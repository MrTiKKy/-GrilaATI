import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const WORKSPACE_COOKIE = "grila_workspace";

export type WorkspaceRole = "admin" | "editor" | "viewer";

export type ActiveWorkspace = {
  workspaceId: string;
  rol: WorkspaceRole;
  nume: string;
  /** user_id = workspaces.created_by */
  isOwner: boolean;
  /** isOwner SAU workspace_members.poate_modifica_setari */
  poateModificaSetari: boolean;
};

function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return v === "admin" || v === "editor" || v === "viewer";
}

/**
 * Workspace activ pentru user.
 * Dacă preferredId e setat și userul e membru → acel workspace.
 * Dacă preferredId e setat dar userul NU mai e membru → null
 *   (caller redirectează la /workspaces; nu cădem pe alt membership).
 * Dacă preferredId lipsește → primul membership după created_at ASC.
 */
export async function getActiveWorkspace(
  userId: string,
  preferredId?: string | null,
): Promise<ActiveWorkspace | null> {
  const sql = getDb();

  if (preferredId) {
    const rows = await sql`
      SELECT
        w.id::text AS workspace_id,
        w.nume,
        w.created_by::text AS created_by,
        m.rol,
        COALESCE(m.poate_modifica_setari, false) AS poate_modifica_setari
      FROM workspace_members m
      INNER JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.user_id = ${userId}::uuid
        AND w.id = ${preferredId}::uuid
      LIMIT 1
    `;
    const row = rows[0];
    if (!row) return null;
    const rol = String(row.rol);
    if (!isWorkspaceRole(rol)) return null;
    const isOwner = String(row.created_by) === userId;
    return {
      workspaceId: String(row.workspace_id),
      rol,
      nume: String(row.nume ?? ""),
      isOwner,
      poateModificaSetari: isOwner || Boolean(row.poate_modifica_setari),
    };
  }

  // Fără cookie: primul membership după created_at
  const rows = await sql`
    SELECT
      w.id::text AS workspace_id,
      w.nume,
      w.created_by::text AS created_by,
      m.rol,
      COALESCE(m.poate_modifica_setari, false) AS poate_modifica_setari
    FROM workspace_members m
    INNER JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ${userId}::uuid
    ORDER BY m.created_at ASC
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  const rol = String(row.rol);
  if (!isWorkspaceRole(rol)) return null;
  const isOwner = String(row.created_by) === userId;
  const flag = Boolean(row.poate_modifica_setari);
  return {
    workspaceId: String(row.workspace_id),
    rol,
    nume: String(row.nume ?? ""),
    isOwner,
    poateModificaSetari: isOwner || flag,
  };
}

/** Read preferred workspace id from cookie jar */
export async function getPreferredWorkspaceId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Set workspace cookie on a NextResponse */
export function setWorkspaceCookie(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
  workspaceId: string,
): void {
  response.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/** Clear workspace cookie */
export function clearWorkspaceCookie(
  response: { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => void } },
): void {
  response.cookies.set(WORKSPACE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  });
}
