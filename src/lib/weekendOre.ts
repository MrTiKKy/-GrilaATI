import type { AngajatPost } from "@/lib/post";

/** Zi de weekend care intră în O.SD (Vineri exclus) */
export type WeekendOsdDay = "S" | "D";

/** Ore pe schimb — doar Sâmbătă / Duminică (Vineri = 0, nu se calculează) */
const ORE_OSD: Record<
  AngajatPost,
  Record<WeekendOsdDay, Record<string, number>>
> = {
  asistent: {
    S: { "1": 8, "1/3": 18, "2": 6 },
    D: { "1": 8, "1/3": 11, "2": 6 },
  },
  infirmier: {
    S: { "1": 8, "1/3": 17, "2": 7 },
    D: { "1": 8, "1/3": 11, "2": 7 },
  },
};

export function isWeekendOsdDay(abbr: string): abbr is WeekendOsdDay {
  return abbr === "S" || abbr === "D";
}

/** Ore pentru o casuță pe S/D; altceva (V, L, CO…) → 0 */
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
