import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { FIELD_MAP } from "@dvault/core";

/** GET: list a profile's vault fields (server returns only ciphertext). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const profile = await prisma.profile.findFirst({ where: { id, userId: auth.user.id } });
  if (!profile) return apiError("Profile not found", 404);

  const fields = await prisma.vaultField.findMany({
    where: { profileId: id },
    orderBy: [{ category: "asc" }, { fieldKey: "asc" }],
  });
  return json({
    profile: { id: profile.id, profileType: profile.profileType, profileName: profile.profileName },
    fields: fields.map((f) => ({
      id: f.id,
      fieldKey: f.fieldKey,
      category: f.category,
      isSensitive: f.isSensitive,
      verified: f.verified,
      encryptedValue: JSON.parse(f.encryptedValue),
      sourceDocumentId: f.sourceDocumentId,
      updatedAt: f.updatedAt,
      createdAt: f.createdAt,
    })),
  });
}

const upsertSchema = z.object({
  fieldKey: z.string().min(3).max(80),
  // AES-GCM envelope produced on the user's device.
  encryptedValue: z.object({ c: z.string().min(1), iv: z.string().min(1) }),
  verified: z.boolean().default(false),
  sourceDocumentId: z.string().nullable().optional(),
});

/** POST: add or update a field with a client-encrypted value. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid field payload", 422);

  const def = FIELD_MAP[parsed.data.fieldKey];
  if (!def) return apiError("Unknown field key", 422);
  if (def.profileType !== profile.profileType) {
    return apiError(`This field belongs to a ${def.profileType} profile.`, 422);
  }

  const field = await prisma.vaultField.upsert({
    where: { profileId_fieldKey: { profileId: id, fieldKey: parsed.data.fieldKey } },
    create: {
      profileId: id,
      fieldKey: parsed.data.fieldKey,
      encryptedValue: JSON.stringify(parsed.data.encryptedValue),
      category: def.category,
      isSensitive: Boolean(def.sensitive),
      verified: parsed.data.verified,
      sourceDocumentId: parsed.data.sourceDocumentId ?? null,
    },
    update: {
      encryptedValue: JSON.stringify(parsed.data.encryptedValue),
      verified: parsed.data.verified,
      sourceDocumentId: parsed.data.sourceDocumentId ?? undefined,
    },
  });
  return json({ ok: true, field: { id: field.id, fieldKey: field.fieldKey, updatedAt: field.updatedAt } }, { status: 201 });
}
