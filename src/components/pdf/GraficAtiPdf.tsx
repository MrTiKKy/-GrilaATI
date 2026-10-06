import {
  GraficAtiPdfLegacy,
  registerGraficPdfFontsLegacy,
} from "./GraficAtiPdfLegacy";
import {
  GraficAtiPdfTemplated,
  registerGraficPdfFonts as registerTemplatedFonts,
} from "./GraficAtiPdfTemplated";
import type { PdfTemplateSetari, PdfTemplateVars } from "@/lib/pdfTemplate";
import type { GraficFooterTexts } from "@/lib/graficFooter";

export type GraficPdfDay = {
  day: number;
  abbr: string;
  weekend: boolean;
};

export type GraficPdfRow = {
  name: string;
  cells: string[];
  osd: string;
};

export type GraficPdfData = {
  title: string;
  days: GraficPdfDay[];
  rows: GraficPdfRow[];
  footer?: GraficFooterTexts;
  labels?: {
    osd: string;
    pageHint: string;
    excelSheetName: string;
  };
  template?: PdfTemplateSetari;
  templateVars?: PdfTemplateVars;
  /** true când workspace-ul nu are template salvat (format inițial = origin/main) */
  useLegacyLayout?: boolean;
};

/** Înregistrează fonturile o dată. */
export function registerGraficPdfFonts(origin: string) {
  registerGraficPdfFontsLegacy(origin);
  registerTemplatedFonts(origin);
}

/**
 * Fără template salvat (useLegacyLayout): randare IDENTICĂ cu origin/main.
 * Cu template personalizat: motorul pe setări.
 */
export function GraficAtiPdf({ data }: { data: GraficPdfData }) {
  if (data.useLegacyLayout || !data.template) {
    return <GraficAtiPdfLegacy data={data} />;
  }
  return <GraficAtiPdfTemplated data={data} />;
}

export const PDF_ROWS_PER_PAGE = 40;
