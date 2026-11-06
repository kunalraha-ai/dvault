import { describe, it, expect, beforeAll } from "vitest";
import {
  deriveVaultKey, encryptString, decryptString, encryptBytes, decryptBytes,
  generateSalt, generateRecoveryPhrase, randomToken, maskSensitive, DEFAULT_KDF_ITERATIONS,
} from "@dvault/core";
import { exportKeyJwk, importKeyJwk } from "@dvault/core";

// Node 20+ exposes Web Crypto globally — same code path as the browser.
describe("client-side crypto", () => {
  let key: CryptoKey;
  beforeAll(async () => {
    const salt = generateSalt();
    key = await deriveVaultKey("correct horse battery staple", salt, 100_000);
  });

  it("derives a usable AES-GCM key from a password + salt", async () => {
    expect(key.algorithm.name).toBe("AES-GCM");
    expect((key.algorithm as AesKeyAlgorithm).length).toBe(256);
  });

  it("encrypts and decrypts a string (round trip)", async () => {
    const env = await encryptString(key, "27 Nehru Colony, Nagpur 440001");
    expect(env.c).not.toContain("Nagpur");
    const back = await decryptString(key, env);
    expect(back).toBe("27 Nehru Colony, Nagpur 440001");
  });

  it("produces a different ciphertext + IV per encryption", async () => {
    const a = await encryptString(key, "same");
    const b = await encryptString(key, "same");
    expect(a.c).not.toBe(b.c);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails decryption with the wrong key", async () => {
    const env = await encryptString(key, "secret");
    const other = await deriveVaultKey("wrong password", generateSalt(), 100_000);
    await expect(decryptString(other, env)).rejects.toThrow();
  });

  it("encrypts and decrypts bytes (document blobs)", async () => {
    const bytes = new Uint8Array(256);
    crypto.getRandomValues(bytes);
    const env = await encryptBytes(key, bytes);
    const back = await decryptBytes(key, env);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it("exports and re-imports the key (JWK, for extension pairing)", async () => {
    const jwk = await exportKeyJwk(key);
    expect(jwk.k).toBeTruthy();
    const imported = await importKeyJwk(jwk);
    const env = await encryptString(imported, "works after import");
    expect(await decryptString(key, env)).toBe("works after import");
  });

  it("masks sensitive values for display", () => {
    const m = maskSensitive("9876 5432 1098");
    expect(m).toContain("•");
    expect(m.endsWith("98")).toBe(true);
    expect(m.startsWith("98")).toBe(true);
  });

  it("generates 32-byte hex tokens and 12-word recovery phrases", () => {
    expect(randomToken()).toMatch(/^[a-f0-9]{64}$/);
    const words = generateRecoveryPhrase().split(" ");
    expect(words).toHaveLength(12);
  });

  it("uses the documented PBKDF2 iteration count", () => {
    expect(DEFAULT_KDF_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });
});
