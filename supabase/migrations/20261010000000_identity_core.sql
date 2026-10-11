-- Vish Flow identity core: public IDs, profiles, roles, credentials, audit, public verification.
-- Assumes Supabase (auth.users, auth.uid(), roles anon/authenticated). Apply once; see .down.sql to roll back.
begin;
create extension if not exists pgcrypto;

create type public.app_role as enum ('student','mentor','reviewer','admin','super_admin');
create type public.account_status as enum ('pending_verification','active','suspended','disabled','deletion_requested','deleted');
create type public.profile_visibility as enum ('private','public');
create type public.credential_status as enum ('valid','suspended','revoked');

-- Registry of every public ID ever issued. Rows can never be deleted, so an ID is never reassigned.
create table public.public_id_registry (public_id text primary key, issued_at timestamptz not null default now());

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,   -- provider's immutable user id
  public_id text not null unique references public.public_id_registry(public_id),
  display_name text check (char_length(display_name) <= 80),
  bio text check (char_length(bio) <= 500),
  visibility public.profile_visibility not null default 'private',
  account_status public.account_status not null default 'pending_verification',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_id_format check (public_id ~ '^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$')
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid, action text not null, target_type text, target_id text, reason text,
  result text not null default 'success', context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  credential_code text not null unique default ('VFC-' || upper(encode(gen_random_bytes(6),'hex'))),
  subject_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('participation','project_completion','certificate')),
  title text not null check (char_length(title) between 1 and 120),
  issuer text not null default 'Vish Flow',
  issued_by uuid not null references public.profiles(id),
  issued_at timestamptz not null default now(),
  valid_until timestamptz,
  status public.credential_status not null default 'valid',
  is_public boolean not null default false,
  evidence_ref text                                   -- internal only, never returned publicly
);
create index on public.credentials (subject_id);

create table public.credential_events (
  id bigint generated always as identity primary key,
  credential_id uuid not null references public.credentials(id),
  event text not null check (event in ('issued','suspended','reinstated','revoked')),
  actor_id uuid not null, reason text not null, created_at timestamptz not null default now()
);

-- ---------- helpers ----------
create function public.generate_public_id() returns text language plpgsql volatile as $$
declare alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; b bytea := gen_random_bytes(8); o text := 'VF-'; i int;
begin
  for i in 0..7 loop
    if i = 4 then o := o || '-'; end if;
    o := o || substr(alphabet, (get_byte(b,i) & 31) + 1, 1);   -- 32 symbols: no modulo bias
  end loop;
  return o;
end $$;

create function public.forbid_change() returns trigger language plpgsql as $$
begin raise exception '% on % is not allowed', tg_op, tg_table_name using errcode = '42501'; end $$;
create trigger audit_append_only before update or delete on public.audit_logs for each row execute function public.forbid_change();
create trigger registry_keep_ids before update or delete on public.public_id_registry for each row execute function public.forbid_change();

create function public.protect_profile_columns() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.public_id <> old.public_id or new.created_at <> old.created_at then
    raise exception 'immutable profile column' using errcode = '42501';
  end if;
  new.updated_at := now(); return new;
end $$;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_columns();

-- Active actors only: suspended or disabled staff lose their privileges immediately.
create function public.actor_has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles ur join profiles p on p.id = ur.user_id
                 where ur.user_id = auth.uid() and ur.role = any(roles) and p.account_status = 'active')
$$;

create function public.write_audit(p_action text, p_target_type text, p_target_id text, p_reason text, p_ctx jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(actor_id, action, target_type, target_id, reason, context)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_reason, p_ctx)
$$;

