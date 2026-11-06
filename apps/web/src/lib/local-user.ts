import "server-only";
import crypto from "crypto";

/**
 * D-Vault runs in no-account local mode:
 *
 *   - There are no logins, sessions or passwords. The app opens directly.
 *   - A single implicit local user owns all data; it is created lazily on
 *     first request (here).
 *   - The AES-256-GCM instance key is generated ONCE at first run. Values are
 *     still encrypted/decrypted on the client — the server stores only
 *     ciphertext — but it holds the instance key, which is the documented
 *     trade-off of removing accounts (see docs/SECURITY.md).
 *   - Device tokens remain for the Chrome extension: they identify a paired
 *     device for revocation and the consent log, not a user.
 */

const subtle = crypto.webcrypto.subtle;

export interface LocalUser {
  id: string;
  name: string;
  email?: string | null;
  vaultKeyJwk: string;
  demoLoaded: boolean;
}

export async function getOrCreateLocalUser(): Promise<LocalUser> {
  const existing = await (
    await import("./db")
  ).prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      vaultKeyJwk: existing.vaultKeyJwk,
      demoLoaded: existing.demoLoaded,
    };
  }
  const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const jwk = await subtle.exportKey("jwk", key);
  const user = await (
    await import("./db")
  ).prisma.user.create({
    data: { name: "Local user", vaultKeyJwk: JSON.stringify(jwk) },
  });
  return {
    id: user.id,
    name: user.name,
    vaultKeyJwk: user.vaultKeyJwk,
    demoLoaded: user.demoLoaded,
  };
}

// ---------------------------------------------------------------------------
// Extension device tokens (device identity, not user auth)
// ---------------------------------------------------------------------------

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function createDeviceToken(userId: string, deviceName: string, deviceType: string) {
  const token = crypto.randomBytes(32).toString("hex");
  await (
    await import("./db")
  ).prisma.connectedDevice.create({
    data: {
      userId,
      deviceName: deviceName.slice(0, 120),
      deviceType,
      tokenHash: sha256(token),
    },
  });
  return token;
}

export async function validateDeviceToken(token: string) {
  const tokenHash = sha256(token);
  const device = await (
    await import("./db")
  ).prisma.connectedDevice.findUnique({
    where: { tokenHash },
  });
  if (!device || device.revokedAt) return null;
  await (
    await import("./db")
  ).prisma.connectedDevice.update({
    where: { id: device.id },
    data: { lastSeenAt: new Date() },
  });
  return device;
}
