import "server-only";
import crypto from "crypto";

/**
 * Hybrid encrypted blob storage:
 *
 *  - When SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set:
 *      encrypted document blobs (screenshots, receipts, uploaded files)
 *      are stored in a Supabase Storage bucket — persistent cloud storage.
 *
 *  - Otherwise: local filesystem under .data/storage/ (offline fallback).
 *
 * Blobs are ALREADY AES-256-GCM encrypted on the client before they reach
 * this layer — Supabase stores ciphertext only. No public URLs are exposed;
 * downloads stream through authenticated, owner-checked API routes.
 */

// ── config ─────────────────────────────────────────────────────────────────

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  return {
    configured: url.length > 0 && key.length > 0,
    url,
    key,
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || "dvault-documents",
  };
}

export function isSupabaseStorage(): boolean {
  return supabaseConfig().configured;
}

async function getSupabase() {
  const cfg = supabaseConfig();
  if (!cfg.configured) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(cfg.url, cfg.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── key management ─────────────────────────────────────────────────────────

export function newStorageKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

function safeKey(key: string): string {
  if (!/^[a-f0-9]{48}$/.test(key)) throw new Error("Invalid storage key");
  return key;
}

// ── local filesystem adapter (fallback) ─────────────────────────────────────

import fs from "fs/promises";
import path from "path";
import { dataDir } from "./env";

function localDir(key: string): string {
  return path.join(process.cwd(), dataDir(), "storage", key.slice(0, 2));
}

async function localPut(key: string, bytes: Uint8Array): Promise<void> {
  const k = safeKey(key);
  const dir = localDir(k);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, k), bytes);
}

async function localGet(key: string): Promise<Buffer | null> {
  const k = safeKey(key);
  try {
    return await fs.readFile(path.join(localDir(k), k));
  } catch {
    return null;
  }
}

async function localDelete(key: string): Promise<void> {
  const k = safeKey(key);
  try {
    await fs.unlink(path.join(localDir(k), k));
  } catch { /* already gone */ }
}

// ── Supabase Storage adapter ────────────────────────────────────────────────

async function supabasePut(key: string, bytes: Uint8Array): Promise<void> {
  const sb = await getSupabase();
  if (!sb) throw new Error("Supabase not configured");
  const cfg = supabaseConfig();
  const { error } = await sb.storage
    .from(cfg.bucket)
    .upload(key, bytes, { contentType: "application/octet-stream", upsert: true });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
}

async function supabaseGet(key: string): Promise<Buffer | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const cfg = supabaseConfig();
  const { data, error } = await sb.storage
    .from(cfg.bucket)
    .download(key);
  if (error || !data) return null;
  const buf = await data.arrayBuffer();
  return Buffer.from(buf);
}

async function supabaseDelete(key: string): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const cfg = supabaseConfig();
  await sb.storage.from(cfg.bucket).remove([key]);
}

// ── unified API ─────────────────────────────────────────────────────────────

/** Store an encrypted blob — Supabase Storage if configured, local filesystem otherwise. */
export async function putBlob(key: string, bytes: Uint8Array): Promise<void> {
  const k = safeKey(key);
  if (isSupabaseStorage()) {
    await supabasePut(k, bytes);
  } else {
    await localPut(k, bytes);
  }
}

/** Retrieve an encrypted blob. Returns null when not found. */
export async function getBlob(key: string): Promise<Buffer | null> {
  const k = safeKey(key);
  if (isSupabaseStorage()) {
    // try Supabase first, fall back to local (migration period)
    const fromCloud = await supabaseGet(k).catch(() => null);
    if (fromCloud) return fromCloud;
    return localGet(k);
  }
  return localGet(k);
}

/** Delete an encrypted blob from whichever store holds it. */
export async function deleteBlob(key: string): Promise<void> {
  const k = safeKey(key);
  if (isSupabaseStorage()) {
    await supabaseDelete(k).catch(() => undefined);
  }
  await localDelete(k); // also clean local copy during migration
}

/** Ensure the Supabase Storage bucket exists (call once on startup). */
export async function ensureSupabaseBucket(): Promise<void> {
  const sb = await getSupabase();
  if (!sb) return;
  const cfg = supabaseConfig();
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === cfg.bucket);
  if (!exists) {
    const { error } = await sb.storage.createBucket(cfg.bucket, {
      public: false, // NEVER public — encrypted blobs only
      fileSizeLimit: "20MB",
    });
    if (error && !error.message.includes("already exists")) {
      console.error("[D-Vault] Supabase bucket creation failed:", error.message);
    } else if (!error) {
      console.log(`[D-Vault] Supabase Storage bucket "${cfg.bucket}" created.`);
    }
  }
}
