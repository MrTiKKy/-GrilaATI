import { getDb } from "@/lib/db";
import { toDateString, type GraficSnapshot } from "@/lib/types";

const DAY_ABBR = ["D", "L", "Ma", "Mi", "J", "V", "S"] as const;

const MONTH_NAMES_RO = [
  "IANUARIE",
  "FEBRUARIE",
  "MARTIE",
  "APRILIE",
  "MAI",
  "IUNIE",
  "IULIE",
  "AUGUST",
  "SEPTEMBRIE",
  "OCTOMBRIE",
  "NOIEMBRIE",
  "DECEMBRIE",
] as const;

export function buildMonthTitle(an: number, luna: number): string {
  const name = MONTH_NAMES_RO[luna - 1] ?? String(luna);
  return `S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II – ${name} ${an}`;
}

/** Construiește snapshot PDF din DB (sursă de adevăr) — fără date din browser. */
export async function buildGraficSnapshotFromDb(
  an: number,
  luna: number,
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
    SELECT a.id, a.nume
    FROM angajati a
    WHERE a.activ = true
    ORDER BY a.ordine ASC, a.nume ASC
  `;

  const programariRows = await sql`
    SELECT p.angajat_id, p.data::text AS data, p.valoare
    FROM programari p
    INNER JOIN angajati a ON a.id = p.angajat_id AND a.activ = true
    WHERE p.data >= ${start}::date
      AND p.data < ${end}::date
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
    title: buildMonthTitle(an, luna),
    days: days.map(({ day, abbr, weekend }) => ({ day, abbr, weekend })),
    rows: angajatiRows.map((row) => {
      const id = String(row.id);
      return {
        name: String(row.nume).toUpperCase(),
        cells: days.map((d) => byStaffDay.get(`${id}|${d.date}`) ?? ""),
        osd: "",
      };
    }),
  };
}
