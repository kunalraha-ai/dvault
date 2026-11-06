import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/sync — the extension reports a sync heartbeat so the
 * Security Center can show live extension status and last-sync time.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);

  let body: { syncStatus?: string; detail?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // heartbeat without body is fine
  }

  const device = await prisma.connectedDevice.findFirst({
    where: { userId: auth.user.id, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });
  if (!device) return apiError("No connected device", 404);

  const status = ["ok", "error", "pending"].includes(body.syncStatus ?? "")
    ? (body.syncStatus as string)
    : "ok";

  const existing = await prisma.syncMetadata.findFirst({ where: { userId: auth.user.id, deviceId: device.id } });
  if (existing) {
    await prisma.syncMetadata.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date(), syncStatus: status, detail: body.detail ?? null },
    });
  } else {
    await prisma.syncMetadata.create({
      data: { userId: auth.user.id, deviceId: device.id, syncStatus: status, detail: body.detail ?? null },
    });
  }
  return corsJson({ ok: true, syncedAt: new Date().toISOString() });
}

export async function OPTIONS() {
  return optionsResponse();
}
