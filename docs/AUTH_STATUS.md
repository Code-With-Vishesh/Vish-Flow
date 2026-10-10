# Vish Flow authentication: status and setup

Legend: **Implemented** = code exists. **Tested (local/mocked)** = automated tests pass without a real Supabase. **Verified (real Supabase)** = checked against your actual project. **Blocked** = needs configuration or later work.

| Feature | Implemented | Tested (local/mocked) | Verified (real Supabase) |
|---|---|---|---|
| Database: IDs, roles, RLS, credentials, audit | Yes | Yes, 46 checks on local Postgres with a stand-in `auth` schema | **No** |
| Signup page (`signup.html`) | Yes | Mocked SDK | No |
| Login page (`login.html`), generic failure message | Yes | Mocked SDK | No |
| Forgot / reset password pages | Yes | Forgot: mocked SDK. Reset: not tested | No |
| Email confirmation callback (`auth-callback.html`) | Yes | Missing-config only | No |
| Dashboard, profile (own ID, edit allowed fields), security (password, sign out others/everywhere) | Yes | Missing-config only | No |
| Open-redirect protection, config/secret-key refusal | Yes | Yes | n/a |
| Permanent public ID created at signup | Yes (DB trigger) | Yes (DB tests) | No |
| Real email delivery | n/a | n/a | **Blocked: needs your Supabase email settings** |
| `/verify/:id` public page and QR code | **No (Phase E)** | | |
| Admin panel | **No** | | |
| Credential issue/revoke UI | **No** (DB functions exist and are tested) | | |
| MFA / passkeys | **No** | | |
| Production build and browser-bundle secret scan | Static site, no build step | Source scan in tests | No |

Automated tests: `npm install && npm test` (16 tests; needs Node 18+).
Database tests: see `README.md`.

## Setup (you must do these; I cannot access your dashboard)
1. Create a project at supabase.com.
2. SQL editor: run `supabase/migrations/20261010000000_identity_core.sql`.
3. Authentication, URL configuration: Site URL = your site address (for testing `http://localhost:8000`). Add redirect URLs: `<site>/auth-callback.html` and `<site>/reset-password.html`.
4. Authentication, providers, Email: turn **Confirm email** on. Set minimum password length to 10.
5. Authentication, SMTP: configure your own sender for real delivery (the built-in sender is heavily limited). Review the rate limits.
6. Project settings, API: copy the **Project URL** and the **anon / publishable** key into `config.js`. Never use the `service_role` or secret key. The pages refuse to run if one is found.
7. Serve the folder over http (not by double-clicking): `python3 -m http.server 8000` then open http://localhost:8000.
8. Create the first super admin once, by SQL (see `SECURITY_PLAN.md`).

## Manual end-to-end checklist (record results yourself)
1. Sign up with a real email: you see "Check your email". 2. Try to log in before confirming: it fails. 3. Open the email link: you land on the dashboard. 4. Dashboard shows a `VF-XXXX-XXXX` ID. 5. Edit profile and save. 6. Log out and back in. 7. Forgot password: email arrives, link opens the reset form, new password works, old one doesn't. 8. Create a second account: it can't see the first account's data (try the browser console: `select` on profiles returns only its own row). 9. Open `dashboard.html` logged out: you are sent to login. 10. In the browser, view source/network: no service-role key anywhere.

## Known limitations
- A static site keeps the Supabase session in the browser's local storage (the SDK default). Any XSS bug could expose it. Mitigations used: all page output uses `textContent`, no inline user HTML. Not yet added: a Content-Security-Policy header (set it at your host). Cookie-based sessions need a server.
- Page "protection" (redirect to login) is only a convenience. The real boundary is Row Level Security.
- The confirmation link only completes automatically in the same browser that signed up (PKCE). On another device the user can still sign in after confirming.
- If profile creation ever failed, the signup itself fails (database trigger). Support-assisted repair needs a server function and is not built.
- Clean URLs such as `/signup` depend on your host (Netlify and Vercel do this for `.html` files).
- Public verification rate limiting must be set at the gateway when Phase E is built.

## Remaining phases
D: final RLS/role review against the real project and admin protections. E: `/verify/:id`, QR, credential status page. F: security center extras (MFA), more tests. G: real-project test run, bundle scan, deployment.
