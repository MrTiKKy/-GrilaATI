import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "read",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT
        i.id::text AS id,
        i.rol,
        i.poate_modifica_setari,
        w.nume AS workspace_nume,
        owner_u.email AS owner_email,
        owner_u.nume AS owner_nume
      FROM invitatii i
      INNER JOIN workspaces w ON w.id = i.workspace_id
      LEFT JOIN users owner_u ON owner_u.id = w.created_by
      WHERE i.email = ${session.user.email}
        AND i.status = 'in_asteptare'
      ORDER BY i.created_at DESC
    `;

    const items = rows.map((row) => ({
      id: String(row.id),
      rol: String(row.rol),
      poateModificaSetari: Boolean(row.poate_modifica_setari),
      workspaceNume: String(row.workspace_nume ?? ""),
      ownerEmail: String(row.owner_email ?? ""),
      ownerNume: row.owner_nume ? String(row.owner_nume) : null,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/invitatii", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca invitațiile" },
      { status: 500 },
    );
  }
}
