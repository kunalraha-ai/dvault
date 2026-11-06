/**
 * D-Vault client-side encryption core.
 *
 * Architecture:
 * - The user's password never leaves the client in plaintext (a separate bcrypt
 *   hash travels to the server purely for authentication).
 * - The client derives an AES-256-GCM key from the password with PBKDF2-SHA256
 *   (600k iterations) using a per-user random salt.
 * - All sensitive vault values, OCR text and document bytes are encrypted with
 *   that key BEFORE they are sent to the server. The server only ever stores
 *   ciphertext blobs and cannot decrypt anything.
 * - Uses the Web Crypto API via globalThis so the same code runs in the
 *   browser, the extension and Node 20+ (tests / scripts).
 *
 * MVP security note (documented in docs/SECURITY.md): during a session the
 * derived key is held in sessionStorage (per-tab, cleared on tab close).
 */

export const DEFAULT_KDF_ITERATIONS = 600_000;

/** Envelope format stored server-side / in transit for every encrypted value. */
export interface CipherEnvelope {
  /** Base64 AES-GCM ciphertext */
  c: string;
  /** Base64 12-byte IV */
  iv: string;
}

const subtle = (): SubtleCrypto => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("Web Crypto API is not available in this environment");
  }
  return c.subtle;
};

const b64encode = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const b64decode = (s: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export function generateSalt(): string {
  const s = new Uint8Array(16);
  crypto.getRandomValues(s);
  return b64encode(s);
}

/** Derive the AES-256-GCM vault key from the user's password. */
export async function deriveVaultKey(
  password: string,
  saltB64: string,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await subtle().importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    { name: "PBKDF2", salt: b64decode(saltB64), iterations, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, // extractable so the key can be persisted for the session
    ["encrypt", "decrypt"],
  );
}

export async function exportKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return subtle().exportKey("jwk", key) as Promise<JsonWebKey>;
}

export async function importKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey("jwk", jwk, { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

/** Encrypt a UTF-8 string → transferable envelope. */
export async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<CipherEnvelope> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { c: b64encode(ct), iv: b64encode(iv) };
}

/** Decrypt an envelope back to a UTF-8 string. */
export async function decryptString(
  key: CryptoKey,
  env: CipherEnvelope,
): Promise<string> {
  const pt = await subtle().decrypt(
    { name: "AES-GCM", iv: b64decode(env.iv) },
    key,
    b64decode(env.c),
  );
  return new TextDecoder().decode(pt);
}

/** Encrypt raw bytes (documents, screenshots, receipts). */
export async function encryptBytes(
  key: CryptoKey,
  bytes: Uint8Array,
): Promise<CipherEnvelope> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv },
    key,
    bytes as unknown as BufferSource,
  );
  return { c: b64encode(ct), iv: b64encode(iv) };
}

export async function decryptBytes(
  key: CryptoKey,
  env: CipherEnvelope,
): Promise<Uint8Array> {
  const pt = await subtle().decrypt(
    { name: "AES-GCM", iv: b64decode(env.iv) },
    key,
    b64decode(env.c),
  );
  return new Uint8Array(pt);
}

/** Timing-safe-ish comparison for short masked previews (not for crypto use). */
export function maskSensitive(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const visible =
    trimmed.length <= 4
      ? trimmed.slice(0, 1)
      : trimmed.slice(0, 2) + "•".repeat(Math.min(8, Math.max(4, trimmed.length - 4))) + trimmed.slice(-2);
  return visible;
}

/** Generate a URL-safe random token (device tokens, session tokens, etc.). */
export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** 12-word recovery-style phrase generated from CSPRNG (used for demo recovery kit). */
const RECOVERY_WORDS = [
  "orbit","velvet","signal","harbor","maple","quantum","lantern","cedar","ember","tide","prism","anchor",
  "meadow","cobalt","ripple","north","summit","fable","glacier","quill","sonnet","vector","willow","zenith",
];
export function generateRecoveryPhrase(): string {
  const idx = new Uint8Array(12);
  crypto.getRandomValues(idx);
  return Array.from(idx, (b) => RECOVERY_WORDS[b % RECOVERY_WORDS.length]).join(" ");
}
