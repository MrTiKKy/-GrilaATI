import { NextResponse } from "next/server";
import { guardRead } from "@/lib/apiGuard";
import { getDb } from "@/lib/db";
import { isAngajatPost } from "@/lib/post";
import { parseYear } from "@/lib/validate";
import type { ConcediiResponse, ConcediuDto } from "@/lib/types";

export async function GET(request: Request) {
  const gated = await guardRead(request);
  if (gated instanceof NextResponse) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const an = parseYear(searchParams.get("an"));

    if (an === null) {
      return NextResponse.json({ error: "Parametru an invalid" }, { status: 400 });
    }

    const sql = getDb();

    const rows = await sql`
      SELECT
        a.id,
        a.nume,
        COALESCE(a.post, 'asistent') AS post,
        a.zile_co_an,
        COALESCE((
          SELECT COUNT(DISTINCT p.data)::int
          FROM programari p
          WHERE p.angajat_id = a.id
            AND p.workspace_id = a.workspace_id
            AND p.valoare = 'CO'
            AND EXTRACT(YEAR FROM p.data) = ${an}
        ), 0) AS folosite
      FROM angajati a
      WHERE a.workspace_id = ${workspaceId}::uuid
        AND a.activ = true
      ORDER BY a.ordine ASC, a.nume ASC
    `;

    const angajati: ConcediuDto[] = rows.map((row) => {
      const zileCoAn = Number(row.zile_co_an);
      const folosite = Number(row.folosite);
      const postRaw = String(row.post ?? "asistent");
      return {
        id: String(row.id),
        nume: String(row.nume),
        post: isAngajatPost(postRaw) ? postRaw : "asistent",
        zileCoAn,
        folosite,
        ramase: zileCoAn - folosite,
      };
    });

    const body: ConcediiResponse = { an, angajati };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/concedii", error);
    const message =
      error instanceof Error && /column .*post/i.test(error.message)
        ? "Coloana post lipsește — rulează sql/add_post.sql în Neon"
        : "Nu s-au putut încărca concediile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
