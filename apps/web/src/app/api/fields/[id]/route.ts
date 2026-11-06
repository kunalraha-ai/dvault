import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";

const patchSchema = z.object({
  encryptedValue: z.object({ c: z.string().min(1), iv: z.string().min(1) }).optional(),
  verified: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  // Ownership: field -> profile -> user
  const field = await prisma.vaultField.findFirst({
    where: { id },
    include: { profile: true },
  });
  if (!field || field.profile.userId !== auth.user.id) return apiError("Field not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);

  const updated = await prisma.vaultField.update({
    where: { id },
    data: {
      encryptedValue: parsed.data.encryptedValue
        ? JSON.stringify(parsed.data.encryptedValue)
        : undefined,
      verified: parsed.data.verified ?? undefined,
    },
  });
  return json({ ok: true, field: { id: updated.id, verified: updated.verified, updatedAt: updated.updatedAt } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const field = await prisma.vaultField.findFirst({
    where: { id },
    include: { profile: true },
  });
  if (!field || field.profile.userId !== auth.user.id) return apiError("Field not found", 404);

  await prisma.vaultField.delete({ where: { id } });
  return json({ ok: true });
}
