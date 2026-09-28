import {
  cellsToRates,
  oreOsdKey,
  type OreOsdRates,
  ORE_OSD_DEFAULT_TEMPLATE,
} from "@/lib/oreOsd";

const FALLBACK_RATES: OreOsdRates = Object.fromEntries(
  ORE_OSD_DEFAULT_TEMPLATE.map((d) => [
    oreOsdKey("__default__", d.zi, d.schimb),
    d.ore,
  ]),
);

export function isWeekendOsdDay(abbr: string): abbr is "V" | "S" | "D" {
  return abbr === "V" || abbr === "S" || abbr === "D";
}

/** Ore pentru o casuță pe V/S/D; altceva → 0 */
export function orePentruCasuta(
  categorieId: string,
  dayAbbr: string,
  valoare: string,
  rates: OreOsdRates,
  comportamentMap?: Record<string, string>,
): number {
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  const lookup =
    comportamentMap && Object.keys(comportamentMap).length > 0
      ? comportamentMap[valoare]
      : valoare;
  // Coduri noi / text liber fără comportament_vechi: 0 ore (până la Faza 4)
  if (
    comportamentMap &&
    Object.keys(comportamentMap).length > 0 &&
    lookup === undefined
  ) {
    return 0;
  }
  const keyVal = lookup ?? valoare;
  if (dayAbbr === "V" && keyVal !== "1/3") return 0;
  const key = oreOsdKey(categorieId, dayAbbr, keyVal);
  const ore = rates[key];
  if (typeof ore === "number" && Number.isFinite(ore)) return ore;
  const fallback = FALLBACK_RATES[oreOsdKey("__default__", dayAbbr, keyVal)];
  return typeof fallback === "number" && Number.isFinite(fallback)
    ? fallback
    : 0;
}

export function totalOsdOre(
  categorieId: string,
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
  rates: OreOsdRates,
  comportamentMap?: Record<string, string>,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    total += orePentruCasuta(
      categorieId,
      day.abbr,
      valoare,
      rates,
      comportamentMap,
    );
  }
  return total;
}
