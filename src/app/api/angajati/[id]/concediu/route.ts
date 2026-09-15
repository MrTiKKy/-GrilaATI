import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { UpdateConcediuBody } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "id lipsă" }, { status: 400 });
    }

    const body = (await request.json()) as UpdateConcediuBody;

    let zileCoAn = 0;
    if (body.zileCoAn !== null && body.zileCoAn !== undefined) {
      if (
        typeof body.zileCoAn !== "number" ||
        !Number.isFinite(body.zileCoAn) ||
        !Number.isInteger(body.zileCoAn) ||
        body.zileCoAn < 0
      ) {
        return NextResponse.json(
          { error: "zileCoAn trebuie să fie întreg >= 0 sau null" },
          { status: 400 },
        );
      }
      zileCoAn = body.zileCoAn;
    }

    const sql = getDb();
    const updated = await sql`
      UPDATE angajati
      SET zile_co_an = ${zileCoAn}
      WHERE id = ${id}::uuid AND activ = true
      RETURNING id, nume, zile_co_an
    `;

    if (!updated[0]) {
      return NextResponse.json({ error: "Angajat negăsit" }, { status: 404 });
    }

    return NextResponse.json({
      angajat: {
        id: String(updated[0].id),
        nume: String(updated[0].nume),
        zileCoAn: Number(updated[0].zile_co_an),
      },
    });
  } catch (error) {
    console.error("PATCH /api/angajati/[id]/concediu", error);
    return NextResponse.json(
      { error: "Nu s-a putut actualiza concediul" },
      { status: 500 },
    );
  }
}
