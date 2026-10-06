export const PROGRAMARE_VALUES = [
  "1",
  "2",
  "1/3",
  "2*",
  "L",
  "CO",
  "CM",
  "-",
  "CIC",
] as const;

export type ProgramareValoare = (typeof PROGRAMARE_VALUES)[number];

/** Secție pe casuță — exclusiv A sau R (notiță șef / ciornă; nu pe document oficial) */
export const SECTIE_VALUES = ["A", "R"] as const;
export type SectieValoare = (typeof SECTIE_VALUES)[number];

export type AngajatDto = {
  id: string;
  nume: string;
  categorieId: string;
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
  /** Culori text: black (default) | red | blue | green | yellow */
  culoare?: string | null;
  /** Sheet / foaie (1 = Sheet 1) */
  foaie?: number;
};

export type LunaResponse = {
  an: number;
  luna: number;
  categorieId: string;
  angajati: AngajatDto[];
  programari: ProgramareDto[];
  /** Foi existente pentru categoria cerută */
  foi?: number[];
  /** Foi cu nume/etichetă (faza 5) */
  foiItems?: Array<{ foaie: number; nume: string | null; label: string }>;
  /** Foaia curentă */
  foaie?: number;
  /** Texte workspace pentru etichete grilă (faza 6) */
  texte?: {
    tabelNume: string;
    tabelOsd: string;
    foaieNumeImplicit: string;
    foaieFisierSuffix: string;
    dayAbbrs: string[];
    titluPreview?: string;
    /** Bază nume fișier (fără suffix foaie / extensie), deja curățată */
    exportBase: string;
  };
};

export type ConcediuDto = {
  id: string;
  nume: string;
  categorieId: string;
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
  categorieId: string;
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
  /** 'black' | 'red' | 'blue' | 'green' | 'yellow' | null */
  culoare?: string | null;
  /** Sheet / foaie, default 1 */
  foaie?: number;
};

/** Snapshot salvat pentru PDF (arhiva grafice_finale) */
export type GraficSnapshot = {
  title: string;
  days: Array<{ day: number; abbr: string; weekend: boolean }>;
  rows: Array<{ name: string; cells: string[]; osd: string }>;
  footer?: {
    delegatName: string;
    delegatLabel: string;
    medicSef: string;
    asSef: string;
  };
  /** Etichete / meta la momentul exportului (faza 6); lipsa = implicite vechi */
  labels?: {
    osd: string;
    pageHint: string;
    excelSheetName: string;
  };
  /** Template PDF — lipsa + useLegacyLayout = PDF identic origin/main */
  pdfTemplate?: import("@/lib/pdfTemplate").PdfTemplateSetari;
  pdfTemplateVars?: import("@/lib/pdfTemplate").PdfTemplateVars;
  /** true = fără template salvat → layout origin/main */
  pdfUseLegacyLayout?: boolean;
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
  categorieId: string;
  /** Sheet / foaie exportată */
  foaie?: number;
  /** Template PDF opțional (altfel implicitul workspace) */
  pdfTemplateId?: string | null;
};

export type GraficeListResponse = {
  items: GraficFinalMeta[];
};

export function isProgramareValoare(v: string): v is ProgramareValoare {
  return (PROGRAMARE_VALUES as readonly string[]).includes(v);
}

/** Legacy check kept for backward compat; faza 3 also validates against coduri table */
export function isLegacyProgramareValoare(v: string): boolean {
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
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const s = String(value);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : s.slice(0, 10);
}
