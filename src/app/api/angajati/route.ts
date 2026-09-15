import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { CreateAngajatBody, CreateAngajatResponse } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateAngajatBody;
    const nume = body.nume?.trim().toUpperCase();
    if (!nume) {
      return NextResponse.json({ error: "Numele este obligatoriu" }, { status: 400 });
    }

    const zileCoAn =
      typeof body.zileCoAn === "number" && Number.isFinite(body.zileCoAn)
        ? Math.max(0, Math.floor(body.zileCoAn))
        : 0;

    const sql = getDb();

    const maxRows = await sql`
      SELECT COALESCE(MAX(ordine), 0)::int AS max_ordine
      FROM angajati
      WHERE activ = true
    `;
    const ordine = Number(maxRows[0]?.max_ordine ?? 0) + 1;

    const inserted = await sql`
      INSERT INTO angajati (nume, zile_co_an, ordine, activ)
      VALUES (${nume}, ${zileCoAn}, ${ordine}, true)
      RETURNING id, nume, zile_co_an, ordine
    `;

    const row = inserted[0];
    if (!row) {
      return NextResponse.json({ error: "Insert eșuat" }, { status: 500 });
    }

    const response: CreateAngajatResponse = {
      angajat: {
        id: String(row.id),
        nume: String(row.nume),
        zileCoAn: Number(row.zile_co_an),
        zileCoFolosite: 0,
        zileCoRamase: Number(row.zile_co_an),
        ordine: Number(row.ordine),
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("POST /api/angajati", error);
    return NextResponse.json(
      { error: "Nu s-a putut adăuga angajatul" },
      { status: 500 },
    );
  }
}
