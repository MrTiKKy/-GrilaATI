import {
  categorieSlugFromGraficTitle,
  graficExportFileNameForCategorie,
} from "@/lib/categorii";

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
  categorieNume: string,
  format: ExportFormat,
  suffix = "",
): string {
  return graficExportFileNameForCategorie(
    an,
    luna,
    categorieNume,
    format,
    suffix,
  );
}

/** Pentru arhivă: derivează slug din titlul salvat. */
export function categorieNumeFromGraficTitle(title: string): string {
  const slug = categorieSlugFromGraficTitle(title);
  if (slug === "infirmiere") return "Infirmiere";
  if (slug === "asistenti") return "Asistenți";
  return slug;
}
