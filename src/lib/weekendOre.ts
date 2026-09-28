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
): number {
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  if (dayAbbr === "V" && valoare !== "1/3") return 0;
  const key = oreOsdKey(categorieId, dayAbbr, valoare);
  const ore = rates[key];
  if (typeof ore === "number" && Number.isFinite(ore)) return ore;
  const fallback = FALLBACK_RATES[oreOsdKey("__default__", dayAbbr, valoare)];
  return typeof fallback === "number" && Number.isFinite(fallback)
    ? fallback
    : 0;
}

export function totalOsdOre(
  categorieId: string,
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
  rates: OreOsdRates,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    total += orePentruCasuta(categorieId, day.abbr, valoare, rates);
  }
  return total;
}
