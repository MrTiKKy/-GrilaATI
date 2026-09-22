import { getDb } from "@/lib/db";
import type { AngajatPost } from "@/lib/post";

export function parseFoaie(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 50) return null;
  return n;
}

/** Asigură Sheet 1 și returnează lista sortată de foi. */
export async function ensureLunaFoi(
  an: number,
  luna: number,
  post: AngajatPost,
): Promise<number[]> {
  const sql = getDb();
  await sql`
    INSERT INTO luna_foi (an, luna, post, foaie)
    VALUES (${an}, ${luna}, ${post}, 1)
    ON CONFLICT DO NOTHING
  `;
  const rows = await sql`
    SELECT foaie
    FROM luna_foi
    WHERE an = ${an} AND luna = ${luna} AND post = ${post}
    ORDER BY foaie ASC
  `;
  return rows.map((r) => Number(r.foaie));
}

export async function createNextFoaie(
  an: number,
  luna: number,
  post: AngajatPost,
): Promise<{ foaie: number; foi: number[] }> {
  const sql = getDb();
  await ensureLunaFoi(an, luna, post);
  const maxRows = await sql`
    SELECT COALESCE(MAX(foaie), 0)::int AS max
    FROM luna_foi
    WHERE an = ${an} AND luna = ${luna} AND post = ${post}
  `;
  const next = Number(maxRows[0]?.max ?? 0) + 1;
  if (next > 50) {
    throw new Error("Maxim 50 de foi pe lună");
  }
  await sql`
    INSERT INTO luna_foi (an, luna, post, foaie)
    VALUES (${an}, ${luna}, ${post}, ${next})
    ON CONFLICT DO NOTHING
  `;
  const foi = await ensureLunaFoi(an, luna, post);
  return { foaie: next, foi };
}

/** Număr casuțe cu valoare sau secție pe foaia dată. */
export async function countFoaieCells(
  an: number,
  luna: number,
  post: AngajatPost,
  foaie: number,
): Promise<number> {
  const sql = getDb();
  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(an, luna, 1));
  const end = endDate.toISOString().slice(0, 10);
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM programari p
    INNER JOIN angajati a ON a.id = p.angajat_id AND a.activ = true
    WHERE p.data >= ${start}::date
      AND p.data < ${end}::date
      AND p.foaie = ${foaie}
      AND COALESCE(a.post, 'asistent') = ${post}
      AND (
        (p.valoare IS NOT NULL AND p.valoare <> '')
        OR (p.ciorna IS NOT NULL AND p.ciorna <> '')
      )
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function deleteFoaie(
  an: number,
  luna: number,
  post: AngajatPost,
  foaie: number,
): Promise<{ foi: number[]; nextFoaie: number }> {
  const sql = getDb();
  const foiBefore = await ensureLunaFoi(an, luna, post);
  if (!foiBefore.includes(foaie)) {
    throw new Error("Foaia nu există");
  }
  if (foiBefore.length <= 1) {
    throw new Error("Nu poți șterge singura foaie");
  }

  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(an, luna, 1));
  const end = endDate.toISOString().slice(0, 10);

  await sql`
    DELETE FROM programari p
    USING angajati a
    WHERE p.angajat_id = a.id
      AND a.activ = true
      AND COALESCE(a.post, 'asistent') = ${post}
      AND p.foaie = ${foaie}
      AND p.data >= ${start}::date
      AND p.data < ${end}::date
  `;

  await sql`
    DELETE FROM luna_foi
    WHERE an = ${an} AND luna = ${luna} AND post = ${post} AND foaie = ${foaie}
  `;

  const foi = await ensureLunaFoi(an, luna, post);
  // Preferă foaia anterioară, altfel prima rămasă
  const lower = foi.filter((n) => n < foaie);
  const nextFoaie =
    lower.length > 0 ? lower[lower.length - 1]! : (foi[0] ?? 1);
  return { foi, nextFoaie };
}
