begin;
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
drop table if exists public.credential_events, public.credentials, public.audit_logs, public.user_roles, public.profiles, public.public_id_registry cascade;
drop function if exists public.verify_credential(text), public.verify_public_profile(text), public.set_credential_status(text, public.credential_status, text),
  public.issue_credential(text, text, text, timestamptz, boolean, text), public.admin_set_role(uuid, public.app_role, boolean, text),
  public.admin_set_account_status(uuid, public.account_status, text), public.handle_user_confirmed(), public.handle_new_user(),
  public.write_audit(text, text, text, text, jsonb), public.actor_has_role(public.app_role[]), public.protect_profile_columns(),
  public.forbid_change(), public.generate_public_id();
drop type if exists public.credential_status, public.profile_visibility, public.account_status, public.app_role;
commit;
