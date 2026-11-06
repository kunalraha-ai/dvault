import { NextRequest } from "next/server";
import { json, resolveUser, corsJson } from "@/lib/api";
import { gnaniStatus } from "@/lib/voice/gnani";
import { llmStatus } from "@/lib/ai/llm";

/** GET: report which providers are ACTUALLY configured (honest status). */
export async function GET(req: NextRequest) {
  const gnani = gnaniStatus();
  const llm = llmStatus();
  return corsJson({
    voice: {
      provider: "gnani.ai",
      configured: gnani.configured,
      // Fallback that the client will use when Gnani is not configured:
      fallback: {
        provider: "browser-web-speech",
        availableIn: "Chromium-based browsers",
        note:
          "Development fallback only — not Gnani.ai. Configure GNANI_API_KEY for real voice (see docs/GNANI_INTEGRATION.md).",
      },
      sttModel: gnani.sttModel,
      ttsModel: gnani.ttsModel,
      ttsVoice: gnani.ttsVoice,
      languages: gnani.languages,
    },
    ai: {
      mapping: llm.configured ? "llm-assisted" : "deterministic-on-device",
      model: llm.model,
      brain: llm.configured,
      provider: llm.provider,
    },
    storage: {
      provider: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local",
      bucket: process.env.SUPABASE_STORAGE_BUCKET || "dvault-documents",
    },
  });
}

export async function OPTIONS() {
  const { optionsResponse } = await import("@/lib/api");
  return optionsResponse();
}

// Auth not strictly needed for status, but keeping the response consistent.
export const dynamic = "force-dynamic";
