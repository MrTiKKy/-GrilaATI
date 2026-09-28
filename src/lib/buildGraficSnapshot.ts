import { getDb } from "@/lib/db";
import { loadGraficFooter } from "@/lib/loadGraficFooter";
import { loadOreOsdRatesForCategorie } from "@/lib/loadOreOsd";
import {
  buildGraficTitleFromCategorie,
  getCategorie,
} from "@/lib/categorii";
import { toDateString, type GraficSnapshot } from "@/lib/types";
import { orePentruCasuta } from "@/lib/weekendOre";

const DAY_ABBR = ["D", "L", "Ma", "Mi", "J", "V", "S"] as const;

export { buildGraficTitleFromCategorie as buildMonthTitle };

/** Construiește snapshot PDF din DB (sursă de adevăr) — fără date din browser. */
export async function buildGraficSnapshotFromDb(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie = 1,
): Promise<GraficSnapshot> {
  const sql = getDb();
  const categorie = await getCategorie(workspaceId, categorieId);
  if (!categorie) {
    throw new Error("Categorie negăsită");
  }

  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(an, luna, 1));
  const end = endDate.toISOString().slice(0, 10);
  const daysInMonth = new Date(an, luna, 0).getDate();
  const [osdRates, footer] = await Promise.all([
    loadOreOsdRatesForCategorie(workspaceId, categorieId),
    loadGraficFooter(workspaceId),
  ]);

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const weekday = new Date(an, luna - 1, day).getDay();
    const abbr = DAY_ABBR[weekday];
    return {
      day,
      abbr,
      weekend: abbr === "S" || abbr === "D",
      date: `${an}-${String(luna).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  });

  const angajatiRows = await sql`
    SELECT a.id, a.nume
    FROM angajati a
    WHERE a.workspace_id = ${workspaceId}::uuid
      AND a.activ = true
      AND a.categorie_id = ${categorieId}::uuid
    ORDER BY a.ordine ASC, a.nume ASC
  `;

  const programariRows = await sql`
    SELECT p.angajat_id, p.data::text AS data, p.valoare
    FROM programari p
    INNER JOIN angajati a
      ON a.id = p.angajat_id
      AND a.workspace_id = p.workspace_id
      AND a.activ = true
    WHERE p.workspace_id = ${workspaceId}::uuid
      AND p.data >= ${start}::date
      AND p.data < ${end}::date
      AND a.categorie_id = ${categorieId}::uuid
      AND p.foaie = ${foaie}
  `;

  const byStaffDay = new Map<string, string>();
  for (const row of programariRows) {
    const date = toDateString(row.data);
    const val =
      row.valoare === null || row.valoare === undefined || row.valoare === ""
        ? ""
        : String(row.valoare);
    byStaffDay.set(`${String(row.angajat_id)}|${date}`, val);
  }

  return {
    title: buildGraficTitleFromCategorie(categorie.titluGrafic, an, luna),
    days: days.map(({ day, abbr, weekend }) => ({ day, abbr, weekend })),
    rows: angajatiRows.map((row) => {
      const id = String(row.id);
      const cells = days.map((d) => byStaffDay.get(`${id}|${d.date}`) ?? "");
      let osd = 0;
      for (let i = 0; i < days.length; i++) {
        osd += orePentruCasuta(
          categorieId,
          days[i].abbr,
          cells[i],
          osdRates,
        );
      }
      return {
        name: String(row.nume).toUpperCase(),
        cells,
        osd: osd > 0 ? String(osd) : "",
      };
    }),
    footer,
  };
}
