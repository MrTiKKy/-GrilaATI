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

    const invRows = await sql`
      SELECT
        i.id::text AS id,
        i.workspace_id::text AS workspace_id,
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

    await sql`
      UPDATE invitatii
      SET status = 'refuzata', raspuns_la = now()
      WHERE id = ${invitId}::uuid
    `;

    await writeAudit({
      action: "invitatie_refuzata",
      resource: invitId,
      ip: clientKey(request),
      userId: session.user.userId,
      workspaceId: String(inv.workspace_id),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/invitatii/[id]/refuse", error);
    return NextResponse.json(
      { error: "Eroare la refuzarea invitației" },
      { status: 500 },
    );
  }
}
