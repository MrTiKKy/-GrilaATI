import { getDb } from "@/lib/db";
import { buildGraficTitle, type AngajatPost } from "@/lib/post";
import { toDateString, type GraficSnapshot } from "@/lib/types";
import { orePentruCasuta } from "@/lib/weekendOre";

const DAY_ABBR = ["D", "L", "Ma", "Mi", "J", "V", "S"] as const;

export { buildGraficTitle as buildMonthTitle };

/** Construiește snapshot PDF din DB (sursă de adevăr) — fără date din browser. */
export async function buildGraficSnapshotFromDb(
  an: number,
  luna: number,
  post: AngajatPost = "asistent",
): Promise<GraficSnapshot> {
  const sql = getDb();
  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(an, luna, 1));
  const end = endDate.toISOString().slice(0, 10);
  const daysInMonth = new Date(an, luna, 0).getDate();

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
    SELECT a.id, a.nume, a.post
    FROM angajati a
    WHERE a.activ = true
      AND COALESCE(a.post, 'asistent') = ${post}
    ORDER BY a.ordine ASC, a.nume ASC
  `;

  const programariRows = await sql`
    SELECT p.angajat_id, p.data::text AS data, p.valoare
    FROM programari p
    INNER JOIN angajati a ON a.id = p.angajat_id AND a.activ = true
    WHERE p.data >= ${start}::date
      AND p.data < ${end}::date
      AND COALESCE(a.post, 'asistent') = ${post}
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
    title: buildGraficTitle(an, luna, post),
    days: days.map(({ day, abbr, weekend }) => ({ day, abbr, weekend })),
    rows: angajatiRows.map((row) => {
      const id = String(row.id);
      const cells = days.map((d) => byStaffDay.get(`${id}|${d.date}`) ?? "");
      let osd = 0;
      for (let i = 0; i < days.length; i++) {
        osd += orePentruCasuta(post, days[i].abbr, cells[i]);
      }
      return {
        name: String(row.nume).toUpperCase(),
        cells,
        osd: osd > 0 ? String(osd) : "",
      };
    }),
  };
}
