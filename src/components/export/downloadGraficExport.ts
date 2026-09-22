import { downloadGraficPdf } from "@/components/pdf/exportGraficPdf";
import type { ExportFormat } from "@/lib/exportFormats";
import type { GraficSnapshot } from "@/lib/types";
import { downloadGraficDocx } from "./exportGraficDocx";
import { downloadGraficExcel } from "./exportGraficExcel";

export async function downloadGraficExport(
  data: GraficSnapshot,
  fileName: string,
  format: ExportFormat,
) {
  switch (format) {
    case "pdf":
      await downloadGraficPdf(data, fileName);
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
