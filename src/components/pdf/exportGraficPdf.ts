import { createElement } from "react";
import type { GraficPdfData } from "./GraficAtiPdf";

type DayCol = {
  day: number;
  abbr: string;
  weekend: boolean;
  key: string;
};

type StaffRow = {
  id: string;
  name: string;
};

type CellMap = Record<string, Record<string, { valoare: string }>>;

export function buildGraficPdfData(params: {
  year: number;
  monthIndex: number;
  days: DayCol[];
  staff: StaffRow[];
  grid: CellMap;
}): GraficPdfData {
  const { year, monthIndex, days, staff, grid } = params;

  const monthName = new Date(year, monthIndex, 1)
    .toLocaleDateString("ro-RO", { month: "long", year: "numeric" })
    .toUpperCase();

  const title = `S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II – ${monthName}`;

  return {
    title,
    days: days.map((d) => ({
      day: d.day,
      abbr: d.abbr,
      weekend: d.weekend,
    })),
    rows: staff.map((person) => ({
      name: person.name.toUpperCase(),
      cells: days.map((d) => grid[person.id]?.[d.key]?.valoare ?? ""),
      osd: "",
    })),
  };
}

export async function downloadGraficPdf(data: GraficPdfData, fileName: string) {
  const { pdf } = await import("@react-pdf/renderer");
  const { GraficAtiPdf, registerGraficPdfFonts } = await import("./GraficAtiPdf");

  registerGraficPdfFonts(window.location.origin);

  const blob = await pdf(createElement(GraficAtiPdf, { data })).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
