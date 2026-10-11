-- READ-ONLY health check. Paste into Supabase > SQL Editor and Run. Every row should say PASS (NOTE is informational).
do $$ begin
  if to_regclass('public.profiles') is null then
    raise exception 'Migration not applied: run supabase/migrations/20261010000000_identity_core.sql first';
  end if;
end $$;

-- Signup runs under search_path=public (as Supabase Auth does). Make sure ID generation works there.
do $$ declare sp text := current_setting('search_path'); begin
  perform set_config('search_path', 'public', true);
  begin perform public.generate_public_id();
  exception when others then
    perform set_config('search_path', sp, true);
    raise exception 'Signups would FAIL (%). Run supabase/migrations/20261012000000_fix_random_without_pgcrypto.sql', sqlerrm;
  end;
  perform set_config('search_path', sp, true);
end $$;

with checks(name, ok, required, detail) as (
  select 'table public.' || t, to_regclass('public.' || t) is not null, true, null::text
    from unnest(array['profiles','user_roles','audit_logs','credentials','credential_events','public_id_registry']) t
  union all
  select 'row level security on ' || c.relname, c.relrowsecurity, true, null
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  union all select 'signup trigger creates profile + Vish Flow ID',
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass and not tgisinternal), true, null
  union all select 'email-confirmed trigger activates account',
    exists (select 1 from pg_trigger where tgname = 'on_auth_user_confirmed' and tgrelid = 'auth.users'::regclass and not tgisinternal), true, null
  union all select 'anonymous visitors cannot read profiles', not has_table_privilege('anon', 'public.profiles', 'SELECT'), true, null
  union all select 'client roles can use public schema', has_schema_privilege('anon', 'public', 'USAGE') and has_schema_privilege('authenticated', 'public', 'USAGE'), true, null
  union all select 'users cannot change account_status', not has_column_privilege('authenticated', 'public.profiles', 'account_status', 'UPDATE'), true, null
  union all select 'users cannot change public_id', not has_column_privilege('authenticated', 'public.profiles', 'public_id', 'UPDATE'), true, null
  union all select 'users cannot write roles',
    not has_table_privilege('authenticated', 'public.user_roles', 'INSERT') and not has_table_privilege('authenticated', 'public.user_roles', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.user_roles', 'DELETE'), true, null
  union all select 'users cannot issue credentials directly', not has_table_privilege('authenticated', 'public.credentials', 'INSERT'), true, null
  union all select 'anonymous can run public verification', has_function_privilege('anon', 'public.verify_public_profile(text)', 'EXECUTE'), true, null
  union all select 'anonymous cannot run admin functions',
    not has_function_privilege('anon', 'public.admin_set_role(uuid,public.app_role,boolean,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.issue_credential(text,text,text,timestamptz,boolean,text)', 'EXECUTE'), true, null
  union all select 'signed-in users can self-heal their own profile', has_function_privilege('authenticated', 'public.ensure_my_profile()', 'EXECUTE'), true,
    'If FAIL: run supabase/migrations/20261013000000_ensure_profile_and_backfill.sql'
  union all select 'ensure_profile(uuid) is internal only', not has_function_privilege('authenticated', 'public.ensure_profile(uuid)', 'EXECUTE'), true, null
  union all select 'every signed-up user has a profile',
    not exists (select 1 from auth.users u left join public.profiles p on p.id = u.id where p.id is null), true,
    (select count(*) || ' users, ' || (select count(*) from public.profiles) || ' profiles' from auth.users)
  union all select 'a super_admin exists', exists (select 1 from public.user_roles where role = 'super_admin'), false,
    'If NOTE: create the first super admin with the SQL in docs/CONNECT_SUPABASE.md'
)
select name, case when ok then 'PASS' when required then 'FAIL' else 'NOTE' end as result, detail from checks order by ok, name;
