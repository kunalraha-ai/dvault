/**
 * Server-side environment access. Secrets are ONLY read here (server code);
 * nothing in this module may be imported from client components.
 */

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function dataDir(): string {
  return process.env.DVAULT_DATA_DIR ?? ".data";
}

// --------------------------------------------------------------------------
// Gnani.ai voice configuration
// --------------------------------------------------------------------------
// Endpoint contract per https://docs.gnani.ai — Quick Start:
//   STT:  POST https://api.vachana.ai/stt/v3        (multipart, X-API-Key-ID)
//   TTS:  POST https://api.vachana.ai/api/v1/tts/inference (JSON, X-API-Key-ID)
export const GNANI_STT_URL_DEFAULT = "https://api.vachana.ai/stt/v3";
export const GNANI_TTS_URL_DEFAULT = "https://api.vachana.ai/api/v1/tts/inference";

export function gnaniConfig() {
  const apiKey = process.env.GNANI_API_KEY?.trim() || "";
  return {
    configured: apiKey.length > 0,
    apiKey,
    sttUrl: process.env.GNANI_STT_URL?.trim() || GNANI_STT_URL_DEFAULT,
    ttsUrl: process.env.GNANI_TTS_URL?.trim() || GNANI_TTS_URL_DEFAULT,
    sttModel: process.env.GNANI_STT_MODEL?.trim() || "prisma-v3.0",
    ttsModel: process.env.GNANI_TTS_MODEL?.trim() || "timbre-v2.5",
    ttsVoice: process.env.GNANI_TTS_VOICE?.trim() || "Kaveri",
    defaultLanguage: process.env.GNANI_DEFAULT_LANGUAGE?.trim() || "en-IN",
    languages: (
      process.env.GNANI_LANGUAGES?.trim() || "en-IN,hi-IN,hi-en,kn-IN,ta-IN,te-IN,ml-IN,mr-IN,bn-IN,gu-IN,pa-IN,indic-auto"
    ).split(","),
  };
}

// --------------------------------------------------------------------------
// Optional LLM assist (AI-assisted field-mapping refinement).
// Default target: Kimi K2.7 (code) on Cloudflare Workers AI.
//   base URL: https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1
//   model:    @cf/moonshotai/kimi-k2.7-code
// Set CF_ACCOUNT_ID + CF_API_TOKEN (or LLM_API_KEY), or override fully via
// LLM_BASE_URL / LLM_MODEL for any OpenAI-compatible API.
// Without credentials the deterministic on-device mapper is used.
// --------------------------------------------------------------------------
export function llmConfig() {
  const apiKey = (process.env.LLM_API_KEY ?? process.env.CF_API_TOKEN ?? "").trim();
  const accountId = (process.env.CF_ACCOUNT_ID ?? "").trim();
  return {
    configured: apiKey.length > 0,
    apiKey,
    baseUrl:
      (process.env.LLM_BASE_URL ?? "").trim() ||
      (accountId
        ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
        : "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/ai/v1"),
    model: (process.env.LLM_MODEL ?? "").trim() || "@cf/moonshotai/kimi-k2.7-code",
    provider: "cloudflare-workers-ai",
  };
}
