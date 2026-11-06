import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { deleteBlob, getBlob } from "@/lib/storage";
import { DOCUMENT_CATEGORIES } from "@dvault/core";

const patchSchema = z.object({
  filename: z.string().min(1).max(200).optional(),
  category: z.string().optional(),
  extractionStatus: z.enum(["pending", "processing", "extracted", "failed", "skipped"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: { id, userId: auth.user.id },
    include: { extractions: true },
  });
  if (!doc) return apiError("Document not found", 404);

  const wantBlob = req.nextUrl.searchParams.get("blob") === "1";
  if (wantBlob) {
    // Stream the CLIENT-ENCRYPTED blob; only the owner's device key can
    // decrypt it. No public URLs are ever exposed.
    const blob = await getBlob(doc.encryptedStorageKey);
    if (!blob) return apiError("Encrypted blob missing from storage", 410);
    return new Response(new Uint8Array(blob), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${doc.filename}.enc"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const latestExtraction = doc.extractions[0];
  return json({
    document: {
      id: doc.id,
      profileId: doc.profileId,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      category: doc.category,
      extractionStatus: doc.extractionStatus,
      createdAt: doc.createdAt,
      encryptedText: latestExtraction ? JSON.parse(latestExtraction.encryptedText) : null,
      encryptedFields: latestExtraction ? JSON.parse(latestExtraction.encryptedFields) : null,
      extractionReviewedAt: latestExtraction?.reviewedAt ?? null,
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const doc = await prisma.document.findFirst({ where: { id, userId: auth.user.id } });
  if (!doc) return apiError("Document not found", 404);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);

  const category = parsed.data.category;
  if (category && !(DOCUMENT_CATEGORIES as readonly string[]).includes(category)) {
    return apiError("Invalid category", 422);
  }

  const updated = await prisma.document.update({
    where: { id },
    data: {
      filename: parsed.data.filename?.trim() ?? undefined,
      category: category ?? undefined,
      extractionStatus: parsed.data.extractionStatus ?? undefined,
    },
  });
  return json({ ok: true, document: { id: updated.id, filename: updated.filename, category: updated.category, extractionStatus: updated.extractionStatus } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);
  const { id } = await params;

  const doc = await prisma.document.findFirst({ where: { id, userId: auth.user.id } });
  if (!doc) return apiError("Document not found", 404);

  await deleteBlob(doc.encryptedStorageKey).catch(() => undefined);
  await prisma.document.delete({ where: { id } });
  return json({ ok: true });
}
