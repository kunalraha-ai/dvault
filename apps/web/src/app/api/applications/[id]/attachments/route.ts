import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { putBlob, newStorageKey, getBlob } from "@/lib/storage";

/** GET: list attachments; ?blob=1&id=<attachmentId> streams one (encrypted). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const app = await prisma.application.findFirst({ where: { id, userId: auth.user.id } });
  if (!app) return apiError("Application not found", 404);

  const sp = req.nextUrl.searchParams;
  const blobId = sp.get("id");
  if (sp.get("blob") === "1" && blobId) {
    const att = await prisma.applicationAttachment.findFirst({ where: { id: blobId, applicationId: id } });
    if (!att) return apiError("Attachment not found", 404);
    const blob = await getBlob(att.encryptedStorageKey);
    if (!blob) return apiError("Encrypted blob missing", 410);
    return new Response(new Uint8Array(blob), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${att.filename}.enc"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const attachments = await prisma.applicationAttachment.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "desc" },
  });
  return json({
    attachments: attachments.map((a) => ({
      id: a.id,
      attachmentType: a.attachmentType,
      filename: a.filename,
      fileSize: a.fileSize,
      createdAt: a.createdAt,
    })),
  });
}

/**
 * POST: attach a screenshot / receipt / supporting document. Blobs are
 * encrypted on the user's device (AES-GCM) before upload; only ciphertext
 * is stored. Attachments are only ever created through explicit user action.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const app = await prisma.application.findFirst({ where: { id, userId: auth.user.id } });
  if (!app) return apiError("Application not found", 404);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Expected multipart/form-data", 415);

  const file = form.get("file");
  if (!(file instanceof Blob)) return apiError("Missing file", 422);
  if (file.size === 0) return apiError("Empty file", 422);
  if (file.size > 15 * 1024 * 1024) return apiError("Attachment larger than 15 MB", 413);

  const typeRaw = String(form.get("attachmentType") ?? "document");
  const attachmentType = ["screenshot", "receipt", "document"].includes(typeRaw) ? typeRaw : "document";
  const filename = String(form.get("filename") ?? "attachment").slice(0, 200);

  const storageKey = newStorageKey();
  await putBlob(storageKey, new Uint8Array(await file.arrayBuffer()));

  const att = await prisma.applicationAttachment.create({
    data: { applicationId: id, attachmentType, filename, encryptedStorageKey: storageKey, fileSize: file.size },
  });

  if (attachmentType === "screenshot") {
    await prisma.consentEvent.create({
      data: { userId: auth.user.id, action: "screenshot_captured", websiteDomain: app.websiteDomain },
    });
  }

  return json({ ok: true, attachment: { id: att.id, attachmentType, filename, createdAt: att.createdAt } }, { status: 201 });
}
