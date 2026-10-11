// jsdom tests for profile.html. The Supabase SDK is replaced by a stub (mocked tests, NOT real integration).
const test = require("node:test"), assert = require("node:assert"), path = require("path"), { pathToFileURL } = require("url");
const { JSDOM, ResourceLoader } = require("jsdom");
class L extends ResourceLoader { fetch(u, o) { return u.startsWith("file:") ? super.fetch(u, o) : Promise.resolve(Buffer.from("")); } }
const cfg = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(24) };
const PROFILE = { public_id: "VF-7K4M-9Q2X", display_name: "Vishesh", bio: "Zebra bio", account_status: "active", visibility: "private", created_at: "2026-01-05T10:00:00Z" };
function stub(o = {}) {
  const st = { calls: [], have: true, profile: { ...PROFILE }, roles: [{ role: "student" }], creds: [], user: { id: "u1", email: "v@x.test", email_confirmed_at: "x", identities: [{ provider: "google" }, { provider: "email" }], user_metadata: {} }, ...o };
  const read = t => t === "profiles" ? { data: st.have ? st.profile : null, error: null } : t === "user_roles" ? { data: st.roles, error: null } : { data: st.creds, error: null };
  const from = t => { const f = []; const b = { select() { return b; }, eq(k, v) { f.push([k, v]); return b; }, order() { return b; },
    maybeSingle() { st.calls.push(["q", t, f.slice()]); return Promise.resolve(read(t)); }, then(a, r) { st.calls.push(["q", t, f.slice()]); return Promise.resolve(read(t)).then(a, r); },
    update(p) { st.calls.push(["update", JSON.parse(JSON.stringify(p))]); return { eq(k, v) { st.calls.push(["updEq", k, v]); Object.assign(st.profile, p); return { select() { return Promise.resolve({ data: [{ id: v }], error: null }); }, then(a, r) { return Promise.resolve({ error: null }).then(a, r); } }; } }; } }; return b; };
  const auth = { getUser: async () => ({ data: { user: st.user }, error: null }), updateUser: async a => (st.calls.push(["updateUser", JSON.parse(JSON.stringify(a))]), { error: null }), signOut: async a => (st.calls.push(["signOut", JSON.parse(JSON.stringify(a || {}))]), {}), onAuthStateChange() {} };
  st.sdk = { createClient: () => ({ auth, from, rpc: async n => { st.calls.push(["rpc", n]); st.have = true; return { error: null }; } }) };
  return st;
}
async function load(st, { c = cfg, hash = "" } = {}) {
  const errors = [], copied = [];
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "profile.html"), { runScripts: "dangerously", resources: new L(), pretendToBeVisual: true, url: pathToFileURL(path.join(__dirname, "..", "profile.html")).href + hash,
    beforeParse(w) { w.matchMedia = () => ({ matches: false }); w.VF_CONFIG = c; if (st) w.supabase = st.sdk; w.requestAnimationFrame = f => f();
      Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async t => { copied.push(t); } } }); w.addEventListener("error", e => errors.push(e.message)); } });
  await new Promise(r => dom.window.addEventListener("load", r)); await new Promise(r => setTimeout(r, 80));
  return { w: dom.window, d: dom.window.document, errors, copied };
}
const $ = (d, s) => d.querySelector(s), wait = (ms = 40) => new Promise(r => setTimeout(r, ms));

