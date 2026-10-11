// Live connection check. Uses ONLY the public key from config.js. Shows what is working and what still needs setting up.
(function () {
  var C = window.VFCore, cfg = window.VF_CONFIG || {}, list = document.getElementById("results");
  var ICON = { pass: "✓ ", fail: "✗ ", warn: "! ", info: "i " };
  function add(state, title, detail) {
    var li = document.createElement("li"); li.className = "chk " + state;
    var b = document.createElement("b"); b.textContent = ICON[state] + title;
    var s = document.createElement("span"); s.textContent = detail || "";
    li.appendChild(b); li.appendChild(s); list.appendChild(li);
  }
  var TEXT = { not_configured: "config.js has no Supabase URL / key yet.", bad_url: "SUPABASE_URL is not a valid Supabase address.", bad_key: "SUPABASE_ANON_KEY looks invalid.", secret_key: "A SECRET key is in config.js. Remove it and rotate it in Supabase now." };
  var problem = C.configProblem(cfg);
  if (problem) { add("fail", "config.js", TEXT[problem]); return; }
  var base = String(cfg.SUPABASE_URL).replace(/\/$/, ""), H = { apikey: cfg.SUPABASE_ANON_KEY };
  add("pass", "config.js has a valid Project URL and a public key", base);
  var site = C.siblingUrl(location.href, "./");
  add("info", "Supabase > Authentication > URL Configuration: Site URL", site);
  add("info", "…and add these Redirect URLs", C.siblingUrl(location.href, "auth-callback.html") + "  |  " + C.siblingUrl(location.href, "reset-password.html"));
  function call(path, opts) {
    return window.fetch(base + path, opts).then(function (r) { return r.json().catch(function () { return null; }).then(function (b) { return { status: r.status, body: b }; }); });
  }
  call("/auth/v1/settings", { headers: H }).then(function (r) {
    var s = r.body || {}, ext = s.external || {};
    if (r.status !== 200) return add("fail", "Reach Supabase Auth", "HTTP " + r.status + ". Check the URL and key.");
    add("pass", "Supabase Auth is reachable");
    add(ext.email ? "pass" : "fail", "Email sign-in is enabled");
    add(s.mailer_autoconfirm === false ? "pass" : "fail", "Email confirmation is required", s.mailer_autoconfirm === false ? "" : "Confirm email is OFF: anyone could sign up with an inbox they don't own.");
    add(s.disable_signup ? "warn" : "info", s.disable_signup ? "New signups are disabled" : "New signups are allowed");
    if (cfg.GOOGLE_ENABLED === true) add(ext.google ? "pass" : "fail", "Google provider", ext.google ? "Enabled in Supabase." : "config.js shows the Google button but the Google provider is OFF in Supabase.");
    else add("info", "Google button is off in config.js", ext.google ? "Provider is enabled in Supabase; set GOOGLE_ENABLED to true to show the button." : "");
  }).catch(function () { add("fail", "Reach Supabase Auth", "Network error or blocked. Check the Project URL."); })
  .then(function () { return call("/rest/v1/rpc/verify_public_profile", { method: "POST", headers: { apikey: cfg.SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ p_public_id: "VF-2222-2222" }) }); })
  .then(function (r) {
    if (r.status === 200 && r.body && r.body.found === false) add("pass", "Database migration is applied", "The public verification function answers.");
    else if (r.status === 404) add("fail", "Database migration is NOT applied", "Run supabase/migrations/20261010000000_identity_core.sql in the SQL Editor.");
    else add("warn", "Database check gave an unexpected answer", "HTTP " + r.status);
  }).catch(function () { add("warn", "Database check could not run"); })
  .then(function () { return call("/rest/v1/profiles?select=id&limit=1", { headers: H }); })
  .then(function (r) {
    var locked = r.status === 401 || r.status === 403 || (r.body && r.body.code === "42501");
    if (locked) add("pass", "Anonymous visitors cannot read profiles");
    else if (r.status === 200 && Array.isArray(r.body) && r.body.length === 0) add("warn", "Profiles table answers anonymous requests", "Rows are hidden by RLS, but anonymous access should be fully denied. Re-run the migration grants.");
    else if (r.status === 200) add("fail", "Anonymous visitors can read profiles", "Fix the database access rules immediately.");
    else if (r.status === 404) add("fail", "profiles table not found", "Migration not applied.");
    else add("warn", "Unexpected answer for profiles", "HTTP " + r.status);
  }).catch(function () { add("warn", "Profiles check could not run"); });
})();
