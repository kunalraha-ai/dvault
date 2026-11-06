# Setup guide

## Requirements

- Node.js 20+ (built with 22)
- npm 10+
- Chrome (for the extension)

## 1. Install & initialize

```bash
npm install
npm run db:push        # creates apps/web/prisma/dev.db (SQLite) from the Prisma schema
npm run build:extension
npm run dev            # web app at http://localhost:3000
```

## 2. Environment

Copy `apps/web/.env.example` to `apps/web/.env` and adjust:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | SQLite locally; Supabase PostgreSQL in production (see docs/SUPABASE.md) |
| `SUPABASE_URL` | *(empty)* | **Encrypted document storage in Supabase** — empty → local filesystem |
| `SUPABASE_SERVICE_ROLE_KEY` | *(empty)* | From Supabase dashboard → Settings → API (service_role, NOT anon) |
| `SUPABASE_STORAGE_BUCKET` | `dvault-documents` | Supabase Storage bucket name |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Base URL used by the extension and demo links |
| `DVAULT_DATA_DIR` | `.data` | Where client-encrypted document blobs are stored |
| `GNANI_API_KEY` | *(empty)* | **Real voice**. Empty → clearly-labelled browser fallback (see docs/GNANI_INTEGRATION.md) |
| `GNANI_STT_URL` / `GNANI_TTS_URL` | Gnani vachana endpoints | Override if your Gnani plan routes elsewhere |
| `GNANI_STT_MODEL` | `prisma-v3.0` | STT model (`prisma-v2.5` also supported) |
| `GNANI_TTS_MODEL` / `GNANI_TTS_VOICE` | `timbre-v2.5` / `Kaveri` | TTS model + voice from the Gnani catalog |
| `GNANI_DEFAULT_LANGUAGE` | `en-IN` | `hi-IN`, `hi-en`, `ta-IN`, `kn-IN`, `te-IN`, `ml-IN`, `mr-IN`, `bn-IN`, `gu-IN`, `pa-IN` |
| `LLM_API_KEY` (or `CF_API_TOKEN`) | *(empty)* | **AI-assisted mapping via Kimi K2.7 (code) on Cloudflare Workers AI.** Off → deterministic on-device mapper |
| `CF_ACCOUNT_ID` | *(empty)* | Your Cloudflare account ID — auto-builds the OpenAI-compatible base URL (`…/client/v4/accounts/{id}/ai/v1`) |
| `LLM_MODEL` | `@cf/moonshotai/kimi-k2.7-code` | Override for any OpenAI-compatible model |
| `LLM_BASE_URL` | *(auto from CF_ACCOUNT_ID)* | Override the endpoint entirely |

## Accounts & demo data

- **No account yet?** Click **“Enter the live demo — no account needed”** on the landing or
  login page (or the quiet *“walk straight into the live demo”* link in the hero). It walks you
  into a shared, fictional demo account (`demo@dvault.example.test`) that is **wiped and
  recreated on every entry**, then seeded client-side with the Aarav Mehta / NovaStack demo
  data through the same encrypted pipeline as real data. Never store real information in it —
  the sidebar marks it with a pink **DEMO** badge.
- Sign up at `/signup` for a real account. Onboarding walks you through profiles, input modes
  and the encryption model.
- On the dashboard, **Load demo data** seeds the same fictional dataset into *your own* account
  through the real, encrypted pipeline. All demo records are labelled **Fictional** in the UI.
- Delete everything anytime from **Settings → Danger zone**.

## 4. Running tests

```bash
npm run test       # unit: intent engine, mapping engine, crypto round-trips
npm run smoke       # end-to-end API: auth, encryption-at-rest, extension pairing,
                    # ownership isolation, honest voice status, reset flow
                    # (requires the server running: npm run dev or npm start)
```

## 5. Extension testing

```bash
npm run build:extension     # output: apps/extension/dist
```

Then: `chrome://extensions` → Developer mode → **Load unpacked** → select `apps/extension/dist`.
Full walkthrough: [docs/EXTENSION_GUIDE.md](EXTENSION_GUIDE.md).

Test pages (served by the web app itself):

- `http://localhost:3000/demo/grant-application.html` — startup grant (business vault) with
  text, email, tel, url, number, date, select, radio, checkbox, textarea, a file input and a
  deliberately-unsupported `contenteditable` widget.
- `http://localhost:3000/demo/bank-kyc.html` — personal KYC (identity fields, masked values).
- `http://localhost:3000/demo/confirmation.html?ref=...` — mock acknowledgement page for
  “D, save this application”.

## 6. Production build

```bash
npm run build       # web (next build) + extension (esbuild)
npm start           # serve the production web build on :3000
```

Behind HTTPS: set `NEXT_PUBLIC_APP_URL` to the public URL *before building*; the extension
reads it at pairing time (it is also entered manually in the popup).

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `prisma` errors | Run `npm run db:push` from the repo root (it targets apps/web) |
| Landing dark visuals missing | Hard-refresh; the SVG wave is inline and should render in any modern browser |
| OCR hangs on first image | tesseract.js downloads its WASM model on first use (~2 MB), then caches |
| PDF says “no text layer” | The PDF is a scan; PDF OCR is honestly not in the MVP — add fields manually |
| Extension can't reach the server | Check the server URL in the popup and that `npm run dev` is up |
