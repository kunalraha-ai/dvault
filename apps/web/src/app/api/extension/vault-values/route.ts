import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { FIELD_MAP } from "@dvault/core";

export const dynamic = "force-dynamic";

const schema = z.object({
  profileId: z.string().min(1),
  // Only the field keys needed for the CURRENT user-approved task.
  fieldKeys: z.array(z.string()).min(1).max(80),
});

/**
 * POST /api/extension/vault-values — scoped field retrieval for the
 * extension's form-filling task.
 *
 * SECURITY DESIGN:
 * - The extension asks for a SMALL, explicit set of field keys (those the
 *   mapper proposed for the active form) — never the whole vault.
 * - The server returns only those fields, still ENCRYPTED; the extension
 *   decrypts locally with the key derived from the user's password.
 * - No vault value is ever sent to an LLM or logged.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid request", 422);

  const profile = await prisma.profile.findFirst({
    where: { id: parsed.data.profileId, userId: auth.user.id },
  });
  if (!profile) return apiError("Profile not found", 404);

  const fields = await prisma.vaultField.findMany({
    where: {
      profileId: profile.id,
      fieldKey: { in: parsed.data.fieldKeys },
    },
  });

  const byKey: Record<string, unknown> = {};
  for (const f of fields) {
    const def = FIELD_MAP[f.fieldKey];
    byKey[f.fieldKey] = {
      fieldKey: f.fieldKey,
      label: def?.label ?? f.fieldKey,
      isSensitive: f.isSensitive,
      verified: f.verified,
      updatedAt: f.updatedAt,
      // AES-GMB envelope — decrypted on-device only.
      encryptedValue: JSON.parse(f.encryptedValue),
    };
  }
  // Keys requested but absent are reported as missing — never guessed.
  const missing = parsed.data.fieldKeys.filter((k) => !byKey[k]);

  return corsJson({
    ok: true,
    profile: { id: profile.id, profileType: profile.profileType, profileName: profile.profileName },
    fields: byKey,
    missing,
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
