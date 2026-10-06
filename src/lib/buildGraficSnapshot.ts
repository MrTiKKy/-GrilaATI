import { getDb } from "@/lib/db";
import { loadGraficFooter } from "@/lib/loadGraficFooter";
import { getCategorie } from "@/lib/categorii";
import {
  listOreCoduriForCategorie,
  rowsToByCod,
} from "@/lib/oreCoduri";
import { loadPdfTemplateForWorkspace } from "@/lib/pdfTemplate";
import {
  buildTitluGrafic,
  dayAbbrList,
  formatCheie,
  getTexte,
  lunaNume,
  lunaScurta,
} from "@/lib/texte";
import { toDateString, type GraficSnapshot } from "@/lib/types";
import { orePentruWeekday } from "@/lib/weekendOre";

export async function buildMonthTitle(
  workspaceId: string,
  titluGrafic: string,
  an: number,
  luna: number,
): Promise<string> {
  const texte = await getTexte(workspaceId);
  return buildTitluGrafic(texte, titluGrafic, an, luna);
}

/** Construiește snapshot PDF din DB (sursă de adevăr) — fără date din browser. */
export async function buildGraficSnapshotFromDb(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie = 1,
  templateId?: string | null,
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
  const [oreRows, footer, texte, pdfTpl, wsRows] = await Promise.all([
    listOreCoduriForCategorie(workspaceId, categorieId, { onlyActive: false }),
    loadGraficFooter(workspaceId),
    getTexte(workspaceId),
    loadPdfTemplateForWorkspace(workspaceId, templateId),
    sql`SELECT nume FROM workspaces WHERE id = ${workspaceId}::uuid LIMIT 1`,
  ]);
  const ratesByCod = rowsToByCod(oreRows);
  const abbrs = dayAbbrList(texte);
  const workspaceNume = wsRows[0] ? String(wsRows[0].nume) : "";

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const weekday = new Date(an, luna - 1, day).getDay();
    const abbr = abbrs[weekday] ?? "";
    return {
      day,
      abbr,
      weekday,
      weekend: weekday === 0 || weekday === 6,
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
    title: buildTitluGrafic(texte, categorie.titluGrafic, an, luna),
    days: days.map(({ day, abbr, weekend }) => ({ day, abbr, weekend })),
    rows: angajatiRows.map((row) => {
      const id = String(row.id);
      const cells = days.map((d) => byStaffDay.get(`${id}|${d.date}`) ?? "");
      let osd = 0;
      for (let i = 0; i < days.length; i++) {
        osd += orePentruWeekday(days[i].weekday, cells[i], ratesByCod);
      }
      return {
        name: String(row.nume).toUpperCase(),
        cells,
        osd: osd > 0 ? String(osd) : "",
      };
    }),
    footer,
    labels: {
      osd: formatCheie(texte, "tabel.osd"),
      pageHint: formatCheie(texte, "export.pagina", {
        page: "{page}",
        total: "{total}",
      }),
      excelSheetName: lunaScurta(texte, luna),
    },
    pdfTemplate: pdfTpl.e_implicit ? undefined : pdfTpl.setari,
    pdfTemplateVars: {
      luna: lunaNume(texte, luna),
      lunaNum: luna,
      an,
      categorie: categorie.nume,
      workspace: workspaceNume,
    },
    pdfUseLegacyLayout: pdfTpl.e_implicit,
  };
}
