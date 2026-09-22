import type { GraficFooterTexts } from "@/lib/graficFooter";
import { mergeGraficFooter } from "@/lib/graficFooter";
import { GRAFIC_FONT } from "@/lib/graficTypography";
import type { GraficSnapshot } from "@/lib/types";
import { downloadBlob } from "./downloadBlob";

type ExcelBookType = "xlsx" | "xls";

/** Portocaliu weekend — doar pe rândurile de angajați + header */
const WEEKEND_FILL = "F5C09A";
const WEEKEND_FILL_ARGB = "FFF5C09A";

const MONTH_ABBR: Record<string, string> = {
  IANUARIE: "IAN",
  FEBRUARIE: "FEB",
  MARTIE: "MAR",
  APRILIE: "APR",
  MAI: "MAI",
  IUNIE: "IUN",
  IULIE: "IUL",
  AUGUST: "AUG",
  SEPTEMBRIE: "SEP",
  OCTOMBRIE: "OCT",
  NOIEMBRIE: "NOI",
  DECEMBRIE: "DEC",
};

function sheetNameFromTitle(title: string): string {
  const upper = title.toUpperCase();
  for (const [full, abbr] of Object.entries(MONTH_ABBR)) {
    if (upper.includes(full)) return abbr;
  }
  return "Grafic";
}

function footerOf(data: GraficSnapshot): GraficFooterTexts {
  return mergeGraficFooter(data.footer);
}

type ThinBorder = {
  style: "thin";
  color: { argb: string };
};

const thin: ThinBorder = { style: "thin", color: { argb: "FF000000" } };
const allBorders = { top: thin, bottom: thin, left: thin, right: thin };

/** Coloane zile ~pătrate (lățime Excel ≈ caractere; înălțime în pt) */
const DAY_COL_WIDTH = 4.8;
const ROW_HEIGHT = 22;
const HEADER_ROW_HEIGHT = 20;

/** Evită interpretarea „1/3” ca dată (ex. 1 martie). */
function asLiteralScheduleValue(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^\d+\s*\/\s*\d+$/.test(s)) return `\u200B${s}`;
  return s;
}

/** Forțează text — altfel Excel transformă „1/3” în 1 martie. */
function setTextCell(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cell: any,
  text: string,
  opts?: { bold?: boolean; size?: number; align?: "left" | "center" },
) {
  cell.numFmt = "@";
  cell.value = asLiteralScheduleValue(text);
  cell.font = {
    name: "Calibri",
    size: opts?.size ?? GRAFIC_FONT.cell,
    bold: opts?.bold,
  };
  cell.alignment = {
    horizontal: opts?.align ?? "center",
    vertical: "middle",
    wrapText: false,
  };
}

