-- ═══════════════════════════════════════════════════════════════════════
-- D-VAULT — Supabase PostgreSQL Schema (FIXED)
-- Run this in the Supabase SQL Editor.
-- Uses native UUID type for all ID columns (Supabase convention).
-- Drops conflicting tables first for a clean run.
-- ═══════════════════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══ DROP existing tables (clean slate — safe on a fresh project) ════════
DROP TABLE IF EXISTS "app_settings" CASCADE;
DROP TABLE IF EXISTS "sync_metadata" CASCADE;
DROP TABLE IF EXISTS "connected_devices" CASCADE;
DROP TABLE IF EXISTS "consent_events" CASCADE;
DROP TABLE IF EXISTS "application_status_history" CASCADE;
DROP TABLE IF EXISTS "application_attachments" CASCADE;
DROP TABLE IF EXISTS "applications" CASCADE;
DROP TABLE IF EXISTS "document_extractions" CASCADE;
DROP TABLE IF EXISTS "vault_fields" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "profiles" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- ═══ USERS ═══════════════════════════════════════════════════════════════
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL DEFAULT 'Local user',
    "email" TEXT,
    "vaultKeyJwk" TEXT NOT NULL,
    "demoLoaded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- ═══ PROFILES ═════════════════════════════════════════════════════════════
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "profileType" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- ═══ VAULT FIELDS (encrypted values) ═══════════════════════════════════════
CREATE TABLE "vault_fields" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isSensitive" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sourceDocumentId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_fields_pkey" PRIMARY KEY ("id")
);

-- ═══ DOCUMENTS (metadata — blobs are in Supabase Storage) ═════════════════
CREATE TABLE "documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "encryptedStorageKey" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'other',
    "extractionStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- ═══ DOCUMENT EXTRACTIONS (encrypted OCR text) ════════════════════════════
CREATE TABLE "document_extractions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documentId" UUID NOT NULL,
    "encryptedText" TEXT NOT NULL,
    "encryptedFields" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- ═══ APPLICATIONS (application memory) ════════════════════════════════════
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "profileId" UUID,
    "applicationName" TEXT NOT NULL,
    "websiteDomain" TEXT NOT NULL,
    "applicationUrl" TEXT NOT NULL,
    "encryptedReferenceId" TEXT,
    "submissionDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "encryptedNotes" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- ═══ APPLICATION ATTACHMENTS (encrypted screenshots/receipts) ══════════════
CREATE TABLE "application_attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" UUID NOT NULL,
    "attachmentType" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "encryptedStorageKey" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_attachments_pkey" PRIMARY KEY ("id")
);

-- ═══ APPLICATION STATUS HISTORY ═══════════════════════════════════════════
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "applicationId" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- ═══ CONSENT EVENTS (audit trail) ═════════════════════════════════════════
CREATE TABLE "consent_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "websiteDomain" TEXT,
    "details" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

-- ═══ CONNECTED DEVICES (extension pairing) ════════════════════════════════
CREATE TABLE "connected_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'chrome-extension',
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connected_devices_pkey" PRIMARY KEY ("id")
);

-- ═══ SYNC METADATA ════════════════════════════════════════════════════════
CREATE TABLE "sync_metadata" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "deviceId" UUID,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'ok',
    "detail" TEXT,

    CONSTRAINT "sync_metadata_pkey" PRIMARY KEY ("id")
);

-- ═══ APP SETTINGS (language, voice, email, conversation) ══════════════════
CREATE TABLE "app_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- ═══ FOREIGN KEY RELATIONSHIPS ═════════════════════════════════════════════

ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vault_fields" ADD CONSTRAINT "vault_fields_profileId_profiles_id_fk"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vault_fields" ADD CONSTRAINT "vault_fields_sourceDocumentId_documents_id_fk"
    FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_profileId_profiles_id_fk"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_documentId_documents_id_fk"
    FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applications" ADD CONSTRAINT "applications_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "applications" ADD CONSTRAINT "applications_profileId_profiles_id_fk"
    FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_applicationId_applications_id_fk"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_applicationId_applications_id_fk"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "consent_events" ADD CONSTRAINT "consent_events_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "connected_devices" ADD CONSTRAINT "connected_devices_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sync_metadata" ADD CONSTRAINT "sync_metadata_deviceId_connected_devices_id_fk"
    FOREIGN KEY ("deviceId") REFERENCES "connected_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_userId_users_id_fk"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══ INDEXES (for fast queries) ═════════════════════════════════════════════

CREATE INDEX "profiles_userId_profileType_idx" ON "profiles"("userId", "profileType");

CREATE UNIQUE INDEX "vault_fields_profileId_fieldKey_key" ON "vault_fields"("profileId", "fieldKey");
CREATE INDEX "vault_fields_profileId_category_idx" ON "vault_fields"("profileId", "category");

CREATE UNIQUE INDEX "documents_encryptedStorageKey_key" ON "documents"("encryptedStorageKey");
CREATE INDEX "documents_userId_idx" ON "documents"("userId");
CREATE INDEX "documents_profileId_idx" ON "documents"("profileId");

CREATE INDEX "document_extractions_documentId_idx" ON "document_extractions"("documentId");

CREATE INDEX "applications_userId_status_idx" ON "applications"("userId", "status");
CREATE INDEX "applications_userId_submissionDate_idx" ON "applications"("userId", "submissionDate");

CREATE INDEX "application_attachments_applicationId_idx" ON "application_attachments"("applicationId");
CREATE UNIQUE INDEX "application_attachments_encryptedStorageKey_key" ON "application_attachments"("encryptedStorageKey");

CREATE INDEX "application_status_history_applicationId_idx" ON "application_status_history"("applicationId");

CREATE INDEX "consent_events_userId_grantedAt_idx" ON "consent_events"("userId", "grantedAt");

CREATE UNIQUE INDEX "connected_devices_tokenHash_key" ON "connected_devices"("tokenHash");
CREATE INDEX "connected_devices_userId_idx" ON "connected_devices"("userId");

CREATE INDEX "sync_metadata_userId_lastSyncedAt_idx" ON "sync_metadata"("userId", "lastSyncedAt");

CREATE UNIQUE INDEX "app_settings_userId_key_key" ON "app_settings"("userId", "key");
CREATE INDEX "app_settings_userId_idx" ON "app_settings"("userId");

-- ═══ STORAGE BUCKET (for encrypted document blobs) ════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('dvault-documents', 'dvault-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ═══ DONE ═════════════════════════════════════════════════════════════════
