import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, corsJson, optionsResponse, resolveUser } from "@/lib/api";
import { llmJson, llmStatus } from "@/lib/ai/llm";
import { mapFormField, type FormFieldMetadata } from "@dvault/core";
import { rateLimit, limitOrFail } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  fields: z.array(z.unknown()).max(120),
  profileType: z.enum(["personal", "business"]).optional(),
});

/**
 * POST /api/ai/map-fields — OPTIONAL AI-assisted mapping refinement.
 *
 * Receives ONLY field metadata (labels, types, options — never values) and
 * returns refined mappings. When no LLM is configured (the default), it
 * answers with `mode: "deterministic"` and the deterministic on-device
 * results so callers don't call it again. The deterministic engine in
 * packages/core is the primary mapper; this endpoint exists to show the
 * LLM-augmented path with strict structured JSON.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveUser(req);
  if (!auth) return apiError("Not authenticated", 401);

  const rl = rateLimit(`map:${auth.user.id}`, 20, 60_000);
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

  const fields = parsed.data.fields as FormFieldMetadata[];
  const deterministic = fields.map((f) =>
    mapFormField(f, { profileType: parsed.data.profileType ?? null }),
  );

  const llm = llmStatus();
  if (!llm.configured) {
    return corsJson({
      mode: "deterministic",
      llmConfigured: false,
      mappings: deterministic,
      note: "On-device deterministic mapper used. Set LLM_API_KEY to enable AI-assisted refinement.",
    });
  }

  const result = await llmJson<{ mappings: { index: number; fieldKey: string | null; confidence: number }[] }>(
    "You are a form-field mapper for D-Vault. Given website form field metadata (label, type, options — no values), " +
      "map each field to the most likely D-Vault vault field key from the provided catalog. " +
      'Respond strictly as JSON: {"mappings":[{"index":<number>,"fieldKey":<string|null>,"confidence":<0-1>}]}.',
    JSON.stringify({ fields, profileType: parsed.data.profileType ?? null }),
  );

  if (!result.ok) {
    return corsJson({
      mode: "deterministic",
      llmConfigured: true,
      llmError: result.error,
      mappings: deterministic,
    });
  }

  const refined = fields.map((f, i) => {
    const llmMatch = result.data.mappings.find((m) => m.index === i);
    const det = deterministic[i];
    const merged = Math.max(det.mapping.confidence, llmMatch?.confidence ?? 0);
    return {
      mapping: {
        fieldKey: merged >= det.mapping.confidence ? llmMatch?.fieldKey ?? det.mapping.fieldKey : det.mapping.fieldKey,
        confidence: Number(merged.toFixed(3)),
        level: merged >= 0.85 ? "high" : merged >= 0.55 ? "medium" : merged >= 0.3 ? "low" : "none",
        reason: det.mapping.reason,
      },
      missingInVault: det.missingInVault,
      alternatives: det.alternatives,
    };
  });

  return corsJson({ mode: "llm-assisted", llmConfigured: true, mappings: refined });
}

export async function OPTIONS() {
  return optionsResponse();
}
