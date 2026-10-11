// jsdom tests. "missing config" tests use the real page code; "mocked SDK" tests replace Supabase with a stub (NOT real integration).
const test = require("node:test"), assert = require("node:assert"), path = require("path"), fs = require("fs");
const { JSDOM, ResourceLoader } = require("jsdom");
class Local extends ResourceLoader { fetch(url, o) { return url.startsWith("file:") ? super.fetch(url, o) : Promise.resolve(Buffer.from("")); } }
const root = path.join(__dirname, "..");
const KEY = "sb_publishable_" + "a".repeat(24);
async function load(file, { cfg, sdk, search = "" } = {}) {
  const errors = [];
  const pagePath = path.join(root, file);
  const dom = await JSDOM.fromFile(pagePath, { url: require("url").pathToFileURL(pagePath).href + search, runScripts: "dangerously", resources: new Local(), pretendToBeVisual: true,
    beforeParse(w) { w.matchMedia = () => ({ matches: false }); if (cfg) w.VF_CONFIG = cfg; if (sdk) w.supabase = sdk; w.addEventListener("error", e => errors.push(e.message)); } });
  await new Promise(r => dom.window.addEventListener("load", r));
  await new Promise(r => setTimeout(r, 50));
  return { w: dom.window, d: dom.window.document, errors };
}
const submit = (w, f) => { f.dispatchEvent(new w.Event("submit", { bubbles: true, cancelable: true })); return new Promise(r => setTimeout(r, 60)); };
const fill = (d, v) => Object.entries(v).forEach(([k, x]) => { d.getElementById(k).value = x; });

test("every auth page loads with missing config, shows a warning and throws no errors", async () => {
  const missing = { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", GOOGLE_ENABLED: false };
  for (const f of ["signup", "login", "forgot-password", "reset-password", "auth-callback", "dashboard", "profile", "security"]) {
    const { d, errors } = await load(f + ".html", { cfg: missing });
    assert.strictEqual(d.getElementById("cfgwarn").hidden, false, f);
    assert.match(d.getElementById("cfgwarn").textContent, /not connected to Supabase/, f);
    assert.deepStrictEqual(errors, [], f);
  }
});
test("submitting with missing config does nothing harmful", async () => {
  const { w, d, errors } = await load("login.html", { cfg: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "", GOOGLE_ENABLED: false } });
  fill(d, { email: "a@b.co", password: "whatever123" }); await submit(w, d.getElementById("form"));
  assert.match(d.getElementById("msg").textContent, /not connected/); assert.deepStrictEqual(errors, []);
});
test("a service-role key in config is refused", async () => {
  const bad = "x." + Buffer.from('{"role":"service_role"}').toString("base64url") + ".y";
  const { d } = await load("login.html", { cfg: { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: bad + "a".repeat(20) }, sdk: { createClient() { throw new Error("must not be called"); } } });
  assert.match(d.getElementById("cfgwarn").textContent, /secret|service-role/i);
});
function stub(over = {}) {
  const calls = []; const ok = { data: {}, error: null };
  const auth = { signUp: async a => (calls.push(["signUp", a]), ok), signInWithPassword: async a => (calls.push(["signIn", a]), { data: {}, error: { message: "Invalid login credentials", status: 400 } }),
    resetPasswordForEmail: async (e, o) => (calls.push(["reset", e, o]), ok), onAuthStateChange() {}, ...over };
  return { calls, sdk: { createClient: () => ({ auth }) } };
}
const cfg = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: KEY };
test("[mocked SDK] signup validates before calling Supabase and sends a same-site redirect", async () => {
  const s = stub(); const { w, d } = await load("signup.html", { cfg, sdk: s.sdk });
  fill(d, { name: "", email: "bad", password: "x", confirm: "x" }); await submit(w, d.getElementById("form"));
  assert.strictEqual(s.calls.length, 0);
  fill(d, { email: "a@b.co", password: "longenough123", confirm: "different123" }); await submit(w, d.getElementById("form"));
  assert.match(d.getElementById("msg").textContent, /do not match/); assert.strictEqual(s.calls.length, 0);
  fill(d, { email: "a@b.co", password: "longenough123", confirm: "longenough123" }); await submit(w, d.getElementById("form"));
  assert.strictEqual(s.calls.length, 1); assert.match(s.calls[0][1].options.emailRedirectTo, /auth-callback\.html$/);
  assert.match(d.getElementById("msg").textContent, /Check your email/);
});
test("[mocked SDK] login failure message is generic (no account enumeration)", async () => {
  const s = stub(); const { w, d } = await load("login.html", { cfg, sdk: s.sdk });
  fill(d, { email: "a@b.co", password: "wrongpass123" }); await submit(w, d.getElementById("form"));
  assert.match(d.getElementById("msg").textContent, /Incorrect email or password/);
  assert.doesNotMatch(d.getElementById("msg").textContent, /Invalid login credentials|not found|no account/i);
});
test("[mocked SDK] password reset gives the same answer for any address; network failure shows a safe message", async () => {
  const s = stub(); const { w, d } = await load("forgot-password.html", { cfg, sdk: s.sdk });
  fill(d, { email: "nobody@b.co" }); await submit(w, d.getElementById("form"));
  assert.match(d.getElementById("msg").textContent, /If an account exists/);
  const s2 = stub({ resetPasswordForEmail: async () => { throw new Error("network down"); } });
  const p = await load("forgot-password.html", { cfg, sdk: s2.sdk });
  fill(p.d, { email: "a@b.co" }); await submit(p.w, p.d.getElementById("form"));
  assert.match(p.d.getElementById("msg").textContent, /Something went wrong/);
});
test("no real key-like strings or innerHTML in shipped browser code", () => {
  for (const f of fs.readdirSync(root).filter(x => /\.(js|html)$/.test(x) && x !== "vish-flow-single-file.html")) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    assert.ok(!/sb_secret_[A-Za-z0-9]{10}/.test(s), f + " contains a secret-key-like string");
    assert.ok(!/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\./.test(s), f + " contains a JWT-like string");
  }
  assert.ok(!/innerHTML/.test(fs.readFileSync(path.join(root, "auth.js"), "utf8")));
});

