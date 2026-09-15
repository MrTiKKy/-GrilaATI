import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { OrdineBody } from "@/lib/types";

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as OrdineBody;
    const ids = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids trebuie să fie un array" }, { status: 400 });
    }
    if (ids.some((id) => typeof id !== "string" || !id)) {
      return NextResponse.json({ error: "ids invalide" }, { status: 400 });
    }

    const sql = getDb();

    // Sequential updates — ordine 1..n
    for (let i = 0; i < ids.length; i++) {
      await sql`
        UPDATE angajati
        SET ordine = ${i + 1}
        WHERE id = ${ids[i]}::uuid AND activ = true
      `;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/angajati/ordine", error);
    return NextResponse.json(
      { error: "Nu s-a putut salva ordinea" },
      { status: 500 },
    );
  }
}
