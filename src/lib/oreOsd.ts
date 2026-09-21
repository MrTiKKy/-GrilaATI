import type { AngajatPost } from "@/lib/post";

export type OreOsdZi = "V" | "S" | "D";
export type OreOsdSchimb = "1" | "1/3" | "2";

export type OreOsdCell = {
  post: AngajatPost;
  zi: OreOsdZi;
  schimb: OreOsdSchimb;
  ore: number;
};

/** Cheie internă post|zi|schimb → ore */
export type OreOsdRates = Record<string, number>;

/** Defaults când DB e goală / lipsește un rând */
export const ORE_OSD_DEFAULTS: OreOsdCell[] = [
  { post: "asistent", zi: "V", schimb: "1/3", ore: 7 },
  { post: "asistent", zi: "S", schimb: "1", ore: 8 },
  { post: "asistent", zi: "S", schimb: "1/3", ore: 18 },
  { post: "asistent", zi: "S", schimb: "2", ore: 6 },
  { post: "asistent", zi: "D", schimb: "1", ore: 8 },
  { post: "asistent", zi: "D", schimb: "1/3", ore: 11 },
  { post: "asistent", zi: "D", schimb: "2", ore: 6 },
  { post: "infirmier", zi: "V", schimb: "1/3", ore: 6 },
  { post: "infirmier", zi: "S", schimb: "1", ore: 8 },
  { post: "infirmier", zi: "S", schimb: "1/3", ore: 17 },
  { post: "infirmier", zi: "S", schimb: "2", ore: 7 },
  { post: "infirmier", zi: "D", schimb: "1", ore: 8 },
  { post: "infirmier", zi: "D", schimb: "1/3", ore: 11 },
  { post: "infirmier", zi: "D", schimb: "2", ore: 7 },
];

/** Coloane afișate în widget (V doar 1/3) */
export const ORE_OSD_COLUMNS: Array<{ zi: OreOsdZi; schimb: OreOsdSchimb; label: string }> =
  [
    { zi: "V", schimb: "1/3", label: "V 1/3" },
    { zi: "S", schimb: "1", label: "S 1" },
    { zi: "S", schimb: "1/3", label: "S 1/3" },
    { zi: "S", schimb: "2", label: "S 2" },
    { zi: "D", schimb: "1", label: "D 1" },
    { zi: "D", schimb: "1/3", label: "D 1/3" },
    { zi: "D", schimb: "2", label: "D 2" },
  ];

export function oreOsdKey(
  post: AngajatPost,
  zi: string,
  schimb: string,
): string {
  return `${post}|${zi}|${schimb}`;
}

export function cellsToRates(cells: OreOsdCell[]): OreOsdRates {
  const rates: OreOsdRates = {};
  for (const c of cells) {
    rates[oreOsdKey(c.post, c.zi, c.schimb)] = c.ore;
  }
  return rates;
}

export function mergeWithDefaults(cells: OreOsdCell[]): OreOsdCell[] {
  const map = new Map(
    cells.map((c) => [oreOsdKey(c.post, c.zi, c.schimb), c.ore]),
  );
  return ORE_OSD_DEFAULTS.map((d) => ({
    ...d,
    ore: map.get(oreOsdKey(d.post, d.zi, d.schimb)) ?? d.ore,
  }));
}

export function isOreOsdZi(v: unknown): v is OreOsdZi {
  return v === "V" || v === "S" || v === "D";
}

export function isOreOsdSchimb(v: unknown): v is OreOsdSchimb {
  return v === "1" || v === "1/3" || v === "2";
}
