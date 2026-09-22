import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardRead } from "@/lib/apiGuard";
import { culoareFromDb } from "@/lib/culoare";
import { ensureLunaFoi } from "@/lib/foi";
import { isAngajatPost, postFromTabParam } from "@/lib/post";
import { parseFoaieParam, parseMonth, parseYear } from "@/lib/validate";
import {
  toDateString,
  type AngajatDto,
  type LunaResponse,
  type ProgramareDto,
  type ProgramareValoare,
} from "@/lib/types";

export async function GET(request: Request) {
  const denied = await guardRead(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const an = parseYear(searchParams.get("an"));
    const luna = parseMonth(searchParams.get("luna"));
    const post = postFromTabParam(searchParams.get("tab") ?? searchParams.get("post"));
    const foaieRaw = parseFoaieParam(searchParams.get("foaie") ?? searchParams.get("sheet"));

    if (an === null) {
      return NextResponse.json({ error: "Parametru an invalid" }, { status: 400 });
    }
    if (luna === null) {
      return NextResponse.json({ error: "Parametru luna invalid" }, { status: 400 });
    }

    const sql = getDb();
    const start = `${an}-${String(luna).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(an, luna, 1));
    const end = endDate.toISOString().slice(0, 10);

    const foi = await ensureLunaFoi(an, luna, post);
    const foaie =
      foaieRaw && foi.includes(foaieRaw) ? foaieRaw : (foi[0] ?? 1);

    const angajatiRows = await sql`
      SELECT
        a.id,
        a.nume,
        COALESCE(a.post, 'asistent') AS post,
        a.zile_co_an,
        a.ordine,
        COALESCE((
          SELECT COUNT(DISTINCT p.data)::int
          FROM programari p
          WHERE p.angajat_id = a.id
            AND p.valoare = 'CO'
            AND EXTRACT(YEAR FROM p.data) = ${an}
        ), 0) AS zile_co_folosite
      FROM angajati a
      WHERE a.activ = true
      ORDER BY a.ordine ASC, a.nume ASC
    `;

    const programariRows = await sql`
      SELECT p.angajat_id, p.data::text AS data, p.valoare, p.ciorna, p.culoare, p.foaie
      FROM programari p
      INNER JOIN angajati a ON a.id = p.angajat_id AND a.activ = true
      WHERE p.data >= ${start}::date
        AND p.data < ${end}::date
        AND p.foaie = ${foaie}
      ORDER BY p.data ASC
    `;

    const angajati: AngajatDto[] = angajatiRows.map((row) => {
      const zileCoAn = Number(row.zile_co_an);
      const zileCoFolosite = Number(row.zile_co_folosite);
      const postRaw = String(row.post ?? "asistent");
      return {
        id: String(row.id),
        nume: String(row.nume),
        post: isAngajatPost(postRaw) ? postRaw : "asistent",
        zileCoAn,
        zileCoFolosite,
        zileCoRamase: zileCoAn - zileCoFolosite,
        ordine: Number(row.ordine),
      };
    });

    const programari: ProgramareDto[] = programariRows.map((row) => {
      const raw = row.valoare;
      const valoare =
        raw === null || raw === undefined || raw === ""
          ? null
          : (String(raw) as ProgramareValoare);
      const ciornaRaw = row.ciorna;
      const ciornaStr =
        ciornaRaw === null || ciornaRaw === undefined || ciornaRaw === ""
          ? null
          : String(ciornaRaw);
      const ciorna =
        ciornaStr === "A" || ciornaStr === "R" ? ciornaStr : null;
      return {
        angajatId: String(row.angajat_id),
        data: toDateString(row.data),
        valoare,
        ciorna,
        culoare: culoareFromDb(row.culoare),
        foaie: Number(row.foaie) || foaie,
      };
    });

    const body: LunaResponse = { an, luna, angajati, programari, foi, foaie };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/luna", error);
    const message =
      error instanceof Error && /luna_foi|foaie/i.test(error.message)
        ? "Tabelele pentru foi lipsesc — rulează sql/add_foi.sql în Neon"
        : error instanceof Error && /culoare/i.test(error.message)
          ? "Coloana culoare lipsește — rulează sql/add_culoare.sql în Neon"
          : error instanceof Error && /column .*post/i.test(error.message)
            ? "Coloana post lipsește — rulează sql/add_post.sql în Neon"
            : "Nu s-au putut încărca datele lunii";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
