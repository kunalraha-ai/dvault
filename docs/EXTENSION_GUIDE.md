# Chrome extension guide

## Build & install

```bash
npm run build:extension          # → apps/extension/dist (content.js, background.js, popup.js, manifest, icons)
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `apps/extension/dist`
4. Pin the D-Vault icon for easy access

## Pair

Open the popup (toolbar icon) and enter:

- **Server URL** — `http://localhost:3000` (or your deployment URL)

That's all — there are no accounts. Pairing calls `POST /api/extension/pair`, which registers
a **ConnectedDevice** (revocable in the web app's Security Center) and returns the vault's
AES-256-GCM instance key, which the extension keeps in `chrome.storage.local`, protected by
the Chrome profile. Unpairing deletes it and revokes the token server-side.

## Use

1. Open any page with a form (try `http://localhost:3000/demo/grant-application.html`).
2. **Click the D toolbar icon** — this grants `activeTab` and injects the floating D button
   + assistant panel for that tab. Pages are **never** touched before this click.
3. Click the floating D → the panel opens.
4. Speak or type: **“D, fill this form using my business profile”** (chips provided).
5. The inspector extracts field **metadata** (labels, placeholders, types, options — never
   values), the on-device mapper scores every candidate, and only the *needed* field keys
   are fetched from your vault — encrypted, then decrypted locally.
6. Review: every proposed field with its confidence (High → auto-proposed, Medium → manual
   pick, Low → ask, missing → flagged). Toggle, edit values, change mappings, reveal masked
   sensitive values with the eye toggle.
7. **Fill approved** → D writes values using native setters (React/Vue/Angular-safe), then
   reports filled/skipped/unsupported.
8. **You press Submit.** D never submits, never touches CAPTCHAs or OTPs.
9. On a confirmation page: **“D, save this application”** → consent dialog → URL, domain,
   date, reference (auto-detected from the page, editable) and — if you allow it — an
   encrypted screenshot are saved to your application memory.

## Security model

| Control | Implementation |
|---|---|
| Permissions | Only `storage`, `activeTab`, `scripting`. `optional_host_permissions` exist for an opt-in “always show” mode and are NOT requested by default |
| Activation | `chrome.action.onClicked` → `chrome.scripting.executeScript`. No manifest content scripts; nothing runs on page load |
| No surveillance | No browsing history, no background page reads, no auto-save of form content |
| Screenshot consent | `chrome.tabs.captureVisibleTab` only fires after the per-save consent card is accepted; each capture is logged to your consent trail (`/api/extension/consent`) |
| Scoped retrieval | The extension requests only the field keys needed for the current task (`POST /api/extension/vault-values`); never the whole vault |
| Encryption in transit & at rest | All values travel as AES-GCM envelopes; the server can't decrypt anything |
| OTP/CAPTCHA | Inspector explicitly skips fields matching OTP/verification-code/captcha patterns |
| Untrusted page text | Website labels are only *compared* against a fixed lexicon — they can never alter D's rules, permissions or security model |
| Revocation | Security Center → unpair instantly revokes the device token; password reset revokes all devices |

## Field type support (honest)

| Supported | Notes |
|---|---|
| `<input type=text/email/tel/url/number/date>` | Filled with typed conversion |
| `<textarea>` | Filled, events dispatched |
| `<select>` | Matched case-insensitively against vault value; skipped if no match |
| `radio` groups | Matched by value/label prefix |
| **Unsupported** | file inputs, checkboxes, custom widgets (`contenteditable`, canvas), cross-origin iframes — these are *labelled* in the review, never guessed |

## Known limitations

- Voice in the panel requires the D-Vault server to have Gnani configured (or falls back to
  browser speech); typing always works.
- Re-activation is needed after page navigation (activeTab grant is per-navigation by design —
  that's the security model working, not a bug).
- The floating button exists only after activation in this MVP; an opt-in always-visible mode
  (requiring broad host permissions) is future work.

## Project layout

```
apps/extension/
├── public/manifest.json     # MV3 manifest (minimal permissions)
├── public/popup.html        # pairing UI
├── src/background.ts       # service worker: activation, API relay, screenshots
├── src/content.tsx          # shadow-DOM host + styles (entry: content.js)
├── src/popup.ts             # popup logic
├── src/panel/DPanel.tsx     # assistant panel (React, in shadow DOM)
├── src/form-inspector.ts    # metadata-only DOM extraction
├── src/autofill.ts          # native-setter value writing
├── src/store.ts             # pairing + key storage (chrome.storage.local)
└── scripts/build.mjs        # esbuild → dist/  |  scripts/gen-icons.mjs → PNG icons
```
