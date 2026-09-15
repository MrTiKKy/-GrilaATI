import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { guardRead, guardWrite } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { clientKey } from "@/lib/rateLimit";
import { parseUuid } from "@/lib/validate";
import type { GraficFinalDetail, GraficSnapshot } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  const denied = await guardRead(request);
  if (denied) return denied;

  try {
    const { id: rawId } = await context.params;
    const id = parseUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "id invalid" }, { status: 400 });
    }

    const sql = getDb();
    const rows = await sql`
      SELECT id, an, luna, titlu, snapshot, created_at
      FROM grafice_finale
      WHERE id = ${id}::uuid
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "Salvare negăsită" }, { status: 404 });
    }

    const snapshot =
      typeof row.snapshot === "string"
        ? (JSON.parse(row.snapshot) as GraficSnapshot)
        : (row.snapshot as GraficSnapshot);

    const body: GraficFinalDetail = {
      id: String(row.id),
      an: Number(row.an),
      luna: Number(row.luna),
      titlu: String(row.titlu),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      snapshot,
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/grafice/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut încărca salvarea" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: Ctx) {
  const denied = await guardWrite(request);
  if (denied) return denied;

  try {
    const { id: rawId } = await context.params;
    const id = parseUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "id invalid" }, { status: 400 });
    }

    const sql = getDb();
    const deleted = await sql`
      DELETE FROM grafice_finale
      WHERE id = ${id}::uuid
      RETURNING id, an, luna
    `;

    if (!deleted[0]) {
      return NextResponse.json({ error: "Salvare negăsită" }, { status: 404 });
    }

    await writeAudit({
      action: "grafic_delete",
      resource: id,
      detail: {
        an: Number(deleted[0].an),
        luna: Number(deleted[0].luna),
      },
      ip: clientKey(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/grafice/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge salvarea" },
      { status: 500 },
    );
  }
}