test("login page: new layout, Google off by default, password toggle works", async () => {
  const { w, d, errors } = await load("login.html");
  assert.ok(d.querySelector(".auth-card .x") && d.querySelector(".auth-panel") && d.getElementById("wave"));
  assert.strictEqual(d.querySelectorAll(".auth-intro .intro-features li").length, 4);
  assert.match(d.querySelector(".auth-intro h2").textContent, /Your Skills.*Your Projects.*Your Future/s);
  assert.strictEqual(d.getElementById("google").disabled, true);
  const i = d.getElementById("password"), b = d.querySelector(".eye");
  assert.strictEqual(i.type, "password"); b.click(); assert.strictEqual(i.type, "text"); b.click(); assert.strictEqual(i.type, "password");
  assert.deepStrictEqual(errors, []);
});
test("[mocked SDK] Google button turns on only when GOOGLE_ENABLED is true", async () => {
  const s = stub(); const off = await load("login.html", { cfg, sdk: s.sdk }); assert.strictEqual(off.d.getElementById("google").disabled, true);
  const on = await load("login.html", { cfg: { ...cfg, GOOGLE_ENABLED: true }, sdk: s.sdk }); assert.strictEqual(on.d.getElementById("google").disabled, false);
});
test("[mocked SDK] callback shows the real reason for a failed Google sign-in", async () => {
  const s = stub(); const { d } = await load("auth-callback.html", { cfg, sdk: s.sdk, search: "?error=server_error&error_code=unexpected_failure&error_description=Database+error+saving+new+user" });
  const m = d.getElementById("msg").textContent;
  assert.match(m, /could not create your profile/); assert.match(m, /Database error saving new user/);
  const e = await load("auth-callback.html", { cfg, sdk: s.sdk, search: "?error=access_denied&error_description=User+denied" });
  assert.match(e.d.getElementById("msg").textContent, /cancelled or denied/);
});
function dashStub(profileExists, userMetadata = {}, existingName = null) {
  let have = profileExists; const calls = [];
  const profile = { public_id: "VF-7K4M-9Q2X", display_name: existingName, account_status: "active", visibility: "private", created_at: "2026-01-01" };
  const sb = { auth: { getUser: async () => ({ data: { user: { id: "u1", email_confirmed_at: "x", user_metadata: userMetadata } }, error: null }), onAuthStateChange() {}, signOut: async () => ({}) },
    rpc: async n => { calls.push(n); have = true; return { error: null }; },
    from: t => ({ select: () => { const res = t === "profiles" ? { data: have ? profile : null, error: null } : { data: [{ role: "student" }], error: null };
      const p = Promise.resolve(res); p.eq = () => ({ maybeSingle: () => Promise.resolve(res) }); return p; },
      update: fields => ({ eq: async () => { Object.assign(profile, fields); return { error: null }; } }) }) };
  return { calls, sdk: { createClient: () => sb } };
}
test("[mocked SDK] dashboard creates a missing profile once, then shows the Vish Flow ID", async () => {
  const s = dashStub(false, { full_name: "Google Display Name" }); const { d } = await load("dashboard.html", { cfg, sdk: s.sdk });
  assert.deepStrictEqual(s.calls, ["ensure_my_profile"]);
  assert.strictEqual(d.getElementById("pid").textContent, "VF-7K4M-9Q2X"); assert.strictEqual(d.getElementById("msg").hidden, true);
  assert.strictEqual(d.getElementById("name").textContent, "Google Display Name");
});
test("[mocked SDK] dashboard does not call ensure_my_profile when the profile already exists", async () => {
  const s = dashStub(true, { name: "Google Display Name" }); const { d } = await load("dashboard.html", { cfg, sdk: s.sdk });
  assert.deepStrictEqual(s.calls, []); assert.strictEqual(d.getElementById("pid").textContent, "VF-7K4M-9Q2X");
  assert.strictEqual(d.getElementById("name").textContent, "Google Display Name");
});
test("[mocked SDK] dashboard preserves a display name the user already chose", async () => {
  const s = dashStub(true, { name: "Google Display Name" }, "Chosen Name"); const { d } = await load("dashboard.html", { cfg, sdk: s.sdk });
  assert.strictEqual(d.getElementById("name").textContent, "Chosen Name");
});
