import "server-only";
import { llmConfig } from "../env";
import { extractJsonObject } from "./parse-json";

/**
 * Optional LLM assist (OpenAI-compatible API) for refining field mapping.
 *
 * Default target: Kimi K2.7 (code) hosted on Cloudflare Workers AI —
 *   POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions
 *
 * Without LLM_API_KEY / CF_API_TOKEN the deterministic on-device engine in
 * packages/core is the only mapper (the default) — no vault data ever leaves
 * the user's device. When configured, only field METADATA (labels, types,
 * select options — never values) is sent.
 *
 * Cloudflare/Kimi quirks handled here:
 *  - `response_format: json_object` is not guaranteed on Workers AI → a 400
 *    mentioning it is retried once without the parameter.
 *  - Kimi often wraps JSON in ```json fences or prose → tolerant extraction.
 *  - Cloudflare native error shape { success:false, errors:[…] } is surfaced.
 */

export interface LlmStatus {
  configured: boolean;
  provider: string;
  model: string;
}

export function llmStatus(): LlmStatus {
  const cfg = llmConfig();
  return {
    configured: cfg.configured,
    provider: cfg.provider,
    model: cfg.configured ? cfg.model : "deterministic-engine",
  };
}

async function chatCompletions(
  cfg: ReturnType<typeof llmConfig>,
  system: string,
  user: string,
  withResponseFormat: boolean,
): Promise<Response> {
  return fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      ...(withResponseFormat ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
}

function friendlyError(status: number, bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as {
      success?: boolean;
      errors?: { code?: number; message?: string }[];
      error?: { message?: string };
      message?: string;
    };
    // Cloudflare native error shape
    if (parsed.success === false && Array.isArray(parsed.errors)) {
      const e = parsed.errors[0];
      return e?.message ? `LLM ${status}: ${e.message}` : `LLM ${status}`;
    }
    // OpenAI-style error shape
    const msg = parsed.error?.message ?? parsed.message;
    return msg ? `LLM ${status}: ${String(msg).slice(0, 200)}` : `LLM ${status}`;
  } catch {
    return `LLM ${status}`;
  }
}

/**
 * Generic "prompt → strict JSON" helper. The raw text/labels it receives are
 * NEVER vault values.
 */
export async function llmJson<T>(
  system: string,
  user: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string; configured: boolean }> {
  const cfg = llmConfig();
  if (!cfg.configured) return { ok: false, error: "LLM not configured", configured: false };

  try {
    let res = await chatCompletions(cfg, system, user, true);

    // Some OpenAI-compatible gateways (including Cloudflare Workers AI) may
    // reject response_format — retry once without it.
    if (res.status === 400 || res.status === 422) {
      const bodyText = await res.text();
      if (/response_format|unknown (field|parameter|argument)|not supported/i.test(bodyText)) {
        res = await chatCompletions(cfg, system, user, false);
      } else {
        return { ok: false, error: friendlyError(res.status, bodyText), configured: true };
      }
    }

    if (!res.ok) {
      const bodyText = await res.text();
      return { ok: false, error: friendlyError(res.status, bodyText), configured: true };
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string | null }; text?: string }[];
    };
    const content =
      payload.choices?.[0]?.message?.content ?? payload.choices?.[0]?.text ?? null;
    if (!content) return { ok: false, error: "LLM returned no content", configured: true };

    const parsed = extractJsonObject(content);
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "LLM response was not valid JSON", configured: true };
    }
    return { ok: true, data: parsed as T };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "LLM request failed",
      configured: true,
    };
  }
}
