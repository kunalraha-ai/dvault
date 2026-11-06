/**
 * Tolerant JSON extraction from LLM output.
 *
 * Kimi models (like the Kimi K2.7 family) habitually wrap JSON in markdown
 * fences or add prose around it even when asked for raw JSON. This helper
 * carves the first JSON object out of whatever the model returned.
 */
export function extractJsonObject(raw: string | null | undefined): unknown | null {
  if (!raw) return null;

  // ```json { … } ``` (or an untagged fence)
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();

  // direct parse
  try {
    return JSON.parse(body);
  } catch {
    /* continue */
  }

  // otherwise carve the outermost { … } and try that
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      /* continue */
    }
  }

  return null;
}
