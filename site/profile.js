// Vish Flow profile page. Uses Supabase Auth + Row Level Security. All dynamic text is written with textContent (no HTML injection).
(function () {
  var C = window.VFCore, cfg = window.VF_CONFIG || {}, d = document;
  var $ = function (s, r) { return (r || d).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var RM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches), HOVER = !!(window.matchMedia && matchMedia("(hover: hover)").matches);
  var problem = C.configProblem(cfg), sb = null, user = null, prof = null, roles = [], certs = [], dirty = false;
  var WARN = { not_configured: "This site is not connected to Supabase yet. Add your Project URL and anon key to config.js.", bad_url: "The Supabase URL in config.js is not valid.", bad_key: "The Supabase key in config.js is not valid.", secret_key: "A secret key was found in config.js. Remove it and rotate it in Supabase now." };
  if (!problem && window.supabase) sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
  var warnText = problem ? WARN[problem] : (!sb ? "Could not load the authentication library. Check your connection and reload." : "");
  if (warnText) { $("#cfgwarn").textContent = warnText; $("#cfgwarn").hidden = false; }

  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function text(sel, v) { var e = $(sel); if (e) e.textContent = v == null || v === "" ? "—" : v; }
  var msgTimer;
  function msg(t, kind, keep) { var m = $("#msg"); m.textContent = t || ""; m.className = "pf-msg " + (kind || ""); m.hidden = !t; clearTimeout(msgTimer); if (t && kind === "ok" && !keep) msgTimer = setTimeout(function () { m.hidden = true; }, 4000); }
  var NET = "Something went wrong. Check your connection and try again.";
  function busy(btn, on, label) { if (!btn) return; if (on) { btn.dataset.t = btn.textContent; btn.textContent = label || "Please wait…"; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; btn.disabled = on; }
  function fmtDate(s) { var x = new Date(s); return isNaN(x) ? "—" : x.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }

  /* ---------- theme, logout ---------- */
  $("#theme").addEventListener("click", function () {
    var t = d.documentElement.dataset.theme === "light" ? "dark" : "light"; d.documentElement.dataset.theme = t;
    try { localStorage.setItem("vf-theme", t); } catch (e) {}
    var l = t === "light" ? "Switch to night mode" : "Switch to day mode"; $("#theme").setAttribute("aria-label", l); $("#theme").title = l;
  });
  $("#logout").addEventListener("click", function () { if (!sb) return; sb.auth.signOut().then(function () { location.assign("login.html"); }); });

  /* ---------- 3D tilt + cursor glare (mouse only, never with reduced motion) ---------- */
  function tilt(e0) {
    if (RM || !HOVER) return; var s = parseFloat(e0.getAttribute("data-tilt")) || 6;
    e0.addEventListener("pointermove", function (e) {
      var b = e0.getBoundingClientRect(), px = (e.clientX - b.left) / b.width - .5, py = (e.clientY - b.top) / b.height - .5, st = e0.style;
      st.setProperty("--ry", (px * s).toFixed(2) + "deg"); st.setProperty("--rx", (-py * s).toFixed(2) + "deg");
      st.setProperty("--mx", ((px + .5) * 100).toFixed(1) + "%"); st.setProperty("--my", ((py + .5) * 100).toFixed(1) + "%");
      st.setProperty("--tx", (px * 14).toFixed(1)); st.setProperty("--ty", (py * 14).toFixed(1));
    });
    e0.addEventListener("pointerleave", function () { ["--rx", "--ry", "--tx", "--ty"].forEach(function (k) { e0.style.removeProperty(k); }); });
  }
  $$("[data-tilt]").forEach(tilt);

  /* ---------- tabs (keyboard: arrows, Home, End) ---------- */
  var tabs = $$('[role="tab"]'), panels = { "t-account": "#p-account", "t-security": "#p-security", "t-certs": "#p-certs" }, byHash = { "#account": 0, "#security": 1, "#certificates": 2 };
  function moveInd() { var t = tabs.filter(function (x) { return x.getAttribute("aria-selected") === "true"; })[0], i = $("#ind"); if (t && i) { i.style.width = t.offsetWidth + "px"; i.style.transform = "translateX(" + t.offsetLeft + "px)"; } }
  function select(i, focus) {
    tabs.forEach(function (t, k) { var on = k === i; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; $(panels[t.id]).hidden = !on; });
    moveInd(); if (focus) tabs[i].focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(i); });
    t.addEventListener("keydown", function (e) {
      var k = e.key, n = k === "ArrowRight" ? (i + 1) % tabs.length : k === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : k === "Home" ? 0 : k === "End" ? tabs.length - 1 : -1;
      if (n >= 0) { e.preventDefault(); select(n, true); }
    });
  });
  window.addEventListener("resize", moveInd);
  select(byHash[location.hash] || 0);

  /* ---------- copy ---------- */
  function copyText(t, btn, doneLabel) {
    function done() { var s = $("span", btn), old = s.textContent; s.textContent = doneLabel || "Copied"; btn.classList.add("done"); msg("Copied to clipboard.", "ok"); setTimeout(function () { s.textContent = old; btn.classList.remove("done"); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(done, function () { msg("Couldn't copy. Select the text and copy it manually.", "err"); });
    var ta = el("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; d.body.appendChild(ta); ta.select();
    try { d.execCommand("copy"); done(); } catch (e) { msg("Couldn't copy. Select the text and copy it manually.", "err"); } d.body.removeChild(ta);
  }
  $("#copy").addEventListener("click", function () { if (prof) copyText(prof.public_id, $("#copy"), "Copied ✓"); });

  /* ---------- data ---------- */
  function loadProfile() { return sb.from("profiles").select("public_id,display_name,bio,account_status,visibility,created_at").eq("id", user.id).maybeSingle(); }
  function metaName() {
    var m = user && user.user_metadata || {}, c = [m.display_name, m.full_name, m.name];
    for (var i = 0; i < c.length; i++) if (typeof c[i] === "string" && c[i].trim()) return c[i].trim().replace(/\s+/g, " ").slice(0, 80);
    return "";
  }
  function fillName(r) {
    var n = metaName(); if (r.error || !r.data || String(r.data.display_name || "").trim() || !n) return Promise.resolve(r);
    return Promise.resolve(sb.from("profiles").update({ display_name: n }).eq("id", user.id)).then(function (x) { return x.error ? r : loadProfile(); });
  }
  function ensure() {   // self-heal: create the missing profile row (idempotent, own account only)
    return Promise.resolve(loadProfile()).then(function (r) {
      if (r.error) return r; if (r.data) return fillName(r);
      return Promise.resolve(sb.rpc("ensure_my_profile")).then(function (x) { return x.error ? { data: null, error: x.error } : Promise.resolve(loadProfile()).then(fillName); });
    });
  }

  /* ---------- render ---------- */
  var STATUS = { active: ["Active", "active"], pending_verification: ["Confirm your email", "warn"], suspended: ["Suspended", "bad"], disabled: ["Disabled", "bad"], deletion_requested: ["Deletion requested", "bad"] };
  function hueOf(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function initial(n, id) { var c = (n || "").trim().charAt(0) || (id || "V").replace(/^VF-/, "").charAt(0) || "V"; return c.toUpperCase(); }
  function verified() { return !!(user && user.email_confirmed_at); }
  function chip(node, label, cls) { node.textContent = label; node.className = "pf-chip " + (cls || ""); }
  function renderIdentity() {
    var p = prof, st = STATUS[p.account_status] || [p.account_status, "warn"], name = (p.display_name || "").trim();
    var s = $("#status"); s.dataset.state = st[1]; $("b", s).textContent = st[0];
    text("#name", name || "New member"); text("#pid", p.public_id); text("#since", fmtDate(p.created_at));
    text("#emailstate", verified() ? "Confirmed" : "Not confirmed yet"); text("#visstate", p.visibility === "public" ? "Public" : "Private");
    var h = hueOf(p.public_id); [$("#avatar"), $("#pv-av")].forEach(function (a) { a.textContent = initial(name, p.public_id); a.style.setProperty("--h", h); });
    $("#avatar").style.setProperty("--h", h);
    var r = $("#roles"); r.textContent = ""; roles.forEach(function (x) { r.appendChild(el("span", "pf-role", String(x.role).replace("_", " "))); });
    renderMeter();
  }
  function renderMeter() {
    var items = [["Add a display name", !!(prof.display_name || "").trim(), "#f-name"], ["Write a short bio", !!(prof.bio || "").trim(), "#f-bio"], ["Confirm your email", verified(), null]];
    var done = items.filter(function (i) { return i[1]; }).length, pct = Math.round(done / items.length * 100);
    text("#pct", pct + "%"); requestAnimationFrame(function () { $("#bar").style.strokeDashoffset = String(100 - pct); });
    var ul = $("#todo"); ul.textContent = "";
    items.forEach(function (i) {
      if (i[1] || !i[2]) return; var li = el("li"), b = el("button", "", "+ " + i[0]); b.type = "button";
      b.addEventListener("click", function () { select(0, false); $(i[2]).focus(); }); li.appendChild(b); ul.appendChild(li);
    });
  }
  function formState() { var n = $("#f-name").value.trim().replace(/\s+/g, " ").slice(0, 80), b = $("#f-bio").value.trim().slice(0, 500), v = $("#vis").getAttribute("aria-checked") === "true" ? "public" : "private"; return { name: n, bio: b, vis: v }; }
  function renderForm() {
    $("#f-name").value = prof.display_name || ""; $("#f-bio").value = prof.bio || ""; setVis(prof.visibility === "public"); refreshPreview(); markDirty();
    text("#email", user.email || ""); chip($("#emailchip"), verified() ? "Confirmed" : "Not confirmed", verified() ? "ok" : "warn");
  }
  function setVis(on) {
    $("#vis").setAttribute("aria-checked", String(on)); $("#preview").classList.toggle("is-private", !on);
    $("#vis-help").textContent = on ? "Anyone with your ID can see your name, member-since date, email-verified status and public certificates. Never your email or bio." : "Only you can see your profile. Verification pages will say your ID was not found.";
  }
  function refreshPreview() {
    var f = formState(); text("#pv-name", f.name || "Vish Flow member"); text("#pv-id", prof ? prof.public_id : "VF-····-····");
    text("#pv-meta", "Member since " + (prof ? fmtDate(prof.created_at) : "—"));
    var pub = certs.filter(function (c) { return c.is_public; }).length; $("#pv-meta").textContent += " · " + pub + " public certificate" + (pub === 1 ? "" : "s");
    chip($("#pv-email"), verified() ? "Email verified" : "Email not verified", verified() ? "ok" : "warn");
    var a = initial(f.name, prof && prof.public_id); $("#pv-av").textContent = a;
  }
  function markDirty() {
    var f = formState(); dirty = !!prof && (f.name !== (prof.display_name || "").trim() || f.bio !== (prof.bio || "").trim() || f.vis !== prof.visibility);
    $("#dirty").hidden = !dirty; $("#bio-count").textContent = $("#f-bio").value.length + "/500";
  }
  ["#f-name", "#f-bio"].forEach(function (s) { $(s).addEventListener("input", function () { refreshPreview(); markDirty(); }); });
  $("#vis").addEventListener("click", function () { setVis($("#vis").getAttribute("aria-checked") !== "true"); markDirty(); });
  $("#reset").addEventListener("click", function () { if (prof) renderForm(); });
  window.addEventListener("beforeunload", function (e) { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  $("#form").addEventListener("submit", function (e) {
    e.preventDefault(); if (!sb || !prof) return msg(warnText || "Your profile isn't loaded yet.", "err");
    var f = formState(), btn = $("#save"); busy(btn, true, "Saving…");
    Promise.resolve(sb.from("profiles").update({ display_name: f.name || null, bio: f.bio || null, visibility: f.vis }).eq("id", user.id).select("id")).then(function (x) {
      if (x.error || !x.data || !x.data.length) return msg("Couldn't save. Your account may not be active.", "err");
      prof.display_name = f.name || null; prof.bio = f.bio || null; prof.visibility = f.vis; renderIdentity(); renderForm(); msg("Profile saved.", "ok");
    }).catch(function () { msg(NET, "err"); }).then(function () { busy(btn, false); });
  });

  /* ---------- security ---------- */
  function renderMethods() {
    var m = $("#methods"); m.textContent = ""; var seen = {};
    ((user.identities || []).map(function (i) { return i.provider; }).concat((user.app_metadata && user.app_metadata.providers) || [])).forEach(function (p) {
      if (!p || seen[p]) return; seen[p] = 1; m.appendChild(el("span", "pf-chip ok", p === "email" ? "Email & password" : p === "google" ? "Google" : p));
    });
    if (!m.firstChild) m.appendChild(el("span", "pf-chip", "Email"));
  }
  $("#pwform").addEventListener("submit", function (e) {
    e.preventDefault(); if (!sb) return msg(warnText, "err");
    var pw = $("#np").value, pe = C.validatePassword(pw); if (pe) return msg(pe, "err");
    if (pw !== $("#npc").value) return msg("Passwords do not match.", "err");
    var btn = $("button[type=submit]", $("#pwform")); busy(btn, true);
    Promise.resolve(sb.auth.updateUser({ password: pw })).then(function (r) {
      if (r.error) return msg("Couldn't change the password. Sign in again and retry.", "err");
      $("#np").value = ""; $("#npc").value = ""; msg("Password changed.", "ok");
    }).catch(function () { msg(NET, "err"); }).then(function () { busy(btn, false); });
  });
  $("#out-others").addEventListener("click", function () { if (!sb) return; Promise.resolve(sb.auth.signOut({ scope: "others" })).then(function (r) { msg(r && r.error ? NET : "Signed out of your other devices.", r && r.error ? "err" : "ok"); }); });
  $("#out-all").addEventListener("click", function () { if (!sb) return; Promise.resolve(sb.auth.signOut({ scope: "global" })).then(function () { location.assign("login.html"); }); });

  /* ---------- certificates ---------- */
  var TYPES = { participation: "Participation", project_completion: "Project completion", certificate: "Certificate" };
  function certStatus(c) { if (c.status === "valid" && c.valid_until && new Date(c.valid_until) < new Date()) return ["Expired", "warn"]; return c.status === "valid" ? ["Valid", "ok"] : c.status === "suspended" ? ["Suspended", "warn"] : ["Revoked", "bad"]; }
  function renderCerts() {
    var box = $("#certs"); box.textContent = ""; var n = $("#certcount"); n.hidden = !certs.length; n.textContent = certs.length;
    if (!certs.length) {
      var e = el("div", "pf-empty"), NS = "http://www.w3.org/2000/svg", sv = d.createElementNS(NS, "svg"), ci = d.createElementNS(NS, "circle"), pa = d.createElementNS(NS, "path");
      sv.setAttribute("viewBox", "0 0 24 24"); sv.setAttribute("aria-hidden", "true"); ci.setAttribute("cx", "12"); ci.setAttribute("cy", "9"); ci.setAttribute("r", "6"); pa.setAttribute("d", "M8.5 14.5L7 22l5-3 5 3-1.5-7.5");
      sv.appendChild(ci); sv.appendChild(pa); e.appendChild(sv);
      e.appendChild(el("b", "", "No certificates yet")); e.appendChild(el("span", "", "Complete your internship tasks and your certificates will appear here, with a code anyone can verify."));
      return box.appendChild(e);
    }
    var list = el("div", "pf-certs");
    certs.forEach(function (c) {
      var s = certStatus(c), card = el("div", "pf-cert"), top = el("div", "pf-cert-top"), t = el("div"), foot = el("div", "pf-cert-foot"), b = el("button", "pf-copy"), sp = el("span", "", "Copy code");
      card.setAttribute("data-tilt", "5"); t.appendChild(el("b", "", c.title)); t.appendChild(el("small", "", (TYPES[c.type] || c.type) + " · " + c.issuer + " · " + fmtDate(c.issued_at)));
      top.appendChild(t); top.appendChild(el("span", "pf-chip " + s[1], s[0]));
      foot.appendChild(el("code", "", c.credential_code)); b.type = "button"; b.appendChild(sp); b.addEventListener("click", function () { copyText(c.credential_code, b, "Copied ✓"); }); foot.appendChild(b);
      card.appendChild(top); card.appendChild(foot); card.appendChild(el("small", "", c.is_public ? "Shown on your public verification page" : "Private: not shown publicly"));
      list.appendChild(card); tilt(card);
    });
    box.appendChild(list);
  }

  /* ---------- start ---------- */
  function problemText(err) { return "Your profile couldn't be loaded." + (err ? " (Details: " + String(err.code || "") + " " + String(err.message || "").slice(0, 120) + ")" : " Refresh in a moment; if this continues, contact support."); }
  if (!sb) { $("#status").dataset.state = "warn"; $("b", $("#status")).textContent = "Not connected"; return; }
  Promise.resolve(sb.auth.getUser()).then(function (r) {
    if (r.error || !r.data || !r.data.user) { location.replace("login.html?next=profile.html"); return; }
    user = r.data.user; renderMethods();
    return Promise.all([ensure(), sb.from("user_roles").select("role").eq("user_id", user.id), sb.from("credentials").select("credential_code,type,title,issuer,issued_at,valid_until,status,is_public").eq("subject_id", user.id).order("issued_at", { ascending: false })]).then(function (x) {
      if (x[0].error || !x[0].data) { $("#status").dataset.state = "warn"; $("b", $("#status")).textContent = "Not ready"; return msg(problemText(x[0].error), "err", true); }
      prof = x[0].data; roles = x[1].data || []; certs = x[2].data || [];
      renderIdentity(); renderForm(); renderCerts();
    });
  }).catch(function () { msg(NET, "err", true); });
})();
