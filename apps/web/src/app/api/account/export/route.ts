import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, resolveUser, sameOrigin } from "@/lib/api";

/**
 * GET /api/account/export — full data export.
 * Returns every stored row, including ciphertext values exactly as stored.
 */
export async function GET(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const { user } = await resolveUser(req);

  const [profiles, applications, consentEvents, devices] = await Promise.all([
    prisma.profile.findMany({
      where: { userId: user.id },
      include: { fields: true, documents: true },
    }),
    prisma.application.findMany({
      where: { userId: user.id },
      include: { attachments: true, statusHistory: true },
    }),
    prisma.consentEvent.findMany({
      where: { userId: user.id },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.connectedDevice.findMany({ where: { userId: user.id } }),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
    note: "Values are AES-256-GCM envelopes. In no-auth local mode the instance key is held by this server (docs/SECURITY.md).",
    user: { id: user.id, name: user.name },
    profiles: profiles.map((p) => ({
      id: p.id,
      profileType: p.profileType,
      profileName: p.profileName,
      fields: p.fields.map((f) => ({
        fieldKey: f.fieldKey,
        encryptedValue: JSON.parse(f.encryptedValue),
        verified: f.verified,
        updatedAt: f.updatedAt,
      })),
      documents: p.documents.map((d) => ({
        filename: d.filename,
        category: d.category,
        extractionStatus: d.extractionStatus,
        createdAt: d.createdAt,
        // Blob NOT embedded (can be large) — available via /api/documents/:id?blob=1
      })),
    })),
    applications: applications.map((a) => ({
      applicationName: a.applicationName,
      websiteDomain: a.websiteDomain,
      applicationUrl: a.applicationUrl,
      encryptedReferenceId: a.encryptedReferenceId ? JSON.parse(a.encryptedReferenceId) : null,
      encryptedNotes: a.encryptedNotes ? JSON.parse(a.encryptedNotes) : null,
      submissionDate: a.submissionDate,
      status: a.status,
      createdAt: a.createdAt,
      attachments: a.attachments.map((att) => ({ attachmentType: att.attachmentType, filename: att.filename })),
      statusHistory: a.statusHistory,
    })),
    consentEvents,
    devices: devices.map((d) => ({
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      revokedAt: d.revokedAt,
      lastSeenAt: d.lastSeenAt,
    })),
  };

  return new Response(JSON.stringify(exportPayload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="dvault-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
