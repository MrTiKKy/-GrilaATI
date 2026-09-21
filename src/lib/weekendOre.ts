import type { AngajatPost } from "@/lib/post";
import {
  cellsToRates,
  oreOsdKey,
  type OreOsdRates,
  ORE_OSD_DEFAULTS,
} from "@/lib/oreOsd";

const DEFAULT_RATES = cellsToRates(ORE_OSD_DEFAULTS);

export function isWeekendOsdDay(abbr: string): abbr is "V" | "S" | "D" {
  return abbr === "V" || abbr === "S" || abbr === "D";
}

/** Ore pentru o casuță pe V/S/D; altceva → 0 */
export function orePentruCasuta(
  post: AngajatPost,
  dayAbbr: string,
  valoare: string,
  rates: OreOsdRates = DEFAULT_RATES,
): number {
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  // Vineri: doar 1/3
  if (dayAbbr === "V" && valoare !== "1/3") return 0;
  const key = oreOsdKey(post, dayAbbr, valoare);
  const ore = rates[key];
  return typeof ore === "number" && Number.isFinite(ore) ? ore : 0;
}

export function totalOsdOre(
  post: AngajatPost,
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
  rates: OreOsdRates = DEFAULT_RATES,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    total += orePentruCasuta(post, day.abbr, valoare, rates);
  }
  return total;
}
