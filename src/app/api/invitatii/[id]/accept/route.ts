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

    // Find pending invite for this user
    const invRows = await sql`
      SELECT
        i.id::text AS id,
        i.workspace_id::text AS workspace_id,
        i.rol,
        i.poate_modifica_setari,
        i.email
      FROM invitatii i
      WHERE i.id = ${invitId}::uuid
        AND i.email = ${session.user.email}
        AND i.status = 'in_asteptare'
      LIMIT 1
    `;
    const inv = invRows[0];
    if (!inv) {
      return NextResponse.json(
        { error: "Invitația nu a fost găsită sau a expirat" },
        { status: 404 },
      );
    }

    const workspaceId = String(inv.workspace_id);

    // Check if already a member
    const existingMember = await sql`
      SELECT 1 FROM workspace_members
      WHERE workspace_id = ${workspaceId}::uuid
        AND user_id = ${session.user.userId}::uuid
      LIMIT 1
    `;
    if (existingMember[0]) {
      // Already member — just mark invite as accepted
      await sql`
        UPDATE invitatii
        SET status = 'acceptata', raspuns_la = now()
        WHERE id = ${invitId}::uuid
      `;
      return NextResponse.json({ ok: true });
    }

    // Transaction: insert member + update invite status
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (
        ${workspaceId}::uuid,
        ${session.user.userId}::uuid,
        ${String(inv.rol)},
        ${Boolean(inv.poate_modifica_setari)}
      )
    `;
    await sql`
      UPDATE invitatii
      SET status = 'acceptata', raspuns_la = now()
      WHERE id = ${invitId}::uuid
    `;

    await writeAudit({
      action: "invitatie_acceptata",
      resource: invitId,
      ip: clientKey(request),
      userId: session.user.userId,
      workspaceId,
      detail: { rol: String(inv.rol) },
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
