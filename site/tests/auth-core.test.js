const test = require("node:test"), assert = require("node:assert"), C = require("../auth-core.js");
const jwt = role => "x." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".y";
test("safeNext allows only internal allowlisted pages", () => {
  for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "dashboard.html@evil.com", "../x.html", "", null, undefined, 5, "login.html"])
    assert.strictEqual(C.safeNext(bad), "dashboard.html", String(bad));
  assert.strictEqual(C.safeNext("profile.html"), "profile.html");
  assert.strictEqual(C.safeNext("/security.html"), "security.html");
});
test("email and password validation", () => {
  assert.ok(C.validateEmail("a@b.co")); assert.ok(!C.validateEmail("a@b")); assert.ok(!C.validateEmail("a b@c.com")); assert.ok(!C.validateEmail(null));
  assert.ok(C.validatePassword("short1")); assert.ok(C.validatePassword("onlyletterslong")); assert.ok(C.validatePassword("1234567890123")); assert.ok(C.validatePassword("a1".repeat(40)));
  assert.strictEqual(C.validatePassword("longenough123"), null);
});
test("config check refuses missing, malformed and secret keys", () => {
  assert.strictEqual(C.configProblem({}), "not_configured");
  assert.strictEqual(C.configProblem({ SUPABASE_URL: "http://evil.com", SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(20) }), "bad_url");
  assert.strictEqual(C.configProblem({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: jwt("service_role") }), "secret_key");
  assert.strictEqual(C.configProblem({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "sb_secret_" + "a".repeat(20) }), "secret_key");
  assert.strictEqual(C.configProblem({ SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: jwt("anon") + "a".repeat(20) }), null);
  assert.strictEqual(C.configProblem({ SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_ANON_KEY: "sb_publishable_" + "a".repeat(20) }), null);
});
test("public ID format and callback URL building", () => {
  assert.ok(C.isPublicId("VF-7K4M-9Q2X")); assert.ok(!C.isPublicId("VF-0000-1111")); assert.ok(!C.isPublicId("vf-7k4m-9q2x")); assert.ok(!C.isPublicId("VF-7K4M-9Q2X; drop"));
  assert.strictEqual(C.siblingUrl("https://x.com/app/signup.html?a=1#b", "auth-callback.html"), "https://x.com/app/auth-callback.html");
});
