-- Run on a database where users existed BEFORE the identity migrations (see README of this test in CI notes).
create schema if not exists t;
create or replace function t.ok(c boolean, name text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', name; end if; raise notice 'PASS: %', name; end $$;
create or replace function t.denied(q text, name text) returns void language plpgsql as $$
begin begin execute q; exception when others then raise notice 'PASS: % (%)', name, sqlerrm; return; end; raise exception 'FAIL (was allowed): %', name; end $$;
create or replace function t.as_user(u uuid) returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); set role authenticated; end $$;
create or replace function t.as_anon() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); set role anon; end $$;
grant usage on schema t to anon, authenticated; grant execute on all functions in schema t to public;

-- backfill of accounts that pre-date the trigger
select t.ok((select count(*) from profiles where id in ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2'))=2, 'legacy accounts were backfilled');
select t.ok((select public_id ~ '^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$' and account_status='active' from profiles where id='00000000-0000-0000-0000-0000000000a1'), 'confirmed legacy account: valid ID, active');
select t.ok((select account_status from profiles where id='00000000-0000-0000-0000-0000000000a2')='pending_verification', 'unconfirmed legacy account stays pending');
select t.ok((select count(*) from user_roles where user_id='00000000-0000-0000-0000-0000000000a1' and role='student')=1, 'legacy account got the student role only');
select t.ok(not exists(select 1 from user_roles where role in ('admin','super_admin','reviewer','mentor')), 'nobody was made privileged by the backfill');

-- self-heal for the signed-in user
alter table auth.users disable trigger on_auth_user_created;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b1','m@x.test',now(),'{}'),('00000000-0000-0000-0000-0000000000b2','n@x.test',now(),'{}');
alter table auth.users enable trigger on_auth_user_created;
select t.ok((select count(*) from profiles where id in ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2'))=0, 'precondition: accounts without profiles');
select t.as_user('00000000-0000-0000-0000-0000000000b1');
select ensure_my_profile();
select ensure_my_profile();
select t.ok((select count(*) from profiles)=1 and (select public_id from profiles) ~ '^VF-', 'signed-in user created exactly one own profile (idempotent)');
select t.denied($$select ensure_profile('00000000-0000-0000-0000-0000000000b2')$$, 'users cannot create a profile for someone else');
select t.as_anon();
select t.denied($$select ensure_my_profile()$$, 'anonymous cannot call ensure_my_profile');
reset role;
select t.ok((select count(*) from profiles where id='00000000-0000-0000-0000-0000000000b2')=0, 'the other account was not touched');
select t.ok((select count(*) from public_id_registry)=(select count(distinct public_id) from profiles), 'no orphan or duplicate IDs');
select 'ALL ENSURE-PROFILE TESTS PASSED' as result;
