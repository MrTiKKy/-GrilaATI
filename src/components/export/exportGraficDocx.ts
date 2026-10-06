import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { splitCellDisplayLines } from "@/lib/cellText";
import { mergeGraficFooter } from "@/lib/graficFooter";
import { GRAFIC_FONT_DOCX } from "@/lib/graficTypography";
import type { GraficSnapshot } from "@/lib/types";
import { downloadBlob } from "./downloadBlob";

const THIN = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: "000000",
};

const BORDERS = {
  top: THIN,
  bottom: THIN,
  left: THIN,
  right: THIN,
};

function cellFontForLines(lines: string[], base: number): number {
  const longest = Math.max(...lines.map((l) => l.length), 1);
  if (longest > 9) return Math.max(10, base - 4);
  if (longest > 5) return Math.max(12, base - 2);
  return base;
}

function cell(
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    width: number;
    weekend?: boolean;
    center?: boolean;
    borders?: typeof BORDERS;
    columnSpan?: number;
    fontSize?: number;
    /** Rupe pe max 2 rânduri + micșorează fontul pentru valori lungi */
    scheduleValue?: boolean;
  },
) {
  const lines = opts.scheduleValue
    ? [...splitCellDisplayLines(text)]
    : [text];
  const fontSize = opts.scheduleValue
    ? cellFontForLines(lines, opts.fontSize ?? GRAFIC_FONT_DOCX.cell)
    : (opts.fontSize ?? GRAFIC_FONT_DOCX.cell);

  return new TableCell({
    borders: opts.borders ?? BORDERS,
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.columnSpan,
    shading: opts.weekend ? { fill: "D9D9D9" } : undefined,
    children: lines.map(
      (line, i) =>
        new Paragraph({
          alignment:
            opts.center === false ? AlignmentType.LEFT : AlignmentType.CENTER,
          spacing: {
            before: 0,
            after: 0,
            line: lines.length > 1 ? 200 : 240,
          },
          children: [
            new TextRun({
              text: line || (i === 0 ? "" : ""),
              bold: opts.bold,
              italics: opts.italic,
              size: fontSize,
              font: "Times New Roman",
            }),
          ],
        }),
    ),
  });
}

export async function downloadGraficDocx(
  data: GraficSnapshot,
  fileName: string,
) {
  const footer = mergeGraficFooter(data.footer);
  const dayCount = data.days.length;
  const osdLabel = data.labels?.osd?.trim() || "O.SD";
  const totalWidth = 15700;
  const nameW = 1800;
  const osdW = 700;
  const dayW = Math.max(
    280,
    Math.floor((totalWidth - nameW - osdW) / Math.max(dayCount, 1)),
  );
  const daysPlusOsdW = dayW * dayCount + osdW;

  const headerDayNums = new TableRow({
    children: [
      cell(" ", { bold: true, width: nameW, fontSize: GRAFIC_FONT_DOCX.header }),
      ...data.days.map((d) =>
        cell(String(d.day), {
          bold: true,
          width: dayW,
          weekend: d.weekend,
          fontSize: GRAFIC_FONT_DOCX.header,
        }),
      ),
      cell(osdLabel, {
        bold: true,
        width: osdW,
        fontSize: GRAFIC_FONT_DOCX.abbr,
      }),
    ],
  });

  const headerAbbrs = new TableRow({
    children: [
      cell(" ", { bold: true, width: nameW, fontSize: GRAFIC_FONT_DOCX.abbr }),
      ...data.days.map((d) =>
        cell(d.abbr, {
          bold: true,
          width: dayW,
          weekend: d.weekend,
          fontSize: GRAFIC_FONT_DOCX.abbr,
        }),
      ),
      cell(" ", { width: osdW, fontSize: GRAFIC_FONT_DOCX.abbr }),
    ],
  });

  const bodyRows = data.rows.map(
    (row) =>
      new TableRow({
        children: [
          cell(row.name, {
            bold: true,
            width: nameW,
            center: false,
            fontSize: GRAFIC_FONT_DOCX.name,
          }),
          ...data.days.map((d, i) =>
            cell(row.cells[i] ?? "", {
              width: dayW,
              weekend: d.weekend,
              fontSize: GRAFIC_FONT_DOCX.cell,
              scheduleValue: true,
            }),
          ),
          cell(row.osd || "", {
            width: osdW,
            fontSize: GRAFIC_FONT_DOCX.cell,
          }),
        ],
      }),
  );

  const emptyRows = [0, 1].map(
    () =>
      new TableRow({
        children: [
          cell(" ", { width: nameW, center: false }),
          ...data.days.map(() => cell(" ", { width: dayW })),
          cell(" ", { width: osdW }),
        ],
      }),
  );

  const delegatRow = new TableRow({
    children: [
      cell(footer.delegatName, {
        bold: true,
        width: nameW,
        center: false,
        fontSize: GRAFIC_FONT_DOCX.name,
      }),
      new TableCell({
        borders: {
          top: THIN,
          bottom: THIN,
          left: THIN,
          right: THIN,
        },
        width: { size: daysPlusOsdW, type: WidthType.DXA },
        columnSpan: dayCount + 1,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: footer.delegatLabel,
                size: GRAFIC_FONT_DOCX.cell,
                font: "Times New Roman",
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: 360,
              bottom: 360,
              left: 360,
              right: 360,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: data.title,
                bold: true,
                size: GRAFIC_FONT_DOCX.title,
                font: "Times New Roman",
              }),
            ],
          }),
          new Table({
            width: {
              size: nameW + dayW * dayCount + osdW,
              type: WidthType.DXA,
            },
            rows: [
              headerDayNums,
              headerAbbrs,
              ...bodyRows,
              ...emptyRows,
              delegatRow,
            ],
          }),
          new Paragraph({ spacing: { before: 200 }, children: [] }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: footer.medicSef,
                italics: true,
                size: GRAFIC_FONT_DOCX.footer,
                font: "Times New Roman",
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: footer.asSef,
                italics: true,
                size: GRAFIC_FONT_DOCX.footer,
                font: "Times New Roman",
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, fileName);
}
