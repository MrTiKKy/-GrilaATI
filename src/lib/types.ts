export const PROGRAMARE_VALUES = [
  "1",
  "2",
  "1/3",
  "2*",
  "L",
  "CO",
  "CM",
] as const;

export type ProgramareValoare = (typeof PROGRAMARE_VALUES)[number];

/** Secție pe casuță — exclusiv A sau R (notiță șef / ciornă; nu pe document oficial) */
export const SECTIE_VALUES = ["A", "R"] as const;
export type SectieValoare = (typeof SECTIE_VALUES)[number];

export type AngajatDto = {
  id: string;
  nume: string;
  zileCoAn: number;
  zileCoFolosite: number;
  zileCoRamase: number;
  ordine: number;
};

export type ProgramareDto = {
  angajatId: string;
  data: string; // YYYY-MM-DD
  valoare: ProgramareValoare | null;
  /** Secție A sau R; null = nesetat. Stocat în coloana `ciorna`. */
  ciorna: SectieValoare | null;
};

export type LunaResponse = {
  an: number;
  luna: number;
  angajati: AngajatDto[];
  programari: ProgramareDto[];
};

export type ConcediuDto = {
  id: string;
  nume: string;
  zileCoAn: number;
  folosite: number;
  ramase: number;
};

export type ConcediiResponse = {
  an: number;
  angajati: ConcediuDto[];
};

export type UpdateConcediuBody = {
  zileCoAn: number | null;
};

export type CreateAngajatBody = {
  nume: string;
  zileCoAn?: number;
};

export type CreateAngajatResponse = {
  angajat: AngajatDto;
};

export type UpdateAngajatBody = {
  nume?: string;
};

export type OrdineBody = {
  ids: string[];
};

export type UpsertProgramareBody = {
  angajatId: string;
  data: string; // YYYY-MM-DD
  valoare: string | null;
  /** 'A' | 'R' | null */
  ciorna?: string | null;
};

/** Snapshot salvat pentru PDF (arhiva grafice_finale) */
export type GraficSnapshot = {
  title: string;
  days: Array<{ day: number; abbr: string; weekend: boolean }>;
  rows: Array<{ name: string; cells: string[]; osd: string }>;
};

export type GraficFinalMeta = {
  id: string;
  an: number;
  luna: number;
  titlu: string;
  createdAt: string;
};

export type GraficFinalDetail = GraficFinalMeta & {
  snapshot: GraficSnapshot;
};

/** Body client pentru export — snapshot e construit pe server din DB */
export type CreateGraficBody = {
  an: number;
  luna: number;
};

export type GraficeListResponse = {
  items: GraficFinalMeta[];
};

export function isProgramareValoare(v: string): v is ProgramareValoare {
  return (PROGRAMARE_VALUES as readonly string[]).includes(v);
}

export function isSectieValoare(v: string): v is SectieValoare {
  return (SECTIE_VALUES as readonly string[]).includes(v);
}

/** Normalizează DATE Postgres la YYYY-MM-DD fără shift de fus orar. */
export function toDateString(value: unknown): string {
  if (value == null) return "";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value.slice(0, 10);
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Folosim componentele locale — NU toISOString() (mută ziua în UTC+2/+3)
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(value);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : s.slice(0, 10);
}

