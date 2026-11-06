# Security architecture

> Scope: hackathon MVP with production-grade *architecture*, honestly labelled.
> See docs/LIMITATIONS.md for what is implemented vs. pending.

## Encryption model (no-auth local mode)

```
┌─ Server first run ─────────────────────────────────────────┐
│ generates a random AES-256-GCM instance key (JWK) once,     │
│ stored in the local user row                                │
└──────────────┬──────────────────────────────────────────────┘
               │ JWK handed to the local client (web app /
               │ paired extension) over the same channel
┌─ User's device ────────────────────────────────────────────┐
│ every value is still AES-256-GCM encrypted on the client   │
│  · vault fields, OCR text, reference IDs, notes             │
│  · documents, screenshots, receipts (bytes)                 │
└──────────────┬──────────────────────────────────────────────┘
               │ only { ciphertext, iv } envelopes
               ▼
┌─ D-Vault server ───────────────────────────────────────────┐
│ stores envelopes; blobs under opaque random keys, no public │
│ URLs; downloads via owner-checked routes only               │
└──────────────────────────────────────────────────────────────┘
```

- **Values are encrypted client-side** and stored as ciphertext-only — the DB is
  never plaintext for any field, note, reference or attachment.
- **Honest trade-off of removing accounts:** the instance key lives on your
  self-hosted server, so encryption protects the stored data (and against
  DB-only leaks where the key table is excluded), **not against the server
  itself**. D-Vault is designed for single-user self-hosting; bind it to
  localhost or a private network. A password-based zero-knowledge variant
  remains possible as future work (the envelope format is identical).
- **No sessions, no cookies, no login surface.** An attacker's only surface is
  the network path — rate limits and same-origin checks remain in place.
- **OTP/PIN policy:** never captured, stored, logged or included in memory;
  the extension inspector skips OTP/CAPTCHA-like fields explicitly.

## Transport & sessions

- Session cookies: `httpOnly`, `sameSite=lax`, `secure` in production, 7-day expiry, token
  stored SHA-256-hashed; sessions revocable from Security Center.
- Extension devices: random 32-byte tokens (hashed at rest), revocable; password reset revokes all.
- CSRF: mutating cookie-authenticated routes check same-origin; extension routes are
  token-authenticated (no cookies) and CORS-open only for those specific paths.
- Rate limiting: per-IP / per-user in-memory buckets on auth, STT, TTS, mapping, pairing.

## Authorization

Every user-owned query resolves through ownership joins (`profile → user`, `document → user`,
`application → user`); ownership is enforced server-side on all routes (verified by the smoke
test: cross-user reads return 404).

## Upload validation

- Extension allow-list (pdf/png/jpg/jpeg/webp/doc/docx/txt/md), 15 MB cap, opaque random
  storage keys (regex-validated to prevent path tricks), client-side encryption before upload.
- Download only through authenticated routes that check ownership and stream with
  `no-store`.

## LLM & privacy boundaries

- The **default mapper is deterministic and on-device** — website text is compared against a
  fixed lexicon (`packages/core/src/lexicon.ts`); no page content reaches any LLM.
- If an operator configures `LLM_API_KEY`, `/api/ai/map-fields` receives **only** labels,
  input types and select options — never values — and the status endpoint reports
  `mapping: "llm-assisted"` honestly.
- Vault retrieval is always scoped: the extension (and assistant) request *specific* field
  keys for an approved task; the whole vault is never shipped anywhere.
- Website text is untrusted input: it can only ever influence *which lexicon key* matches.
  It cannot alter permissions, exfiltrate data, or change D's rules.
- Sensitive values are masked by default in every UI and never spoken aloud in full.

## What is deliberately NOT claimed

- The local filesystem store is not S3; production swaps the same interface
  (`apps/web/src/lib/storage.ts`) behind encrypted object storage.
- Rate limiting is per-process (restart clears it) — production needs Redis/KV.
- No automated application-status tracking — statuses are only what the user sets.
- Chrome profile storage protects the extension key on-device; hardware-backed key storage
  is future work.
- A hackathon deployment over plain HTTP is for local testing only; run behind HTTPS with
  `secure` cookies in production.

## Audit trail

`consent_events` records: form inspections, autofill approvals, screenshots, OCR saves and
application saves — visible to the user in the Security Center. Exportable via
`/api/account/export` alongside all other records.

## Devices

Paired extensions hold revocable device tokens that exist for the consent log
and the Security Center — they identify a device, not a user, and one click
unpairs them. The instance key they receive is the same server-held key.
