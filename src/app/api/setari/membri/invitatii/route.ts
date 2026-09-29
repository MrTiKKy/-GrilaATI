import { NextResponse } from "next/server";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid, clampString } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { clientKey } from "@/lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET: pending invites for this workspace
export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT
        i.id::text AS id,
        i.email,
        i.rol,
        i.poate_modifica_setari,
        i.status,
        i.created_at,
        inv_u.email AS invitat_de_email
      FROM invitatii i
      LEFT JOIN users inv_u ON inv_u.id = i.invitat_de
      WHERE i.workspace_id = ${gated.workspaceId}::uuid
        AND i.status = 'in_asteptare'
      ORDER BY i.created_at DESC
    `;

    const items = rows.map((row) => ({
      id: String(row.id),
      email: String(row.email),
      rol: String(row.rol),
      poateModificaSetari: Boolean(row.poate_modifica_setari),
      status: String(row.status),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      invitatDeEmail: String(row.invitat_de_email ?? ""),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/setari/membri/invitatii", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca invitațiile" },
      { status: 500 },
    );
  }
}

// POST: send invite
export async function POST(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const parsed = await readJsonLimited<{
      email?: unknown;
      rol?: unknown;
      poateModificaSetari?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const emailRaw = clampString(parsed.data.email, 254);
    if (!emailRaw || !EMAIL_RE.test(emailRaw.toLowerCase())) {
      return NextResponse.json(
        { error: "Adresă de email invalidă" },
        { status: 400 },
      );
    }
    const email = emailRaw.toLowerCase();

    const rol =
      typeof parsed.data.rol === "string" &&
      ["admin", "editor", "viewer"].includes(parsed.data.rol)
        ? parsed.data.rol
        : "editor";

    // Only owner can set poate_modifica_setari
    let poateModificaSetari = false;
    if (typeof parsed.data.poateModificaSetari === "boolean") {
      if (!gated.isOwner) {
        return NextResponse.json(
          { error: "Doar owner-ul poate acorda permisiunea de setări" },
          { status: 403 },
        );
      }
      poateModificaSetari = parsed.data.poateModificaSetari;
    }

    const sql = getDb();

    // Check if already a member
    const existingMember = await sql`
      SELECT 1 FROM workspace_members m
      INNER JOIN users u ON u.id = m.user_id
      WHERE m.workspace_id = ${gated.workspaceId}::uuid
        AND u.email = ${email}
      LIMIT 1
    `;
    if (existingMember[0]) {
      return NextResponse.json(
        { error: "Acest email este deja membru al workspace-ului" },
        { status: 409 },
      );
    }

    // Check if already has pending invite (unique index will also enforce this)
    const existingInvite = await sql`
      SELECT 1 FROM invitatii
      WHERE workspace_id = ${gated.workspaceId}::uuid
        AND email = ${email}
        AND status = 'in_asteptare'
      LIMIT 1
    `;
    if (existingInvite[0]) {
      return NextResponse.json(
        { error: "Există deja o invitație în așteptare pentru acest email" },
        { status: 409 },
      );
    }

    const inserted = await sql`
      INSERT INTO invitatii (workspace_id, email, rol, poate_modifica_setari, invitat_de, status)
      VALUES (
        ${gated.workspaceId}::uuid,
        ${email},
        ${rol},
        ${poateModificaSetari},
        ${gated.user.userId}::uuid,
        'in_asteptare'
      )
      RETURNING id::text AS id
    `;

    await writeAudit({
      action: "invitatie_trimisa",
      resource: String(inserted[0]?.id),
      ip: clientKey(request),
      userId: gated.user.userId,
      workspaceId: gated.workspaceId,
      detail: { email, rol, poateModificaSetari },
    });

    return NextResponse.json({ ok: true, id: String(inserted[0]?.id) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/setari/membri/invitatii", error);
    return NextResponse.json(
      { error: "Nu s-a putut trimite invitația" },
      { status: 500 },
    );
  }
}

// DELETE: cancel invite
export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const parsed = await readJsonLimited<{ id?: unknown }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const invitId = parseUuid(parsed.data.id);
    if (!invitId) {
      return NextResponse.json({ error: "id invalid" }, { status: 400 });
    }

    const sql = getDb();

    const invRows = await sql`
      SELECT 1 FROM invitatii
      WHERE id = ${invitId}::uuid
        AND workspace_id = ${gated.workspaceId}::uuid
        AND status = 'in_asteptare'
      LIMIT 1
    `;
    if (!invRows[0]) {
      return NextResponse.json(
        { error: "Invitație negăsită sau deja procesată" },
        { status: 404 },
      );
    }

    await sql`
      UPDATE invitatii
      SET status = 'anulata', raspuns_la = now()
      WHERE id = ${invitId}::uuid
    `;

    await writeAudit({
      action: "invitatie_anulata",
      resource: invitId,
      ip: clientKey(request),
      userId: gated.user.userId,
      workspaceId: gated.workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/setari/membri/invitatii", error);
    return NextResponse.json(
      { error: "Nu s-a putut anula invitația" },
      { status: 500 },
    );
  }
}
