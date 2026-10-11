// Pure helpers (no DOM, no network) so they can be unit tested in Node.
(function (root) {
  var PAGES = /^(dashboard|profile|security)\.html$/;
  function safeNext(raw) {                       // open-redirect protection: allowlist of internal pages only
    if (typeof raw !== "string") return "dashboard.html";
    var s = raw.trim().replace(/^\/(?!\/)/, "");
    return PAGES.test(s) ? s : "dashboard.html";
  }
  function validateEmail(e) { return typeof e === "string" && e.length <= 254 && /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e); }
  function validatePassword(p) {
    if (typeof p !== "string" || p.length < 10) return "Use at least 10 characters.";
    if (p.length > 72) return "Use at most 72 characters.";
    if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return "Include at least one letter and one number.";
    return null;
  }
  function keyRole(k) {                          // returns "service_role" etc. for legacy JWT keys, "secret" for sb_secret_ keys
    if (typeof k !== "string") return null;
    if (k.indexOf("sb_secret_") === 0) return "secret";
    var p = k.split(".");
    if (p.length !== 3) return null;
    try { return JSON.parse(atob(p[1].replace(/-/g, "+").replace(/_/g, "/"))).role || null; } catch (e) { return null; }
  }
  function configProblem(cfg) {                  // null when usable
    cfg = cfg || {};
    var u = cfg.SUPABASE_URL, k = cfg.SUPABASE_ANON_KEY;
    if (!u || !k || /YOUR/i.test(u + k)) return "not_configured";
    if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)\/?$/i.test(u)) return "bad_url";
    var r = keyRole(k);
    if (r === "service_role" || r === "secret") return "secret_key";
    return k.length < 20 ? "bad_key" : null;
  }
  function siblingUrl(href, file) { var u = new URL(file, href); u.search = ""; u.hash = ""; return u.href; }
  function explainAuthError(code, desc) {         // friendly hint + the provider's own words (shown via textContent only)
    code = String(code || "").slice(0, 60); desc = String(desc || "").replace(/\+/g, " ").replace(/[^\x20-\x7E]/g, "").slice(0, 160);
    var all = (code + " " + desc).toLowerCase(), hint;
    if (/database error saving new user|unexpected_failure/.test(all)) hint = "The database could not create your profile. Run the latest migration (20261012000000_fix_random_without_pgcrypto.sql), then try again.";
    else if (/access_denied/.test(all)) hint = "Sign-in was cancelled or denied. Please try again.";
    else if (/exchange external code|bad_oauth_callback|invalid_client|redirect_uri|provider is not enabled|unsupported provider/.test(all)) hint = "Google sign-in settings look wrong (Client ID/Secret, or the redirect URI in Google Cloud, or the Google provider is off in Supabase).";
    else if (/flow_state|code verifier|bad_oauth_state|pkce/.test(all)) hint = "Start sign-in again in the same browser and use the same site address throughout (don't mix localhost and github.io).";
    else if (/otp_expired|expired/.test(all)) hint = "This link has expired. Please request a new one.";
    else hint = "This link is invalid or has expired. If you already confirmed your email, you can sign in.";
    return hint + (code || desc ? " (Details: " + [code, desc].filter(Boolean).join(" - ") + ")" : "");
  }
  function isPublicId(s) { return typeof s === "string" && /^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(s); }
  var api = { safeNext: safeNext, validateEmail: validateEmail, validatePassword: validatePassword, keyRole: keyRole, configProblem: configProblem, siblingUrl: siblingUrl, isPublicId: isPublicId, explainAuthError: explainAuthError };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VFCore = api;
})(typeof window !== "undefined" ? window : globalThis);
