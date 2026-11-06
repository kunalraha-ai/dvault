import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { deleteBlob } from "@/lib/storage";

const patchSchema = z.object({
  profileName: z.string().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const profile = await prisma.profile.findFirst({ where: { id, userId: auth.user.id } });
  if (!profile) return apiError("Profile not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);

  if (parsed.data.isDefault) {
    await prisma.profile.updateMany({
      where: { userId: auth.user.id, profileType: profile.profileType },
      data: { isDefault: false },
    });
  }
  const updated = await prisma.profile.update({
    where: { id },
    data: {
      profileName: parsed.data.profileName?.trim() ?? profile.profileName,
      isDefault: parsed.data.isDefault ?? profile.isDefault,
    },
  });
  return json({ ok: true, profile: { id: updated.id, profileName: updated.profileName, isDefault: updated.isDefault } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const profile = await prisma.profile.findFirst({
    where: { id, userId: auth.user.id },
    include: { documents: true },
  });
  if (!profile) return apiError("Profile not found", 404);
  if (profile.isDefault) {
    return apiError("You can't delete your default profile. Set another profile as default first.", 409);
  }

  // Documents attached to this profile are deleted along with their
  // client-encrypted blobs — the UI confirms this explicitly first.
  for (const doc of profile.documents) {
    await deleteBlob(doc.encryptedStorageKey).catch(() => undefined);
  }
  await prisma.profile.delete({ where: { id } }); // cascades to fields/documents
  return json({ ok: true });
}
