-- LOCAL TESTING ONLY. Minimal stand-in for the parts of Supabase the migration relies on. Never run on a real project.
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Real Supabase keeps extensions in their own schema, which is NOT on the search_path used by auth triggers.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
