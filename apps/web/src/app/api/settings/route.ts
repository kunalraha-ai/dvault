import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, json, resolveUser, sameOrigin } from "@/lib/api";
import { normalizeAssistantSettings } from "@/lib/core";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = [
  "assistant.language", "assistant.voice", "assistant.speakSensitive",
  "user.email", "assistant.conversation",
] as const;

const putSchema = z.object({
  "assistant.language": z.string().max(10).optional(),
  "assistant.voice": z.string().max(40).optional(),
  "assistant.speakSensitive": z.boolean().optional(),
  "user.email": z.string().max(200).optional(),
  "assistant.conversation": z.string().max(60_000).optional(),
});

/** GET: the vault's settings — assistant config, user email, conversation. */
export async function GET(req: NextRequest) {
  const { user } = await resolveUser(req);
  const [rows, userRow] = await Promise.all([
    prisma.appSetting.findMany({ where: { userId: user.id } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } }),
  ]);
  const raw: Record<string, unknown> = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const parsed = normalizeAssistantSettings({
    language: typeof raw["assistant.language"] === "string" ? raw["assistant.language"] : undefined,
    voice: typeof raw["assistant.voice"] === "string" ? raw["assistant.voice"] : undefined,
    speakSensitive: raw["assistant.speakSensitive"] === "true",
  });

  // restore the last conversation (stored as JSON — without decrypted values)
  let conversation: unknown[] = [];
  try {
    const conv = raw["assistant.conversation"];
    if (typeof conv === "string" && conv.length > 2) {
      const parsedConv = JSON.parse(conv);
      if (Array.isArray(parsedConv)) conversation = parsedConv.slice(-60);
    }
  } catch { /* empty or corrupted — start fresh */ }

  return json({
    settings: { ...parsed },
    user: { email: userRow?.email ?? null, name: userRow?.name ?? user.name },
    conversation,
  });
}

/** PUT: persist assistant settings, email, or conversation (upsert each key). */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return apiError("Cross-origin request blocked", 403);
  const { user } = await resolveUser(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid settings payload", 422);

  const entries = Object.entries(parsed.data) as [string, string | boolean][];
  const serialized = entries.map(([k, v]) => [k, String(v)] as [string, string]);

  for (const [key, value] of serialized) {
    if (!ALLOWED_KEYS.includes(key as (typeof ALLOWED_KEYS)[number])) continue;
    await prisma.appSetting.upsert({
      where: { userId_key: { userId: user.id, key } },
      create: { userId: user.id, key, value },
      update: { value },
    });
  }

  // handle user.email directly on the user row
  if (parsed.data["user.email"] !== undefined) {
    const email = parsed.data["user.email"].trim();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: email === "" ? null : email,
        ...(email ? { name: email.split("@")[0] } : {}),
      },
    });
  }

  return json({ ok: true });
}
