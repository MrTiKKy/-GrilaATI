import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import type { ConcediiResponse, ConcediuDto } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const an = Number(searchParams.get("an"));

    if (!Number.isInteger(an) || an < 2000 || an > 2100) {
      return NextResponse.json({ error: "Parametru an invalid" }, { status: 400 });
    }

    const sql = getDb();

    const rows = await sql`
      SELECT
        a.id,
        a.nume,
        a.zile_co_an,
        COALESCE((
          SELECT COUNT(*)::int
          FROM programari p
          WHERE p.angajat_id = a.id
            AND p.valoare = 'CO'
            AND EXTRACT(YEAR FROM p.data) = ${an}
        ), 0) AS folosite
      FROM angajati a
      WHERE a.activ = true
      ORDER BY a.ordine ASC, a.nume ASC
    `;

    const angajati: ConcediuDto[] = rows.map((row) => {
      const zileCoAn = Number(row.zile_co_an);
      const folosite = Number(row.folosite);
      return {
        id: String(row.id),
        nume: String(row.nume),
        zileCoAn,
        folosite,
        ramase: zileCoAn - folosite,
      };
    });

    const body: ConcediiResponse = { an, angajati };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/concedii", error);
    return NextResponse.json(
      { error: "Nu s-au putut încărca concediile" },
      { status: 500 },
    );
  }
}
