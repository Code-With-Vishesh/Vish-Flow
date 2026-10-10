# Vish Flow – Multi-Domain Internship Program

Landing website for Vish Flow, powered by Code With Vishesh. Plain HTML, CSS and JavaScript (no build step). Three.js r128 loads from cdnjs for the 3D scene.

## Files
- `index.html` – page structure and content
- `style.css` – all styles, including day/night themes (`[data-theme=light]` overrides)
- `script.js` – domain data and search/filters, FAQ, social icons, theme toggle, scroll animation, 3D scene
- `assets/logo-mark.webp` – V logo mark (nav, footer, tab icon)
- `robots.txt` – allows crawling (add a sitemap line after the real URL is confirmed)
- `vish-flow-single-file.html` – the same site as one self-contained file

## Authentication
Login/signup pages exist but need your Supabase project. See `docs/AUTH_STATUS.md` for status, setup and the manual test checklist. Run `npm install && npm test` for the automated tests.

## Run locally
Open `index.html` in a browser, or run `python3 -m http.server 8000` in this folder and visit http://localhost:8000.

## Deploy
Upload this folder to any static host: Netlify (drag and drop), Vercel, Cloudflare Pages, or GitHub Pages. No build command is needed.

## Things to edit
- Application form link: `FORM` at the top of `script.js`.
- WhatsApp link: search for `chat.whatsapp.com` in `index.html` and `script.js`.
- Social links: the `SOC` list in `script.js` (empty link = dimmed "soon" icon).
- Domains: the `D` list in `script.js` (change `status` to `Open` only once the plan and mentors are confirmed).
- FAQ answers and example projects: `F` and `P` lists in `script.js`.
- Footer contact details, privacy policy and terms: currently placeholders in `index.html`.

## Not built yet
React/TypeScript/Vite/Tailwind/Motion version, Lucide icons, per-domain detail pages, parallax and background transitions, sitemap, canonical URL, social preview image, and full device/Lighthouse testing.