async function buildExcelJsWorkbook(data: GraficSnapshot) {
  const ExcelJS = await import("exceljs");
  const footer = footerOf(data);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Grila ATI";
  const ws = wb.addWorksheet(sheetNameFromTitle(data.title), {
    views: [{ state: "frozen", ySplit: 4, showGridLines: true }],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
    },
  });

  const dayCount = data.days.length;
  const lastCol = 1 + dayCount + 1; // nume + zile + O.SD

  ws.getColumn(1).width = 16;
  for (let d = 1; d <= dayCount; d++) {
    ws.getColumn(1 + d).width = DAY_COL_WIDTH;
  }
  ws.getColumn(lastCol).width = 5.5;

  // R1: titlu
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = data.title;
  titleCell.font = { name: "Calibri", size: GRAFIC_FONT.title, bold: true };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 24;

  ws.getRow(2).height = 6;

  // R3–R4 header (cu weekend portocaliu)
  const headerNum = ws.getRow(3);
  headerNum.height = HEADER_ROW_HEIGHT;
  headerNum.getCell(1).value = "";
  for (let i = 0; i < dayCount; i++) {
    const cell = headerNum.getCell(2 + i);
    setTextCell(cell, String(data.days[i].day), {
      bold: true,
      size: GRAFIC_FONT.header,
    });
  }
  {
    const cell = headerNum.getCell(lastCol);
    setTextCell(cell, "O.SD", { bold: true, size: GRAFIC_FONT.osd });
  }

  const headerAbbr = ws.getRow(4);
  headerAbbr.height = HEADER_ROW_HEIGHT;
  headerAbbr.getCell(1).value = "";
  for (let i = 0; i < dayCount; i++) {
    const cell = headerAbbr.getCell(2 + i);
    setTextCell(cell, data.days[i].abbr, { bold: true, size: GRAFIC_FONT.header });
  }
  headerAbbr.getCell(lastCol).value = "";

  function paintStaffOrHeaderRow(row: number, withWeekend: boolean) {
    ws.getRow(row).height = ROW_HEIGHT;
    for (let col = 1; col <= lastCol; col++) {
      const dayIdx = col - 2;
      const weekend =
        withWeekend &&
        dayIdx >= 0 &&
        dayIdx < dayCount &&
        data.days[dayIdx].weekend;
      const cell = ws.getCell(row, col);
      cell.border = allBorders;
      cell.font = { name: "Calibri", size: GRAFIC_FONT.cell };
      cell.alignment = {
        horizontal: col === 1 ? "left" : "center",
        vertical: "middle",
      };
      cell.numFmt = "@";
      if (weekend) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: WEEKEND_FILL_ARGB },
        };
      }
    }
  }

  for (const headerRow of [3, 4]) {
    paintStaffOrHeaderRow(headerRow, true);
  }

  // Angajați — portocaliu pe weekend; valori ca TEXT (1/3 ≠ dată)
  let r = 5;
  for (const row of data.rows) {
    paintStaffOrHeaderRow(r, true);
    const nameCell = ws.getCell(r, 1);
    setTextCell(nameCell, row.name, {
      bold: true,
      size: GRAFIC_FONT.name,
      align: "left",
    });
    nameCell.border = allBorders;
    for (let i = 0; i < dayCount; i++) {
      const cell = ws.getCell(r, 2 + i);
      setTextCell(cell, row.cells[i] || "");
      cell.border = allBorders;
      if (data.days[i].weekend) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: WEEKEND_FILL_ARGB },
        };
      }
    }
    const osdCell = ws.getCell(r, lastCol);
    setTextCell(osdCell, row.osd || "");
    osdCell.border = allBorders;
    r += 1;
  }

  // 2 rânduri libere — fără portocaliu, cu borduri
  for (let i = 0; i < 2; i++) {
    ws.getRow(r).height = ROW_HEIGHT;
    for (let col = 1; col <= lastCol; col++) {
      const cell = ws.getCell(r, col);
      cell.border = allBorders;
      cell.numFmt = "@";
      cell.value = "";
    }
    r += 1;
  }

  // Rând MARCULESCU + DELEGAT
  const delegatRow = r;
  ws.getRow(delegatRow).height = ROW_HEIGHT;
  const nameCell = ws.getCell(delegatRow, 1);
  setTextCell(nameCell, footer.delegatName, {
    bold: true,
    size: GRAFIC_FONT.name,
    align: "left",
  });
  nameCell.border = allBorders;

  ws.mergeCells(delegatRow, 2, delegatRow, lastCol);
  const delegatCell = ws.getCell(delegatRow, 2);
  setTextCell(delegatCell, footer.delegatLabel, { size: GRAFIC_FONT.cell });
  delegatCell.border = allBorders;

  // Semnături SUB tabel
  r = delegatRow + 2;
  ws.getRow(r).height = 18;
  const medicCell = ws.getCell(r, 1);
  medicCell.value = footer.medicSef;
  medicCell.font = { name: "Calibri", size: GRAFIC_FONT.footer, italic: true };
  medicCell.alignment = { horizontal: "left", vertical: "middle" };

  const asCol = Math.max(2, lastCol - 8);
  const asCell = ws.getCell(r, asCol);
  asCell.value = footer.asSef;
  asCell.font = { name: "Calibri", size: GRAFIC_FONT.footer, italic: true };
  asCell.alignment = { horizontal: "left", vertical: "middle" };

  return wb;
}

