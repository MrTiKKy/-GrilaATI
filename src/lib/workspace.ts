import { getDb } from "@/lib/db";

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
