import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";

const schema = z.object({
  status: z.enum(["draft", "submitted", "pending", "approved", "rejected", "unknown"]),
  note: z.string().max(500).optional(),
});

/** POST: append a status change to history. Statuses are only ever set by the
 *  user — D-Vault never fabricates a status (no automatic tracking in MVP). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid status", 422);

  const entry = await prisma.applicationStatusHistory.create({
    data: { applicationId: id, status: parsed.data.status, note: parsed.data.note },
  });
  await prisma.application.update({
    where: { id },
    data: { status: parsed.data.status },
  });
  return json({ ok: true, entry }, { status: 201 });
}
