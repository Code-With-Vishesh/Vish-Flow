-- FIX: on Supabase, pgcrypto lives in the "extensions" schema, which is NOT on the search_path used when Supabase Auth runs the
-- signup trigger. gen_random_bytes() was therefore not found and EVERY new signup (email or Google) failed with
-- "Database error saving new user". This migration removes the pgcrypto dependency: gen_random_uuid() is built into
-- PostgreSQL (13+) and uses the same secure random source. Safe to run once; it does not touch existing data.
begin;

create or replace function public.generate_public_id() returns text language plpgsql volatile
set search_path = public, pg_catalog as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  -- 6 random bytes from one UUID + 2 from another (UUID bytes 0-5 contain no fixed version/variant bits)
  b bytea := decode(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4), 'hex');
  o text := 'VF-'; i int;
begin
  for i in 0..7 loop
    if i = 4 then o := o || '-'; end if;
    o := o || substr(alphabet, (get_byte(b, i) & 31) + 1, 1);
  end loop;
  return o;
end $$;

alter table public.credentials alter column credential_code
  set default ('VFC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

commit;
