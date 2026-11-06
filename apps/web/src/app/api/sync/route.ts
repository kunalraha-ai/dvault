import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  deviceKey: z.string().min(8).max(120),
  syncStatus: z.enum(["ok", "error", "pending"]).default("ok"),
  detail: z.string().max(300).optional(),
});

/**
 * POST /api/sync — local cache (IndexedDB) heartbeat from the web app.
 * Records the device's encrypted local cache state for the hybrid
 * storage model (encrypted local + encrypted cloud backup).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid sync payload", 422);

  const existing = await prisma.syncMetadata.findFirst({
    where: { userId: auth.user.id, detail: `device:${parsed.data.deviceKey}` },
  });
  if (existing) {
    await prisma.syncMetadata.update({
      where: { id: existing.id },
      data: { lastSyncedAt: new Date(), syncStatus: parsed.data.syncStatus },
    });
  } else {
    await prisma.syncMetadata.create({
      data: {
        userId: auth.user.id,
        lastSyncedAt: new Date(),
        syncStatus: parsed.data.syncStatus,
        detail: `device:${parsed.data.deviceKey}`,
      },
    });
  }
  return json({ ok: true, lastSyncedAt: new Date().toISOString() });
}
