/**
 * Extension-side storage: pairing state + the instance key.
 *
 * SECURITY NOTE (docs/EXTENSION_GUIDE.md): the AES-256-GCM instance key is
 * received from your own D-Vault server at pairing time (no-auth local mode —
 * the server holds it; see the web app's docs/SECURITY.md). It is kept in
 * chrome.storage.local, protected by the user's Chrome profile. Unpairing or
 * revoking from the Security Center deletes it immediately.
 */

export interface StoredPairing {
  serverUrl: string;
  deviceToken: string;
  /** AES-256-GCM instance key received at pairing — decryption stays on this device */
  keyJwk: JsonWebKey;
  user: { id: string; name: string };
  profiles: { id: string; profileType: "personal" | "business"; profileName: string }[];
  pairedAt: string;
}

const KEY = "dvault.pairing";

/** Untyped accessor — @types/chrome's generic overloads fight our string keys. */
const localArea = chrome.storage.local as unknown as {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(key: string): Promise<void>;
};

export async function getPairing(): Promise<StoredPairing | null> {
  const got = (await localArea.get(KEY)) as Record<string, StoredPairing>;
  return got[KEY] ?? null;
}

export async function setPairing(p: StoredPairing): Promise<void> {
  await localArea.set({ [KEY]: p });
}

export async function clearPairing(): Promise<void> {
  const got = (await localArea.get(KEY)) as Partial<StoredPairing>;
  const { serverUrl, deviceToken } = got;
  if (serverUrl && deviceToken) {
    await fetch(`${serverUrl}/api/extension/unpair`, {
      method: "POST",
      headers: { "X-DVault-Device-Token": deviceToken },
    }).catch(() => undefined);
  }
  await localArea.remove(KEY);
}
