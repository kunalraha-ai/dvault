import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createDeviceToken } from "@/lib/local-user";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceName: z.string().min(1).max(120),
});

/**
 * POST /api/extension/pair — connect the Chrome extension.
 *
 * No-auth mode: no credentials to verify. Pairing registers a revocable
 * device identity (for the consent log and Security Center) and hands the
 * extension the instance key so it can decrypt vault values locally.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(`pair:${req.headers.get("x-forwarded-for") ?? "local"}`, 20, 10 * 60_000);
  const fail = limitOrFail(rl);
  if (fail) return fail;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("Tell D-Vault what to call this device (deviceName).", 422);
  }

  const { user } = await resolveUser(req);
  const deviceToken = await createDeviceToken(user.id, parsed.data.deviceName, "chrome-extension");
  const profiles = await prisma.profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return corsJson({
    ok: true,
    deviceToken,
    // instance key — decryption stays on the extension device
    keyJwk: JSON.parse(user.vaultKeyJwk),
    user: { id: user.id, name: user.name },
    profiles: profiles.map((p) => ({
      id: p.id,
      profileType: p.profileType,
      profileName: p.profileName,
    })),
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
