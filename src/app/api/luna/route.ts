import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guardRead, isGuardError } from "@/lib/apiGuard";
import { culoareFromDb } from "@/lib/culoare";
import { listLunaFoi } from "@/lib/foi";
import { resolveCategorieId } from "@/lib/categorii";
import { parseFoaieParam, parseMonth, parseYear } from "@/lib/validate";
import {
  toDateString,
  type AngajatDto,
  type LunaResponse,
  type ProgramareDto,
  type ProgramareValoare,
} from "@/lib/types";

export async function GET(request: Request) {
  const gated = await guardRead(request);
  if (isGuardError(gated)) return gated;
  const { workspaceId } = gated;

  try {
    const { searchParams } = new URL(request.url);
    const an = parseYear(searchParams.get("an"));
    const luna = parseMonth(searchParams.get("luna"));
    const categorie = await resolveCategorieId(workspaceId, {
      categorieId: searchParams.get("categorie"),
      tabParam: searchParams.get("tab") ?? searchParams.get("post"),
    });
    const foaieRaw = parseFoaieParam(
      searchParams.get("foaie") ?? searchParams.get("sheet"),
    );

    if (an === null) {
      return NextResponse.json({ error: "Parametru an invalid" }, { status: 400 });
    }
    if (luna === null) {
      return NextResponse.json(
        { error: "Parametru luna invalid" },
        { status: 400 },
      );
    }
    if (!categorie) {
      return NextResponse.json(
        { error: "Nicio categorie activă" },
        { status: 400 },
      );
    }

    const sql = getDb();
    const start = `${an}-${String(luna).padStart(2, "0")}-01`;
    const endDate = new Date(Date.UTC(an, luna, 1));
    const end = endDate.toISOString().slice(0, 10);

    const foiItems = await listLunaFoi(workspaceId, an, luna, categorie.id);
    const foi = foiItems.map((i) => i.foaie);
    const foaie =
      foaieRaw && foi.includes(foaieRaw) ? foaieRaw : (foi[0] ?? 1);

    const angajatiRows = await sql`
      SELECT
        a.id,
        a.nume,
        a.categorie_id::text AS categorie_id,
        a.zile_co_an,
        a.ordine,
        COALESCE((
          SELECT COUNT(DISTINCT p.data)::int
          FROM programari p
          WHERE p.angajat_id = a.id
            AND p.workspace_id = a.workspace_id
            AND p.valoare = 'CO'
            AND EXTRACT(YEAR FROM p.data) = ${an}
        ), 0) AS zile_co_folosite
      FROM angajati a
      WHERE a.workspace_id = ${workspaceId}::uuid
        AND a.activ = true
        AND a.categorie_id = ${categorie.id}::uuid
      ORDER BY a.ordine ASC, a.nume ASC
    `;

    const programariRows = await sql`
      SELECT p.angajat_id, p.data::text AS data, p.valoare, p.ciorna, p.culoare, p.foaie
      FROM programari p
      INNER JOIN angajati a
        ON a.id = p.angajat_id
        AND a.workspace_id = p.workspace_id
        AND a.activ = true
      WHERE p.workspace_id = ${workspaceId}::uuid
        AND p.data >= ${start}::date
        AND p.data < ${end}::date
        AND p.foaie = ${foaie}
        AND a.categorie_id = ${categorie.id}::uuid
      ORDER BY p.data ASC, p.angajat_id ASC
    `;

    const angajati: AngajatDto[] = angajatiRows.map((row) => {
      const zileCoAn = Number(row.zile_co_an);
      const zileCoFolosite = Number(row.zile_co_folosite);
      return {
        id: String(row.id),
        nume: String(row.nume),
        categorieId: String(row.categorie_id),
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

    const body: LunaResponse = {
      an,
      luna,
      categorieId: categorie.id,
      angajati,
      programari,
      foi,
      foiItems,
      foaie,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/luna", error);
    const message =
      error instanceof Error && /luna_foi|foaie|categorie/i.test(error.message)
        ? "Tabelele pentru foi/categorii lipsesc — rulează migrarea pe branch"
        : error instanceof Error && /culoare/i.test(error.message)
          ? "Coloana culoare lipsește — rulează sql/add_culoare.sql în Neon"
          : "Nu s-au putut încărca datele lunii";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
