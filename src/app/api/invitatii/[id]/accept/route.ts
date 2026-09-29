import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { parseUuid } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { clientKey } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  const { id: rawId } = await params;
  const invitId = parseUuid(rawId);
  if (!invitId) {
    return NextResponse.json({ error: "ID invalid" }, { status: 400 });
  }

  try {
    const sql = getDb();
    const userEmail = session.user.email;
    const userId = session.user.userId;

    // Atomic: UPDATE pending invite + INSERT member only if UPDATE matched.
    // Concurrent accepts: only one UPDATE succeeds; the other sees 0 rows → no insert.
    const [rows] = await sql.transaction((txn) => [
      txn`
        WITH updated AS (
          UPDATE invitatii
          SET status = 'acceptata', raspuns_la = now()
          WHERE id = ${invitId}::uuid
            AND status = 'in_asteptare'
            AND email = ${userEmail}
          RETURNING workspace_id, rol, poate_modifica_setari
        ),
        inserted AS (
          INSERT INTO workspace_members (
            workspace_id, user_id, rol, poate_modifica_setari
          )
          SELECT
            workspace_id,
            ${userId}::uuid,
            rol,
            poate_modifica_setari
          FROM updated
          ON CONFLICT (workspace_id, user_id) DO NOTHING
          RETURNING workspace_id
        )
        SELECT
          (SELECT count(*)::int FROM updated) AS updated_count,
          (SELECT workspace_id::text FROM updated LIMIT 1) AS workspace_id,
          (SELECT rol FROM updated LIMIT 1) AS rol
      `,
    ]);

    const row = rows[0];
    const updatedCount = Number(row?.updated_count ?? 0);
    if (updatedCount === 0) {
      return NextResponse.json(
        { error: "Invitația nu a fost găsită sau a expirat" },
        { status: 404 },
      );
    }

    const workspaceId = String(row.workspace_id);

    await writeAudit({
      action: "invitatie_acceptata",
      resource: invitId,
      ip: clientKey(request),
      userId,
      workspaceId,
      detail: { rol: String(row.rol) },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/invitatii/[id]/accept", error);
    return NextResponse.json(
      { error: "Eroare la acceptarea invitației" },
      { status: 500 },
    );
  }
}
