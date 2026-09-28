import { getDb } from "@/lib/db";
import { numeFoaie } from "@/lib/foiNume";

export {
  numeFoaie,
  numeFoaieImplicit,
  foaieTitleSuffix,
  foaieFileSuffix,
  parseFoaie,
  parseFoaieNumeInput,
} from "@/lib/foiNume";

export type FoaieItem = {
  foaie: number;
  nume: string | null;
  label: string;
};

async function postVechiForCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT post_vechi
    FROM categorii
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${categorieId}::uuid
    LIMIT 1
  `;
  const v = rows[0]?.post_vechi;
  return v === null || v === undefined ? null : String(v);
}

/** Asigură Sheet 1 și returnează lista sortată de foi. */
export async function ensureLunaFoi(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
): Promise<number[]> {
  const items = await listLunaFoi(workspaceId, an, luna, categorieId);
  return items.map((i) => i.foaie);
}

export async function listLunaFoi(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
): Promise<FoaieItem[]> {
  const sql = getDb();
  const post = await postVechiForCategorie(workspaceId, categorieId);
  await sql`
    INSERT INTO luna_foi (workspace_id, an, luna, post, foaie, categorie_id)
    VALUES (${workspaceId}::uuid, ${an}, ${luna}, ${post}, 1, ${categorieId}::uuid)
    ON CONFLICT DO NOTHING
  `;
  const rows = await sql`
    SELECT foaie, nume
    FROM luna_foi
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna} AND categorie_id = ${categorieId}::uuid
    ORDER BY foaie ASC
  `;
  return rows.map((r) => {
    const foaie = Number(r.foaie);
    const nume =
      r.nume === null || r.nume === undefined || String(r.nume).trim() === ""
        ? null
        : String(r.nume);
    return { foaie, nume, label: numeFoaie(foaie, nume) };
  });
}

export async function getFoaieNume(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie: number,
): Promise<string | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT nume
    FROM luna_foi
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna}
      AND categorie_id = ${categorieId}::uuid
      AND foaie = ${foaie}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const n = rows[0].nume;
  if (n === null || n === undefined || String(n).trim() === "") return null;
  return String(n);
}

export async function renameFoaie(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie: number,
  nume: string | null,
): Promise<{ before: string | null; after: string | null }> {
  const sql = getDb();
  await ensureLunaFoi(workspaceId, an, luna, categorieId);

  const current = await sql`
    SELECT nume
    FROM luna_foi
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna}
      AND categorie_id = ${categorieId}::uuid
      AND foaie = ${foaie}
    LIMIT 1
  `;
  if (!current[0]) {
    throw new Error("Foaia nu există");
  }
  const before =
    current[0].nume === null || current[0].nume === undefined
      ? null
      : String(current[0].nume);

  if (nume !== null) {
    const dup = await sql`
      SELECT foaie
      FROM luna_foi
      WHERE workspace_id = ${workspaceId}::uuid
        AND an = ${an} AND luna = ${luna}
        AND categorie_id = ${categorieId}::uuid
        AND foaie <> ${foaie}
        AND nume IS NOT NULL
        AND lower(btrim(nume)) = lower(${nume})
      LIMIT 1
    `;
    if (dup[0]) {
      const err = new Error("Există deja o foaie cu acest nume în lună");
      (err as Error & { code?: string }).code = "DUPLICATE_NAME";
      throw err;
    }
  }

  await sql`
    UPDATE luna_foi
    SET nume = ${nume}
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna}
      AND categorie_id = ${categorieId}::uuid
      AND foaie = ${foaie}
  `;

  return { before, after: nume };
}

export async function createNextFoaie(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
): Promise<{ foaie: number; foi: number[] }> {
  const sql = getDb();
  await ensureLunaFoi(workspaceId, an, luna, categorieId);
  const post = await postVechiForCategorie(workspaceId, categorieId);
  const maxRows = await sql`
    SELECT COALESCE(MAX(foaie), 0)::int AS max
    FROM luna_foi
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna} AND categorie_id = ${categorieId}::uuid
  `;
  const next = Number(maxRows[0]?.max ?? 0) + 1;
  if (next > 50) {
    throw new Error("Maxim 50 de foi pe lună");
  }
  await sql`
    INSERT INTO luna_foi (workspace_id, an, luna, post, foaie, categorie_id)
    VALUES (${workspaceId}::uuid, ${an}, ${luna}, ${post}, ${next}, ${categorieId}::uuid)
    ON CONFLICT DO NOTHING
  `;
  const foi = await ensureLunaFoi(workspaceId, an, luna, categorieId);
  return { foaie: next, foi };
}

/** Număr casuțe cu valoare sau secție pe foaia dată. */
export async function countFoaieCells(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie: number,
): Promise<number> {
  const sql = getDb();
  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(an, luna, 1));
  const end = endDate.toISOString().slice(0, 10);
  const rows = await sql`
    SELECT COUNT(*)::int AS n
    FROM programari p
    INNER JOIN angajati a
      ON a.id = p.angajat_id
      AND a.workspace_id = p.workspace_id
      AND a.activ = true
    WHERE p.workspace_id = ${workspaceId}::uuid
      AND p.data >= ${start}::date
      AND p.data < ${end}::date
      AND p.foaie = ${foaie}
      AND a.categorie_id = ${categorieId}::uuid
      AND (
        (p.valoare IS NOT NULL AND p.valoare <> '')
        OR (p.ciorna IS NOT NULL AND p.ciorna <> '')
      )
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function deleteFoaie(
  workspaceId: string,
  an: number,
  luna: number,
  categorieId: string,
  foaie: number,
): Promise<{ foi: number[]; nextFoaie: number }> {
  const sql = getDb();
  const foiBefore = await ensureLunaFoi(workspaceId, an, luna, categorieId);
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
      AND p.workspace_id = a.workspace_id
      AND p.workspace_id = ${workspaceId}::uuid
      AND a.activ = true
      AND a.categorie_id = ${categorieId}::uuid
      AND p.foaie = ${foaie}
      AND p.data >= ${start}::date
      AND p.data < ${end}::date
  `;

  await sql`
    DELETE FROM luna_foi
    WHERE workspace_id = ${workspaceId}::uuid
      AND an = ${an} AND luna = ${luna}
      AND categorie_id = ${categorieId}::uuid
      AND foaie = ${foaie}
  `;

  const foi = await ensureLunaFoi(workspaceId, an, luna, categorieId);
  const lower = foi.filter((n) => n < foaie);
  const nextFoaie =
    lower.length > 0 ? lower[lower.length - 1]! : (foi[0] ?? 1);
  return { foi, nextFoaie };
}
