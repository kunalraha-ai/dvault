import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.string().min(1).max(60),
  websiteDomain: z.string().max(200).optional(),
  details: z.record(z.unknown()).optional(),
});

/**
 * POST /api/extension/consent — append an auditable consent event (form
 * inspected, autofill approved, application saved, screenshot captured).
 * Every extension action that touches page data must be logged here.
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
  if (!parsed.success) return apiError("Invalid consent payload", 422);

  const event = await prisma.consentEvent.create({
    data: {
      userId: auth.user.id,
      action: parsed.data.action,
      websiteDomain: parsed.data.websiteDomain?.toLowerCase(),
      details: parsed.data.details ? JSON.stringify(parsed.data.details).slice(0, 2000) : null,
    },
  });
  return corsJson({ ok: true, id: event.id, grantedAt: event.grantedAt }, { status: 201 });
}

export async function OPTIONS() {
  return optionsResponse();
}
