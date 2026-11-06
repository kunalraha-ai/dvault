/**
 * Simple in-memory rate limiter for API routes.
 *
 * MVP note: per-process only (resets on restart, not shared across
 * instances). Production would use Redis or an edge KV — documented in
 * docs/SECURITY.md as a known limitation.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    if (buckets.size > 5000) {
      // prune expired
      for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
    }
    return { ok: true, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function limitOrFail(res: { ok: boolean; resetAt: number }): Response | null {
  if (res.ok) return null;
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((res.resetAt - Date.now()) / 1000)) },
    },
  );
}