test("shows the Vish Flow ID, name, status, roles and member-since from the database", async () => {
  const st = stub(); const { d, errors } = await load(st);
  assert.strictEqual($(d, "#pid").textContent, "VF-7K4M-9Q2X"); assert.strictEqual($(d, "#name").textContent, "Vishesh");
  assert.strictEqual($(d, "#status").dataset.state, "active"); assert.match($(d, "#status").textContent, /Active/);
  assert.match($(d, "#roles").textContent, /student/); assert.match($(d, "#since").textContent, /2026/); assert.strictEqual($(d, "#avatar").textContent, "V");
  assert.deepStrictEqual(errors, []);
});
test("queries are scoped to the signed-in user (admins must not see other people's data here)", async () => {
  const st = stub(); await load(st); const q = st.calls.filter(c => c[0] === "q");
  assert.ok(q.some(c => c[1] === "user_roles" && c[2].some(f => f[0] === "user_id" && f[1] === "u1")));
  assert.ok(q.some(c => c[1] === "credentials" && c[2].some(f => f[0] === "subject_id" && f[1] === "u1")));
  assert.ok(q.some(c => c[1] === "profiles" && c[2].some(f => f[0] === "id" && f[1] === "u1")));
});
test("a missing profile is created once through ensure_my_profile", async () => {
  const st = stub({ have: false }); const { d } = await load(st);
  assert.deepStrictEqual(st.calls.filter(c => c[0] === "rpc").map(c => c[1]), ["ensure_my_profile"]); assert.strictEqual($(d, "#pid").textContent, "VF-7K4M-9Q2X");
});
test("a blank display name is filled from the sign-in provider's name", async () => {
  const st = stub({ profile: { ...PROFILE, display_name: null }, user: { id: "u1", email: "v@x.test", email_confirmed_at: "x", user_metadata: { full_name: "  Google   Name " } } });
  await load(st); assert.deepStrictEqual(st.calls.find(c => c[0] === "update")[1], { display_name: "Google Name" });
});
test("saving sends only the three editable columns, for the user's own row", async () => {
  const st = stub(); const { w, d } = await load(st);
  $(d, "#f-name").value = "  New   Name "; $(d, "#f-name").dispatchEvent(new w.Event("input")); $(d, "#vis").click();
  assert.strictEqual($(d, "#dirty").hidden, false);
  $(d, "#form").dispatchEvent(new w.Event("submit", { cancelable: true })); await wait();
  const u = st.calls.filter(c => c[0] === "update").pop()[1]; assert.deepStrictEqual(Object.keys(u).sort(), ["bio", "display_name", "visibility"]);
  assert.deepStrictEqual(u, { display_name: "New Name", bio: "Zebra bio", visibility: "public" }); assert.ok(st.calls.some(c => c[0] === "updEq" && c[1] === "id" && c[2] === "u1"));
  assert.match($(d, "#msg").textContent, /saved/i); assert.strictEqual($(d, "#dirty").hidden, true); assert.strictEqual($(d, "#name").textContent, "New Name");
});
test("public preview is blurred and labelled hidden while private, never shows the bio or email", async () => {
  const st = stub(); const { d } = await load(st);
  assert.ok($(d, "#preview").classList.contains("is-private")); $(d, "#vis").click(); assert.ok(!$(d, "#preview").classList.contains("is-private"));
  const txt = $(d, "#preview").textContent; assert.ok(!txt.includes("Zebra") && !txt.includes("v@x.test")); assert.match(txt, /Email verified/);
});
test("tabs work by click and keyboard", async () => {
  const st = stub(); const { w, d } = await load(st);
  const t1 = $(d, "#t-account"); t1.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.strictEqual($(d, "#t-security").getAttribute("aria-selected"), "true"); assert.strictEqual($(d, "#p-account").hidden, true); assert.strictEqual($(d, "#p-security").hidden, false);
  $(d, "#t-certs").click(); assert.strictEqual($(d, "#p-certs").hidden, false); $(d, "#t-security").dispatchEvent(new w.KeyboardEvent("keydown", { key: "Home", bubbles: true }));
  assert.strictEqual($(d, "#t-account").getAttribute("aria-selected"), "true");
});
test("certificates: statuses are shown truthfully; a revoked or expired one is never 'Valid'", async () => {
  const mk = (code, status, extra = {}) => ({ credential_code: code, type: "certificate", title: "Cert " + code, issuer: "Vish Flow", issued_at: "2026-02-01T00:00:00Z", valid_until: null, status, is_public: true, ...extra });
  const st = stub({ creds: [mk("VFC-AAAAAAAAAAAA", "valid"), mk("VFC-BBBBBBBBBBBB", "revoked"), mk("VFC-CCCCCCCCCCCC", "valid", { valid_until: "2020-01-01T00:00:00Z" })] });
  const { d, copied } = await load(st); const cards = [...d.querySelectorAll(".pf-cert")];
  assert.strictEqual(cards.length, 3); assert.match(cards[0].textContent, /Valid/); assert.match(cards[1].textContent, /Revoked/); assert.ok(!/Valid/.test(cards[1].textContent));
  assert.match(cards[2].textContent, /Expired/); assert.ok(!/Valid/.test(cards[2].textContent)); assert.strictEqual($(d, "#certcount").textContent, "3");
  cards[0].querySelector(".pf-copy").click(); await wait(); assert.deepStrictEqual(copied, ["VFC-AAAAAAAAAAAA"]);
});
test("empty certificate state is friendly", async () => { const { d } = await load(stub()); assert.match($(d, "#certs").textContent, /No certificates yet/); assert.strictEqual($(d, "#certcount").hidden, true); });
test("copy button copies the Vish Flow ID and confirms", async () => { const { d, copied } = await load(stub()); $(d, "#copy").click(); await wait(); assert.deepStrictEqual(copied, ["VF-7K4M-9Q2X"]); assert.match($(d, "#copy").textContent, /Copied/); });
test("password change validates before calling Supabase", async () => {
  const st = stub(); const { w, d } = await load(st); const go = () => { $(d, "#pwform").dispatchEvent(new w.Event("submit", { cancelable: true })); return wait(); };
  $(d, "#np").value = "short"; $(d, "#npc").value = "short"; await go(); assert.ok(!st.calls.some(c => c[0] === "updateUser"));
  $(d, "#np").value = "longenough123"; $(d, "#npc").value = "different1234"; await go(); assert.match($(d, "#msg").textContent, /do not match/); assert.ok(!st.calls.some(c => c[0] === "updateUser"));
  $(d, "#npc").value = "longenough123"; await go(); assert.deepStrictEqual(st.calls.find(c => c[0] === "updateUser")[1], { password: "longenough123" });
});
test("sign-out options use the right scopes; sign-in methods are listed", async () => {
  const st = stub(); const { d } = await load(st); assert.match($(d, "#methods").textContent, /Google/); assert.match($(d, "#methods").textContent, /Email & password/);
  $(d, "#out-others").click(); await wait(); assert.deepStrictEqual(st.calls.find(c => c[0] === "signOut")[1], { scope: "others" });
});
test("user-controlled text is never interpreted as HTML", async () => {
  const evil = "<img src=x onerror=alert(1)>"; const st = stub({ profile: { ...PROFILE, display_name: evil }, creds: [{ credential_code: "VFC-AAAAAAAAAAAA", type: "certificate", title: evil, issuer: evil, issued_at: "2026-02-01T00:00:00Z", valid_until: null, status: "valid", is_public: true }] });
  const { d } = await load(st); assert.strictEqual(d.querySelectorAll("img[src='x']").length, 0); assert.strictEqual($(d, "#name").textContent, evil);
});
test("missing config shows a warning and breaks nothing", async () => { const { d, errors } = await load(null, { c: { SUPABASE_URL: "", SUPABASE_ANON_KEY: "" } }); assert.strictEqual($(d, "#cfgwarn").hidden, false); assert.deepStrictEqual(errors, []); });
test("profile problems show the real reason", async () => {
  const st = stub(); st.sdk = { createClient: () => ({ auth: { getUser: async () => ({ data: { user: st.user }, error: null }), onAuthStateChange() {} }, rpc: async () => ({ error: null }), from: () => { const b = { select() { return b; }, eq() { return b; }, order() { return b; }, maybeSingle: () => Promise.resolve({ data: null, error: { code: "42501", message: "permission denied for table profiles" } }), then(a, r) { return Promise.resolve({ data: [], error: null }).then(a, r); } }; return b; } }) };
  const { d } = await load(st); assert.match($(d, "#msg").textContent, /42501/);
});