-- ---------- account creation (idempotent, fails the signup if an ID cannot be allocated) ----------
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare pid text; tries int := 0;
begin
  if exists (select 1 from profiles where id = new.id) then return new; end if;
  loop
    pid := generate_public_id();
    begin insert into public_id_registry(public_id) values (pid); exit;
    exception when unique_violation then
      tries := tries + 1; if tries > 10 then raise exception 'could not allocate public id'; end if;
    end;
  end loop;
  insert into profiles(id, public_id, display_name, account_status)
  values (new.id, pid, left(new.raw_user_meta_data->>'display_name', 80),
          case when new.email_confirmed_at is not null then 'active' else 'pending_verification' end::account_status)
  on conflict (id) do nothing;
  insert into user_roles(user_id, role) values (new.id, 'student') on conflict do nothing;  -- never from user input
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.handle_user_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles set account_status = 'active' where id = new.id and account_status = 'pending_verification';
  return new;
end $$;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_user_confirmed();

-- ---------- privileged operations (the only way to change roles, status, credentials) ----------
create function public.admin_set_account_status(p_user uuid, p_status public.account_status, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.actor_has_role('admin','super_admin') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_status not in ('active','suspended','disabled') then raise exception 'status not allowed'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason required'; end if;
  if p_user = auth.uid() then raise exception 'cannot change own status' using errcode = '42501'; end if;
  if exists (select 1 from user_roles where user_id = p_user and role in ('admin','super_admin'))
     and not public.actor_has_role('super_admin') then raise exception 'not authorized' using errcode = '42501'; end if;
  update profiles set account_status = p_status where id = p_user;
  if not found then raise exception 'unknown user'; end if;
  perform public.write_audit('account_status_changed','profile',p_user::text,p_reason,jsonb_build_object('status',p_status));
end $$;

create function public.admin_set_role(p_user uuid, p_role public.app_role, p_grant boolean, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.actor_has_role('super_admin') then raise exception 'not authorized' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'cannot change own roles' using errcode = '42501'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason required'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'unknown user'; end if;
  if p_grant then
    insert into user_roles(user_id, role, granted_by) values (p_user, p_role, auth.uid()) on conflict do nothing;
  else
    if p_role = 'super_admin' and (select count(*) from user_roles where role = 'super_admin' and user_id <> p_user) = 0
      then raise exception 'cannot remove the last super_admin'; end if;
    delete from user_roles where user_id = p_user and role = p_role;
  end if;
  perform public.write_audit(case when p_grant then 'role_granted' else 'role_revoked' end,'profile',p_user::text,p_reason,jsonb_build_object('role',p_role));
end $$;

create function public.issue_credential(p_subject_public_id text, p_type text, p_title text,
  p_valid_until timestamptz default null, p_is_public boolean default false, p_evidence_ref text default null) returns text
language plpgsql security definer set search_path = public as $$
declare subj profiles%rowtype; code text; cid uuid;
begin
  if not public.actor_has_role('reviewer','admin','super_admin') then raise exception 'not authorized' using errcode = '42501'; end if;
  select * into subj from profiles where public_id = upper(trim(p_subject_public_id)) and account_status = 'active';
  if not found then raise exception 'subject not found'; end if;
  if subj.id = auth.uid() then raise exception 'cannot issue a credential to yourself' using errcode = '42501'; end if;
  insert into credentials(subject_id, type, title, issued_by, valid_until, is_public, evidence_ref)
  values (subj.id, p_type, p_title, auth.uid(), p_valid_until, p_is_public, p_evidence_ref)
  returning id, credential_code into cid, code;
  insert into credential_events(credential_id, event, actor_id, reason) values (cid, 'issued', auth.uid(), 'issued');
  perform public.write_audit('credential_issued','credential',code,'issued',jsonb_build_object('type',p_type));
  return code;
end $$;

create function public.set_credential_status(p_code text, p_status public.credential_status, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c credentials%rowtype;
begin
  if not public.actor_has_role('reviewer','admin','super_admin') then raise exception 'not authorized' using errcode = '42501'; end if;
  if coalesce(trim(p_reason),'') = '' then raise exception 'reason required'; end if;
  select * into c from credentials where credential_code = p_code for update;
  if not found then raise exception 'unknown credential'; end if;
  if c.subject_id = auth.uid() then raise exception 'cannot change your own credential' using errcode = '42501'; end if;
  if c.status = 'revoked' then raise exception 'revoked credentials are final'; end if;
  if c.status = p_status then return; end if;
  update credentials set status = p_status where id = c.id;
  insert into credential_events(credential_id, event, actor_id, reason)
  values (c.id, case p_status when 'revoked' then 'revoked' when 'suspended' then 'suspended' else 'reinstated' end, auth.uid(), p_reason);
  perform public.write_audit('credential_'||p_status,'credential',p_code,p_reason);
end $$;

-- ---------- public verification (only explicitly public fields; identical "not found" for unknown/private/inactive) ----------
create function public.verify_public_profile(p_public_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pr profiles%rowtype; creds jsonb; ev boolean; pid text := upper(trim(coalesce(p_public_id,'')));
begin
  if pid !~ '^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' then return jsonb_build_object('found', false); end if;
  select * into pr from profiles where public_id = pid and visibility = 'public' and account_status = 'active';
  if not found then return jsonb_build_object('found', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('credential_code', c.credential_code,'type', c.type,'title', c.title,'issuer', c.issuer,
         'issued_at', c.issued_at,'status', case when c.status = 'valid' and c.valid_until < now() then 'expired' else c.status::text end)
         order by c.issued_at desc), '[]'::jsonb) into creds from credentials c where c.subject_id = pr.id and c.is_public;
  select (email_confirmed_at is not null) into ev from auth.users where id = pr.id;
  return jsonb_build_object('found', true,'public_id', pr.public_id,'display_name', pr.display_name,'member_since', pr.created_at::date,
         'email_verified', coalesce(ev,false),'identity_proofed', false,'credentials', creds);
end $$;

create function public.verify_credential(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c credentials%rowtype; pr profiles%rowtype;
begin
  select * into c from credentials where credential_code = upper(trim(coalesce(p_code,'')));
  if not found then return jsonb_build_object('found', false); end if;
  select * into pr from profiles where id = c.subject_id and visibility = 'public' and account_status = 'active';
  return jsonb_build_object('found', true,'credential_code', c.credential_code,'type', c.type,'title', c.title,'issuer', c.issuer,
    'issued_at', c.issued_at,'status', case when c.status = 'valid' and c.valid_until < now() then 'expired' else c.status::text end,
    'holder_public_id', pr.public_id,'holder_display_name', pr.display_name);   -- null when the holder's profile is not public
end $$;

-- ---------- row level security + grants (deny by default) ----------
alter table public.public_id_registry enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.user_roles, public.audit_logs, public.credentials, public.credential_events to authenticated;
grant update (display_name, bio, visibility) on public.profiles to authenticated;   -- no client writes to status, id, public_id or roles

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.actor_has_role('reviewer','admin','super_admin'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and account_status in ('pending_verification','active')) with check (id = auth.uid());
create policy roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.actor_has_role('admin','super_admin'));
create policy audit_select on public.audit_logs for select to authenticated using (public.actor_has_role('admin','super_admin'));
create policy credentials_select on public.credentials for select to authenticated
  using (subject_id = auth.uid() or public.actor_has_role('reviewer','admin','super_admin'));
create policy cred_events_select on public.credential_events for select to authenticated
  using (public.actor_has_role('reviewer','admin','super_admin'));

grant execute on function public.actor_has_role(public.app_role[]) to authenticated;
grant execute on function public.verify_public_profile(text), public.verify_credential(text) to anon, authenticated;
grant execute on function public.admin_set_account_status(uuid, public.account_status, text),
  public.admin_set_role(uuid, public.app_role, boolean, text),
  public.issue_credential(text, text, text, timestamptz, boolean, text),
  public.set_credential_status(text, public.credential_status, text) to authenticated;
commit;
