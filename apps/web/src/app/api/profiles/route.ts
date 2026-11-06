import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { CATEGORIES } from "@/lib/core";

export async function GET(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const profiles = await prisma.profile.findMany({
    where: { userId: auth.user.id },
    orderBy: [{ profileType: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { fields: true, documents: true, applications: true } },
      fields: { select: { verified: true } },
    },
  });
  return json({
    profiles: profiles.map((p) => ({
      id: p.id,
      profileType: p.profileType,
      profileName: p.profileName,
      isDefault: p.isDefault,
      createdAt: p.createdAt,
      fieldCount: p._count.fields,
      documentCount: p._count.documents,
      applicationCount: p._count.applications,
      verifiedFieldCount: p.fields.filter((f) => f.verified).length,
    })),
  });
}

const createSchema = z.object({
  profileType: z.enum(["personal", "business"]),
  profileName: z.string().min(1).max(120),
});

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
  if (!parsed.success) return apiError("Invalid profile", 422);
  const { profileType, profileName } = parsed.data;

  if (!Object.values(CATEGORIES).some((c) => c.profileType === profileType)) {
    return apiError("Unknown profile type", 422);
  }

  const existing = await prisma.profile.findMany({ where: { userId: auth.user.id } });
  const profile = await prisma.profile.create({
    data: {
      userId: auth.user.id,
      profileType,
      profileName: profileName.trim(),
      isDefault: existing.filter((p) => p.profileType === profileType).length === 0,
    },
  });
  return json(
    { profile: { id: profile.id, profileType: profile.profileType, profileName: profile.profileName } },
    { status: 201 },
  );
}
