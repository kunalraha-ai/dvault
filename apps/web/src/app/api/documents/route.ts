import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { putBlob, newStorageKey } from "@/lib/storage";
import { DOCUMENT_CATEGORIES } from "@dvault/core";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "txt", "md"];

/** GET: list documents for the user. */
export async function GET(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const docs = await prisma.document.findMany({
    where: { userId: auth.user.id },
    orderBy: { createdAt: "desc" },
    include: { profile: { select: { profileName: true, profileType: true } } },
  });
  return json({
    documents: docs.map((d) => ({
      id: d.id,
      profileId: d.profileId,
      profileName: d.profile.profileName,
      profileType: d.profile.profileType,
      filename: d.filename,
      fileType: d.fileType,
      fileSize: d.fileSize,
      category: d.category,
      extractionStatus: d.extractionStatus,
      createdAt: d.createdAt,
      hasExtraction: d.extractionStatus === "extracted",
    })),
  });
}

/**
 * POST: upload a document. The file bytes are AES-GCM encrypted ON THE CLIENT
 * and arrive here as an opaque encrypted blob (multipart: file, meta).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Expected multipart/form-data", 415);

  const file = form.get("file");
  if (!(file instanceof Blob)) return apiError("Missing file", 422);
  if (file.size === 0) return apiError("Empty file", 422);
  if (file.size > MAX_BYTES) return apiError("File is larger than 15 MB", 413);

  const filename = String(form.get("filename") ?? "document");
  if (filename.length > 200) return apiError("Filename too long", 422);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    return apiError(`Unsupported file type ".${ext}". Allowed: ${ALLOWED_EXT.join(", ")}`, 415);
  }

  const profileId = String(form.get("profileId") ?? "");
  const categoryRaw = String(form.get("category") ?? "other");
  const category = (DOCUMENT_CATEGORIES as readonly string[]).includes(categoryRaw) ? categoryRaw : "other";

  const profile = await prisma.profile.findFirst({ where: { id: profileId, userId: auth.user.id } });
  if (!profile) return apiError("Profile not found", 404);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storageKey = newStorageKey();
  await putBlob(storageKey, bytes);

  const doc = await prisma.document.create({
    data: {
      userId: auth.user.id,
      profileId,
      filename,
      encryptedStorageKey: storageKey,
      fileType: ext,
      fileSize: file.size,
      category,
      extractionStatus: "pending",
    },
  });

  return json(
    {
      ok: true,
      document: {
        id: doc.id,
        filename: doc.filename,
        category: doc.category,
        extractionStatus: doc.extractionStatus,
        createdAt: doc.createdAt,
      },
      // Honest note: the blob is stored client-encrypted; server never saw plaintext.
      encryptedAtRest: true,
    },
    { status: 201 },
  );
}
