import { NextRequest } from "next/server";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { gnaniTranscribe } from "@/lib/voice/gnani";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/voice/stt — speech-to-text via Gnani.ai.
 * Body: multipart with `audio` (WAV produced by the client recorder).
 * The API key stays on the server; clients never see it.
 *
 * When Gnani is not configured, responds 503 { configured: false } and the
 * caller falls back to browser speech (clearly labelled in the UI).
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const rl = rateLimit(`stt:${auth.user.id}`, 30, 60_000);
  const fail = limitOrFail(rl);
  if (fail) return fail;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("Expected multipart/form-data with an `audio` field", 415);
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) return apiError("Missing `audio` field", 422);
  if (audio.size > 8 * 1024 * 1024) return apiError("Audio too large", 413);
  const language = String(form.get("language") ?? "en-IN");

  const wav = await audio.arrayBuffer();
  const result = await gnaniTranscribe(wav, String((audio as File).name ?? "command.wav"), language);

  if (!result.configured) {
    return corsJson(
      { configured: false, error: result.error, fallback: "browser-web-speech" },
      { status: 503 },
    );
  }
  if (result.error) {
    return corsJson({ configured: true, error: result.error }, { status: 502 });
  }
  return corsJson({
    configured: true,
    transcript: result.transcript,
    detectedLanguage: result.detectedLanguage,
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
