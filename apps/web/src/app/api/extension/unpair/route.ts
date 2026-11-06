import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";

export const dynamic = "force-dynamic";

/** POST /api/extension/unpair — revoke the calling device token. */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const token = req.headers.get("x-dvault-device-token") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return apiError("Missing device token", 401);

  const crypto = await import("crypto");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const device = await prisma.connectedDevice.findFirst({ where: { tokenHash, userId: auth.user.id } });
  if (!device) return apiError("Device not found", 404);

  await prisma.connectedDevice.update({ where: { id: device.id }, data: { revokedAt: new Date() } });
  await prisma.syncMetadata.deleteMany({ where: { deviceId: device.id } });
  return corsJson({ ok: true });
}

export async function OPTIONS() {
  return optionsResponse();
}
