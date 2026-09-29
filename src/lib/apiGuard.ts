import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  readSessionPayload,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/auth";
import { getDb } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/rateLimit";
import {
  getActiveWorkspace,
  getPreferredWorkspaceId,
  type WorkspaceRole,
} from "@/lib/workspace";

export type GuardContext = {
  user: SessionPayload;
  workspaceId: string;
  rol: WorkspaceRole;
  isOwner: boolean;
  poateModificaSetari: boolean;
};

export async function requireSession(): Promise<NextResponse | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }
  return null;
}

export async function requireSessionUser(): Promise<
  { user: SessionPayload } | { error: NextResponse }
> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const user = await readSessionPayload(token);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Sesiune invalidă — te rugăm să te autentifici din nou" },
        { status: 401 },
      ),
    };
  }
  return { user };
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

async function resolveGuardContext(
  request: Request,
  opts: { bucket: string; limit: number; windowMs: number; write: boolean },
): Promise<GuardContext | NextResponse> {
  const limited = enforceRateLimit(request, {
    bucket: opts.bucket,
    limit: opts.limit,
    windowMs: opts.windowMs,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  const sql = getDb();
  const rows = await sql`
    SELECT activ
    FROM users
    WHERE id = ${session.user.userId}::uuid
    LIMIT 1
  `;
  if (!rows[0] || !Boolean(rows[0].activ)) {
    return NextResponse.json({ error: "Neautentificat" }, { status: 401 });
  }

  const preferred = await getPreferredWorkspaceId();
  const ws = await getActiveWorkspace(session.user.userId, preferred);
  if (!ws) {
    return NextResponse.json(
      { error: "Nu faci parte din niciun workspace" },
      { status: 403 },
    );
  }

  if (opts.write && ws.rol === "viewer") {
    return NextResponse.json(
      { error: "Nu ai drept de scriere în acest workspace" },
      { status: 403 },
    );
  }

  return {
    user: session.user,
    workspaceId: ws.workspaceId,
    rol: ws.rol,
    isOwner: ws.isOwner,
    poateModificaSetari: ws.poateModificaSetari,
  };
}

/** Auth + workspace + rate limit pentru scrieri API */
export async function guardWrite(
  request: Request,
  opts?: { limit?: number; windowMs?: number },
): Promise<GuardContext | NextResponse> {
  return resolveGuardContext(request, {
    bucket: "write",
    limit: opts?.limit ?? 90,
    windowMs: opts?.windowMs ?? 60_000,
    write: true,
  });
}

export async function guardRead(
  request: Request,
): Promise<GuardContext | NextResponse> {
  return resolveGuardContext(request, {
    bucket: "read",
    limit: 180,
    windowMs: 60_000,
    write: false,
  });
}

/**
 * Scrieri / citiri pentru /api/setari/* — necesită poateModificaSetari
 * (owner sau flag pe membership), independent de rolul admin/editor/viewer.
 */
export async function guardSettings(
  request: Request,
  opts?: { limit?: number; windowMs?: number },
): Promise<GuardContext | NextResponse> {
  const gated = await resolveGuardContext(request, {
    bucket: "settings",
    limit: opts?.limit ?? 90,
    windowMs: opts?.windowMs ?? 60_000,
    write: false,
  });
  if (isGuardError(gated)) return gated;
  if (!gated.poateModificaSetari) {
    return NextResponse.json(
      { error: "Nu ai permisiunea să modifici setările" },
      { status: 403 },
    );
  }
  return gated;
}

export function isGuardError(
  value: GuardContext | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
