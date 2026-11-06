# Implemented vs. mocked/pending — the honest list

## Fully implemented & verified in this build

| Area | Status | Evidence |
|---|---|---|
| No-auth local mode (single implicit user, server-held AES instance key) | ✅ real | `/api/auth/session` bootstraps user + key on first call; smoke §1 |
| Zero-login entry — app opens directly | ✅ real | smoke §6: `/dashboard` 200 with no cookie; `/login` 404 |
| Client-side AES-256-GCM encryption of every sensitive value | ✅ real | unit tests + smoke: server stores only ciphertext |
| PBKDF2-SHA256 600k key derivation, per-user salt | ✅ real | `packages/core/src/crypto.ts` + tests |
| Personal vault: 6 categories, 32 fields, add/edit/delete/verify/mask/source-tracking | ✅ real | `/vault/personal` + `/api/profiles/[id]/fields` |
| Business vault: 4 categories, 47 fields, multiple profiles | ✅ real | `/vault/business` |
| Voice updates ("D, our company has 12 employees") with confirmation | ✅ real (deterministic NLU; browser fallback voice) | unit tests + assistant UI |
| Document upload (drag & drop), client-side encryption, opaque storage, rename/delete | ✅ real | smoke step 5 |
| OCR for images (tesseract.js, on-device, WASM) | ✅ real | runs in the browser; first use downloads the model |
| PDF text-layer extraction (pdf.js) | ✅ real for digital PDFs; scanned PDFs reported honestly as unsupported | `src/lib/client/ocr.ts` |
| Regex candidate extraction (Aadhaar/PAN/GSTIN/CIN/email/phone/PIN/dates) + review + conflicts warning | ✅ real | review modal with per-field approve/edit |
| Application memory: save, list, filter, sort, status history, notes, attachments | ✅ real | smoke step 6 |
| Application save from extension incl. encrypted screenshot + receipt | ✅ real | `/api/extension/save-application` |
| Consent log (inspections, fills, screenshots) | ✅ real | Security Center |
| Security Center: sessions, devices, revoke, sync status | ✅ real | `/security` |
| Data export (full JSON) & account deletion (blob wipe) | ✅ real | `/api/account/export`, `DELETE /api/account` |
| Intent engine (structured JSON, 12 intents) | ✅ real, deterministic, on-device | 15 unit tests |
| Semantic mapping engine + confidence scores + alternatives | ✅ real, deterministic, on-device | unit tests incl. mock-grant labels |
| Chrome extension: MV3, minimal permissions, activation-only injection | ✅ real | `apps/extension/dist` builds; verified structure |
| Floating D button + shadow-DOM panel with all review controls | ✅ real | built bundle; runtime testing requires Chrome (see below) |
| Form inspection (metadata only), unsupported-type labelling, OTP/CAPTCHA skip | ✅ real | `form-inspector.ts` |
| Approved-only autofill with native setters (framework-safe), no auto-submit | ✅ real | `autofill.ts` |
| Extension pairing + scoped, encrypted vault retrieval | ✅ real | smoke steps 7 |
| Ownership isolation across users | ✅ real | smoke: cross-user reads → 404 |
| Rate limiting (in-memory) | ✅ real, per-process | `rate-limit.ts` |
| Gnani.ai adapter — full documented contract (STT v3 + TTS inference) | ✅ real code | `lib/voice/gnani.ts`; endpoints + payload match docs.gnani.ai |
| Honest voice status everywhere (configured: false + fallback labels) | ✅ real | smoke step 9, `/api/voice/status` |
| WAV recording (PCM AudioWorklet → WAV, since Gnani rejects WebM) | ✅ real | `packages/core/src/wav.ts` |
| Onboarding flow (5 steps, skippable) | ✅ real | `/onboarding` |
| Demo data loader (fictional, encrypted through the real pipeline, labelled) | ✅ real | dashboard button |
| Responsive layout (desktop sidebar, mobile drawer + bottom nav) | ✅ real | app shell |
| Unit + E2E test suites | ✅ real | `npm run test` (41), `npm run smoke` (28), `npm run verify:wave` (20) |

## Works, with clearly-labelled dev-mode caveats

| Area | Caveat |
|---|---|
| Voice capture without Gnani keys | Browser Web Speech fallback, labelled “not Gnani.ai” everywhere. Configure `GNANI_API_KEY` → the same UI uses real Gnani STT/TTS |
| AI-assisted mapping | Optional — defaults to **Kimi K2.7 (code) on Cloudflare Workers AI** (`@cf/moonshotai/kimi-k2.7-code`); without `LLM_API_KEY`/`CF_API_TOKEN` the deterministic on-device mapper is used and reported honestly (`mapping: "deterministic-engine"`). Only field metadata (labels/types/options — never values) is sent; the adapter tolerates Workers AI's `response_format` rejection and Kimi's fenced-JSON output, verified against a mock of the Cloudflare endpoint |
| Local “cloud backup” store | Local filesystem holding client-encrypted blobs (`.data/storage`). Production: S3/R2 behind the same interface |
| One-click demo account (`demo@dvault.example.test`, public password `dvault-demo-2026`) | Shared, fictional, badged **DEMO** in the sidebar. Wiped & recreated on every entry (`POST /api/auth/demo`), so it never accumulates real data; password change/reset blocked for it. Real accounts are unaffected |

## Mocked / demo-only (explicitly fictional)

- Mock grant site, bank KYC, confirmation page (`/demo/*.html`) — mock, labelled
- Landing page follows the provided design SVG (`D-Vault — Bell Curve Landing Page.zip`): exact Gaussians, palette and section stack
- Demo profiles (Aarav Mehta, NovaStack Technologies), demo applications — fictional, badged “Fictional”, loaded via the dashboard button, erasable anytime

## Pending / not in the MVP (no pretence)

| Area | Notes |
|---|---|
| Extension end-to-end test in real Chrome | The bundle builds and is structurally verified (manifest, icons, bundle size, TS-clean), but could NOT be click-tested inside this build environment — it needs `chrome://extensions` → Load unpacked. The demo walkthrough is prepared for exactly that |
| Automatic application-status tracking | Deliberately not built; statuses are user-set only. “Status unknown” is shown honestly |
| PDF OCR (scanned PDFs) | Text-layer only; scans reported as unsupported |
| Cross-origin iframe forms, complex custom widgets (canvas signature, rich editors) | Labelled unsupported in the review panel |
| OTP autofill | Never (by design) |
| Indic-language intent parsing | Gnani STT supports Indic transcripts; command understanding is English-first |
| Recovery-phrase re-encryption on password reset | Zero-knowledge means old data is unrecoverable after reset — warned in UI; a re-key flow is roadmap |
| Always-visible floating button (opt-in host permissions) | Toolbar-click activation only in MVP (strictest model) |
| Redis-backed rate limiting, audit retention, WAF | Production hardening documented in docs/SECURITY.md |
| Full PWA/offline vault editing | Local cache is read-only; write offline → sync is future work |
