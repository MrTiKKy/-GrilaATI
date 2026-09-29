import { categorieSlugFromGraficTitle } from "@/lib/categorii";
import { sanitizeFisierBase } from "@/lib/texteRegistry";

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

/** Nume fișier din bază deja formatată/curățată + optional suffix foaie. */
export function graficExportFileNameFromBase(
  baseName: string,
  format: ExportFormat,
  foaieSuffix = "",
): string {
  const base = sanitizeFisierBase(baseName) || "grafic";
  const suf = foaieSuffix ? sanitizeFisierBase(foaieSuffix) || foaieSuffix : "";
  const mid = suf ? `${base}-${suf}` : base;
  return `${mid}.${format}`;
}

/**
 * Compat + arhivă: pattern implicit vechi
 * grafic-{slug}-{an}-{ll}[-suffix].ext
 */
export function graficExportFileName(
  an: number,
  luna: number,
  categorieNume: string,
  format: ExportFormat,
  suffix = "",
): string {
  const kind =
    categorieNume
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "categorie";
  const base = `grafic-${kind}-${an}-${String(luna).padStart(2, "0")}`;
  return graficExportFileNameFromBase(base, format, suffix);
}

/** Pentru arhivă: derivează slug din titlul salvat. */
export function categorieNumeFromGraficTitle(title: string): string {
  const slug = categorieSlugFromGraficTitle(title);
  if (slug === "infirmiere") return "Infirmiere";
  if (slug === "asistenti") return "Asistenți";
  return slug;
}
