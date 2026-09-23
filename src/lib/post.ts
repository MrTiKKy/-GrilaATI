/** Post / tip de personal pe grilă și PDF */
export const ANGAJAT_POSTURI = ["asistent", "infirmier"] as const;
export type AngajatPost = (typeof ANGAJAT_POSTURI)[number];

export function isAngajatPost(v: unknown): v is AngajatPost {
  return v === "asistent" || v === "infirmier";
}

/** Valoare din URL `tab=` */
export function postFromTabParam(v: string | null | undefined): AngajatPost {
  if (v === "infirmiere" || v === "infirmier") return "infirmier";
  return "asistent";
}

export function tabParamFromPost(post: AngajatPost): string {
  return post === "infirmier" ? "infirmiere" : "asistenti";
}

export function postLabel(post: AngajatPost): string {
  return post === "infirmier" ? "Infirmiere" : "Asistenți";
}

export function postLabelSingular(post: AngajatPost): string {
  return post === "infirmier" ? "infirmieră" : "asistent";
}

const MONTH_NAMES_RO = [
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

export function buildGraficTitle(
  an: number,
  luna: number,
  post: AngajatPost,
): string {
  const name = MONTH_NAMES_RO[luna - 1] ?? String(luna);
  if (post === "infirmier") {
    return `S.C.J.U. BRAILA - GRAFIC INFIRMIERE ATI - ${name} ${an}`;
  }
  return `S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II - ${name} ${an}`;
}

export function graficPdfFileName(
  an: number,
  luna: number,
  post: AngajatPost,
  suffix = "",
): string {
  const kind = post === "infirmier" ? "infirmiere" : "asistenti";
  const base = `grafic-${kind}-${an}-${String(luna).padStart(2, "0")}`;
  return suffix ? `${base}-${suffix}.pdf` : `${base}.pdf`;
}
