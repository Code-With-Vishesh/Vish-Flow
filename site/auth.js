// Vish Flow authentication pages. Uses Supabase Auth (PKCE). Page output is written with textContent only (no HTML injection).
(function () {
  var C = window.VFCore, cfg = window.VF_CONFIG || {}, page = document.body.dataset.page;
  var $ = function (s) { return document.querySelector(s); };
  var problem = C.configProblem(cfg), sb = null;
  var WARN = { not_configured: "This site is not connected to Supabase yet. Add your Project URL and anon key to config.js (see docs/AUTH_STATUS.md).",
    bad_url: "The Supabase URL in config.js is not valid.", bad_key: "The Supabase key in config.js is not valid.",
    secret_key: "A secret/service-role key was found in config.js. Remove it now and rotate that key in Supabase: secret keys must never be used in a browser." };
  if (!problem && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  }
  var warnText = problem ? WARN[problem] : (!sb ? "Could not load the authentication library. Check your connection and reload." : "");
  if (warnText && $("#cfgwarn")) { $("#cfgwarn").textContent = warnText; $("#cfgwarn").hidden = false; }
  function msg(t, kind) { var m = $("#msg"); if (!m) return; m.textContent = t || ""; m.className = "msg " + (kind || ""); m.hidden = !t; }
  function busy(f, b) {
    f.querySelectorAll("button,input,textarea,select").forEach(function (e) { e.disabled = b; });
    var s = f.querySelector("[type=submit]"); if (s) { s.dataset.t = s.dataset.t || s.textContent; s.textContent = b ? "Please wait…" : s.dataset.t; }
  }
  function limited(err) { return err && (err.status === 429 || /rate|limit/i.test(err.message || "")); }
  var NET = "Something went wrong. Check your connection and try again.", LIM = "Too many attempts. Please wait a few minutes and try again.";
  function onSubmit(sel, fn) {
    var f = $(sel); if (!f) return;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!sb) return msg(warnText || WARN.not_configured, "err");
      msg(""); var data = new FormData(f); busy(f, true);   // read values BEFORE disabling (disabled fields are excluded)
      Promise.resolve().then(function () { return fn(data, f); }).catch(function () { msg(NET, "err"); }).then(function () { busy(f, false); });
    });
  }
  function text(id, v) { var e = $(id); if (e) e.textContent = v == null ? "—" : v; }
  function need() {                              // UX gate only: real protection is Row Level Security on the server
    if (!sb) return Promise.resolve(null);
    return sb.auth.getUser().then(function (r) {
      if (r.error || !r.data || !r.data.user) { location.replace("login.html?next=" + encodeURIComponent(page + ".html")); return null; }
      return r.data.user;
    });
  }
  function loadProfile(u) { return sb.from("profiles").select("public_id,display_name,bio,account_status,visibility,created_at").eq("id", u.id).maybeSingle(); }
  function bindLogout() { var b = $("#logout"); if (b) b.addEventListener("click", function () { sb.auth.signOut().then(function () { location.assign("login.html"); }); }); }

  if (page === "signup") onSubmit("#form", function (d) {
    var email = (d.get("email") || "").trim(), pw = d.get("password") || "", name = (d.get("name") || "").trim().slice(0, 80);
    if (!C.validateEmail(email)) return msg("Enter a valid email address.", "err");
    var pe = C.validatePassword(pw); if (pe) return msg(pe, "err");
    if (pw !== d.get("confirm")) return msg("Passwords do not match.", "err");
    return sb.auth.signUp({ email: email, password: pw, options: { emailRedirectTo: C.siblingUrl(location.href, "auth-callback.html"), data: name ? { display_name: name } : {} } }).then(function (r) {
      if (limited(r.error)) return msg(LIM, "err");
      if (r.error && r.error.code === "weak_password") return msg("That password is too weak. Try a longer, less common one.", "err");
      if (r.error) return msg("We couldn't create the account. Check your details and try again.", "err");
      msg("Check your email. If this address can be registered, we've sent a confirmation link. You can sign in after confirming.", "ok");
    });
  });

  if (page === "login") {
    var q = new URLSearchParams(location.search);
    if (q.get("reset") === "1") msg("Password updated. Please sign in.", "ok");
    onSubmit("#form", function (d) {
      var email = (d.get("email") || "").trim(), pw = d.get("password") || "";
      if (!C.validateEmail(email) || !pw) return msg("Enter your email and password.", "err");
      return sb.auth.signInWithPassword({ email: email, password: pw }).then(function (r) {
        if (limited(r.error)) return msg(LIM, "err");
        if (r.error) return msg("Incorrect email or password, or your email isn't confirmed yet.", "err");
        location.assign(C.safeNext(q.get("next")));
      });
    });
  }

  if (page === "forgot") onSubmit("#form", function (d) {
    var email = (d.get("email") || "").trim();
    if (!C.validateEmail(email)) return msg("Enter a valid email address.", "err");
    return sb.auth.resetPasswordForEmail(email, { redirectTo: C.siblingUrl(location.href, "reset-password.html") }).then(function (r) {
      if (limited(r.error)) return msg(LIM, "err");
      msg("If an account exists for this address, a reset link is on its way.", "ok");
    });
  });

  if (page === "reset" && sb) {
    var recovered = false, f = $("#form"); f.hidden = true;
    sb.auth.onAuthStateChange(function (ev) { if (ev === "PASSWORD_RECOVERY") { recovered = true; f.hidden = false; msg(""); } });
    setTimeout(function () { if (!recovered) msg("This reset link is invalid or has expired. Please request a new one.", "err"); }, 4000);
    onSubmit("#form", function (d) {
      var pw = d.get("password") || "", pe = C.validatePassword(pw);
      if (pe) return msg(pe, "err");
      if (pw !== d.get("confirm")) return msg("Passwords do not match.", "err");
      return sb.auth.updateUser({ password: pw }).then(function (r) {
        if (r.error) return msg(limited(r.error) ? LIM : "Couldn't update the password. The link may have expired; request a new one.", "err");
        return sb.auth.signOut().then(function () { location.assign("login.html?reset=1"); });
      });
    });
  }

  if (page === "callback" && sb) {
    var qs = new URLSearchParams(location.search + "&" + location.hash.slice(1)), done = false;
    if (qs.get("error") || qs.get("error_description")) { msg("This link is invalid or has expired. If you already confirmed your email, you can sign in.", "err"); done = true; }
    else {
      sb.auth.onAuthStateChange(function (ev, s) { if (!done && s) { done = true; location.replace("dashboard.html"); } });
      setTimeout(function () { if (!done) msg("We couldn't complete the confirmation here. If your email is confirmed, you can sign in.", "err"); }, 6000);
    }
  }

  if (page === "dashboard") need().then(function (u) {
    if (!u) return; bindLogout();
    text("#email-state", u.email_confirmed_at ? "Confirmed" : "Not confirmed yet");
    return Promise.all([loadProfile(u), sb.from("user_roles").select("role")]).then(function (r) {
      var p = r[0].data;
      if (r[0].error || !p) return msg("Your profile isn't ready yet. Refresh in a moment; if this continues, contact support.", "err");
      text("#pid", p.public_id); text("#name", p.display_name || "Not set"); text("#status", p.account_status);
      text("#roles", (r[1].data || []).map(function (x) { return x.role; }).join(", "));
    });
  });

  if (page === "profile") need().then(function (u) {
    if (!u) return; bindLogout();
    return loadProfile(u).then(function (r) {
      var p = r.data; if (r.error || !p) return msg("Your profile isn't ready yet. Refresh in a moment.", "err");
      text("#pid", p.public_id); text("#status", p.account_status);
      $("#f-name").value = p.display_name || ""; $("#f-bio").value = p.bio || ""; $("#f-vis").value = p.visibility;
      $("#copy").addEventListener("click", function () { if (navigator.clipboard) navigator.clipboard.writeText(p.public_id).then(function () { msg("ID copied.", "ok"); }); });
      onSubmit("#form", function (d) {                // only the columns the database lets a user change
        var vis = d.get("visibility") === "public" ? "public" : "private";
        return sb.from("profiles").update({ display_name: (d.get("name") || "").trim().slice(0, 80) || null, bio: (d.get("bio") || "").trim().slice(0, 500) || null, visibility: vis }).eq("id", u.id).select("id").then(function (x) {
          if (x.error || !x.data || !x.data.length) return msg("Couldn't save. Your account may not be active.", "err");
          msg("Profile saved.", "ok");
        });
      });
    });
  });

  if (page === "security") need().then(function (u) {
    if (!u) return; bindLogout();
    onSubmit("#form", function (d) {
      var pw = d.get("password") || "", pe = C.validatePassword(pw);
      if (pe) return msg(pe, "err");
      if (pw !== d.get("confirm")) return msg("Passwords do not match.", "err");
      return sb.auth.updateUser({ password: pw }).then(function (r) {
        if (r.error) return msg(limited(r.error) ? LIM : "Couldn't change the password. Sign in again and retry.", "err");
        msg("Password changed.", "ok");
      });
    });
    function scope(id, s, t) { $(id).addEventListener("click", function () { sb.auth.signOut({ scope: s }).then(function (r) { if (s === "global") return location.assign("login.html"); msg(r.error ? NET : t, r.error ? "err" : "ok"); }); }); }
    scope("#out-others", "others", "Signed out of your other devices."); scope("#out-all", "global", "");
  });

  // Show/hide password toggles (DOM APIs only).
  document.querySelectorAll("input[type=password]").forEach(function (i) {
    var w = document.createElement("div"); w.className = "pwwrap"; i.parentNode.insertBefore(w, i); w.appendChild(i);
    var b = document.createElement("button"); b.type = "button"; b.className = "eye"; b.textContent = "Show"; b.setAttribute("aria-label", "Show password"); b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () { var s = i.type === "password"; i.type = s ? "text" : "password"; b.textContent = s ? "Hide" : "Show"; b.setAttribute("aria-label", s ? "Hide password" : "Show password"); b.setAttribute("aria-pressed", String(s)); });
    w.appendChild(b);
  });
  // Google sign-in: only active when config.js sets GOOGLE_ENABLED: true AND the provider is configured in Supabase.
  var g = $("#google");
  if (g && sb && cfg.GOOGLE_ENABLED === true) {
    g.disabled = false; g.removeAttribute("title"); if ($("#gnote")) $("#gnote").hidden = true;
    g.addEventListener("click", function () { g.disabled = true; sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: C.siblingUrl(location.href, "auth-callback.html") } }).then(function (r) { if (r.error) { g.disabled = false; msg("Google sign-in isn't available right now.", "err"); } }); });
  }
})();
