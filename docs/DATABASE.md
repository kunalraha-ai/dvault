# Database

## Schema

Single Prisma schema at `apps/web/prisma/schema.prisma` — 12 models, UUID string ids,
portable between SQLite (local dev) and PostgreSQL (production).

```
users ─┬─< sessions
       ├─< password_resets
       ├─< profiles ─┬─< vault_fields >─ documents (sourceDocumentId)
       │             ├─< documents ──< document_extractions
       │             └─< applications
       ├─< applications ─┬─< application_attachments
       │                 └─< application_status_history
       ├─< consent_events
       ├─< connected_devices ──< sync_metadata
       └─< sync_metadata
```

| Model | Key columns | Notes |
|---|---|---|
| `users` | id, email (unique), passwordHash, cryptoSalt, kdfIterations, onboardingStep, demoLoaded | bcrypt cost 12; salt feeds client-side PBKDF2 |
| `sessions` | tokenHash (unique), expiresAt, lastSeenAt | tokens are 32 random bytes, stored SHA-256 |
| `passwordResets` | tokenHash (unique), expiresAt (30 min), usedAt | single-use |
| `profiles` | profileType ("personal"/"business"), profileName, isDefault | multiple profiles per user per type |
| `vaultFields` | fieldKey, encryptedValue (JSON `{c,iv}`), category, isSensitive, verified, sourceDocumentId | `@@unique([profileId, fieldKey])` |
| `documents` | filename, encryptedStorageKey (unique), fileType, fileSize, category, extractionStatus | blobs on the encrypted store, not the DB |
| `documentExtractions` | encryptedText, encryptedFields, status, reviewedAt | client-encrypted OCR output |
| `applications` | applicationName, websiteDomain, applicationUrl, encryptedReferenceId, encryptedNotes, submissionDate, status, isDemo | `@@index([userId,status])`, `@@index([userId,submissionDate])` |
| `applicationAttachments` | attachmentType ("screenshot"/"receipt"/"document"), encryptedStorageKey (unique) | |
| `applicationStatusHistory` | status, note, changedAt | user-driven only |
| `consentEvents` | action, websiteDomain, grantedAt | audit trail shown in Security Center |
| `connectedDevices` | deviceName, tokenHash (unique), lastSeenAt, revokedAt | extension pairing |
| `syncMetadata` | lastSyncedAt, syncStatus, detail | per-device sync heartbeats |

## Using PostgreSQL in production

The schema avoids SQLite-only features (no enums, JSON as strings) so the switch is a
two-line change:

1. In `apps/web/prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"          // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Set `DATABASE_URL="postgresql://user:pass@host:5432/dvault"` in `apps/web/.env`.

3. Run migrations:

   ```bash
   cd apps/web
   npx prisma migrate dev --name init   # generates SQL migrations under prisma/migrations
   ```

For local development nothing changes — `npm run db:push` keeps SQLite in sync.

## Common commands

```bash
npm run db:push       # apply schema to the database (dev)
npm run db:studio     # browse data with Prisma Studio
```

## Inspection (quick SQLite)

```bash
cd apps/web && npx prisma studio
# or: sqlite3 prisma/dev.db "select field_key, verified from VaultField limit 5;"
```

Sensitive columns you should *never* see as plaintext in the DB: `vault_fields.encrypted_value`,
`documents.encrypted_storage_key` blobs, `applications.encrypted_reference_id/notes`,
`document_extractions.encrypted_*` — if you ever find plaintext there, it's a bug.
