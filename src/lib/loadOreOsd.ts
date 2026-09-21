import { getDb } from "@/lib/db";
import { isAngajatPost } from "@/lib/post";
import {
  cellsToRates,
  isOreOsdSchimb,
  isOreOsdZi,
  mergeWithDefaults,
  type OreOsdCell,
  type OreOsdRates,
} from "@/lib/oreOsd";

export async function loadOreOsdCells(): Promise<OreOsdCell[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT post, zi, schimb, ore::float AS ore
    FROM ore_osd
  `;
  const cells: OreOsdCell[] = [];
  for (const row of rows) {
    const post = String(row.post);
    const zi = String(row.zi);
    const schimb = String(row.schimb);
    const ore = Number(row.ore);
    if (!isAngajatPost(post) || !isOreOsdZi(zi) || !isOreOsdSchimb(schimb)) {
      continue;
    }
    if (!Number.isFinite(ore)) continue;
    cells.push({ post, zi, schimb, ore });
  }
  return mergeWithDefaults(cells);
}

export async function loadOreOsdRates(): Promise<OreOsdRates> {
  return cellsToRates(await loadOreOsdCells());
}
