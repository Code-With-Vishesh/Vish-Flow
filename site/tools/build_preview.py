"""Builds ../../vish-flow-account-preview.html: all account screens in ONE file for design review (not functional)."""
import re, base64, os
os.chdir(os.path.join(os.path.dirname(__file__), ".."))
css = open("style.css", encoding="utf-8").read() + "\n" + open("auth.css", encoding="utf-8").read()
logo = "data:image/webp;base64," + base64.b64encode(open("assets/logo-mark.webp", "rb").read()).decode()
wave = open("wave.js", encoding="utf-8").read()
authjs = open("auth.js", encoding="utf-8").read()
eye = authjs[authjs.index("// Show/hide password toggles"):authjs.index("// Google sign-in")]
V = [("login", "login.html", "Log in"), ("signup", "signup.html", "Sign up"), ("forgot", "forgot-password.html", "Forgot password"),
     ("dashboard", "dashboard.html", "Dashboard"), ("profile", "profile.html", "Profile"), ("security", "security.html", "Security")]
GO = {"login.html": "login", "signup.html": "signup", "forgot-password.html": "forgot", "dashboard.html": "dashboard", "profile.html": "profile", "security.html": "security"}
secs = ""
for k, f, _ in V:
    h = open(f, encoding="utf-8").read()
    card = re.search(r'<div class="auth-card">(.*?)</div></main>', h, re.S).group(1)
    card = re.sub(r'<div class="msg" id="cfgwarn"[^>]*></div>\n', "", card)
    card = re.sub(r'\b(id|for)="([^"]+)"', lambda m: '%s="v-%s-%s"' % (m.group(1), k, m.group(2)), card)
    card = card.replace('href="index.html" aria-label="Close', 'href="#" data-go="login" aria-label="Close')
    card = re.sub(r'href="([a-z-]+\.html)"', lambda m: 'href="#" data-go="%s"' % GO[m.group(1)] if m.group(1) in GO else m.group(0), card)
    secs += '<section class="auth-card" data-view="%s" hidden>%s</section>\n' % (k, card)
tabs = "".join('<button class="chip" data-tab="%s" aria-pressed="false">%s</button>' % (k, l) for k, _, l in V)
js = '''
var $=function(s,r){return(r||document).querySelector(s)};
function show(k){document.querySelectorAll("[data-view]").forEach(function(c){c.hidden=c.dataset.view!==k});document.querySelectorAll("[data-tab]").forEach(function(b){b.setAttribute("aria-pressed",b.dataset.tab===k)});document.querySelectorAll('[id$="-msg"]').forEach(function(m){m.hidden=true})}
function note(el){var m=el.closest("[data-view]").querySelector('[id$="-msg"]');m.textContent="Preview only: connect Supabase to make this work.";m.className="msg";m.hidden=false}
document.addEventListener("click",function(e){var t=e.target.closest("[data-tab],[data-go]");if(t){e.preventDefault();show(t.dataset.tab||t.dataset.go);return}
 var s=e.target.closest(".sbtn,#v-dashboard-logout,#v-security-out-all,#v-security-out-others,#v-profile-copy");if(s)note(s)});
document.querySelectorAll("form").forEach(function(f){f.addEventListener("submit",function(e){e.preventDefault();note(f)})});
function set(id,v){var e=document.getElementById(id);if(e)e.textContent=v}
["dashboard","profile"].forEach(function(k){set("v-"+k+"-pid","VF-7K4M-9Q2X");set("v-"+k+"-status","active")});
set("v-dashboard-name","Example Student");set("v-dashboard-email-state","Confirmed");set("v-dashboard-roles","student");
document.querySelectorAll(".sbtn").forEach(function(b){b.disabled=false;b.removeAttribute("title")});document.querySelectorAll("#v-login-gnote,#v-signup-gnote").forEach(function(n){n.hidden=true});
$("#v-profile-f-name").value="Example Student";$("#v-profile-f-bio").value="Learning web development with Vish Flow.";
''' + eye + '''
$("#theme").addEventListener("click",function(){var t=document.documentElement.dataset.theme==="light"?"dark":"light";document.documentElement.dataset.theme=t;try{localStorage.setItem("vf-theme",t)}catch(e){}});
show("login");
'''
html = '''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Vish Flow account pages (preview)</title>
<script>(function(){var t;try{t=localStorage.getItem("vf-theme")}catch(e){}if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t})()</script>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@500;700;800&family=Manrope:wght@400;500;600&display=swap">
<style>''' + css + '''
.pv-top{position:absolute;top:0;left:0;right:0;z-index:2;display:flex;flex-wrap:wrap;gap:.6rem 1rem;align-items:center;padding:1rem 1.25rem}
.pv-tabs{display:flex;flex-wrap:wrap;gap:.4rem;flex:1}
.pv-banner{max-width:480px;margin:0 auto 1.6rem;text-align:center;font-size:.9rem;color:var(--mute)}
.auth-card[hidden]{display:none}
</style></head><body data-page="preview"><canvas id="wave" aria-hidden="true"></canvas>
<div class="pv-top"><a class="logo" href="#" aria-label="Vish Flow"><img class="mark" src="''' + logo + '''" alt="" width="44" height="33">Vish Flow</a>
<nav class="pv-tabs" aria-label="Preview pages">''' + tabs + '''</nav>
<button id="theme" class="theme" type="button" aria-label="Toggle day or night mode"><svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg><svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button></div>
<main class="auth-wrap" style="padding-top:8rem"><div style="width:100%"><p class="pv-banner">Design preview only. These pages are not connected to Supabase, so buttons don't sign anyone in. The ID and name shown are examples.</p>
<div style="display:grid;place-items:center">''' + secs + '''</div></div></main>
<script>''' + js + '''</script><script>''' + wave + '''</script></body></html>'''
open("../vish-flow-account-preview.html", "w", encoding="utf-8").write(html)
print(len(html))
