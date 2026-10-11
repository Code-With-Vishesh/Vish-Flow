# Supabase को जोड़ना और जाँचना (आपका project: `kmblvbbfijnhteqawocc`)

## अभी तक क्या मिला (आपकी अपलोड की हुई repo से)
- `site/config.js` में आपका Project URL और **publishable key** है, `GOOGLE_ENABLED: true` है। secret/service-role key कहीं नहीं मिली, यह सही है।
- `.env` और `.gitignore`: `.env` git में commit नहीं है, अच्छा। पर `.env` इस साइट में इस्तेमाल ही नहीं होती (वह Next.js quickstart की है)।
- `app/page.tsx` और `utils/supabase/*` Next.js quickstart के बचे हुए हैं। `app/page.tsx` ऐसी `todos` तालिका पढ़ता है जो है ही नहीं। साइट इन्हें नहीं छूती। साफ़ रखने के लिए हटाने का सुझाव: `git rm -r app utils` (history में वापस मिल जाएँगे)।
- `.agents/` और `skills-lock.json` Supabase के AI-skills हैं। हानिरहित, चाहें तो `.gitignore` में डाल दें।

## 1. database की स्थिति जाँचो (2 मिनट)
Supabase → **SQL Editor** → `supabase/verify/verify_setup.sql` की सामग्री चिपकाकर **Run**।
- हर पंक्ति **PASS** होनी चाहिए। "a super_admin exists" पर **NOTE** आए तो ठीक है, नीचे step 4 देखें।
- "Migration not applied" एरर आए तो पहले `supabase/migrations/20261010000000_identity_core.sql` चलाइए (या GitHub का Migrations workflow)।

## 2. Authentication की सेटिंग (Supabase dashboard)
**Authentication → URL Configuration**
- Site URL: `https://code-with-vishesh.github.io/Vish-Flow/`
- Redirect URLs (सब जोड़िए):
  - `https://code-with-vishesh.github.io/Vish-Flow/auth-callback.html`
  - `https://code-with-vishesh.github.io/Vish-Flow/reset-password.html`
  - local टेस्ट के लिए: `http://localhost:8000/auth-callback.html` और `http://localhost:8000/reset-password.html`

**Authentication → Providers → Email:** Confirm email चालू, minimum password length 10।

**Google login चालू रखना है तो** (`GOOGLE_ENABLED: true` है, इसलिए यह ज़रूरी है, वरना बटन दबाने पर "not available" दिखेगा):
1. Google Cloud Console → APIs & Services → Credentials → **OAuth client ID** (Web application)।
2. वहाँ **Authorized redirect URI**: `https://kmblvbbfijnhteqawocc.supabase.co/auth/v1/callback`
3. मिले हुए **Client ID और Client Secret** Supabase → Authentication → Providers → **Google** में डालकर चालू करें। (Client Secret सिर्फ़ Supabase में डालें, कहीं और नहीं।)
4. अभी Google नहीं चाहिए तो `site/config.js` में `GOOGLE_ENABLED: false` कर दें।

## 3. साइट से जीवित जाँच
साइट खोलकर `connection-check.html` पर जाइए (जैसे `https://code-with-vishesh.github.io/Vish-Flow/connection-check.html`, या local में `http://localhost:8000/connection-check.html`)। यह बताता है: config सही है या नहीं, Supabase पहुँच में है या नहीं, migration लगी है या नहीं, email confirmation चालू है या नहीं, Google provider चालू है या नहीं, और आपकी तालिकाएँ बाहरी लोगों से बंद हैं या नहीं। हर ✗ के साथ लिखा आता है कि क्या ठीक करना है।

## 4. पहला super admin (एक बार)
पहले साइट पर signup करके ईमेल confirm कीजिए। फिर SQL Editor में:
```sql
insert into public.user_roles(user_id, role)
select id, 'super_admin' from public.profiles
where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
```

## 5. GitHub से deploy
- GitHub → Settings → Pages → Source: **GitHub Actions**।
- अब `deploy-pages.yml` repository variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_ENABLED`) हों तो उनसे, वरना committed `site/config.js` से config बनाती है। secret key मिले तो build रोक देती है।
- Migrations workflow के लिए तीन **Secrets** चाहिए: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` (= `kmblvbbfijnhteqawocc`)। अगर migration आपने SQL Editor से पहले ही चला दी है, तो Migrations workflow मत चलाइए (वह दोबारा चलाने की कोशिश करेगा)।

## यह मैंने जाँचा और यह नहीं
- जाँचा: config.js का format सही है और उसमें secret key नहीं; database जाँच की SQL और connection-check पेज मेरे local टेस्ट में सही चलते हैं।
- **नहीं जाँचा:** मेरा sandbox `supabase.co` तक नहीं पहुँच सकता, इसलिए मैंने आपके असली प्रोजेक्ट से कनेक्शन, migration, email, Google या GitHub workflows नहीं चलाए। इसीलिए ऊपर के दो जाँच-औज़ार (SQL और connection-check पेज) आप खुद चलाइए और नतीजा भेजिए।

## अगर Google (या कोई भी) login के बाद "This link is invalid or has expired" दिखे
यह मेरी एक गलती से हो सकता है, जो अब ठीक कर दी है: Supabase में `pgcrypto` अलग `extensions` schema में रहती है। मेरी पहली migration का ID बनाने वाला function उसे ढूँढ नहीं पाता था, इसलिए **हर नए signup पर** (ईमेल या Google) "Database error saving new user" आता था और login पेज वही सामान्य संदेश दिखाता था।
1. SQL Editor में `supabase/migrations/20261012000000_fix_random_without_pgcrypto.sql` चलाइए (एक बार)।
2. `supabase/verify/verify_setup.sql` चलाइए। अब यह पहले ही बता देता है कि signup टूटेगा या नहीं।
3. नई `auth.js`/`auth-core.js` push कीजिए। अब callback पेज असली कारण भी दिखाता है ("Details: ..."), और अलग-अलग गलतियों के लिए अलग सुझाव देता है।
4. Google से फिर कोशिश कीजिए। फिर भी एरर आए तो पेज पर लिखा "Details" वाला हिस्सा मुझे भेजिए।
नोट: migration हाथ से चलाई हो तो GitHub का "Apply database migrations" workflow मत चलाइए।
