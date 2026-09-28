import { getDb } from "@/lib/db";

export type OreCodRow = {
  codId: string;
  cod: string;
  eticheta: string;
  activ: boolean;
  oreVineri: number;
  oreSambata: number;
  oreDuminica: number;
};

/** Mapă cod text → ore V/S/D */
export type OreCoduriByCod = Record<
  string,
  { vineri: number; sambata: number; duminica: number }
>;

export function rowsToByCod(rows: OreCodRow[]): OreCoduriByCod {
  const map: OreCoduriByCod = {};
  for (const r of rows) {
    // Preferă rândul specific categoriei dacă există dublură (nu ar trebui)
    if (map[r.cod] === undefined) {
      map[r.cod] = {
        vineri: r.oreVineri,
        sambata: r.oreSambata,
        duminica: r.oreDuminica,
      };
    }
  }
  return map;
}

export async function listOreCoduriForCategorie(
  workspaceId: string,
  categorieId: string,
  opts?: { onlyActive?: boolean },
): Promise<OreCodRow[]> {
  const sql = getDb();
  const onlyActive = opts?.onlyActive === true;
  const rows = onlyActive
    ? await sql`
        SELECT
          c.id::text AS cod_id,
          c.cod,
          c.eticheta,
          c.activ,
          oc.ore_vineri::float8 AS ore_vineri,
          oc.ore_sambata::float8 AS ore_sambata,
          oc.ore_duminica::float8 AS ore_duminica
        FROM ore_coduri oc
        INNER JOIN coduri c ON c.id = oc.cod_id AND c.workspace_id = oc.workspace_id
        WHERE oc.workspace_id = ${workspaceId}::uuid
          AND oc.categorie_id = ${categorieId}::uuid
          AND c.activ = true
        ORDER BY c.ordine ASC, c.cod ASC
      `
    : await sql`
        SELECT
          c.id::text AS cod_id,
          c.cod,
          c.eticheta,
          c.activ,
          oc.ore_vineri::float8 AS ore_vineri,
          oc.ore_sambata::float8 AS ore_sambata,
          oc.ore_duminica::float8 AS ore_duminica
        FROM ore_coduri oc
        INNER JOIN coduri c ON c.id = oc.cod_id AND c.workspace_id = oc.workspace_id
        WHERE oc.workspace_id = ${workspaceId}::uuid
          AND oc.categorie_id = ${categorieId}::uuid
        ORDER BY c.ordine ASC, c.cod ASC
      `;

  return rows.map((r) => ({
    codId: String(r.cod_id),
    cod: String(r.cod),
    eticheta: String(r.eticheta),
    activ: Boolean(r.activ),
    oreVineri: Number(r.ore_vineri) || 0,
    oreSambata: Number(r.ore_sambata) || 0,
    oreDuminica: Number(r.ore_duminica) || 0,
  }));
}

/** La creare cod: rânduri 0 pe categoriile unde se aplică */
export async function seedOreCoduriForNewCod(
  workspaceId: string,
  codId: string,
  categorieId: string | null,
): Promise<void> {
  const sql = getDb();
  if (categorieId) {
    await sql`
      INSERT INTO ore_coduri (
        workspace_id, categorie_id, cod_id,
        ore_vineri, ore_sambata, ore_duminica, updated_at
      )
      VALUES (
        ${workspaceId}::uuid,
        ${categorieId}::uuid,
        ${codId}::uuid,
        0, 0, 0, now()
      )
      ON CONFLICT (workspace_id, categorie_id, cod_id) DO NOTHING
    `;
    return;
  }
  await sql`
    INSERT INTO ore_coduri (
      workspace_id, categorie_id, cod_id,
      ore_vineri, ore_sambata, ore_duminica, updated_at
    )
    SELECT
      ${workspaceId}::uuid,
      cat.id,
      ${codId}::uuid,
      0, 0, 0, now()
    FROM categorii cat
    WHERE cat.workspace_id = ${workspaceId}::uuid
    ON CONFLICT (workspace_id, categorie_id, cod_id) DO NOTHING
  `;
}

/** La creare categorie: 0 pentru toate codurile comune (+ specifice deja pe ea) */
export async function seedOreCoduriForNewCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO ore_coduri (
      workspace_id, categorie_id, cod_id,
      ore_vineri, ore_sambata, ore_duminica, updated_at
    )
    SELECT
      ${workspaceId}::uuid,
      ${categorieId}::uuid,
      c.id,
      0, 0, 0, now()
    FROM coduri c
    WHERE c.workspace_id = ${workspaceId}::uuid
      AND (c.categorie_id IS NULL OR c.categorie_id = ${categorieId}::uuid)
    ON CONFLICT (workspace_id, categorie_id, cod_id) DO NOTHING
  `;
}

export function parseOreInput(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw < 0 || raw > 24) return null;
    return Math.round(raw * 100) / 100;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 24) return null;
    return Math.round(n * 100) / 100;
  }
  return null;
}
