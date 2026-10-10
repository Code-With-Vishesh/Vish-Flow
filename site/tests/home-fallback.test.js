const test=require("node:test"),assert=require("node:assert"),path=require("path");
const {JSDOM,ResourceLoader}=require("jsdom");
class L extends ResourceLoader{fetch(u,o){return u.startsWith("file:")?super.fetch(u,o):Promise.resolve(Buffer.from(""))}}
test("home page: local three.js loads; without WebGL the page falls back cleanly (no crash)",async()=>{
  const errs=[];const dom=await JSDOM.fromFile(path.join(process.cwd(),"index.html"),{runScripts:"dangerously",resources:new L(),pretendToBeVisual:true,
    beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){}});w.IntersectionObserver=class{observe(){}unobserve(){}};w.addEventListener("error",e=>errs.push(e.message))}});
  await new Promise(r=>dom.window.addEventListener("load",r));await new Promise(r=>setTimeout(r,300));
  assert.ok(dom.window.THREE&&dom.window.THREE.WebGLRenderer,"three.js loaded from the local file");
  assert.ok(dom.window.document.documentElement.classList.contains("no3d"),"fallback class set when WebGL is unavailable");
  assert.ok(dom.window.document.querySelectorAll("#dgrid .card").length===14,"domain cards still render");
  assert.deepStrictEqual(errs,[]);
});
