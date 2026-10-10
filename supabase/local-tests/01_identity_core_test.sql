-- Runs against a LOCAL database after 00_local_supabase_shim.sql and the migration. Every check raises on failure.
create schema if not exists t;
create or replace function t.ok(c boolean, name text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', name; end if; raise notice 'PASS: %', name; end $$;
create or replace function t.denied(q text, name text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then raise notice 'PASS: % (%)', name, sqlerrm; return; end;
  raise exception 'FAIL (was allowed): %', name;
end $$;
create or replace function t.as_user(u uuid) returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false); set role authenticated; end $$;
create or replace function t.as_anon() returns void language plpgsql as $$
begin reset role; perform set_config('request.jwt.claim.sub','',false); set role anon; end $$;
grant usage on schema t to anon, authenticated;
grant execute on all functions in schema t to public;

-- fixtures (as superuser, the way an auth provider would insert users)
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@x.test',now(),'{"display_name":"Alice","role":"super_admin"}'),
 ('00000000-0000-0000-0000-00000000000b','b@x.test',now(),'{"display_name":"Bob"}'),
 ('00000000-0000-0000-0000-0000000000f1','rev@x.test',now(),'{}'),
 ('00000000-0000-0000-0000-0000000000f2','men@x.test',now(),'{}'),
 ('00000000-0000-0000-0000-0000000000f3','adm@x.test',now(),'{}'),
 ('00000000-0000-0000-0000-0000000000f4','root@x.test',now(),'{}'),
 ('00000000-0000-0000-0000-0000000000f5','pend@x.test',null,'{}');
insert into user_roles(user_id,role) values ('00000000-0000-0000-0000-0000000000f1','reviewer'),
 ('00000000-0000-0000-0000-0000000000f2','mentor'),('00000000-0000-0000-0000-0000000000f3','admin'),('00000000-0000-0000-0000-0000000000f4','super_admin');

-- identity
select t.ok((select count(*) from profiles)=7 and (select count(distinct public_id) from profiles)=7, 'every new account gets exactly one unique public ID');
select t.ok((select bool_and(public_id ~ '^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$') from profiles), 'public IDs have the expected format');
select t.ok((select count(*) from public_id_registry)=7, 'IDs are recorded in the registry');
select t.ok((select account_status from profiles where id='00000000-0000-0000-0000-0000000000f5')='pending_verification', 'unconfirmed email -> pending_verification');
select t.ok(not exists(select 1 from user_roles where user_id='00000000-0000-0000-0000-00000000000a' and role='super_admin'), 'role in signup metadata is ignored');
update auth.users set email_confirmed_at=now() where id='00000000-0000-0000-0000-0000000000f5';
select t.ok((select account_status from profiles where id='00000000-0000-0000-0000-0000000000f5')='active', 'email confirmation activates the account');
select t.denied($$update profiles set public_id='VF-2222-2222' where id='00000000-0000-0000-0000-00000000000a'$$, 'public ID is immutable');
select t.denied($$delete from public_id_registry$$, 'public IDs are never freed for reuse');
select t.denied($$insert into profiles(id,public_id) select id, 'VF-2222-2222' from auth.users limit 1$$, 'duplicate profile creation is rejected');

-- row level security
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from profiles)=1, 'user A sees only own profile');
select t.ok((select count(*) from user_roles)=1, 'user A sees only own roles');
select t.denied($$update profiles set account_status='active'$$, 'user cannot edit own account_status');
select t.denied($$update profiles set public_id='VF-3333-3333'$$, 'user cannot edit own public_id');
select t.denied($$insert into user_roles(user_id,role) values ('00000000-0000-0000-0000-00000000000a','admin')$$, 'student cannot grant self admin');
select t.denied($$select admin_set_role('00000000-0000-0000-0000-00000000000a','admin',true,'x')$$, 'admin_set_role denied to student');
select t.denied($$select issue_credential('VF-2222-2222','certificate','x')$$, 'student cannot issue credentials');
select t.denied($$insert into credentials(subject_id,type,title,issued_by) values ('00000000-0000-0000-0000-00000000000a','certificate','x','00000000-0000-0000-0000-00000000000a')$$, 'student cannot insert credentials directly');
update profiles set display_name='Alice A';
select t.ok((select display_name from profiles)='Alice A', 'user can edit own display name');
do $$ declare n int; begin update profiles set display_name='hacked' where id='00000000-0000-0000-0000-00000000000b'; get diagnostics n=row_count; perform t.ok(n=0, 'user A cannot update user B'); end $$;
select t.ok((select count(*) from audit_logs)=0, 'student sees no audit logs');
select t.as_anon();
select t.denied($$select * from profiles$$, 'anonymous cannot read profiles');
select t.denied($$select admin_set_role('00000000-0000-0000-0000-00000000000a','admin',true,'x')$$, 'anonymous cannot call admin functions');

