import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { readJsonLimited } from "@/lib/readJsonLimited";
import { clampString } from "@/lib/validate";
import { isDevEmail, toPlainText } from "@/lib/devAccess";
import { getPreferredWorkspaceId } from "@/lib/workspace";

const TIPS = new Set(["idee", "problema", "altceva"]);

async function resolveVerifiedWorkspace(
  userId: string,
): Promise<{ workspaceId: string | null; nume: string | null }> {
  const preferred = await getPreferredWorkspaceId();
  if (!preferred) return { workspaceId: null, nume: null };

  const sql = getDb();
  const rows = await sql`
    SELECT w.id::text AS id, w.nume
    FROM workspace_members m
    INNER JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ${userId}::uuid
      AND w.id = ${preferred}::uuid
    LIMIT 1
  `;
  if (!rows[0]) return { workspaceId: null, nume: null };
  return {
    workspaceId: String(rows[0].id),
    nume: rows[0].nume ? String(rows[0].nume) : null,
  };
}

/** POST: orice user logat — trimite propunere */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;

  try {
    const parsed = await readJsonLimited<{
      tip?: unknown;
      titlu?: unknown;
      mesaj?: unknown;
      pagina?: unknown;
    }>(request, 16_384);
    if (!parsed.ok) return parsed.response;

    const tipRaw =
      typeof parsed.data.tip === "string" ? parsed.data.tip.trim() : "";
    if (!TIPS.has(tipRaw)) {
      return NextResponse.json(
        { error: "Tip invalid (idee / problema / altceva)" },
        { status: 400 },
      );
    }
    const tip = tipRaw;

    const titlu = toPlainText(clampString(parsed.data.titlu, 150) ?? "");
    if (titlu.length < 3 || titlu.length > 150) {
      return NextResponse.json(
        { error: "Titlul trebuie să aibă 3–150 caractere" },
        { status: 400 },
      );
    }

    const mesajRaw =
      typeof parsed.data.mesaj === "string" ? parsed.data.mesaj : "";
    const mesaj = toPlainText(mesajRaw);
    if (mesaj.length < 10 || mesaj.length > 5000) {
      return NextResponse.json(
        { error: "Mesajul trebuie să aibă 10–5000 caractere" },
        { status: 400 },
      );
    }

    let pagina: string | null = null;
    if (typeof parsed.data.pagina === "string") {
      const p = toPlainText(parsed.data.pagina).slice(0, 300);
      pagina = p.length > 0 ? p : null;
    }

    const sql = getDb();

    // Max 5 / user / oră din tabel
    const rate = await sql`
      SELECT count(*)::int AS n
      FROM propuneri
      WHERE user_id = ${session.user.userId}::uuid
        AND created_at > now() - interval '1 hour'
    `;
    if (Number(rate[0]?.n ?? 0) >= 5) {
      return NextResponse.json(
        { error: "Prea multe propuneri. Încearcă din nou peste o oră." },
        { status: 429 },
      );
    }

    const ws = await resolveVerifiedWorkspace(session.user.userId);

    const inserted = await sql`
      INSERT INTO propuneri (
        workspace_id, user_id, email_autor, nume_workspace,
        tip, titlu, mesaj, pagina, status
      )
      VALUES (
        ${ws.workspaceId}::uuid,
        ${session.user.userId}::uuid,
        ${session.user.email},
        ${ws.nume},
        ${tip},
        ${titlu},
        ${mesaj},
        ${pagina},
        'noua'
      )
      RETURNING id::text AS id
    `;

    return NextResponse.json(
      { ok: true, id: String(inserted[0]?.id) },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/propuneri", error);
    return NextResponse.json(
      { error: "Nu s-a putut trimite propunerea" },
      { status: 500 },
    );
  }
}

/** GET: listă — doar DEV_EMAILS */
export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "read",
    limit: 120,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;
  if (!isDevEmail(session.user.email)) {
    return NextResponse.json({ error: "Negăsit" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const tip = searchParams.get("tip");

    const sql = getDb();

    const rows =
      status &&
      ["noua", "citita", "rezolvata", "respinsa"].includes(status) &&
      tip &&
      TIPS.has(tip)
        ? await sql`
            SELECT
              id::text AS id, tip, titlu, status, email_autor, nume_workspace,
              pagina, created_at, updated_at
            FROM propuneri
            WHERE status = ${status} AND tip = ${tip}
            ORDER BY created_at DESC
            LIMIT 500
          `
        : status &&
            ["noua", "citita", "rezolvata", "respinsa"].includes(status)
          ? await sql`
              SELECT
                id::text AS id, tip, titlu, status, email_autor, nume_workspace,
                pagina, created_at, updated_at
              FROM propuneri
              WHERE status = ${status}
              ORDER BY created_at DESC
              LIMIT 500
            `
          : tip && TIPS.has(tip)
            ? await sql`
                SELECT
                  id::text AS id, tip, titlu, status, email_autor, nume_workspace,
                  pagina, created_at, updated_at
                FROM propuneri
                WHERE tip = ${tip}
                ORDER BY created_at DESC
                LIMIT 500
              `
            : await sql`
                SELECT
                  id::text AS id, tip, titlu, status, email_autor, nume_workspace,
                  pagina, created_at, updated_at
                FROM propuneri
                ORDER BY created_at DESC
                LIMIT 500
              `;

    const countNoua = await sql`
      SELECT count(*)::int AS n FROM propuneri WHERE status = 'noua'
    `;

    const items = rows.map((r) => ({
      id: String(r.id),
      tip: String(r.tip),
      titlu: String(r.titlu),
      status: String(r.status),
      emailAutor: String(r.email_autor),
      numeWorkspace: r.nume_workspace ? String(r.nume_workspace) : null,
      pagina: r.pagina ? String(r.pagina) : null,
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      updatedAt:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : String(r.updated_at),
    }));

    return NextResponse.json({
      items,
      nouaCount: Number(countNoua[0]?.n ?? 0),
    });
  } catch (error) {
    console.error("GET /api/propuneri", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca propunerile" },
      { status: 500 },
    );
  }
}
