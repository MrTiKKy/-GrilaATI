/**
 * Registru texte editabile (Faza 6).
 * Lipsa rândului în DB = valoarea implicită de aici (caracter cu caracter).
 */

export type TexteSectionId =
  | "titlu"
  | "calendar"
  | "tabel"
  | "foi"
  | "fisier"
  | "export";

export type TexteKeyDef = {
  cheie: string;
  section: TexteSectionId;
  label: string;
  implicit: string;
  /** Variabile permise, ex. ["luna","an"] — în text apar ca {luna} */
  variabile: readonly string[];
  maxLen: number;
  /** Dacă true, valoarea (după trim) nu poate fi goală */
  required: boolean;
  /** textarea în UI */
  long?: boolean;
};

const MONTHS_FULL = [
  "IANUARIE",
  "FEBRUARIE",
  "MARTIE",
  "APRILIE",
  "MAI",
  "IUNIE",
  "IULIE",
  "AUGUST",
  "SEPTEMBRIE",
  "OCTOMBRIE",
  "NOIEMBRIE",
  "DECEMBRIE",
] as const;

const MONTHS_SHORT = [
  "IAN",
  "FEB",
  "MAR",
  "APR",
  "MAI",
  "IUN",
  "IUL",
  "AUG",
  "SEP",
  "OCT",
  "NOI",
  "DEC",
] as const;

const DAYS = ["D", "L", "Ma", "Mi", "J", "V", "S"] as const;

function monthKeys(): TexteKeyDef[] {
  return MONTHS_FULL.map((name, i) => ({
    cheie: `luna.${i + 1}`,
    section: "calendar" as const,
    label: `Luna ${i + 1}`,
    implicit: name,
    variabile: [] as const,
    maxLen: 40,
    required: true,
  }));
}

function monthShortKeys(): TexteKeyDef[] {
  return MONTHS_SHORT.map((name, i) => ({
    cheie: `luna_scurta.${i + 1}`,
    section: "calendar" as const,
    label: `Luna scurtă ${i + 1}`,
    implicit: name,
    variabile: [] as const,
    maxLen: 12,
    required: true,
  }));
}

function dayKeys(): TexteKeyDef[] {
  const labels = [
    "Duminică",
    "Luni",
    "Marți",
    "Miercuri",
    "Joi",
    "Vineri",
    "Sâmbătă",
  ];
  return DAYS.map((name, i) => ({
    cheie: `zi.${i}`,
    section: "calendar" as const,
    label: labels[i]!,
    implicit: name,
    variabile: [] as const,
    maxLen: 8,
    required: true,
  }));
}

export const TEXTE_SECTIONS: Array<{
  id: TexteSectionId;
  label: string;
}> = [
  { id: "titlu", label: "Titlu" },
  { id: "calendar", label: "Calendar" },
  { id: "tabel", label: "Tabel" },
  { id: "foi", label: "Foi" },
  { id: "fisier", label: "Nume fișier" },
  { id: "export", label: "Export" },
];

export const TEXTE_REGISTRY: readonly TexteKeyDef[] = [
  {
    cheie: "titlu.format",
    section: "titlu",
    label: "Format titlu grafic",
    implicit: "{titlu_grafic} - {luna} {an}",
    variabile: ["titlu_grafic", "luna", "an"],
    maxLen: 200,
    required: true,
    long: true,
  },
  ...monthKeys(),
  ...monthShortKeys(),
  ...dayKeys(),
  {
    cheie: "tabel.nume",
    section: "tabel",
    label: "Cap coloană nume (grilă)",
    implicit: "Nume",
    variabile: [],
    maxLen: 40,
    required: true,
  },
  {
    cheie: "tabel.osd",
    section: "tabel",
    label: "Cap coloană O.SD",
    implicit: "O.SD",
    variabile: [],
    maxLen: 20,
    required: true,
  },
  {
    cheie: "foaie.nume_implicit",
    section: "foi",
    label: "Nume foaie implicit",
    implicit: "Sheet {n}",
    variabile: ["n"],
    maxLen: 40,
    required: true,
  },
  {
    cheie: "foaie.fisier_suffix",
    section: "foi",
    label: "Suffix fișier foaie (fără nume custom)",
    implicit: "sheet{n}",
    variabile: ["n"],
    maxLen: 40,
    required: true,
  },
  {
    cheie: "fisier.pattern",
    section: "fisier",
    label: "Pattern nume fișier (fără suffix foaie / extensie)",
    implicit: "grafic-{categorie}-{an}-{luna}",
    variabile: ["categorie", "an", "luna"],
    maxLen: 120,
    required: true,
    long: true,
  },
  {
    cheie: "excel.foaie_fallback",
    section: "fisier",
    label: "Nume foaie Excel (fallback)",
    implicit: "Grafic",
    variabile: [],
    maxLen: 31,
    required: true,
  },
  {
    cheie: "export.pagina",
    section: "export",
    label: "Indiciu pagină PDF",
    implicit: "Pagina {page} / {total}",
    variabile: ["page", "total"],
    maxLen: 80,
    required: true,
  },
] as const;

const BY_KEY = new Map(TEXTE_REGISTRY.map((d) => [d.cheie, d]));

export function getTexteKeyDef(cheie: string): TexteKeyDef | undefined {
  return BY_KEY.get(cheie);
}

export function isTexteCheie(cheie: unknown): cheie is string {
  return typeof cheie === "string" && BY_KEY.has(cheie);
}

/** Implicituri ca mapă cheie → valoare. */
export function texteDefaults(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of TEXTE_REGISTRY) out[d.cheie] = d.implicit;
  return out;
}

/**
 * Înlocuiește {var} din template. Variabile necunoscute rămân literale.
 */
export function formatTexte(
  template: string,
  variabile: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(variabile, name)) return match;
    const v = variabile[name];
    if (v === null || v === undefined) return match;
    return String(v);
  });
}

/** Curăță un nume de fișier (fără extensie / suffix foaie). Max 100. */
export function sanitizeFisierBase(raw: string): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[/\\:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return cleaned;
}

export function parseTexteValoare(
  cheie: string,
  raw: unknown,
): { ok: true; valoare: string } | { ok: false; error: string } {
  const def = getTexteKeyDef(cheie);
  if (!def) return { ok: false, error: "Cheie necunoscută" };
  if (typeof raw !== "string") return { ok: false, error: "Valoare invalidă" };
  const valoare = raw; // păstrează spațiile interne; trim doar pentru required
  if (valoare.length > def.maxLen) {
    return {
      ok: false,
      error: `Maxim ${def.maxLen} caractere`,
    };
  }
  if (def.required && valoare.trim().length === 0) {
    return { ok: false, error: "Valoarea nu poate fi goală" };
  }
  if (valoare.length > 500) {
    return { ok: false, error: "Maxim 500 caractere" };
  }
  return { ok: true, valoare };
}
