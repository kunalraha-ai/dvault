import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { putBlob, newStorageKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/save-application — "D, save this application".
 *
 * Multipart payload (everything value-like arrives client-encrypted):
 *   meta: JSON { applicationName, websiteDomain, applicationUrl, profileId?,
 *                encryptedReferenceId?, encryptedNotes?, submissionDate, status }
 *   screenshot?: encrypted blob (captured ONLY after explicit consent)
 *   receipt?:    encrypted blob
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Expected multipart/form-data", 415);

  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") return apiError("Missing `meta` JSON field", 422);
  const meta = z
    .object({
      applicationName: z.string().min(1).max(200),
      websiteDomain: z.string().min(1).max(200),
      applicationUrl: z.string().url().max(2000),
      profileId: z.string().nullable().optional(),
      encryptedReferenceId: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
      encryptedNotes: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
      submissionDate: z.string().datetime().nullable().optional(),
      status: z.enum(["draft", "submitted", "pending", "approved", "rejected", "unknown"]).default("unknown"),
    })
    .safeParse(JSON.parse(metaRaw));
  if (!meta.success) return apiError("Invalid application metadata", 422);
  const m = meta.data;

  if (m.profileId) {
    const profile = await prisma.profile.findFirst({ where: { id: m.profileId, userId: auth.user.id } });
    if (!profile) return apiError("Profile not found", 404);
  }

  const app = await prisma.application.create({
    data: {
      userId: auth.user.id,
      profileId: m.profileId ?? null,
      applicationName: m.applicationName.trim(),
      websiteDomain: m.websiteDomain.toLowerCase(),
      applicationUrl: m.applicationUrl,
      encryptedReferenceId: m.encryptedReferenceId ? JSON.stringify(m.encryptedReferenceId) : null,
      encryptedNotes: m.encryptedNotes ? JSON.stringify(m.encryptedNotes) : null,
      submissionDate: m.submissionDate ? new Date(m.submissionDate) : null,
      status: m.status,
      statusHistory: m.status !== "unknown" ? { create: [{ status: m.status, note: "Saved via extension" }] } : undefined,
    },
  });

  const attached: { type: string; filename: string }[] = [];
  for (const key of ["screenshot", "receipt"]) {
    const blob = form.get(key);
    if (blob instanceof Blob && blob.size > 0 && blob.size <= 15 * 1024 * 1024) {
      const storageKey = newStorageKey();
      await putBlob(storageKey, new Uint8Array(await blob.arrayBuffer()));
      await prisma.applicationAttachment.create({
        data: {
          applicationId: app.id,
          attachmentType: key,
          filename: `${m.websiteDomain}-${key}-${Date.now()}.enc`,
          encryptedStorageKey: storageKey,
          fileSize: blob.size,
        },
      });
      attached.push({ type: key, filename: `${key}.enc` });
    }
  }

  await prisma.consentEvent.create({
    data: {
      userId: auth.user.id,
      action: "application_saved",
      websiteDomain: m.websiteDomain,
      details: JSON.stringify({
        applicationId: app.id,
        withScreenshot: attached.some((a) => a.type === "screenshot"),
        source: "extension",
      }),
    },
  });

  return corsJson(
    {
      ok: true,
      application: {
        id: app.id,
        applicationName: app.applicationName,
        websiteDomain: app.websiteDomain,
        status: app.status,
        createdAt: app.createdAt,
      },
      attachments: attached,
    },
    { status: 201 },
  );
}

export async function OPTIONS() {
  return optionsResponse();
}
