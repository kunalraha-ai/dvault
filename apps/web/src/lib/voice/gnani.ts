import "server-only";
import { gnaniConfig, GNANI_STT_URL_DEFAULT } from "../env";

/**
 * Gnani.ai voice provider adapter.
 *
 * Built against the published Gnani Speech API contract:
 *   POST {GNANI_STT_URL}/stt/v3                    — multipart STT
 *     form fields: audio_file (WAV/MP3/OGG/FLAC/AAC/M4A, 8–44.1kHz, ≤30s),
 *                 model (prisma-v3.0 | prisma-v2.5),
 *                 language_code (e.g. en-IN, hi-IN, indic-auto),
 *                 format=transcribe (optional)
 *     header: X-API-Key-ID
 *     200 → { success, request_id, transcript, model, detected_language_code, processing_time }
 *
 *   POST {GNANI_TTS_URL}/api/v1/tts/inference      — JSON TTS
 *     body: { text, voice, model (timbre-v2.5|timbre-v3.0), language,
 *            speed, audio_config { sample_rate, num_channels,
 *            sample_width, encoding: "linear_pcm", container: "wav" } }
 *     header: X-API-Key-ID
 *     200 → binary audio/wav
 *
 * Docs: https://docs.gnani.ai (see docs/GNANI_INTEGRATION.md in this repo).
 *
 * HONEST STATUS: if GNANI_API_KEY is not set, these functions return
 * `configured: false` and the UI falls back to browser speech — clearly
 * labelled. Nothing pretends to be Gnani.
 */

export interface SttResult {
  configured: boolean;
  transcript?: string;
  detectedLanguage?: string;
  error?: string;
}

export interface TtsResult {
  configured: boolean;
  audio?: ArrayBuffer; // WAV
  contentType?: string;
  error?: string;
}

export { gnaniConfig } from "../env";

export function gnaniStatus() {
  const cfg = gnaniConfig();
  return {
    provider: "gnani.ai" as const,
    configured: cfg.configured,
    sttUrl: cfg.configured ? cfg.sttUrl : GNANI_STT_URL_DEFAULT,
    sttModel: cfg.sttModel,
    ttsModel: cfg.ttsModel,
    ttsVoice: cfg.ttsVoice,
    defaultLanguage: cfg.defaultLanguage,
    languages: cfg.languages,
  };
}

export async function gnaniTranscribe(
  wav: ArrayBuffer,
  filename: string,
  language: string,
): Promise<SttResult> {
  const cfg = gnaniConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      error:
        "Gnani.ai is not configured. Set GNANI_API_KEY in apps/web/.env (see docs/GNANI_INTEGRATION.md).",
    };
  }
  try {
    const form = new FormData();
    const lang = language === "auto" ? "indic-auto" : language || cfg.defaultLanguage;
    form.append(
      "audio_file",
      new Blob([wav], { type: "audio/wav" }),
      filename || "command.wav",
    );
    form.append("model", cfg.sttModel);
    form.append("language_code", lang === "indic-auto" && cfg.sttModel === "prisma-v2.5" ? "en-IN" : lang);
    const res = await fetch(cfg.sttUrl, {
      method: "POST",
      headers: { "X-API-Key-ID": cfg.apiKey },
      body: form,
    });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(text);
    } catch {
      return { configured: true, error: `Unexpected Gnani response (${res.status})` };
    }
    if (!res.ok) {
      const detail = (body as { detail?: { message?: string }; message?: string });
      return {
        configured: true,
        error:
          detail.detail?.message ??
          detail.message ??
          `Gnani STT failed with status ${res.status}`,
      };
    }
    const transcript = (body as { transcript?: string }).transcript;
    if (!transcript) {
      return { configured: true, error: "Gnani returned no transcript for this audio." };
    }
    return {
      configured: true,
      transcript,
      detectedLanguage: (body as { detected_language_code?: string }).detected_language_code,
    };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? `Could not reach Gnani STT: ${e.message}` : "Could not reach Gnani STT.",
    };
  }
}

export async function gnaniSynthesize(
  text: string,
  language: string,
  options?: { voice?: string; model?: string },
): Promise<TtsResult> {
  const cfg = gnaniConfig();
  if (!cfg.configured) {
    return {
      configured: false,
      error: "Gnani.ai is not configured. Set GNANI_API_KEY to enable voice responses.",
    };
  }
  try {
    const res = await fetch(cfg.ttsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key-ID": cfg.apiKey,
      },
      body: JSON.stringify({
        text,
        voice: options?.voice ?? cfg.ttsVoice,
        model: options?.model ?? cfg.ttsModel,
        language: language || cfg.defaultLanguage,
        speed: 1.0,
        audio_config: {
          sample_rate: 48000,
          num_channels: 1,
          sample_width: 2,
          encoding: "linear_pcm",
          container: "wav",
        },
      }),
    });
    if (!res.ok) {
      const raw = await res.text();
      let message = `Gnani TTS failed with status ${res.status}`;
      try {
        const parsed = JSON.parse(raw) as { message?: string; detail?: { message?: string } };
        message = parsed.message ?? parsed.detail?.message ?? message;
      } catch { /* keep default */ }
      return { configured: true, error: message };
    }
    const audio = await res.arrayBuffer();
    return { configured: true, audio, contentType: res.headers.get("content-type") ?? "audio/wav" };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? `Could not reach Gnani TTS: ${e.message}` : "Could not reach Gnani TTS.",
    };
  }
}
