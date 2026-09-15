import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { UpdateAngajatBody } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id lipsă" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateAngajatBody;
    const nume = body.nume?.trim().toUpperCase();
    if (!nume) {
      return NextResponse.json(
        { error: "Nimic de actualizat (nume)" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const updated = await sql`
      UPDATE angajati
      SET nume = ${nume}
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id, nume
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    return NextResponse.json({
      angajat: { id: String(updated[0].id), nume: String(updated[0].nume) },
    });
  } catch (error) {
    console.error("PATCH /api/angajati/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza angajatul" },
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
    const updated = await sql`
      UPDATE angajati
      SET activ = false
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/angajati/[id]", error);
    return NextResponse.json(
      { error: "Nu s-a putut șterge angajatul" },
      { status: 500 },
    );
  }
}
