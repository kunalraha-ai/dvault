import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";

/**
 * POST: persist the result of an OCR / extraction run.
 *
 * The extraction itself happens ON THE USER'S DEVICE (tesseract.js for
 * images, pdf.js text layer for PDFs). This endpoint receives the raw
 * extracted text and the candidate fields ALREADY ENCRYPTED with the user's
 * vault key, and stores only ciphertext. Nothing is applied to the vault
 * until the user reviews and approves — see POST /api/documents/[id]/apply.
 */
const schema = z.object({
  encryptedText: z.object({ c: z.string().min(1), iv: z.string().min(1) }),
  // [{ fieldKey, value, confidence, evidence }] — encrypted client-side
  encryptedFields: z.object({ c: z.string().min(1), iv: z.string().min(1) }),
  status: z.enum(["extracted", "failed", "skipped"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid extraction payload", 422);

  // Replace any previous extraction row for this document
  await prisma.documentExtraction.deleteMany({ where: { documentId: id } });
  const extraction = await prisma.documentExtraction.create({
    data: {
      documentId: id,
      encryptedText: JSON.stringify(parsed.data.encryptedText),
      encryptedFields: JSON.stringify(parsed.data.encryptedFields),
      status: "pending",
    },
  });
  await prisma.document.update({
    where: { id },
    data: { extractionStatus: parsed.data.status ?? "extracted" },
  });

  return json({ ok: true, extractionId: extraction.id }, { status: 201 });
}
