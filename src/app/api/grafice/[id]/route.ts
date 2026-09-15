import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { GraficFinalDetail, GraficSnapshot } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id lipsă" }, { status: 400 });
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

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id lipsă" }, { status: 400 });
    }

    const sql = getDb();
    const deleted = await sql`
      DELETE FROM grafice_finale
      WHERE id = ${id}::uuid
      RETURNING id
    `;

    if (!deleted[0]) {
      return NextResponse.json({ error: "Salvare negăsită" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/grafice/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge salvarea" },
      { status: 500 },
    );
  }
}
