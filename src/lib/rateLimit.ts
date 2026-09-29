/**
 * Rate limiting: în memorie (API general) + în DB pentru login/register.
 */

import { getDb } from "@/lib/db";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** In-memory rate limit (per proces Node) — folosit de apiGuard pe rutele API. */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Rate limit persistent pe `login_incercari` (login + register).
 * Curăță automat rândurile mai vechi de 1 oră. Fiecare apel consumă o încercare.
 */
export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const sql = getDb();

  await sql`
    DELETE FROM login_incercari
    WHERE created_at < now() - interval '1 hour'
  `;

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const counted = await sql`
    SELECT
      count(*)::int AS n,
      EXTRACT(
        EPOCH FROM (
          MIN(created_at) + make_interval(secs => ${windowSec}) - now()
        )
      )::int AS retry_after
    FROM login_incercari
    WHERE cheie = ${key}
      AND created_at > now() - make_interval(secs => ${windowSec})
  `;

  const n = Number(counted[0]?.n ?? 0);
  if (n >= limit) {
    const retry = Number(counted[0]?.retry_after ?? 1);
    return {
      ok: false,
      retryAfterSec: Math.max(1, retry),
    };
  }

  await sql`
    INSERT INTO login_incercari (cheie) VALUES (${key})
  `;

  return { ok: true, retryAfterSec: 0 };
}

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "local";
}
