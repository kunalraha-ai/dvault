import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { deleteBlob } from "@/lib/storage";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const app = await prisma.application.findFirst({
    where: { id, userId: auth.user.id },
    include: {
      profile: { select: { profileName: true, profileType: true } },
      attachments: { orderBy: { createdAt: "desc" } },
      statusHistory: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!app) return apiError("Application not found", 404);

  return json({
    application: {
      id: app.id,
      applicationName: app.applicationName,
      websiteDomain: app.websiteDomain,
      applicationUrl: app.applicationUrl,
      encryptedReferenceId: app.encryptedReferenceId ? JSON.parse(app.encryptedReferenceId) : null,
      encryptedNotes: app.encryptedNotes ? JSON.parse(app.encryptedNotes) : null,
      submissionDate: app.submissionDate,
      status: app.status,
      isDemo: app.isDemo,
      profileName: app.profile?.profileName ?? null,
      profileType: app.profile?.profileType ?? null,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      attachments: app.attachments.map((a) => ({
        id: a.id,
        attachmentType: a.attachmentType,
        filename: a.filename,
        fileSize: a.fileSize,
        createdAt: a.createdAt,
      })),
      statusHistory: app.statusHistory,
    },
  });
}

const patchSchema = z.object({
  applicationName: z.string().min(1).max(200).optional(),
  applicationUrl: z.string().url().max(2000).optional(),
  encryptedReferenceId: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
  encryptedNotes: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
  submissionDate: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "submitted", "pending", "approved", "rejected", "unknown"]).optional(),
  profileId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const app = await prisma.application.findFirst({ where: { id, userId: auth.user.id } });
  if (!app) return apiError("Application not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const data = parsed.data;

  const updated = await prisma.application.update({
    where: { id },
    data: {
      applicationName: data.applicationName?.trim() ?? undefined,
      applicationUrl: data.applicationUrl ?? undefined,
      encryptedReferenceId:
        data.encryptedReferenceId === null
          ? null
          : data.encryptedReferenceId
            ? JSON.stringify(data.encryptedReferenceId)
            : undefined,
      encryptedNotes:
        data.encryptedNotes === null
          ? null
          : data.encryptedNotes
            ? JSON.stringify(data.encryptedNotes)
            : undefined,
      submissionDate:
        data.submissionDate === null
          ? null
          : data.submissionDate
            ? new Date(data.submissionDate)
            : undefined,
      status: data.status ?? undefined,
      profileId: data.profileId ?? undefined,
      statusHistory:
        data.status && data.status !== app.status
          ? { create: [{ status: data.status, note: "Updated by user" }] }
          : undefined,
    },
  });
  return json({ ok: true, application: { id: updated.id, status: updated.status, updatedAt: updated.updatedAt } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const app = await prisma.application.findFirst({
    where: { id, userId: auth.user.id },
    include: { attachments: true },
  });
  if (!app) return apiError("Application not found", 404);

  for (const att of app.attachments) {
    await deleteBlob(att.encryptedStorageKey).catch(() => undefined);
  }
  await prisma.application.delete({ where: { id } });
  return json({ ok: true });
}
