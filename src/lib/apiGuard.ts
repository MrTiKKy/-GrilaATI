import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rateLimit";

export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  return null;
}

export function enforceRateLimit(
  request: Request,
  opts: { bucket: string; limit: number; windowMs: number },
): NextResponse | null {
  const key = `${opts.bucket}:${clientKey(request)}`;
  const result = rateLimit(key, opts.limit, opts.windowMs);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Prea multe cereri. Încearcă din nou în curând." },
      {
        status: 429,
        headers: { "Retry-After": String(result.retryAfterSec) },
      },
    );
  }
  return null;
}

/** Auth + rate limit pentru scrieri API */
export async function guardWrite(
  request: Request,
  opts?: { limit?: number; windowMs?: number },
): Promise<NextResponse | null> {
  const authError = await requireSession();
  if (authError) return authError;
  return enforceRateLimit(request, {
    bucket: "write",
    limit: opts?.limit ?? 90,
    windowMs: opts?.windowMs ?? 60_000,
  });
}

export async function guardRead(
  request: Request,
): Promise<NextResponse | null> {
  const authError = await requireSession();
  if (authError) return authError;
  return enforceRateLimit(request, {
    bucket: "read",
    limit: 180,
    windowMs: 60_000,
  });
}
