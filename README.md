# D-VAULT

**Your information. Every form. One voice.**

Voice-first personal information vault and universal form-filling copilot. Store your personal
and business information once — encrypted on your device — fill any standard web form by voice,
and keep every application's reference numbers, screenshots and receipts in a searchable memory.

> **REMEMBER · FILL · RETRIEVE**

---

## Quick start

```bash
# 1. install
npm install

# 2. initialize the database (SQLite for local dev, PostgreSQL-ready schema)
npm run db:push

# 3. build the Chrome extension (→ apps/extension/dist)
npm run build:extension

# 4. run the web app
npm run dev          # http://localhost:3000
```

> **No accounts at all.** D-Vault runs in no-auth local mode — the app opens directly at
> `/dashboard`. On the dashboard, **Load demo data** seeds the fictional Aarav Mehta /
> NovaStack dataset through the real encrypted pipeline (one click, clearly labelled).

Optional checks:

```bash
npm run test          # 41 unit tests: intent engine, mapping engine, crypto
npm run smoke         # 28 end-to-end API checks (no-auth flow) against a running server
npm run verify:wave   # 20 design-fidelity checks of the bell-curve field (live page)
npm run build:web     # production build
```

## What's inside

| Path | What it is |
|---|---|
| `apps/web` | Next.js 16 app — landing, auth, vaults, documents, D assistant, applications, security center |
| `apps/extension` | Chrome MV3 extension — floating D button, form inspection, confidence-scored mapping, review-and-approve autofill |
| `packages/core` | Shared domain: vault field catalog, semantic mapping engine, intent engine, client-side crypto, WAV recorder |
| `scripts/smoke-test.mjs` | End-to-end API verification |
| `scripts/verify-wave.mjs` | Geometric verification of the bell-curve field against the live page |
| `apps/web/public/demo` | Mock grant application + mock bank KYC for extension testing |

## Visual identity — from the provided design (`Desktop.svg`)

The landing page is rebuilt to the exact construction of the supplied design file:

- **`GiantBellCurve`** renders the field as four stacked Gaussian stripe layers, with the
  design's exact parameters — blue **#2E6EFA** core (21 stripes, h=3, σ=104, W=1350),
  a faint **#5291FF** echo (31 stripes, h=1, W=1260), a white **#F0F5FF** halo (9 stripes,
  σ=82, W=1120) and bright white core (9 stripes) centered directly beneath, plus 3 tiny
  **#FA6EAB** squares. Stripe widths follow `w(y) = W·exp(−(y−cy)²/2σ²)`; opacity falls off
  linearly; stripes are sharp-edged (no rounding), exactly as in the SVG.
- **Sections follow the design stack**: hero curves → `01 — REMEMBER` (#090F21) →
  `02 — FILL` (#060B1B, mapping card #131F3B/#142140 with pink confidence dots) →
  `03 — RETRIEVE` (light #F0F5FF with the memory record + #E8F2FF chip) → finale
  (#091025, right-anchored blue σ=72/W=650 and white σ=58/W=520 bells at cx=1040).
- **Palette** is design-derived everywhere: #060B1B page, #091025/#090F21/#0A1229 navies,
  #2E6EFA/#5291FF blues, #FA6EAB pink, #F0F5FF white, #9CABC9 muted, #405C94 hairlines —
  applied across the app shell, `DBadge`, `DVaultWave`, the Chrome extension popup/panel
  and the extension icons.
- Gentle drift, breathing and per-stripe brightness waves + scroll **parallax** —
  CSS transform/opacity only, disabled under `prefers-reduced-motion`.

`npm run verify:wave` asserts design fidelity against the live page (20 checks: Gaussian
fits < 0.5% error, layer counts, section stack, finale geometry).

## Documentation

| Doc | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Full setup, env vars, database, demo walkthrough |
| [docs/GNANI_INTEGRATION.md](docs/GNANI_INTEGRATION.md) | Gnani.ai voice: contract, status, setup checklist |
| [docs/EXTENSION_GUIDE.md](docs/EXTENSION_GUIDE.md) | Chrome extension: install, pairing, security model |
| [docs/SECURITY.md](docs/SECURITY.md) | Encryption architecture, threat model, controls |
| [docs/LIMITATIONS.md](docs/LIMITATIONS.md) | **Implemented vs. mocked/pending — honest list** |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema, migrations, PostgreSQL switch |
| [docs/SUPABASE.md](docs/SUPABASE.md) | **Supabase setup** — encrypted document storage + PostgreSQL database |

## The 5-minute demo (founder → startup grant)

1. **Sign up** at `http://localhost:3000/signup` → onboarding creates your profiles.
2. On the dashboard, click **Load demo data** — a fictional founder (Aarav Mehta) and company
   (NovaStack Technologies) are seeded through the real encrypted pipeline, clearly labelled fictional.
3. Load the extension (`chrome://extensions` → Load unpacked → `apps/extension/dist`), pair it
   with your account from the toolbar popup.
4. Open the mock grant site: `http://localhost:3000/demo/grant-application.html`.
5. Click the **D** toolbar icon, then the floating D button → say
   *"D, fill this form using my business profile"* (or use the typed input / command chips).
6. Review the confidence-scored mapping, approve, **D fills — you press Submit**.
7. The mock confirmation page shows a fictional reference number. Say *"D, save this application"*
   → D saves URL, reference and (with consent) a screenshot to application memory.
8. Later: *"D, what was my startup grant application reference number?"* — retrieved from memory.

## Non-negotiables honored

- Hybrid storage: encrypted local cache (IndexedDB) + encrypted cloud backup (server holds only ciphertext)
- No always-on listening; no page inspection before the explicit D click
- Voice-first with visual confirmation — every voice action has a typed equivalent
- Gnani.ai is the voice provider — the UI reports its **real** configuration status honestly
- D never presses Submit; OTPs are never stored; screenshots require per-save consent
- Application records save only after explicit user authorization

## License

MIT (demo data is fictional; no real identifiers are used anywhere).