function buildHtmlXls(data: GraficSnapshot): string {
  const footer = footerOf(data);
  const dayCount = data.days.length;
  const lastCol = 1 + dayCount + 1;

  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const td = (
    content: string,
    opts: {
      weekend?: boolean;
      bold?: boolean;
      italic?: boolean;
      align?: string;
      colspan?: number;
      noBorder?: boolean;
      /** Forțează format text (previne 1/3 → dată) */
      asText?: boolean;
      widthPx?: number;
      heightPx?: number;
      raw?: boolean; // content deja e HTML safe (&nbsp;)
    } = {},
  ) => {
    const styleParts = [
      opts.noBorder ? "border:none" : "border:0.5pt solid #000",
      `text-align:${opts.align ?? "center"}`,
      "vertical-align:middle",
      "font-family:Calibri,sans-serif",
      `font-size:${GRAFIC_FONT.cell}pt`,
    ];
    if (opts.weekend) styleParts.push(`background-color:#${WEEKEND_FILL}`);
    if (opts.bold) styleParts.push("font-weight:bold");
    if (opts.italic) styleParts.push("font-style:italic");
    if (opts.asText) styleParts.push("mso-number-format:'\\@'");
    if (opts.widthPx) {
      styleParts.push(`width:${opts.widthPx}px`);
      styleParts.push(`min-width:${opts.widthPx}px`);
    }
    if (opts.heightPx) styleParts.push(`height:${opts.heightPx}px`);
    const colspan = opts.colspan ? ` colspan="${opts.colspan}"` : "";
    let body: string;
    if (opts.raw) {
      body = content;
    } else if (!content) {
      body = "&nbsp;";
    } else if (opts.asText) {
      body = esc(asLiteralScheduleValue(content));
    } else {
      body = esc(content);
    }
    return `<td${colspan} style="${styleParts.join(";")}">${body}</td>`;
  };

  const dayPx = 28;
  const rowPx = 28;

  const rows: string[] = [];
  rows.push(
    `<tr>${td(data.title, {
      bold: true,
      align: "center",
      colspan: lastCol,
      noBorder: true,
    })}</tr>`,
  );
  rows.push(
    `<tr><td colspan="${lastCol}" style="height:6px;border:none"></td></tr>`,
  );

  {
    let html = `<tr style="height:${rowPx}px">`;
    html += td("&nbsp;", { bold: true, heightPx: rowPx, raw: true });
    for (let i = 0; i < dayCount; i++) {
      html += td(String(data.days[i].day), {
        bold: true,
        weekend: data.days[i].weekend,
        asText: true,
        widthPx: dayPx,
        heightPx: rowPx,
      });
    }
    html += td("O.SD", { bold: true, asText: true, heightPx: rowPx });
    rows.push(`${html}</tr>`);
  }
  {
    let html = `<tr style="height:${rowPx}px">`;
    html += td("&nbsp;", { bold: true, heightPx: rowPx, raw: true });
    for (let i = 0; i < dayCount; i++) {
      html += td(data.days[i].abbr, {
        bold: true,
        weekend: data.days[i].weekend,
        asText: true,
        widthPx: dayPx,
        heightPx: rowPx,
      });
    }
    html += td("&nbsp;", { heightPx: rowPx, raw: true });
    rows.push(`${html}</tr>`);
  }

  for (const row of data.rows) {
    let html = `<tr style="height:${rowPx}px">`;
    html += td(row.name, {
      bold: true,
      align: "left",
      asText: true,
      heightPx: rowPx,
    });
    for (let i = 0; i < dayCount; i++) {
      const val = row.cells[i] || "";
      html += td(val || "&nbsp;", {
        weekend: data.days[i].weekend,
        asText: !!val,
        raw: !val,
        widthPx: dayPx,
        heightPx: rowPx,
      });
    }
    html += td(row.osd || "&nbsp;", {
      asText: !!row.osd,
      raw: !row.osd,
      heightPx: rowPx,
    });
    rows.push(`${html}</tr>`);
  }

  for (let i = 0; i < 2; i++) {
    let html = `<tr style="height:${rowPx}px">`;
    html += td("&nbsp;", { align: "left", heightPx: rowPx, raw: true });
    for (let d = 0; d < dayCount; d++) {
      html += td("&nbsp;", { widthPx: dayPx, heightPx: rowPx, raw: true });
    }
    html += td("&nbsp;", { heightPx: rowPx, raw: true });
    rows.push(`${html}</tr>`);
  }

  rows.push(
    `<tr style="height:${rowPx}px">${td(footer.delegatName, {
      bold: true,
      align: "left",
      asText: true,
      heightPx: rowPx,
    })}${td(footer.delegatLabel, {
      align: "center",
      colspan: dayCount + 1,
      asText: true,
      heightPx: rowPx,
    })}</tr>`,
  );

  rows.push(
    `<tr><td colspan="${lastCol}" style="height:12px;border:none"></td></tr>`,
  );
  rows.push(
    `<tr>${td(footer.medicSef, {
      italic: true,
      align: "left",
      noBorder: true,
      colspan: Math.ceil(lastCol / 2),
    })}${td(footer.asSef, {
      italic: true,
      align: "right",
      noBorder: true,
      colspan: Math.floor(lastCol / 2),
    })}</tr>`,
  );

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(sheetNameFromTitle(data.title))}</x:Name><x:WorksheetOptions><x:Print><x:ValidPrinterInfo/></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
td { font-family: Calibri, sans-serif; }
</style>
</head>
<body>
<table cellspacing="0" cellpadding="1" style="border-collapse:collapse">
${rows.join("\n")}
</table>
</body></html>`;
}

export async function downloadGraficExcel(
  data: GraficSnapshot,
  fileName: string,
  bookType: ExcelBookType,
) {
  if (bookType === "xls") {
    const html = buildHtmlXls(data);
    downloadBlob(
      new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }),
      fileName,
    );
    return;
  }

  const wb = await buildExcelJsWorkbook(data);
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    fileName,
  );
}
