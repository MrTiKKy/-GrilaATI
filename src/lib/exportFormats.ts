import type { AngajatPost } from "@/lib/post";

export const EXPORT_FORMATS = ["pdf", "docx", "xlsx", "xls"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_FORMAT_OPTIONS: Array<{
  id: ExportFormat;
  label: string;
  shortLabel: string;
}> = [
  { id: "pdf", label: "PDF", shortLabel: "PDF" },
  { id: "docx", label: "Word (.docx)", shortLabel: "Word" },
  { id: "xlsx", label: "Excel (.xlsx)", shortLabel: "Excel nou" },
  { id: "xls", label: "Excel (.xls)", shortLabel: "Excel vechi" },
];

export function exportFormatLabel(format: ExportFormat): string {
  return EXPORT_FORMAT_OPTIONS.find((o) => o.id === format)?.label ?? format;
}

export function graficExportFileName(
  an: number,
  luna: number,
  post: AngajatPost,
  format: ExportFormat,
  suffix = "",
): string {
  const kind = post === "infirmier" ? "infirmiere" : "asistenti";
  const base = `grafic-${kind}-${an}-${String(luna).padStart(2, "0")}`;
  const mid = suffix ? `${base}-${suffix}` : base;
  return `${mid}.${format}`;
}

export function postFromGraficTitle(title: string): AngajatPost {
  return /INFIRMIERE/i.test(title) ? "infirmier" : "asistent";
}
