import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

/** GET: connected devices + sync status + consent log (no-auth mode: there
 *  are no login sessions — the app itself is open; devices identify paired
 *  extensions only). */
export async function GET(req: NextRequest) {
  const { user } = await resolveUser(req);

  const [devices, syncs, consent] = await Promise.all([
    prisma.connectedDevice.findMany({
      where: { userId: user.id },
      orderBy: { lastSeenAt: "desc" },
    }),
    prisma.syncMetadata.findMany({
      where: { userId: user.id },
      orderBy: { lastSyncedAt: "desc" },
    }),
    prisma.consentEvent.findMany({
      where: { userId: user.id },
      orderBy: { grantedAt: "desc" },
      take: 25,
    }),
  ]);

  return json({
    devices: devices.map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      lastSeenAt: d.lastSeenAt,
      revokedAt: d.revokedAt,
      createdAt: d.createdAt,
    })),
    sync: syncs.map((s) => ({
      id: s.id,
      lastSyncedAt: s.lastSyncedAt,
      syncStatus: s.syncStatus,
      detail: s.detail,
    })),
    recentConsentEvents: consent.map((c) => ({
      id: c.id,
      action: c.action,
      websiteDomain: c.websiteDomain,
      grantedAt: c.grantedAt,
    })),
  });
}

const revokeSchema = z.object({ id: z.string().min(1) });

/** POST: revoke a paired device (unpair an extension). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const { user } = await resolveUser(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);

  const d = await prisma.connectedDevice.findFirst({
    where: { id: parsed.data.id, userId: user.id },
  });
  if (!d) return apiError("Device not found", 404);
  await prisma.connectedDevice.update({ where: { id: d.id }, data: { revokedAt: new Date() } });
  await prisma.syncMetadata.deleteMany({ where: { deviceId: d.id } });
  return json({ ok: true });
}
