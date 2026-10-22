import type { OreCoduriByCod } from "@/lib/oreCoduri";

export function isWeekendOsdDay(abbr: string): abbr is "V" | "S" | "D" {
  return abbr === "V" || abbr === "S" || abbr === "D";
}

/**
 * Ore O.SD după ziua săptămânii (0=D … 5=V, 6=S).
 * Sărbătoare legală → tarife duminică.
 */
export function orePentruWeekday(
  weekday: number,
  valoare: string,
  ratesByCod: OreCoduriByCod,
  sarbatoare = false,
): number {
  if (!valoare) return 0;
  const r = ratesByCod[valoare];
  if (!r) return 0;
  const wd = sarbatoare ? 0 : weekday;
  if (wd === 5) return r.vineri || 0;
  if (wd === 6) return r.sambata || 0;
  if (wd === 0) return r.duminica || 0;
  return 0;
}

/**
 * Ore O.SD pentru o casuță: citește din tabelul ore_coduri (via mapă pe textul codului).
 * Text liber / cod necunoscut → 0.
 * Preferă orePentruWeekday când ai indexul zilei.
 */
export function orePentruCasuta(
  dayAbbr: string,
  valoare: string,
  ratesByCod: OreCoduriByCod,
  sarbatoare = false,
): number {
  if (sarbatoare) {
    return orePentruWeekday(0, valoare, ratesByCod, true);
  }
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  const r = ratesByCod[valoare];
  if (!r) return 0;
  if (dayAbbr === "V") return r.vineri || 0;
  if (dayAbbr === "S") return r.sambata || 0;
  if (dayAbbr === "D") return r.duminica || 0;
  return 0;
}

export type OsdDayInput = {
  abbr: string;
  key: string;
  weekday?: number;
  sarbatoare?: boolean;
};

export function totalOsdOre(
  days: OsdDayInput[],
  cells: Record<string, { valoare?: string } | undefined>,
  ratesByCod: OreCoduriByCod,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    if (typeof day.weekday === "number") {
      total += orePentruWeekday(
        day.weekday,
        valoare,
        ratesByCod,
        Boolean(day.sarbatoare),
      );
    } else {
      total += orePentruCasuta(
        day.abbr,
        valoare,
        ratesByCod,
        Boolean(day.sarbatoare),
      );
    }
  }
  return total;
}

/** Breakdown V / S / D + total pentru un angajat pe luna curentă */
export function osdBreakdown(
  days: OsdDayInput[],
  cells: Record<string, { valoare?: string } | undefined>,
  ratesByCod: OreCoduriByCod,
): { v: number; s: number; d: number; total: number } {
  let v = 0;
  let s = 0;
  let d = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    const sarbatoare = Boolean(day.sarbatoare);
    if (typeof day.weekday === "number") {
      const ore = orePentruWeekday(
        day.weekday,
        valoare,
        ratesByCod,
        sarbatoare,
      );
      if (sarbatoare || day.weekday === 0) d += ore;
      else if (day.weekday === 5) v += ore;
      else if (day.weekday === 6) s += ore;
    } else {
      const ore = orePentruCasuta(
        day.abbr,
        valoare,
        ratesByCod,
        sarbatoare,
      );
      if (sarbatoare || day.abbr === "D") d += ore;
      else if (day.abbr === "V") v += ore;
      else if (day.abbr === "S") s += ore;
    }
  }
  return { v, s, d, total: v + s + d };
}
