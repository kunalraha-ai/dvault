import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { deleteBlob } from "@/lib/storage";

const schema = z.object({
  confirm: z.literal("ERASE-MY-VAULT"),
});

/**
 * DELETE /api/account — erase every vault record.
 *
 * No-auth mode: no password to verify — an explicit confirm string guards
 * the action instead. Wipes profiles, fields, documents (with their encrypted
 * blobs), applications, attachments, consent events and paired devices; keeps
 * the local user row and its instance key.
 */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const { user } = await resolveUser(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError('Type "ERASE-MY-VAULT" to confirm erasing all vault data.', 422);
  }

  const [docs, attachments] = await Promise.all([
    prisma.document.findMany({ where: { userId: user.id } }),
    prisma.applicationAttachment.findMany({
      where: { application: { userId: user.id } },
    }),
  ]);
  for (const blobOwner of [...docs, ...attachments]) {
    await deleteBlob(blobOwner.encryptedStorageKey).catch(() => undefined);
  }

  // devices must be revoked explicitly (not cascade-deleted with the user —
  // we keep the local user); profiles/applications/documents cascade below
  await prisma.$transaction([
    prisma.connectedDevice.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.syncMetadata.deleteMany({ where: { userId: user.id } }),
    prisma.consentEvent.deleteMany({ where: { userId: user.id } }),
    prisma.profile.deleteMany({ where: { userId: user.id } }),
    prisma.application.deleteMany({ where: { userId: user.id } }),
    prisma.document.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { demoLoaded: false } }),
  ]);

  return json({ ok: true });
}
