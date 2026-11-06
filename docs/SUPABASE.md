# Supabase Integration

D-Vault supports Supabase for two things:

1. **Storage** — encrypted document blobs (screenshots, receipts, uploaded files)
   are stored in a Supabase Storage bucket instead of the local filesystem.
2. **Database** — all vault data (profiles, fields, applications) can be stored
   in Supabase PostgreSQL instead of SQLite.

Both are optional and independent — you can use Supabase Storage while keeping
SQLite, or switch the database to PostgreSQL, or both.

## Setup

### 1. Create a Supabase project

1. Go to https://supabase.com/dashboard
2. Click **New Project**
3. Choose a name (e.g., "d-vault") and a region close to you
4. Save the database password

### 2. Get your credentials

From **Settings → API**:
- `Project URL` — e.g., `https://abc123.supabase.co`
- `service_role` key (secret — NOT the anon key)

From **Settings → Database**:
- Connection string (for PostgreSQL database migration)

### 3. Configure D-Vault

Add to `apps/web/.env`:

```bash
# Storage (encrypted document blobs)
SUPABASE_URL="https://abc123.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIs..."
```

Restart the server. The status API will report `"storage": {"provider": "supabase"}`.

### 4. (Optional) Switch the database to Supabase PostgreSQL

1. Edit `apps/web/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```

2. Set the `DATABASE_URL` in `apps/web/.env` to the Supabase Postgres connection string:
   ```bash
   DATABASE_URL="postgresql://postgres.abc123:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
   ```

3. Push the schema:
   ```bash
   cd apps/web
   npx prisma db push
   ```

4. Restart the server. All vault data now persists in Supabase PostgreSQL.

### 5. Verify

```bash
curl -s http://localhost:3000/api/voice/status | python3 -m json.tool
```

You should see:
```json
{
  "storage": {
    "provider": "supabase",
    "bucket": "dvault-documents"
  }
}
```

## Architecture

```
┌─ Client (browser) ────────────────────────────────────────────────────────┐
│  Documents, screenshots, receipts are AES-256-GCM encrypted              │
│  with the vault key BEFORE being uploaded                                 │
└──────────────────────┬────────────────────────────────────────────────────┘
                       │ only ciphertext
                       ▼
┌─ D-Vault Server ─────────────────────────────────────────────────────────┐
│  putBlob(key, encryptedBytes)                                             │
│    ├─ SUPABASE_URL set? ──→ Supabase Storage bucket (dvault-documents) │
│    └─ otherwise ────────→ local filesystem (.data/storage/)              │
│                                                                          │
│  Database (Prisma)                                                       │
│    ├─ DATABASE_URL is postgres? ──→ Supabase PostgreSQL                 │
│    └─ otherwise ───────────────────→ SQLite (apps/web/prisma/dev.db)    │
└──────────────────────────────────────────────────────────────────────────┘
```

## Privacy

- Document blobs are **encrypted on the client** before upload — Supabase
  stores only ciphertext it cannot read.
- Vault field values are **encrypted on the client** before being sent to
  the database — PostgreSQL stores only AES-GCM envelopes.
- The Supabase Storage bucket is **private** (never public).
- The service role key stays on the server; clients never see it.
