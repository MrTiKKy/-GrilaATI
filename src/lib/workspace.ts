import { getDb } from "@/lib/db";

export type WorkspaceRole = "admin" | "editor" | "viewer";

export type ActiveWorkspace = {
  workspaceId: string;
  rol: WorkspaceRole;
  nume: string;
};

function isWorkspaceRole(v: unknown): v is WorkspaceRole {
  return v === "admin" || v === "editor" || v === "viewer";
}

/**
 * Workspace activ pentru user — citit din DB la fiecare cerere (nu din JWT).
 * Dacă are mai multe, ia primul după created_at (selector UI vine mai târziu).
 */
export async function getActiveWorkspace(
  userId: string,
): Promise<ActiveWorkspace | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      w.id::text AS workspace_id,
      w.nume,
      m.rol
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
  return {
    workspaceId: String(row.workspace_id),
    rol,
    nume: String(row.nume ?? ""),
  };
}
