const FORM="https://docs.google.com/forms/d/e/1FAIpQLSeWPdVvO1vPtP-woKAvhzneyMXOsiMBbaqJ9nRSvUzVyGfZVQ/viewform";
document.querySelectorAll(".apply").forEach(a=>a.href=FORM);
const ALL=["Beginner","Intermediate","Advanced"];
const D=[
{n:"UI/UX Design",c:"Design",i:"🎨",d:"Research, wireframes, and interface design."},
{n:"Web Development",c:"Web",i:"🌐",d:"Build websites with HTML, CSS, and JavaScript."},
{n:"Front-End Development",c:"Web",i:"🖥️",d:"Responsive, accessible user interfaces."},
{n:"Back-End Development",c:"Web",i:"⚙️",d:"Servers, APIs, and application logic."},
{n:"JavaScript",c:"Programming",i:"🟨",d:"Core language skills for browser and server."},
{n:"React.js",c:"Web",i:"⚛️",d:"Component-based apps with React."},
{n:"Python",c:"Programming",i:"🐍",d:"Scripting, automation, and problem-solving."},
{n:"Java",c:"Programming",i:"☕",d:"Object-oriented programming and applications."},
{n:"Full-Stack Development",c:"Web",i:"🧩",d:"Connect front end, back end, and database."},
{n:"App Development",c:"Mobile",i:"📱",d:"Build apps for mobile devices."},
{n:"Database Management",c:"Data",i:"🗄️",d:"Design, query, and manage databases."},
{n:"Git & GitHub",c:"Tools",i:"🔀",d:"Version control and collaboration workflow."},
{n:"Data Science & AI/ML",c:"Data",i:"📊",d:"Analyse data and train simple models."},
{n:"Cybersecurity",c:"Security",i:"🔐",d:"Security fundamentals and safe practices."}
].map(x=>({...x,levels:ALL,status:"Planned"}));
const cats=["All",...new Set(D.map(x=>x.c))];let cat="All";
const $=s=>document.querySelector(s),dg=$("#dgrid");
function esc(s){return s.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function draw(){
const t=$("#q").value.trim().toLowerCase();
const r=D.filter(x=>(cat==="All"||x.c===cat)&&(x.n+" "+x.d+" "+x.c).toLowerCase().includes(t));
dg.innerHTML=r.map(x=>`<article class="card"><span class="ico" aria-hidden="true">${x.i}</span><h3>${esc(x.n)}</h3><p>${esc(x.d)}</p><div><span class="tag plan">${x.status}</span>${x.levels.map(l=>`<span class="tag">${l}</span>`).join("")}</div><button class="btn" data-n="${esc(x.n)}">View details</button></article>`).join("");
$("#none").hidden=r.length>0;$("#count").textContent=`Showing ${r.length} of ${D.length} domains`;
}
$("#cats").innerHTML=cats.map(c=>`<button class="chip" aria-pressed="${c==="All"}">${c}</button>`).join("");
$("#cats").onclick=e=>{const b=e.target.closest(".chip");if(!b)return;cat=b.textContent;document.querySelectorAll(".chip").forEach(x=>x.setAttribute("aria-pressed",x===b));draw()};
$("#q").oninput=draw;
dg.onclick=e=>{const b=e.target.closest("button[data-n]");if(!b)return;const x=D.find(y=>y.n===b.dataset.n);$("#dt").textContent=x.n;$("#dd").textContent=x.d+" Category: "+x.c+".";$("#dl").innerHTML=`<span class="tag plan">${x.status}</span>`+x.levels.map(l=>`<span class="tag">${l}</span>`).join("");$("#dlg").showModal()};
$("#dx").onclick=()=>$("#dlg").close();
$("#dlg").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
draw();
$("#fdom").innerHTML=D.slice(0,6).map(x=>`<li><a href="#domains">${esc(x.n)}</a></li>`).join("");
const P=[
["Portfolio landing page","Beginner","Web","A personal page with responsive layout and a contact section.","HTML, CSS","Semantic markup, layout, responsiveness"],
["Task tracker app","Intermediate","React.js","A to-do app with filters and saved state.","React, JavaScript","Components, state, forms"],
["REST API with auth","Advanced","Back-End","An API with a database and user login.","Node.js, SQL","Routing, data modelling, security basics"]
];
$("#pgrid").innerHTML=P.map(p=>`<article class="card"><h3>${p[0]}</h3><div><span class="tag">${p[1]}</span><span class="tag">${p[2]}</span></div><p>${p[3]}</p><p><strong>Stack:</strong> ${p[4]}</p><p><strong>You practise:</strong> ${p[5]}</p></article>`).join("");
const F=[
["Who can apply?","Eligibility is to be announced. The form lists the current requirements."],
["Is there a fee?","To be announced. Check the application form for the latest information."],
["Which domains are available?","Domains are listed above. Those marked Planned are not yet confirmed."],
["What are the skill levels?","Beginner, Intermediate, and Advanced. Requirements vary by domain and level."],
["How long does it last?","Duration is to be announced for each domain."],
["How are people selected?","Applications are reviewed. Submitting an application does not guarantee selection."],
["Can I take part remotely?","To be announced."],
["Will I get a certificate?","Certificate eligibility is to be announced."],
["What counts as completion?","Completion requirements will depend on domain and level and will be shared with selected applicants."]
];
$("#faqs").innerHTML=F.map(f=>`<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join("");
const sv=p=>`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const SOC=[
["WhatsApp","https://chat.whatsapp.com/IpMAKNngIEIDK7xdQTI0ge",sv('<path d="M3 21l1.65-4.9A9 9 0 1 1 8 19.4L3 21z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.3-1.3-2-1-.8.8c-1-.4-1.8-1.2-2.2-2.2l.8-.8-1-2L9 9.5z"/>')],
["Instagram","",sv('<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>')],
["YouTube","",sv('<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>')],
["LinkedIn","",sv('<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>')],
["GitHub","",sv('<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>')]
];
$("#soc").innerHTML=SOC.map(s=>s[1]?`<li><a href="${s[1]}" target="_blank" rel="noopener noreferrer" aria-label="${s[0]}" data-t="${s[0]}">${s[2]}</a></li>`:`<li><span class="off" role="img" aria-label="${s[0]}, link coming soon" data-t="${s[0]} (soon)">${s[2]}</span></li>`).join("");
const th=$("#theme"),rt=document.documentElement;
function setTheme(t,save){rt.dataset.theme=t;const l=t==="light"?"Switch to night mode":"Switch to day mode";th.setAttribute("aria-label",l);th.title=l;if(save){try{localStorage.setItem("vf-theme",t)}catch(e){}}}
setTheme(rt.dataset.theme==="light"?"light":"dark",false);
th.onclick=()=>setTheme(rt.dataset.theme==="light"?"dark":"light",true);
$("#yr").textContent=new Date().getFullYear();
const mb=$("#menu"),ul=$("#links");
mb.onclick=()=>{const o=ul.classList.toggle("open");mb.setAttribute("aria-expanded",o);mb.setAttribute("aria-label",o?"Close menu":"Open menu")};
ul.onclick=e=>{if(e.target.closest("a")){ul.classList.remove("open");mb.setAttribute("aria-expanded","false")}};
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll(".reveal").forEach(el=>io.observe(el));
const links=[...document.querySelectorAll('a.l[href^="#"]')],secs=links.map(a=>document.querySelector(a.getAttribute("href"))).filter(Boolean);
const RM=matchMedia("(prefers-reduced-motion:reduce)").matches,stg=[...document.querySelectorAll(".stage")],rl=[...document.querySelectorAll(".rail i")];let sp=0;
const bar=$("#progress"),fill=$("#fill"),tl=$("#tl");let tick=false;
function onScroll(){
const h=document.documentElement,p=h.scrollTop/(h.scrollHeight-h.clientHeight||1);bar.style.transform=`scaleX(${p})`;
const r=tl.getBoundingClientRect(),v=Math.min(1,Math.max(0,(innerHeight*.7-r.top)/r.height));fill.style.transform=`scaleY(${v})`;
let cur=0;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<innerHeight*.4)cur=i});
links.forEach((a,i)=>a.classList.toggle("on",i===cur));sp=p;
if(!RM){const s=$("#story"),b=s.getBoundingClientRect(),q=Math.min(.999,Math.max(0,-b.top/(b.height-innerHeight))),k=Math.floor(q*3);stg.forEach((e,i)=>e.classList.toggle("on",i===k));rl.forEach((e,i)=>e.classList.toggle("on",i<=k))}
tick=false}
addEventListener("scroll",()=>{if(!tick){tick=true;requestAnimationFrame(onScroll)}},{passive:true});onScroll();
if(matchMedia("(hover:hover)").matches&&!RM){document.addEventListener("pointermove",e=>{const c=e.target.closest&&e.target.closest(".card");if(!c)return;const b=c.getBoundingClientRect();c.style.setProperty("--ry",((e.clientX-b.left)/b.width-.5)*10+"deg");c.style.setProperty("--rx",(.5-(e.clientY-b.top)/b.height)*10+"deg")});document.addEventListener("pointerout",e=>{const c=e.target.closest&&e.target.closest(".card");if(c){c.style.removeProperty("--rx");c.style.removeProperty("--ry")}})}
if(window.THREE)(function(){
const mob=innerWidth<860;
let R=null;try{R=new THREE.WebGLRenderer({canvas:$("#gl"),alpha:true,antialias:!mob})}catch(e){}
if(!R){console.warn("Vish Flow: 3D scene disabled because WebGL is not available in this browser.");document.documentElement.classList.add("no3d");return}
R.setPixelRatio(Math.min(devicePixelRatio,mob?1.5:2));
const S=new THREE.Scene(),C=new THREE.PerspectiveCamera(45,1,.1,100);C.position.z=7;
const G=new THREE.Group();S.add(G);
const knot=new THREE.Mesh(new THREE.TorusKnotGeometry(1.2,.38,mob?120:220,mob?16:28),new THREE.MeshStandardMaterial({color:0x6d5cff,metalness:.85,roughness:.22}));
const wire=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,1),new THREE.MeshBasicMaterial({color:0x8fa8ff,wireframe:true,transparent:true,opacity:.22}));
G.add(knot,wire);
const AL=new THREE.AmbientLight(0x404070,.8);S.add(AL);
[[0x3d7bff,4,3,4],[0xe254c8,-4,-2,3],[0x8b5cf6,0,4,-3]].forEach(a=>{const l=new THREE.PointLight(a[0],2.2,30);l.position.set(a[1],a[2],a[3]);S.add(l)});
const N=mob?250:700,pa=new Float32Array(N*3);for(let i=0;i<N*3;i++)pa[i]=(Math.random()-.5)*24;
const pg=new THREE.BufferGeometry();pg.setAttribute("position",new THREE.BufferAttribute(pa,3));
const pts=new THREE.Points(pg,new THREE.PointsMaterial({size:.04,color:0xaab8ff,transparent:true,opacity:.7}));S.add(pts);
let mx=0,my=0,raf;
addEventListener("pointermove",e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
function size(){R.setSize(innerWidth,innerHeight,false);C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix()}
size();addEventListener("resize",size);
const col=new THREE.Color();
function frame(t){raf=requestAnimationFrame(frame);
const p=sp,x=mob?0:Math.cos(p*Math.PI*5)*2.2;
G.position.x+=(x-G.position.x)*.06;
G.position.y+=((mob?1.8:0)+Math.sin(p*Math.PI*4)*.5-G.position.y)*.06;
G.scale.setScalar((mob?.55:.82)*(1+Math.sin(p*Math.PI*6)*.25));
G.rotation.y=p*Math.PI*8+mx*.8+t*.00015;G.rotation.x=p*Math.PI*3+my*.6;
wire.rotation.y=-t*.0002;pts.rotation.y=p*1.5+t*.00002;pts.position.y=p*6-3;
const lt=rt.dataset.theme==="light";knot.material.metalness=lt?.12:.85;knot.material.roughness=lt?.28:.22;AL.intensity=lt?1.6:.8;AL.color.set(lt?0xe4e9ff:0x404070);col.setHSL(.62+p*.3,.8,lt?.6:.55);knot.material.color.lerp(col,.1);knot.material.emissive.copy(knot.material.color).multiplyScalar(lt?.22:0);pts.material.color.set(lt?0x5b4bd6:0xaab8ff);wire.material.color.set(lt?0x4a5fd6:0x8fa8ff);
R.render(S,C)}
frame(0);
document.addEventListener("visibilitychange",()=>{if(document.hidden)cancelAnimationFrame(raf);else frame(0)});
if(RM){cancelAnimationFrame(raf);th.addEventListener("click",()=>setTimeout(()=>{frame(0);cancelAnimationFrame(raf)},0))}
})();
if(!window.THREE){console.warn("Vish Flow: 3D scene disabled because vendor/three.min.js did not load.");document.documentElement.classList.add("no3d")}
