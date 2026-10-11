-- Self-healing profiles + backfill.
-- Problem: an account created BEFORE the signup trigger worked has no profile row, so the dashboard shows
-- "Your profile isn't ready yet" and has no Vish Flow ID. This migration (1) gives every existing account a profile
-- and (2) lets a signed-in user safely create their OWN missing profile (idempotent, no duplicates, own account only).
begin;

create or replace function public.ensure_profile(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare pid text; tries int := 0; u auth.users%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('vf_profile_' || p_user::text));        -- two simultaneous calls cannot both create one
  select * into u from auth.users where id = p_user;
  if not found then raise exception 'unknown user'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    loop
      pid := public.generate_public_id();
      begin insert into public.public_id_registry(public_id) values (pid); exit;
      exception when unique_violation then
        tries := tries + 1; if tries > 10 then raise exception 'could not allocate public id'; end if;
      end;
    end loop;
    insert into public.profiles(id, public_id, display_name, account_status)
    values (u.id, pid, left(u.raw_user_meta_data->>'display_name', 80),
            case when u.email_confirmed_at is not null then 'active' else 'pending_verification' end::public.account_status);
  end if;
  insert into public.user_roles(user_id, role) select p_user, 'student' where not exists (select 1 from public.user_roles where user_id = p_user);
end $$;

create or replace function public.ensure_my_profile() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in' using errcode = '42501'; end if;
  perform public.ensure_profile(auth.uid());                                      -- only ever the caller's own account
end $$;

revoke execute on function public.ensure_profile(uuid), public.ensure_my_profile() from public, anon, authenticated;
grant execute on function public.ensure_my_profile() to authenticated;            -- ensure_profile(uuid) stays internal
grant usage on schema public to anon, authenticated;                               -- API roles need schema visibility; table grants/RLS still restrict data

-- Route new signups through the same lock-protected, idempotent path used by profile recovery.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ensure_profile(new.id);
  return new;
end $$;

-- Backfill: every existing account gets a profile + Vish Flow ID; confirmed emails become active.
do $$ declare r record; begin
  for r in select u.id from auth.users u left join public.profiles p on p.id = u.id where p.id is null loop
    perform public.ensure_profile(r.id);
  end loop;
end $$;
update public.profiles p set account_status = 'active'
  from auth.users u where u.id = p.id and u.email_confirmed_at is not null and p.account_status = 'pending_verification';
commit;
