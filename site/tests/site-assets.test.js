const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
test("3D library ships with the site (no CDN dependency) and the page loads it locally", () => {
  assert.ok(fs.statSync(path.join(root, "vendor/three.min.js")).size > 400000);
  const h = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(h.includes('src="vendor/three.min.js"') && !/cdnjs[^"]*three/.test(h));
});
test("script.js parses and keeps a fallback for missing WebGL / library", () => {
  const s = fs.readFileSync(path.join(root, "script.js"), "utf8");
  new Function(s);
  assert.ok(s.includes('classList.add("no3d")'));
});
