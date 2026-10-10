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
  function isPublicId(s) { return typeof s === "string" && /^VF-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(s); }
  var api = { safeNext: safeNext, validateEmail: validateEmail, validatePassword: validatePassword, keyRole: keyRole, configProblem: configProblem, siblingUrl: siblingUrl, isPublicId: isPublicId };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VFCore = api;
})(typeof window !== "undefined" ? window : globalThis);
