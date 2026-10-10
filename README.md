# Vish Flow — Multi-Domain Internship Program
Powered by Code With Vishesh. यह repository साइट (`site/`), database के नियम (`supabase/`) और GitHub automation (`.github/workflows/`) एक जगह रखती है।

## फ़ोल्डर
| फ़ोल्डर | क्या है |
|---|---|
| `site/` | वेबसाइट और login/signup पेज (सादा HTML/CSS/JS, कोई build नहीं) |
| `supabase/migrations/` | database की migration फ़ाइलें। नई फ़ाइल जोड़ने पर GitHub उसे Supabase पर चला सकता है |
| `supabase/rollbacks/` | migration वापस लेने की स्क्रिप्ट (अपने-आप नहीं चलती) |
| `supabase/local-tests/` | database के 46 सुरक्षा टेस्ट (सिर्फ़ local/CI पर, असली project पर नहीं) |
| `.github/workflows/` | CI टेस्ट, GitHub Pages पर साइट डालना, Supabase पर migration चलाना |
| `docs/` | सुरक्षा योजना और authentication की स्थिति |

## पूरा सेटअप (एक बार, लगभग 20 मिनट)

### 1. GitHub पर repository बनाओ और code डालो
github.com पर **New repository** → नाम `vish-flow` → **Public** (मुफ़्त Pages के लिए) → बिना README के बनाओ। फिर इस फ़ोल्डर में टर्मिनल खोलकर:
```
git init
git add .
git commit -m "Initial Vish Flow project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/vish-flow.git
git push -u origin main
```
(टर्मिनल नहीं चाहिए तो GitHub के पेज पर **uploading an existing file** से पूरा फ़ोल्डर खींचकर डाल सकते हो, पर `.github` फ़ोल्डर छूटना नहीं चाहिए।)

### 2. Supabase project बनाओ और database तैयार करो
1. supabase.com → **New project** (नाम `vish-flow`)। Database password सुरक्षित लिख लो।
2. पहली बार migration हाथ से चलाने का सबसे आसान तरीका: **SQL Editor** में `supabase/migrations/20261010000000_identity_core.sql` की सामग्री चिपकाकर **Run**।
   (अगर इसे हाथ से चलाओ तो step 4 का "Migrations" workflow पहली बार मत चलाओ, वरना वही migration दोबारा चलने की कोशिश करेगा। या हाथ से मत चलाओ और सिर्फ़ workflow से चलने दो।)

### 3. Supabase को repo से जोड़ने के दो रास्ते (एक चुनो)
**रास्ता A: इस repo की GitHub Actions (हमने बना दी है)**
GitHub repo → **Settings → Secrets and variables → Actions**:
- **Secrets** टैब में तीन जोड़ो: `SUPABASE_ACCESS_TOKEN` (supabase.com/dashboard/account/tokens से), `SUPABASE_DB_PASSWORD` (step 2 वाला पासवर्ड), `SUPABASE_PROJECT_ID` (आपके URL का `xxxx` हिस्सा: `https://xxxx.supabase.co`)।
- अब `supabase/migrations/` में कोई नई फ़ाइल push करो या **Actions → Apply database migrations → Run workflow** दबाओ। यह पहले dry-run करता है, फिर लागू करता है।

**रास्ता B: Supabase का अपना GitHub integration**
Supabase dashboard → **Project Settings → Integrations → GitHub** → अपना repo चुनो → "Supabase directory" में `supabase` लिखो। फिर Supabase खुद migrations लागू करेगा। (रास्ता A और B दोनों साथ चालू मत रखना।)

### 4. साइट को GitHub Pages पर डालो
1. **Settings → Pages → Source: GitHub Actions** चुनो।
2. **Settings → Secrets and variables → Actions → Variables** टैब में (ये public हैं): `SUPABASE_URL` और `SUPABASE_ANON_KEY` (anon/publishable key)। `GOOGLE_ENABLED` तभी `true` करो जब Google login सच में सेट हो।
3. **service_role / secret key यहाँ या कहीं भी साइट में मत डालो।** workflow उसे पकड़कर build रोक देगा।
4. `main` पर push करो। **Actions → Deploy site** चलेगा और साइट `https://YOUR-USERNAME.github.io/vish-flow/` पर आएगी।

### 5. Supabase को साइट का पता बताओ (ज़रूरी)
Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://YOUR-USERNAME.github.io/vish-flow/`
- **Redirect URLs** में जोड़ो: `https://YOUR-USERNAME.github.io/vish-flow/auth-callback.html` और `https://YOUR-USERNAME.github.io/vish-flow/reset-password.html`
- (local टेस्ट के लिए `http://localhost:8000/auth-callback.html` और `.../reset-password.html` भी)
- **Authentication → Providers → Email**: Confirm email चालू, minimum password length 10।

### 6. जाँच
`https://YOUR-USERNAME.github.io/vish-flow/signup.html` खोलो और `docs/AUTH_STATUS.md` की जाँच-सूची चलाओ।

## Local में चलाना
```
cd site   # config.js में अपनी public URL और anon key डालो
python3 -m http.server 8000                # http://localhost:8000/signup.html
npm install && npm test                    # 16 टेस्ट
```
**असली चाबियाँ commit मत करना।** `config.js` में सिर्फ़ public URL और anon key आती है।

## ईमानदारी से: क्या जाँचा गया है
- Local में जाँचे: database के 46 टेस्ट, साइट के 16 टेस्ट, workflow YAML का syntax।
- **अभी असली GitHub और असली Supabase पर नहीं चले।** workflows पहली बार आपके repo में चलेंगे; कोई step फ़ेल हो तो Actions का लॉग देखकर मुझे भेजो।