-- mentor has no extra access yet (assignment tables are a later milestone)
select t.as_user('00000000-0000-0000-0000-0000000000f2');
select t.ok((select count(*) from profiles)=1, 'mentor sees only own profile');

-- credentials
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select t.ok((select count(*) from profiles)=7, 'reviewer can look up profiles');
select t.denied($$select issue_credential((select public_id from profiles where id='00000000-0000-0000-0000-0000000000f1'),'certificate','self')$$, 'reviewer cannot issue to self');
select t.denied($$select admin_set_account_status('00000000-0000-0000-0000-00000000000b','suspended','x')$$, 'reviewer cannot suspend accounts');
create temp table codes(k text, v text); grant all on codes to public;
insert into codes select 'pub', issue_credential((select public_id from profiles where id='00000000-0000-0000-0000-00000000000b'),'certificate','Web Dev Internship',null,true,'internal-ref-1');
insert into codes select 'priv', issue_credential((select public_id from profiles where id='00000000-0000-0000-0000-00000000000b'),'participation','Private note',null,false,null);
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from credentials)=2, 'holder sees own credentials only');
select t.denied($$select set_credential_status((select v from codes where k='pub'),'revoked','x')$$, 'holder cannot revoke/alter credential');

-- public verification
reset role; insert into codes select 'bobid', public_id from profiles where id='00000000-0000-0000-0000-00000000000b';
select t.as_anon();
select t.ok((select verify_public_profile((select v from codes where k='bobid'))->>'found')='false', 'private profile looks identical to unknown ID');
select t.as_user('00000000-0000-0000-0000-00000000000b');
update profiles set visibility='public';
select t.as_anon();
do $$ declare r jsonb; pid text; begin
  reset role; select public_id into pid from profiles where id='00000000-0000-0000-0000-00000000000b'; set role anon;
  r := verify_public_profile(pid);
  perform t.ok(r->>'found'='true' and r->>'display_name'='Bob', 'public profile verifies');
  perform t.ok(jsonb_array_length(r->'credentials')=1, 'only public credentials are listed');
  perform t.ok(not (r ? 'email') and not (r ? 'id') and r::text not like '%internal-ref-1%' and r->>'identity_proofed'='false', 'no email, internal ID or evidence leaked; identity not claimed as proofed');
  perform t.ok(verify_public_profile('nonsense')->>'found'='false' and verify_public_profile(null)->>'found'='false', 'invalid IDs return a safe result');
end $$;

-- revocation, suspension, audit
select t.as_user('00000000-0000-0000-0000-0000000000f1');
select set_credential_status((select v from codes where k='pub'),'revoked','test revoke');
select t.denied($$select set_credential_status((select v from codes where k='pub'),'valid','undo')$$, 'revoked credentials are final');
select t.as_anon();
select t.ok((select verify_credential((select v from codes where k='pub'))->>'status')='revoked', 'revoked credential never shows as valid');
select t.ok((select verify_credential('VFC-DOESNOTEXIST')->>'found')='false', 'unknown credential reveals nothing');
select t.as_user('00000000-0000-0000-0000-0000000000f3');
select t.ok((select count(*) from audit_logs)>=3, 'admin can read audit logs of issue/revoke');
select t.denied($$select admin_set_role('00000000-0000-0000-0000-00000000000b','reviewer',true,'x')$$, 'admin cannot manage roles (super_admin only)');
select admin_set_account_status('00000000-0000-0000-0000-00000000000b','suspended','abuse report');
select t.denied($$select admin_set_account_status('00000000-0000-0000-0000-0000000000f4','suspended','x')$$, 'admin cannot suspend a super_admin');
select t.denied($$select admin_set_account_status('00000000-0000-0000-0000-00000000000b','active','')$$, 'sensitive action needs a reason');
select t.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare n int; begin update profiles set bio='x'; get diagnostics n=row_count; perform t.ok(n=0, 'suspended user cannot edit profile'); end $$;
select t.as_anon();
do $$ declare pid text; begin reset role; select public_id into pid from profiles where id='00000000-0000-0000-0000-00000000000b'; set role anon;
  perform t.ok(verify_public_profile(pid)->>'found'='false', 'suspended account is not publicly verifiable'); end $$;
select t.as_user('00000000-0000-0000-0000-0000000000f4');
select admin_set_role('00000000-0000-0000-0000-0000000000f3','admin',false,'rotation');
select t.denied($$select admin_set_role('00000000-0000-0000-0000-0000000000f4','student',true,'self')$$, 'super_admin cannot change own roles');
reset role;
select t.denied($$update audit_logs set reason='tampered'$$, 'audit log is append-only (update)');
select t.denied($$delete from audit_logs$$, 'audit log is append-only (delete)');
select t.ok((select count(*) from pg_tables where schemaname='public' and not rowsecurity)=0, 'row level security enabled on every public table');
select 'ALL TESTS PASSED' as result;
