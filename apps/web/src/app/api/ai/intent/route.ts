import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { llmJson, llmStatus } from "@/lib/ai/llm";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";
import { FIELDS, FIELD_MAP, CATEGORIES } from "@dvault/core";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const schema = z.object({
  utterance: z.string().min(1).max(300),
  language: z.string().max(10).default("en-IN"),
  /** profile context for better disambiguation */
  profileHint: z.string().max(30).optional(),
});

const INTENTS = [
  "GET_PERSONAL_INFORMATION", "GET_BUSINESS_INFORMATION",
  "SAVE_INFORMATION", "UPDATE_INFORMATION",
  "FILL_ACTIVE_FORM", "ANALYZE_ACTIVE_FORM",
  "SAVE_APPLICATION", "SEARCH_APPLICATIONS",
  "GET_APPLICATION_DETAILS", "UPLOAD_DOCUMENT",
  "SET_ACTIVE_PROFILE", "UNKNOWN",
] as const;

/**
 * POST /api/ai/intent — LLM-powered semantic intent parsing.
 *
 * The deterministic on-device engine runs FIRST (it's instant and offline).
 * This endpoint is the FALLBACK when it returns UNKNOWN or a null field_key:
 * the LLM gets the utterance + the vault field catalog (labels only — NEVER
 * values) and returns a structured intent. Kimi K2.7 naturally understands
 * Indian languages, so Hindi/Tamil/etc. utterances that the deterministic
 * patterns miss are handled here.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const rl = rateLimit(`intent:${auth.user.id}`, 30, 60_000);
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
  const { utterance, language, profileHint } = parsed.data;

  const llm = llmStatus();
  if (!llm.configured) {
    return corsJson({
      ok: false,
      configured: false,
      error: "LLM not configured (set LLM_API_KEY or CF_API_TOKEN + CF_ACCOUNT_ID). The deterministic on-device engine handles common phrasings; the LLM extends coverage to natural language and Indic variants.",
    }, { status: 503 });
  }

  // Build the field catalog for the prompt (labels + keys — never values)
  const fieldCatalog = FIELDS.map((f) => `${f.key} (${f.label}${f.sensitive ? ", sensitive" : ""})`).join("\n");

  const system =
    "You are the intent parser for D-Vault, a personal information vault assistant. " +
    "Parse the user's voice/text command and return a structured intent.\n\n" +
    "Valid intents: " + INTENTS.join(", ") + "\n\n" +
    "Available vault fields (key = label):\n" + fieldCatalog + "\n\n" +
    "Rules:\n" +
    '- Respond ONLY as JSON: {"intent": "...", "field_key": "..." or null, "value": "..." or null, "profile_type": "personal"|"business"|null, "confidence": 0.0-1.0, "explanation": "..."}\n' +
    "- field_key MUST be one of the keys listed above (or null if not a field lookup/save)\n" +
    "- For SAVE_INFORMATION/UPDATE_INFORMATION, extract the value the user wants to store\n" +
    "- The user may speak any Indian language (Hindi, Tamil, Telugu, Kannada, Bengali, Marathi, Gujarati, etc.) or English or Hinglish — understand them all\n" +
    "- If the utterance is asking a question about stored data → GET_*_INFORMATION with the matching field_key\n" +
    "- If they want to store/remember something → SAVE_INFORMATION or UPDATE_INFORMATION\n" +
    "- If they mention filling a form → FILL_ACTIVE_FORM\n" +
    "- If they mention saving an application → SAVE_APPLICATION\n" +
    "- If you cannot confidently determine the intent → UNKNOWN\n" +
    "- confidence should be 0.6-1.0 for your best guesses, 1.0 for certain\n" +
    "- explanation should be a short friendly sentence in English describing what you understood";

  const user = `Utterance: "${utterance}"\nLanguage: ${language}${profileHint ? `\nProfile hint: ${profileHint}` : ""}`;

  const result = await llmJson<{
    intent?: string;
    field_key?: string | null;
    value?: string | null;
    profile_type?: string | null;
    confidence?: number;
    explanation?: string;
  }>(system, user);

  if (!result.ok) {
    return corsJson({ ok: false, configured: true, error: result.error }, { status: 502 });
  }

  const data = result.data;

  // validate the intent is one we know
  const intent = INTENTS.includes(data.intent as (typeof INTENTS)[number]) ? data.intent : "UNKNOWN";
  // validate the field_key exists in our catalog
  const fieldKey = data.field_key && FIELD_MAP[data.field_key] ? data.field_key : null;
  // validate the profile_type
  const profileType = data.profile_type === "business" || data.profile_type === "personal" ? data.profile_type : null;
  const confidence = typeof data.confidence === "number" ? Math.min(1, Math.max(0, data.confidence)) : 0.5;

  return corsJson({
    ok: true,
    configured: true,
    model: llm.model,
    intent: {
      intent,
      field_key: fieldKey,
      value: data.value ?? null,
      profile_type: profileType,
      confidence,
      explanation: data.explanation ?? "Understood via AI.",
      requires_confirmation: intent === "SAVE_INFORMATION" || intent === "UPDATE_INFORMATION" || intent === "FILL_ACTIVE_FORM" || intent === "SAVE_APPLICATION",
      utterance,
    },
  });
}

export async function OPTIONS() {
  return optionsResponse();
}
