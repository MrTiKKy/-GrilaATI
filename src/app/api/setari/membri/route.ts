import { NextResponse } from "next/server";
import { guardSettings, isGuardError } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { parseUuid } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { clientKey } from "@/lib/rateLimit";

// GET: list members
export async function GET(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT
        m.user_id::text AS user_id,
        u.email,
        u.nume,
        m.rol,
        COALESCE(m.poate_modifica_setari, false) AS poate_modifica_setari,
        m.created_at,
        w.created_by::text AS owner_id
      FROM workspace_members m
      INNER JOIN users u ON u.id = m.user_id
      INNER JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.workspace_id = ${gated.workspaceId}::uuid
      ORDER BY m.created_at ASC
    `;

    const items = rows.map((row) => ({
      userId: String(row.user_id),
      email: String(row.email),
      nume: row.nume ? String(row.nume) : null,
      rol: String(row.rol),
      poateModificaSetari: Boolean(row.poate_modifica_setari),
      isOwner: String(row.user_id) === String(row.owner_id),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/setari/membri", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca membrii" },
      { status: 500 },
    );
  }
}

// PUT: update member rol / permissions
export async function PUT(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const parsed = await readJsonLimited<{
      userId?: unknown;
      rol?: unknown;
      poateModificaSetari?: unknown;
    }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const userId = parseUuid(parsed.data.userId);
    if (!userId) {
      return NextResponse.json(
        { error: "userId invalid" },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Check target is member
    const memberRows = await sql`
      SELECT m.rol, m.poate_modifica_setari, w.created_by::text AS owner_id
      FROM workspace_members m
      INNER JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.workspace_id = ${gated.workspaceId}::uuid
        AND m.user_id = ${userId}::uuid
      LIMIT 1
    `;
    const member = memberRows[0];
    if (!member) {
      return NextResponse.json(
        { error: "Membrul nu a fost găsit" },
        { status: 404 },
      );
    }

    const isTargetOwner = String(member.owner_id) === userId;

    // Cannot change owner's role or permissions
    if (isTargetOwner) {
      return NextResponse.json(
        { error: "Nu poți modifica rolul sau permisiunile owner-ului" },
        { status: 403 },
      );
    }

    const newRol =
      typeof parsed.data.rol === "string" &&
      ["admin", "editor", "viewer"].includes(parsed.data.rol)
        ? parsed.data.rol
        : String(member.rol);

    // Only owner can set poate_modifica_setari
    let newPoate = Boolean(member.poate_modifica_setari);
    if (typeof parsed.data.poateModificaSetari === "boolean") {
      if (!gated.isOwner) {
        return NextResponse.json(
          { error: "Doar owner-ul poate modifica permisiunea de setări" },
          { status: 403 },
        );
      }
      newPoate = parsed.data.poateModificaSetari;
    }

    await sql`
      UPDATE workspace_members
      SET rol = ${newRol}, poate_modifica_setari = ${newPoate}
      WHERE workspace_id = ${gated.workspaceId}::uuid
        AND user_id = ${userId}::uuid
    `;

    await writeAudit({
      action: "membru_rol",
      resource: userId,
      ip: clientKey(request),
      userId: gated.user.userId,
      workspaceId: gated.workspaceId,
      detail: { rol: newRol, poateModificaSetari: newPoate },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/setari/membri", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza membrul" },
      { status: 500 },
    );
  }
}

// DELETE: remove member
export async function DELETE(request: Request) {
  const gated = await guardSettings(request);
  if (isGuardError(gated)) return gated;

  try {
    const parsed = await readJsonLimited<{ userId?: unknown }>(request, 2_048);
    if (!parsed.ok) return parsed.response;

    const userId = parseUuid(parsed.data.userId);
    if (!userId) {
      return NextResponse.json(
        { error: "userId invalid" },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Check the target is member and not owner
    const memberRows = await sql`
      SELECT w.created_by::text AS owner_id
      FROM workspace_members m
      INNER JOIN workspaces w ON w.id = m.workspace_id
      WHERE m.workspace_id = ${gated.workspaceId}::uuid
        AND m.user_id = ${userId}::uuid
      LIMIT 1
    `;
    const member = memberRows[0];
    if (!member) {
      return NextResponse.json(
        { error: "Membrul nu a fost găsit" },
        { status: 404 },
      );
    }

    if (String(member.owner_id) === userId) {
      return NextResponse.json(
        { error: "Nu poți elimina owner-ul din workspace" },
        { status: 403 },
      );
    }

    await sql`
      DELETE FROM workspace_members
      WHERE workspace_id = ${gated.workspaceId}::uuid
        AND user_id = ${userId}::uuid
    `;

    await writeAudit({
      action: "membru_scos",
      resource: userId,
      ip: clientKey(request),
      userId: gated.user.userId,
      workspaceId: gated.workspaceId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/setari/membri", error);
    return NextResponse.json(
      { error: "Nu s-a putut elimina membrul" },
      { status: 500 },
    );
  }
}
