import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clientKey } from "@/lib/rateLimit";
import { clampString } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { setWorkspaceCookie } from "@/lib/workspace";
import { SEEDED_CODES } from "@/lib/coduri";

// GET: list memberships for current user
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
        w.id::text AS id,
        w.nume,
        w.created_by::text AS created_by,
        m.rol,
        COALESCE(m.poate_modifica_setari, false) AS poate_modifica_setari,
        (SELECT COUNT(*)::int FROM workspace_members wm WHERE wm.workspace_id = w.id) AS member_count,
        owner_u.email AS owner_email,
        owner_u.nume AS owner_nume
      FROM workspace_members m
      INNER JOIN workspaces w ON w.id = m.workspace_id
      LEFT JOIN users owner_u ON owner_u.id = w.created_by
      WHERE m.user_id = ${session.user.userId}::uuid
      ORDER BY m.created_at ASC
    `;

    const items = rows.map((row) => {
      const isOwner = String(row.created_by) === session.user.userId;
      return {
        id: String(row.id),
        nume: String(row.nume ?? ""),
        isOwner,
        rol: String(row.rol),
        poateModificaSetari:
          isOwner || Boolean(row.poate_modifica_setari),
        memberCount: Number(row.member_count),
        ownerEmail: String(row.owner_email ?? ""),
        ownerNume: row.owner_nume ? String(row.owner_nume) : null,
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/workspaces", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca workspace-urile" },
      { status: 500 },
    );
  }
}

// POST: create workspace
export async function POST(request: Request) {
  const ip = clientKey(request);

  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const parsed = await readJsonLimited<{ nume?: unknown }>(request, 4_096);
    if (!parsed.ok) return parsed.response;

    const nume = clampString(parsed.data.nume, 80);
    if (!nume || nume.length < 2) {
      return NextResponse.json(
        { error: "Numele workspace-ului trebuie să aibă 2–80 caractere" },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Create workspace
    const wsRows = await sql`
      INSERT INTO workspaces (nume, created_by)
      VALUES (${nume}, ${session.user.userId}::uuid)
      RETURNING id::text AS id
    `;
    const wsId = String(wsRows[0]?.id);
    if (!wsId) {
      return NextResponse.json(
        { error: "Eroare la crearea workspace-ului" },
        { status: 500 },
      );
    }

    // Create owner membership
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${wsId}::uuid, ${session.user.userId}::uuid, 'admin', true)
    `;

    // Seed categorie
    const catRows = await sql`
      INSERT INTO categorii (workspace_id, nume, titlu_grafic, ordine, activ)
      VALUES (${wsId}::uuid, 'Categoria 1', ${nume}, 1, true)
      RETURNING id::text AS id
    `;
    const catId = String(catRows[0]?.id);

    // Seed codes (workspace-level, categorie_id = NULL — matching existing pattern)
    for (const seed of SEEDED_CODES) {
      await sql`
        INSERT INTO coduri (workspace_id, categorie_id, cod, eticheta, culoare, ordine, activ, sistem, comportament_vechi)
        VALUES (
          ${wsId}::uuid,
          NULL,
          ${seed.cod},
          ${seed.eticheta},
          '#111111',
          ${seed.ordine},
          true,
          ${seed.sistem},
          ${seed.comportamentVechi}
        )
      `;
    }

    // Seed ore_coduri for the new categorie — 0 for each cod×categorie
    // (panoul O.SD / grila citesc ore_coduri; fără seed pe ore_osd)
    await sql`
      INSERT INTO ore_coduri (workspace_id, categorie_id, cod_id, ore_vineri, ore_sambata, ore_duminica, updated_at)
      SELECT
        ${wsId}::uuid,
        ${catId}::uuid,
        c.id,
        0, 0, 0, now()
      FROM coduri c
      WHERE c.workspace_id = ${wsId}::uuid
        AND (c.categorie_id IS NULL OR c.categorie_id = ${catId}::uuid)
      ON CONFLICT (workspace_id, categorie_id, cod_id) DO NOTHING
    `;

    // Set cookie to new workspace
    const response = NextResponse.json({ id: wsId }, { status: 201 });
    setWorkspaceCookie(response, wsId);

    await writeAudit({
      action: "workspace_creat",
      resource: wsId,
      ip,
      detail: { nume },
      userId: session.user.userId,
      workspaceId: wsId,
    });

    return response;
  } catch (error) {
    console.error("POST /api/workspaces", error);
    return NextResponse.json(
      { error: "Nu s-a putut crea workspace-ul" },
      { status: 500 },
    );
  }
}
