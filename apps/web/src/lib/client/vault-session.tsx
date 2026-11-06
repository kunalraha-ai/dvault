"use client";

import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import {
  importKeyJwk, encryptString, decryptString, encryptBytes, decryptBytes,
  type CipherEnvelope,
} from "@dvault/core";
import { cacheGet, cachePut } from "./local-cache";

/**
 * Vault session for no-account local mode.
 *
 * There is nothing to log into: on mount the app fetches
 * `GET /api/auth/session` (which lazily creates the implicit local user) and
 * imports the AES-256-GCM instance key. All value encryption/decryption
 * still happens on the client; the server stores only ciphertext.
 */

export interface SessionUser {
  id: string;
  name: string;
}

interface VaultSessionValue {
  user: SessionUser;
  key: CryptoKey;
  encrypt: (plaintext: string) => Promise<CipherEnvelope>;
  decrypt: (env: CipherEnvelope) => Promise<string>;
  encryptBlob: (bytes: Uint8Array) => Promise<CipherEnvelope>;
  decryptBlob: (env: CipherEnvelope) => Promise<Uint8Array>;
  ready: true;
}

const VaultSessionCtx = createContext<VaultSessionValue | null>(null);

/** Returns the vault session once bootstrapped (key + local user). */
export function useVaultSession(): VaultSessionValue | null {
  return useContext(VaultSessionCtx);
}

export function VaultSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" });
        const data = (await res.json()) as {
          user?: SessionUser;
          keyJwk?: JsonWebKey;
        };
        if (cancelled || !data.user || !data.keyJwk) return;
        const imported = await importKeyJwk(data.keyJwk);
        if (cancelled) return;
        setKey(imported);
        setUser(data.user);
      } catch {
        // provider simply stays un-bootstrapped; pages show their empty states
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<VaultSessionValue | null>(() => {
    if (!user || !key) return null;
    return {
      user,
      key,
      encrypt: (p) => encryptString(key, p),
      decrypt: (e) => decryptString(key, e),
      encryptBlob: (b) => encryptBytes(key, b),
      decryptBlob: (e) => decryptBytes(key, e),
      ready: true as const,
    };
  }, [user, key]);

  if (!value) return <VaultSessionCtx.Provider value={null}>{children}</VaultSessionCtx.Provider>;
  return <VaultSessionCtx.Provider value={value}>{children}</VaultSessionCtx.Provider>;
}

/** Report local-cache sync state to the server (Security Center shows this). */
export async function reportSync(status: "ok" | "error" | "pending", detail?: string) {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" });
    const data = (await res.json()) as { user?: SessionUser };
    if (!data.user) return;
    const cached = await cacheGet(`fields:${data.user.id}`);
    if (cached === null && status === "ok") return; // nothing cached yet — skip
    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceKey: deviceKey(), syncStatus: status, detail }),
    });
  } catch {
    // sync reporting is best-effort
  }
}

function deviceKey(): string {
  let k = localStorage.getItem("dvault_device_key");
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem("dvault_device_key", k);
  }
  return k;
}

/** Cache a user's encrypted fields in the local IndexedDB cache. */
export async function cacheFieldsLocally(userId: string, fields: unknown) {
  await cachePut(`fields:${userId}`, fields).catch(() => undefined);
}
