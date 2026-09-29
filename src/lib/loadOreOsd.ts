import {
  listOreCoduriForCategorie,
  rowsToByCod,
} from "@/lib/oreCoduri";
import {
  cellsToRates,
  isOreOsdSchimb,
  isOreOsdZi,
  ORE_OSD_COLUMNS,
  type OreOsdCell,
  type OreOsdRates,
} from "@/lib/oreOsd";

/**
 * Compatibilitate legacy /api/ore-osd: ore pe (zi, schimb) derivate din ore_coduri.
 * Nu mai citește tabelul ore_osd. Codurile „1” / „1/3” / „2” → ore V/S/D; lipsă → 0.
 */
export async function loadOreOsdCellsForCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<OreOsdCell[]> {
  const rows = await listOreCoduriForCategorie(workspaceId, categorieId, {
    onlyActive: true,
  });
  const byCod = rowsToByCod(rows);

  return ORE_OSD_COLUMNS.map(({ zi, schimb }) => {
    if (!isOreOsdZi(zi) || !isOreOsdSchimb(schimb)) {
      return { categorieId, zi, schimb, ore: 0 };
    }
    const r = byCod[schimb];
    let ore = 0;
    if (r) {
      if (zi === "V") ore = r.vineri || 0;
      else if (zi === "S") ore = r.sambata || 0;
      else ore = r.duminica || 0;
    }
    return { categorieId, zi, schimb, ore };
  });
}

export async function loadOreOsdRatesForCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<OreOsdRates> {
  return cellsToRates(
    await loadOreOsdCellsForCategorie(workspaceId, categorieId),
  );
}
