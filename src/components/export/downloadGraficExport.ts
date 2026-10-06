import { downloadGraficPdf } from "@/components/pdf/exportGraficPdf";
import type { GraficPdfData } from "@/components/pdf/GraficAtiPdf";
import type { ExportFormat } from "@/lib/exportFormats";
import type { GraficSnapshot } from "@/lib/types";
import { downloadGraficDocx } from "./exportGraficDocx";
import { downloadGraficExcel } from "./exportGraficExcel";

function toPdfData(data: GraficSnapshot): GraficPdfData {
  return {
    title: data.title,
    days: data.days,
    rows: data.rows,
    footer: data.footer,
    labels: data.labels,
    template: data.pdfTemplate,
    templateVars: data.pdfTemplateVars,
    useLegacyLayout: data.pdfUseLegacyLayout ?? !data.pdfTemplate,
  };
}

export async function downloadGraficExport(
  data: GraficSnapshot,
  fileName: string,
  format: ExportFormat,
) {
  switch (format) {
    case "pdf":
      await downloadGraficPdf(toPdfData(data), fileName);
      return;
    case "docx":
      await downloadGraficDocx(data, fileName);
      return;
    case "xlsx":
      await downloadGraficExcel(data, fileName, "xlsx");
      return;
    case "xls":
      await downloadGraficExcel(data, fileName, "xls");
      return;
  }
}
