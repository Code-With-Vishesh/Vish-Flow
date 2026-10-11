const test = require("node:test"), assert = require("node:assert"), path = require("path");
const { JSDOM, ResourceLoader } = require("jsdom");
class L extends ResourceLoader { fetch(u, o) { return u.startsWith("file:") ? super.fetch(u, o) : Promise.resolve(Buffer.from("")); } }
const cfg = { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(24), GOOGLE_ENABLED: true };
const res = (status, body) => Promise.resolve({ status, json: () => Promise.resolve(body) });
async function run(routes, c = cfg) {
  const dom = await JSDOM.fromFile(path.join(__dirname, "..", "connection-check.html"), { runScripts: "dangerously", resources: new L(), pretendToBeVisual: true,
    beforeParse(w) { w.matchMedia = () => ({ matches: false }); w.VF_CONFIG = c; w.fetch = (u) => { const k = Object.keys(routes).find(x => u.includes(x)); return k ? routes[k]() : res(500, null); }; } });
  await new Promise(r => dom.window.addEventListener("load", r)); await new Promise(r => setTimeout(r, 120));
  return [...dom.window.document.querySelectorAll(".chk")].map(li => ({ s: li.className.replace("chk ", ""), t: li.querySelector("b").textContent }));
}
test("healthy project: no failures, shows redirect URLs to add", async () => {
  const r = await run({ "/auth/v1/settings": () => res(200, { external: { email: true, google: true }, mailer_autoconfirm: false }),
    "/rpc/verify_public_profile": () => res(200, { found: false }), "/rest/v1/profiles": () => res(401, { code: "42501" }) });
  assert.ok(!r.some(x => x.s === "fail"), JSON.stringify(r)); assert.ok(r.some(x => /Redirect URLs/.test(x.t)));
});
test("problems are reported: migration missing, confirmation off, Google off, anon can read profiles", async () => {
  const r = await run({ "/auth/v1/settings": () => res(200, { external: { email: true, google: false }, mailer_autoconfirm: true }),
    "/rpc/verify_public_profile": () => res(404, { code: "PGRST202" }), "/rest/v1/profiles": () => res(200, [{ id: "x" }]) });
  const fails = r.filter(x => x.s === "fail").map(x => x.t).join("|");
  for (const w of ["confirmation", "Google", "migration", "read profiles"]) assert.match(fails, new RegExp(w, "i"));
});
test("missing or secret config fails fast and makes no network calls", async () => {
  let called = 0; const r = await run({ "/": () => (called++, res(200, {})) }, {});
  assert.strictEqual(r[0].s, "fail"); assert.strictEqual(called, 0);
});
