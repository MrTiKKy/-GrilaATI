import { NextResponse } from "next/server";
import { requireSessionUser, enforceRateLimit } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { parseUuid, clampString } from "@/lib/validate";
import { isDevEmail, toPlainText } from "@/lib/devAccess";
import { readJsonLimited } from "@/lib/readJsonLimited";

const STATUSES = new Set(["noua", "citita", "rezolvata", "respinsa"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: rawId } = await params;
  const id = parseUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "Negăsit" }, { status: 404 });
  }

  try {
    const sql = getDb();
    const rows = await sql`
      SELECT
        id::text AS id,
        workspace_id::text AS workspace_id,
        user_id::text AS user_id,
        email_autor,
        nume_workspace,
        tip,
        titlu,
        mesaj,
        pagina,
        status,
        nota_dev,
        created_at,
        updated_at
      FROM propuneri
      WHERE id = ${id}::uuid
      LIMIT 1
    `;
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ error: "Negăsit" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: String(r.id),
        workspaceId: r.workspace_id ? String(r.workspace_id) : null,
        userId: r.user_id ? String(r.user_id) : null,
        emailAutor: String(r.email_autor),
        numeWorkspace: r.nume_workspace ? String(r.nume_workspace) : null,
        tip: String(r.tip),
        titlu: String(r.titlu),
        mesaj: String(r.mesaj),
        pagina: r.pagina ? String(r.pagina) : null,
        status: String(r.status),
        notaDev: r.nota_dev ? String(r.nota_dev) : null,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
      },
    });
  } catch (error) {
    console.error("GET /api/propuneri/[id]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    bucket: "write",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const session = await requireSessionUser();
  if ("error" in session) return session.error;
  if (!isDevEmail(session.user.email)) {
    return NextResponse.json({ error: "Negăsit" }, { status: 404 });
  }

  const { id: rawId } = await params;
  const id = parseUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "Negăsit" }, { status: 404 });
  }

  try {
    const parsed = await readJsonLimited<{
      status?: unknown;
      notaDev?: unknown;
    }>(request, 8_192);
    if (!parsed.ok) return parsed.response;

    const sql = getDb();
    const existing = await sql`
      SELECT status, nota_dev FROM propuneri WHERE id = ${id}::uuid LIMIT 1
    `;
    if (!existing[0]) {
      return NextResponse.json({ error: "Negăsit" }, { status: 404 });
    }

    let status = String(existing[0].status);
    if (typeof parsed.data.status === "string") {
      if (!STATUSES.has(parsed.data.status)) {
        return NextResponse.json({ error: "Status invalid" }, { status: 400 });
      }
      status = parsed.data.status;
    }

    let notaDev: string | null =
      existing[0].nota_dev === null || existing[0].nota_dev === undefined
        ? null
        : String(existing[0].nota_dev);
    if (parsed.data.notaDev !== undefined) {
      if (parsed.data.notaDev === null) {
        notaDev = null;
      } else {
        const n = toPlainText(clampString(parsed.data.notaDev, 2000) ?? "");
        notaDev = n.length > 0 ? n : null;
      }
    }

    await sql`
      UPDATE propuneri
      SET status = ${status},
          nota_dev = ${notaDev},
          updated_at = now()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ ok: true, status, notaDev });
  } catch (error) {
    console.error("PATCH /api/propuneri/[id]", error);
    return NextResponse.json({ error: "Eroare" }, { status: 500 });
  }
}
