export type OreOsdZi = "V" | "S" | "D";
export type OreOsdSchimb = "1" | "1/3" | "2";

export type OreOsdCell = {
  categorieId: string;
  zi: OreOsdZi;
  schimb: OreOsdSchimb;
  ore: number;
};

/** Cheie internă categorieId|zi|schimb → ore */
export type OreOsdRates = Record<string, number>;

/**
 * Template default: 0 peste tot.
 * (Valorile istorice ATI trăiesc în ore_coduri; nu mai injectăm 7/8/18 din cod.)
 */
export const ORE_OSD_DEFAULT_TEMPLATE: Array<{
  zi: OreOsdZi;
  schimb: OreOsdSchimb;
  ore: number;
}> = [
  { zi: "V", schimb: "1/3", ore: 0 },
  { zi: "S", schimb: "1", ore: 0 },
  { zi: "S", schimb: "1/3", ore: 0 },
  { zi: "S", schimb: "2", ore: 0 },
  { zi: "D", schimb: "1", ore: 0 },
  { zi: "D", schimb: "1/3", ore: 0 },
  { zi: "D", schimb: "2", ore: 0 },
];

/** Coloane afișate în widget (V doar 1/3) */
export const ORE_OSD_COLUMNS: Array<{
  zi: OreOsdZi;
  schimb: OreOsdSchimb;
  label: string;
}> = [
  { zi: "V", schimb: "1/3", label: "V 1/3" },
  { zi: "S", schimb: "1", label: "S 1" },
  { zi: "S", schimb: "1/3", label: "S 1/3" },
  { zi: "S", schimb: "2", label: "S 2" },
  { zi: "D", schimb: "1", label: "D 1" },
  { zi: "D", schimb: "1/3", label: "D 1/3" },
  { zi: "D", schimb: "2", label: "D 2" },
];

export function oreOsdKey(
  categorieId: string,
  zi: string,
  schimb: string,
): string {
  return `${categorieId}|${zi}|${schimb}`;
}

export function cellsToRates(cells: OreOsdCell[]): OreOsdRates {
  const rates: OreOsdRates = {};
  for (const c of cells) {
    rates[oreOsdKey(c.categorieId, c.zi, c.schimb)] = c.ore;
  }
  return rates;
}

export function mergeWithDefaultsForCategorie(
  categorieId: string,
  cells: OreOsdCell[],
): OreOsdCell[] {
  const map = new Map(
    cells.map((c) => [oreOsdKey(c.categorieId, c.zi, c.schimb), c.ore]),
  );
  return ORE_OSD_DEFAULT_TEMPLATE.map((d) => ({
    categorieId,
    zi: d.zi,
    schimb: d.schimb,
    ore: map.get(oreOsdKey(categorieId, d.zi, d.schimb)) ?? d.ore,
  }));
}

export function isOreOsdZi(v: unknown): v is OreOsdZi {
  return v === "V" || v === "S" || v === "D";
}

export function isOreOsdSchimb(v: unknown): v is OreOsdSchimb {
  return v === "1" || v === "1/3" || v === "2";
}
