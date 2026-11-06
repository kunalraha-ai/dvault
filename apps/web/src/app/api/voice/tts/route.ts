import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { gnaniSynthesize, gnaniConfig } from "@/lib/voice/gnani";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";
import { ASSISTANT_VOICES, ttsModelForVoice } from "@/lib/core";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  text: z.string().min(1).max(600),
  language: z.string().max(10).default("en-IN"),
  voice: z.string().max(40).optional(),
});

/**
 * POST /api/voice/tts — text-to-speech via Gnani.ai (server-held API key).
 * 503 + { configured: false } when Gnani isn't configured; the caller then
 * uses browser speechSynthesis (clearly labelled fallback).
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const rl = rateLimit(`tts:${auth.user.id}`, 30, 60_000);
  const fail = limitOrFail(rl);
  if (fail) return fail;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Invalid input", 422);

  const userVoice = parsed.data.voice && ASSISTANT_VOICES.some((v) => v.id === parsed.data.voice)
    ? parsed.data.voice
    : undefined;
  const cfg = gnaniConfig();
  const model = userVoice ? ttsModelForVoice(userVoice) : cfg.ttsModel;
  const result = await gnaniSynthesize(parsed.data.text, parsed.data.language, {
    voice: userVoice ?? cfg.ttsVoice,
    model,
  });
  if (!result.configured) {
    return corsJson(
      { configured: false, error: result.error, fallback: "browser-speech-synthesis" },
      { status: 503 },
    );
  }
  if (result.error || !result.audio) {
    return corsJson({ configured: true, error: result.error ?? "TTS failed" }, { status: 502 });
  }
  const res = new Response(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.contentType ?? "audio/wav",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
  return res;
}

export async function OPTIONS() {
  return optionsResponse();
}
