# Vish Flow Identity System: Phase 0 plan, threat model and status

## 1. Inspection result (Phase 0)
- Existing site: static HTML, CSS and JavaScript (not React/TypeScript). No backend, no database, no authentication, no environment variables. The Google Form is the only application path.
- No Supabase project, email sender, OAuth credentials or production domain exist yet. These must be created by the owner.
- Decision: keep the existing site and design untouched. Build the identity backend first, as a Supabase migration that can be tested on its own. The React/TypeScript migration and the auth screens come after the database is verified.

## 2. What was built and tested in this milestone
`supabase/migrations/20261010000000_identity_core.sql` (rollback in `supabase/rollbacks/`):
- Immutable public Vish Flow ID (`VF-XXXX-XXXX`, 40 bits of secure randomness, 32-symbol alphabet, no personal data). Uniqueness enforced by a primary key. A registry that cannot be deleted from means an ID is never reused.
- Profile and `student` role created automatically in the same transaction as signup (idempotent; signup fails if an ID cannot be allocated). Roles from signup metadata are ignored.
- Account status: pending_verification becomes active when the email is confirmed; suspended and disabled accounts lose staff powers and cannot edit their profile or be publicly verified.
- RBAC: student, mentor, reviewer, admin, super_admin. Deny by default; clients have no write access to roles, status, public ID or credentials. Privileged changes go through `SECURITY DEFINER` functions that check the actor, require a reason, forbid self-changes and write an append-only audit log.
- Credentials: issue and status change by reviewer/admin only, never to oneself, revoked is final, every event recorded.
- Public verification: `verify_public_profile` and `verify_credential` return only explicitly public fields. Unknown, private and inactive profiles give the same "not found" answer. `identity_proofed` is always false because no identity proofing exists.
- Row Level Security on every table.

`supabase/local-tests/`: 46 automated checks. All pass on a local PostgreSQL 16 with a small stand-in for Supabase's `auth` schema (`00_local_supabase_shim.sql`, local only). The rollback script was also run.

## 3. NOT done yet (and not claimed)
- Never run against a real Supabase project. Auth hooks and `auth.uid()` behave the same in principle, but must be re-tested there.
- No frontend: sign up, login, password recovery, profile page, QR code, Security Center, admin console, `/verify/:id` page.
- Provider configuration: email confirmation, SMTP sender, redirect URLs, Google OAuth, passkeys, MFA enforcement and auth rate limits are dashboard settings.
- Tables still missing: internship_applications, project_submissions, mentor assignments, identity_verifications, consent_records, account export and deletion workflow.
- Rate limiting and caching for the public verification functions (must be done at the API gateway, an Edge Function or a CDN; the database cannot do it).
- Signed, portable (W3C VC 2.0) credentials: deliberately out of scope for now.
- Browser tests on mobile and desktop; a bundle scan for secrets; monitoring and backups.

## 4. Threat model (summary)
| Threat | Control | Status |
|---|---|---|
| Privilege escalation (self-assign admin) | No client writes to roles; super_admin-only function; role metadata ignored | tested |
| Reading others' data (IDOR) | RLS ownership policies | tested |
| Fake or self-issued certificates | Issuer-only function, no self-issue, audit trail | tested |
| Revoked credential shown as valid | Status read live from the database | tested |
| Leaking private data on public page | Whitelisted JSON fields; private looks like unknown | tested |
| Tampering with audit history | Update and delete blocked by trigger | tested |
| Public ID enumeration or scraping | 40-bit space helps but is not enough alone | needs gateway rate limit |
| Account takeover, brute force, email abuse | Provider settings, MFA, rate limits | needs configuration |
| Service-role key leaked to browser | Only the anon key in frontend; key kept in server secrets | process rule |
| XSS in profile fields | Length limits in DB; frontend must escape output | frontend work |

## 5. Next milestones
1. Create the Supabase project, apply the migration, re-run the tests there, configure email, redirect URLs and rate limits.
2. Frontend auth (sign up, confirm email, login, recovery) and the profile page.
3. Public verify page and QR code, with gateway rate limiting.
4. Security Center and MFA.
5. Admin console, then applications, submissions, mentor assignments.
6. Production checks: secret scan, monitoring, backup and recovery drill.

## 6. First super admin (run once, by the project owner, in the SQL editor)
```sql
insert into public.user_roles(user_id, role)
select id, 'super_admin' from public.profiles where id = 'OWNER-USER-UUID';
```
