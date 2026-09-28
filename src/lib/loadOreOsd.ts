import { getDb } from "@/lib/db";
import {
  cellsToRates,
  isOreOsdSchimb,
  isOreOsdZi,
  mergeWithDefaultsForCategorie,
  type OreOsdCell,
  type OreOsdRates,
} from "@/lib/oreOsd";

export async function loadOreOsdCellsForCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<OreOsdCell[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT categorie_id::text AS categorie_id, zi, schimb, ore::float AS ore
    FROM ore_osd
    WHERE workspace_id = ${workspaceId}::uuid
      AND categorie_id = ${categorieId}::uuid
  `;
  const cells: OreOsdCell[] = [];
  for (const row of rows) {
    const zi = String(row.zi);
    const schimb = String(row.schimb);
    const ore = Number(row.ore);
    if (!isOreOsdZi(zi) || !isOreOsdSchimb(schimb)) continue;
    if (!Number.isFinite(ore)) continue;
    cells.push({
      categorieId: String(row.categorie_id),
      zi,
      schimb,
      ore,
    });
  }
  return mergeWithDefaultsForCategorie(categorieId, cells);
}

export async function loadOreOsdRatesForCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<OreOsdRates> {
  return cellsToRates(
    await loadOreOsdCellsForCategorie(workspaceId, categorieId),
  );
}
