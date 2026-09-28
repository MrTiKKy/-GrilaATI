import type { OreCoduriByCod } from "@/lib/oreCoduri";

export function isWeekendOsdDay(abbr: string): abbr is "V" | "S" | "D" {
  return abbr === "V" || abbr === "S" || abbr === "D";
}

/**
 * Ore O.SD pentru o casuță: citește din tabelul ore_coduri (via mapă pe textul codului).
 * Text liber / cod necunoscut → 0.
 */
export function orePentruCasuta(
  dayAbbr: string,
  valoare: string,
  ratesByCod: OreCoduriByCod,
): number {
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  const r = ratesByCod[valoare];
  if (!r) return 0;
  if (dayAbbr === "V") return r.vineri || 0;
  if (dayAbbr === "S") return r.sambata || 0;
  if (dayAbbr === "D") return r.duminica || 0;
  return 0;
}

export function totalOsdOre(
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
  ratesByCod: OreCoduriByCod,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    total += orePentruCasuta(day.abbr, valoare, ratesByCod);
  }
  return total;
}

/** Breakdown V / S / D + total pentru un angajat pe luna curentă */
export function osdBreakdown(
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
  ratesByCod: OreCoduriByCod,
): { v: number; s: number; d: number; total: number } {
  let v = 0;
  let s = 0;
  let d = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    const ore = orePentruCasuta(day.abbr, valoare, ratesByCod);
    if (day.abbr === "V") v += ore;
    else if (day.abbr === "S") s += ore;
    else if (day.abbr === "D") d += ore;
  }
  return { v, s, d, total: v + s + d };
}
