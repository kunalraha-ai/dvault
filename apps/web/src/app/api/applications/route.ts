import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { APPLICATION_STATUSES } from "@/lib/core";

/** GET: list/search applications. */
export async function GET(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const query = sp.get("q");
  const sort = sp.get("sort") ?? "date";
  const timeframe = sp.get("timeframe");

  const where: Record<string, unknown> = { userId: auth.user.id };
  if (status && (APPLICATION_STATUSES as readonly string[]).includes(status)) {
    where.status = status;
  }
  if (query) {
    where.OR = [
      { applicationName: { contains: query } },
      { websiteDomain: { contains: query } },
      { applicationUrl: { contains: query } },
    ];
  }
  if (timeframe === "recent") {
    where.submissionDate = { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) };
  } else if (timeframe === "last_month") {
    const now = new Date();
    where.submissionDate = {
      gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      lt: new Date(now.getFullYear(), now.getMonth(), 1),
    };
  } else if (timeframe === "last_year") {
    where.submissionDate = { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) };
  }

  const apps = await prisma.application.findMany({
    where,
    orderBy:
      sort === "name"
        ? { applicationName: "asc" }
        : sort === "website"
          ? { websiteDomain: "asc" }
          : sort === "status"
            ? { status: "asc" }
            : { createdAt: "desc" },
    include: { profile: { select: { profileName: true, profileType: true } } },
  });

  return json({
    applications: apps.map((a) => ({
      id: a.id,
      applicationName: a.applicationName,
      websiteDomain: a.websiteDomain,
      applicationUrl: a.applicationUrl,
      encryptedReferenceId: a.encryptedReferenceId ? JSON.parse(a.encryptedReferenceId) : null,
      submissionDate: a.submissionDate,
      status: a.status,
      isDemo: a.isDemo,
      profileName: a.profile?.profileName ?? null,
      profileType: a.profile?.profileType ?? null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    stats: await applicationStats(auth.user.id),
  });
}

async function applicationStats(userId: string) {
  const [total, submitted, pending, approved, rejected] = await Promise.all([
    prisma.application.count({ where: { userId } }),
    prisma.application.count({ where: { userId, status: "submitted" } }),
    prisma.application.count({ where: { userId, status: "pending" } }),
    prisma.application.count({ where: { userId, status: "approved" } }),
    prisma.application.count({ where: { userId, status: "rejected" } }),
  ]);
  return { total, submitted, pending, approved, rejected };
}

const createSchema = z.object({
  applicationName: z.string().min(1).max(200),
  websiteDomain: z.string().min(1).max(200),
  applicationUrl: z.string().url().max(2000),
  profileId: z.string().nullable().optional(),
  encryptedReferenceId: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
  encryptedNotes: z.object({ c: z.string(), iv: z.string() }).nullable().optional(),
  submissionDate: z.string().datetime().nullable().optional(),
  status: z.enum(["draft", "submitted", "pending", "approved", "rejected", "unknown"]).default("unknown"),
  isDemo: z.boolean().default(false),
});

/** POST: save an application record (after explicit user confirmation). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 422);
  const data = parsed.data;

  if (data.profileId) {
    const profile = await prisma.profile.findFirst({ where: { id: data.profileId, userId: auth.user.id } });
    if (!profile) return apiError("Profile not found", 404);
  }

  const app = await prisma.application.create({
    data: {
      userId: auth.user.id,
      profileId: data.profileId ?? null,
      applicationName: data.applicationName.trim(),
      websiteDomain: data.websiteDomain.trim().toLowerCase(),
      applicationUrl: data.applicationUrl,
      encryptedReferenceId: data.encryptedReferenceId ? JSON.stringify(data.encryptedReferenceId) : null,
      encryptedNotes: data.encryptedNotes ? JSON.stringify(data.encryptedNotes) : null,
      submissionDate: data.submissionDate ? new Date(data.submissionDate) : null,
      status: data.status,
      isDemo: data.isDemo,
      statusHistory: data.status !== "unknown"
        ? { create: [{ status: data.status, note: "Initial record" }] }
        : undefined,
    },
  });

  await prisma.consentEvent.create({
    data: {
      userId: auth.user.id,
      action: "application_saved",
      websiteDomain: data.websiteDomain,
      details: JSON.stringify({ applicationId: app.id, withScreenshot: false }),
    },
  });

  return json(
    {
      ok: true,
      application: {
        id: app.id,
        applicationName: app.applicationName,
        websiteDomain: app.websiteDomain,
        status: app.status,
        createdAt: app.createdAt,
      },
    },
    { status: 201 },
  );
}
