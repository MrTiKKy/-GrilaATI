import type { AngajatPost } from "@/lib/post";

/** Zile care intră în O.SD */
export type WeekendOsdDay = "V" | "S" | "D";

/**
 * Ore pe schimb:
 * - Vineri asistent: doar `1/3` (10h)
 * - Vineri infirmier: `1/3` (9h) + `2` (6h)
 * - Sâmbătă / Duminică: `1`, `1/3`, `2`
 * - Infirmier `2` = 6h pe V/S/D
 */
const ORE_OSD: Record<
  AngajatPost,
  Record<WeekendOsdDay, Record<string, number>>
> = {
  asistent: {
    V: { "1/3": 10 },
    S: { "1": 8, "1/3": 18, "2": 6 },
    D: { "1": 8, "1/3": 11, "2": 6 },
  },
  infirmier: {
    V: { "1/3": 9, "2": 6 },
    S: { "1": 8, "1/3": 17, "2": 6 },
    D: { "1": 8, "1/3": 11, "2": 6 },
  },
};

export function isWeekendOsdDay(abbr: string): abbr is WeekendOsdDay {
  return abbr === "V" || abbr === "S" || abbr === "D";
}

/** Ore pentru o casuță pe V/S/D; altceva → 0 */
export function orePentruCasuta(
  post: AngajatPost,
  dayAbbr: string,
  valoare: string,
): number {
  if (!isWeekendOsdDay(dayAbbr)) return 0;
  if (!valoare) return 0;
  return ORE_OSD[post][dayAbbr][valoare] ?? 0;
}

export function totalOsdOre(
  post: AngajatPost,
  days: Array<{ abbr: string; key: string }>,
  cells: Record<string, { valoare?: string } | undefined>,
): number {
  let total = 0;
  for (const day of days) {
    const valoare = cells[day.key]?.valoare ?? "";
    total += orePentruCasuta(post, day.abbr, valoare);
  }
  return total;
}
