import {
  Document,
  Page,
  Text,
  View,
  Font,
} from "@react-pdf/renderer";
import {
  PDF_CELL_FONT_MIN,
  PDF_CHAR_RATIO,
  layoutPdfCellText,
  pdfDesiredDayWidth,
  estimatePdfTextWidth,
} from "@/lib/cellText";
import {
  GRAFIC_FOOTER_DEFAULTS,
  mergeGraficFooter,
  type GraficFooterTexts,
} from "@/lib/graficFooter";
import {
  DEFAULT_PDF_TEMPLATE,
  a4SizePt,
  applyPdfTemplateVars,
  mmToPt,
  type PdfTemplateSetari,
  type PdfTemplateVars,
} from "@/lib/pdfTemplate";
import {
  buildDayParts,
  slicePartData,
  shouldShowOsd,
  dayNameRo,
  formatDayDate,
} from "@/lib/pdfSplit";

/* ======================================================================== */
/*  Public types                                                             */
/* ======================================================================== */

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
  /** Template salvat sau DEFAULT — lipsa = DEFAULT (identic cu formatul inițial) */
  template?: PdfTemplateSetari;
  /** Pentru {luna} {an} {categorie} {workspace} în titlu/casete */
  templateVars?: PdfTemplateVars;
};

/* ======================================================================== */
/*  Constants                                                                */
/* ======================================================================== */

const FONT_FAMILY = "GraficSerif";
const HINT_H = 10;
const HEADER_RATIO = 12 / 14;
const ABBR_RATIO = 11 / 14;
const STAFF_2_RATIO = 20 / 14;
const EMPTY_RATIO = 1;
const DELEGAT_RATIO = 16 / 14;
const OSD_W_BASE = 30;
const NAME_MIN_ABS = 58;
const CELL_PAD_X = 1.5;

/* ======================================================================== */
/*  Font registration                                                        */
/* ======================================================================== */

let fontsRegistered = false;

export function registerGraficPdfFonts(origin: string) {
  Font.registerHyphenationCallback((word) => [word]);
  if (fontsRegistered) return;
  const base = `${origin.replace(/\/$/, "")}/fonts`;
  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: `${base}/DejaVuSerif.ttf`, fontWeight: "normal", fontStyle: "normal" },
      { src: `${base}/DejaVuSerif-Bold.ttf`, fontWeight: "bold", fontStyle: "normal" },
      { src: `${base}/DejaVuSerif-Italic.ttf`, fontWeight: "normal", fontStyle: "italic" },
      {
        src: `${base}/DejaVuSerif-BoldItalic.ttf`,
        fontWeight: "bold",
        fontStyle: "italic",
      },
    ],
  });
  fontsRegistered = true;
}

/* ======================================================================== */
/*  Internal types                                                           */
/* ======================================================================== */

type ColLayout = {
  nameW: number;
  dayWs: number[];
  osdW: number;
  contentW: number;
};

type ResolvedLayout = {
  pageW: number;
  pageH: number;
  padTop: number;
  padBottom: number;
  padLeft: number;
  padRight: number;
  scale: number;
  cellFont: number;
  cellFontMin: number;
  headerH: number;
  abbrH: number;
  staffH1: number;
  staffH2: number;
  emptyH: number;
  delegatH: number;
  borderW: number;
  weekendColor: string;
  headerBold: boolean;
  celuleLungi: PdfTemplateSetari["tabel"]["celule_lungi"];
  dayMin: number;
  dayMax: number;
  nameRatio: number;
  compact: boolean;
};

type PartInfo = {
  index: number;
  days: GraficPdfDay[];
  rows: GraficPdfRow[];
  cols: ColLayout;
  showOsd: boolean;
  nameFont: number;
  an: number;
  luna: number;
  antetStil: "clasic" | "detaliat";
};

type PagePartSlot = {
  info: PartInfo;
  staffRows: GraficPdfRow[];
  addTrailing: boolean;
};

type PDFPageModel = {
  globalIdx: number;
  totalPages: number;
  showTitle: boolean;
  titleText: string;
  showFooter: boolean;
  contentTopPt: number;
  slots: PagePartSlot[];
};

/* ======================================================================== */
/*  Layout helpers (preserved from original)                                 */
/* ======================================================================== */

function resolveLayout(t: PdfTemplateSetari): ResolvedLayout {
  const { w: pageW, h: pageH } = a4SizePt(t.pagina.orientare);
  const scale = t.tabel.scara / 100;
  const staffH1 = t.tabel.inaltime_rand * scale;
  return {
    pageW,
    pageH,
    padTop: mmToPt(t.pagina.margini.top),
    padBottom: mmToPt(t.pagina.margini.bottom),
    padLeft: mmToPt(t.pagina.margini.left),
    padRight: mmToPt(t.pagina.margini.right),
    scale,
    cellFont: t.tabel.font_pt * scale,
    cellFontMin: PDF_CELL_FONT_MIN * scale,
    headerH: staffH1 * HEADER_RATIO,
    abbrH: staffH1 * ABBR_RATIO,
    staffH1,
    staffH2: t.tabel.inaltime_rand * STAFF_2_RATIO * scale,
    emptyH: t.tabel.inaltime_rand * EMPTY_RATIO * scale,
    delegatH: t.tabel.inaltime_rand * DELEGAT_RATIO * scale,
    borderW: t.tabel.grosime_linii,
    weekendColor: t.tabel.culoare_weekend,
    headerBold: t.tabel.font_antet_bold,
    celuleLungi: t.tabel.celule_lungi,
    dayMin: t.tabel.latime_zi_min * scale,
    dayMax: t.tabel.latime_zi_max * scale,
    nameRatio: t.tabel.latime_nume / 100,
    compact: t.pagina.tabel_compact,
  };
}

function desiredDayWidth(
  values: string[],
  baseDayW: number,
  dayMax: number,
  cellFont: number,
  mode: PdfTemplateSetari["tabel"]["celule_lungi"],
): number {
  if (mode === "micsoreaza") return baseDayW;
  if (mode === "lateste") {
    let need = baseDayW;
    for (const v of values) {
      const raw = v?.trim();
      if (!raw) continue;
      need = Math.max(
        need,
        Math.min(dayMax, estimatePdfTextWidth(raw.length, cellFont)),
      );
    }
    return need;
  }
  return pdfDesiredDayWidth(values, baseDayW, dayMax, cellFont);
}

function computeColumnWidths(
  dayCount: number,
  dayValues: string[][],
  layout: ResolvedLayout,
  tableWidthPct = 100,
  showOsd = true,
): ColLayout {
  const contentW =
    (layout.pageW * Math.min(100, Math.max(10, tableWidthPct))) / 100;
  const osdW = showOsd ? OSD_W_BASE * layout.scale : 0;
  let nameW = Math.min(contentW * layout.nameRatio, 118 * layout.scale);
  nameW = Math.max(NAME_MIN_ABS * Math.min(1, layout.scale), nameW);

  let dayBudget = contentW - nameW - osdW;
  const baseDay = dayBudget / Math.max(dayCount, 1);

  const desired = Array.from({ length: dayCount }, (_, i) =>
    desiredDayWidth(
      dayValues[i] ?? [],
      baseDay,
      layout.dayMax,
      layout.cellFont,
      layout.celuleLungi,
    ),
  );

  let dayWs = desired.map((d) =>
    Math.max(layout.dayMin, Math.min(layout.dayMax, d)),
  );
  let total = dayWs.reduce((a, b) => a + b, 0);

  if (total > dayBudget + 0.01) {
    let overflow = total - dayBudget;
    const shortIdx = dayWs
      .map((w, i) => ({ w, i }))
      .filter((x) => x.w <= baseDay + 0.01)
      .sort((a, b) => b.w - a.w);
    for (const s of shortIdx) {
      if (overflow <= 0) break;
      const canGive = Math.max(0, dayWs[s.i] - layout.dayMin);
      const take = Math.min(canGive, overflow);
      dayWs[s.i] -= take;
      overflow -= take;
    }
    total = dayWs.reduce((a, b) => a + b, 0);
    overflow = total - dayBudget;
    if (overflow > 0.01) {
      const nameMin = NAME_MIN_ABS * Math.min(1, layout.scale);
      const take = Math.min(Math.max(0, nameW - nameMin), overflow);
      nameW -= take;
      dayBudget = contentW - nameW - osdW;
      overflow -= take;
    }
    total = dayWs.reduce((a, b) => a + b, 0);
    if (total > dayBudget + 0.01) {
      const sc = dayBudget / total;
      dayWs = dayWs.map((w) => Math.max(layout.dayMin, w * sc));
      const sum2 = dayWs.reduce((a, b) => a + b, 0);
      const diff = dayBudget - sum2;
      if (Math.abs(diff) > 0.01 && dayWs.length > 0) {
        dayWs[dayWs.length - 1] = Math.max(
          layout.dayMin,
          dayWs[dayWs.length - 1] + diff,
        );
      }
    }
  } else if (total < dayBudget - 0.01) {
    nameW += dayBudget - total;
  }

  return { nameW, dayWs, osdW, contentW };
}

function layoutCell(
  text: string,
  widthPt: number,
  layout: ResolvedLayout,
) {
  const usable = widthPt - CELL_PAD_X * 2;
  if (layout.celuleLungi === "micsoreaza") {
    const raw = text.trim();
    if (!raw) {
      return { lines: [""], fontSize: layout.cellFont, lineCount: 1 as const };
    }
    let fontSize = layout.cellFont;
    if (estimatePdfTextWidth(raw.length, fontSize) > usable) {
      fontSize = Math.max(
        layout.cellFontMin,
        Math.min(layout.cellFont, (usable - 1) / (raw.length * PDF_CHAR_RATIO)),
      );
    }
    if (estimatePdfTextWidth(raw.length, fontSize) > usable + 0.25) {
      const maxChars = Math.max(
        1,
        Math.floor((usable - 1) / (fontSize * PDF_CHAR_RATIO)),
      );
      return {
        lines: [
          raw.length > maxChars
            ? `${raw.slice(0, Math.max(1, maxChars - 1))}\u2026`
            : raw,
        ],
        fontSize,
        lineCount: 1 as const,
      };
    }
    return { lines: [raw], fontSize, lineCount: 1 as const };
  }
  if (layout.celuleLungi === "lateste") {
    return layoutPdfCellText(text, usable, layout.cellFont, layout.cellFontMin);
  }
  return layoutPdfCellText(text, usable, layout.cellFont, layout.cellFontMin);
}

function staffRowHeight(
  row: GraficPdfRow,
  dayWs: number[],
  layout: ResolvedLayout,
): number {
  if (!layout.compact) return layout.staffH1;
  for (let i = 0; i < dayWs.length; i++) {
    const val = row.cells[i] ?? "";
    if (!val.trim()) continue;
    const cell = layoutCell(val, dayWs[i], layout);
    if (cell.lineCount === 2) return layout.staffH2;
  }
  return layout.staffH1;
}

/**
 * Pack staff rows into sub-pages within one part.
 * @param contentH — total height available on each page for the table area
 * @param addTrailing — reserve space for empty + delegat rows on the last page
 */
function packPages(
  rows: GraficPdfRow[],
  dayWs: number[],
  layout: ResolvedLayout,
  contentH: number,
  addTrailing: boolean,
): GraficPdfRow[][] {
  if (rows.length === 0) return [[]];
  const pages: GraficPdfRow[][] = [];
  let i = 0;

  while (i < rows.length) {
    const remaining = rows.slice(i);
    const headerBlock = layout.headerH + layout.abbrH;
    const hint = pages.length > 0 || remaining.length > 12 ? HINT_H : 0;

    if (!layout.compact) {
      const trailingH = addTrailing ? layout.emptyH + layout.delegatH : 0;
      const withTrailing = contentH - hint - headerBlock - trailingH;
      const withoutTrailing = contentH - hint - headerBlock;
      const nLeft = remaining.length;
      const rowHTry = withTrailing / (nLeft + (addTrailing ? 1 : 0));
      if (rowHTry >= layout.staffH1 * 0.7) {
        pages.push(remaining);
        break;
      }
      const maxRows = Math.max(
        1,
        Math.floor(withoutTrailing / layout.staffH1),
      );
      pages.push(remaining.slice(0, maxRows));
      i += maxRows;
      continue;
    }

    const trailingH = addTrailing ? layout.emptyH + layout.delegatH : 0;
    const withTrailingBudget = contentH - hint - headerBlock - trailingH;
    const withoutTrailingBudget = contentH - hint - headerBlock;

    let used = 0;
    let canAll = true;
    for (const row of remaining) {
      const h = staffRowHeight(row, dayWs, layout);
      if (used + h > withTrailingBudget + 0.01) {
        canAll = false;
        break;
      }
      used += h;
    }
    if (canAll) {
      pages.push(remaining);
      break;
    }

    const page: GraficPdfRow[] = [];
    used = 0;
    while (i < rows.length) {
      const h = staffRowHeight(rows[i], dayWs, layout);
      if (page.length > 0 && used + h > withoutTrailingBudget + 0.01) break;
      if (page.length === 0 && h > withoutTrailingBudget) {
        page.push(rows[i]);
        i += 1;
        break;
      }
      page.push(rows[i]);
      used += h;
      i += 1;
    }
    pages.push(page);
  }
  return pages.length ? pages : [[]];
}

function nameFontForWidth(
  names: string[],
  nameW: number,
  scale: number,
): number {
  const maxLen = Math.max(1, ...names.map((n) => n.trim().length || 1));
  const fitted = (nameW - 4) / (maxLen * PDF_CHAR_RATIO);
  return Math.min(8.5 * scale, Math.max(5.5 * scale, fitted));
}

function alignCss(a: "left" | "center" | "right") {
  return a === "left" ? "left" : a === "right" ? "right" : "center";
}

/* ======================================================================== */
/*  Part builder                                                             */
/* ======================================================================== */

function buildPartInfos(
  data: GraficPdfData,
  template: PdfTemplateSetari,
  layout: ResolvedLayout,
  vars: PdfTemplateVars,
  delegatName: string,
): PartInfo[] {
  const parts = buildDayParts(data.days.length, template.impartire);
  const partCount = parts.length;
  const an = Number(vars.an) || new Date().getFullYear();
  const luna = vars.lunaNum ?? 1;
  const antetStil = template.impartire.antet_stil;

  return parts.map((part) => {
    const sliced = slicePartData(data.days, data.rows, part);
    const showOsd = shouldShowOsd(template.impartire, part.index, partCount);
    const dayCount = sliced.days.length;
    const dayValues = Array.from({ length: dayCount }, (_, d) =>
      sliced.rows.map((r) => r.cells[d] ?? ""),
    );
    const cols = computeColumnWidths(
      dayCount,
      dayValues,
      layout,
      template.tabel.latime,
      showOsd,
    );
    const nf = nameFontForWidth(
      [...sliced.rows.map((r) => r.name), delegatName],
      cols.nameW,
      layout.scale,
    );
    return {
      index: part.index,
      days: sliced.days,
      rows: sliced.rows,
      cols,
      showOsd,
      nameFont: nf,
      an,
      luna,
      antetStil,
    };
  });
}

/* ======================================================================== */
/*  Compact height of a part table (for aceeasi_pagina assignment)           */
/* ======================================================================== */

function partCompactH(
  part: PartInfo,
  layout: ResolvedLayout,
  addTrailing: boolean,
): number {
  const headerH = layout.headerH + layout.abbrH;
  let staffH: number;
  if (layout.compact) {
    staffH = 0;
    for (const row of part.rows) {
      staffH += staffRowHeight(row, part.cols.dayWs, layout);
    }
  } else {
    staffH = part.rows.length * layout.staffH1;
  }
  const trailing = addTrailing ? layout.emptyH + layout.delegatH : 0;
  return headerH + staffH + trailing;
}

/* ======================================================================== */
/*  Page building — pagini_noi                                               */
/* ======================================================================== */

function buildPaginiNoiPages(
  parts: PartInfo[],
  layout: ResolvedLayout,
  template: PdfTemplateSetari,
  titleText: string,
): PDFPageModel[] {
  const tabelTopPt = (layout.pageH * template.tabel.y) / 100;
  const contentH = layout.pageH - tabelTopPt - layout.padBottom;
  const allPages: PDFPageModel[] = [];

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const isLastPart = pi === parts.length - 1;
    const staffPages = packPages(
      part.rows,
      part.cols.dayWs,
      layout,
      contentH,
      isLastPart,
    );
    const suffix =
      parts.length > 1 ? ` (${pi + 1}/${parts.length})` : "";

    for (let sp = 0; sp < staffPages.length; sp++) {
      const isLastSp = sp === staffPages.length - 1;
      allPages.push({
        globalIdx: allPages.length,
        totalPages: 0,
        showTitle: true,
        titleText: titleText + suffix,
        showFooter: isLastPart && isLastSp,
        contentTopPt: tabelTopPt,
        slots: [
          {
            info: part,
            staffRows: staffPages[sp],
            addTrailing: isLastPart && isLastSp,
          },
        ],
      });
    }
  }

  for (const p of allPages) p.totalPages = allPages.length;
  return allPages;
}

/* ======================================================================== */
/*  Page building — aceeasi_pagina                                           */
/* ======================================================================== */

function buildAceeasiPaginaPages(
  parts: PartInfo[],
  layout: ResolvedLayout,
  template: PdfTemplateSetari,
  titleText: string,
): PDFPageModel[] {
  const tabelTopPt = (layout.pageH * template.tabel.y) / 100;
  const spacerH = mmToPt(template.impartire.spatiu_mm);
  const firstPageAvail =
    layout.pageH - tabelTopPt - layout.padBottom - HINT_H;
  const contPageAvail =
    layout.pageH - layout.padTop - layout.padBottom - HINT_H;

  const allPages: PDFPageModel[] = [];
  let currentSlots: PagePartSlot[] = [];
  let usedH = 0;
  let isFirstPage = true;

  function flushPage(showFooter: boolean) {
    if (currentSlots.length === 0) return;
    allPages.push({
      globalIdx: allPages.length,
      totalPages: 0,
      showTitle: isFirstPage,
      titleText,
      showFooter,
      contentTopPt: isFirstPage ? tabelTopPt : layout.padTop,
      slots: currentSlots,
    });
    isFirstPage = false;
    currentSlots = [];
    usedH = 0;
  }

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    const isLastPart = pi === parts.length - 1;
    const tblH = partCompactH(part, layout, isLastPart);
    const pageAvail = isFirstPage ? firstPageAvail : contPageAvail;
    const spacer = currentSlots.length > 0 ? spacerH : 0;

    if (usedH + spacer + tblH <= pageAvail + 0.01) {
      currentSlots.push({
        info: part,
        staffRows: part.rows,
        addTrailing: isLastPart,
      });
      usedH += spacer + tblH;
    } else if (tblH <= contPageAvail + 0.01) {
      flushPage(false);
      currentSlots = [
        { info: part, staffRows: part.rows, addTrailing: isLastPart },
      ];
      usedH = tblH;
    } else {
      flushPage(false);
      const packH = contPageAvail;
      const staffPages = packPages(
        part.rows,
        part.cols.dayWs,
        layout,
        packH,
        isLastPart,
      );
      for (let sp = 0; sp < staffPages.length; sp++) {
        const isLastSp = sp === staffPages.length - 1;
        allPages.push({
          globalIdx: allPages.length,
          totalPages: 0,
          showTitle: isFirstPage,
          titleText,
          showFooter: isLastPart && isLastSp,
          contentTopPt: isFirstPage ? tabelTopPt : layout.padTop,
          slots: [
            {
              info: part,
              staffRows: staffPages[sp],
              addTrailing: isLastPart && isLastSp,
            },
          ],
        });
        isFirstPage = false;
      }
    }
  }

  const hasLastPart = currentSlots.some(
    (s) => s.info.index === parts.length - 1,
  );
  flushPage(hasLastPart);

  for (const p of allPages) p.totalPages = allPages.length;
  return allPages;
}

/* ======================================================================== */
/*  Stretch row height (non-compact mode)                                    */
/* ======================================================================== */

function computeStretchH(
  page: PDFPageModel,
  layout: ResolvedLayout,
  spacerH: number,
): number | null {
  if (layout.compact) return null;
  const availH = layout.pageH - page.contentTopPt - layout.padBottom;
  const hintH = page.totalPages > 1 ? HINT_H : 0;
  const numSlots = page.slots.length;
  const headersH = numSlots * (layout.headerH + layout.abbrH);
  const spacersH = Math.max(0, numSlots - 1) * spacerH;
  let trailingH = 0;
  let totalStaff = 0;
  for (const slot of page.slots) {
    if (slot.addTrailing) trailingH += layout.emptyH + layout.delegatH;
    totalStaff += slot.staffRows.length;
  }
  if (totalStaff === 0) return layout.staffH1;
  const staffBudget = availH - hintH - headersH - spacersH - trailingH;
  return Math.max(layout.staffH1 * 0.75, staffBudget / totalStaff);
}

/* ======================================================================== */
/*  Main component                                                           */
/* ======================================================================== */

export function GraficAtiPdfTemplated({ data }: { data: GraficPdfData }) {
  const template = data.template ?? DEFAULT_PDF_TEMPLATE;
  const layout = resolveLayout(template);
  const footer = mergeGraficFooter(data.footer ?? GRAFIC_FOOTER_DEFAULTS);
  const osdLabel = data.labels?.osd?.trim() || "O.SD";
  const pageHintTpl =
    data.labels?.pageHint?.trim() || "Pagina {page} / {total}";
  const vars = data.templateVars ?? {};

  const titleText = template.titlu.afisat
    ? template.titlu.text.trim()
      ? applyPdfTemplateVars(template.titlu.text, vars)
      : data.title
    : "";

  const partInfos = buildPartInfos(
    data,
    template,
    layout,
    vars,
    footer.delegatName,
  );
  const partCount = partInfos.length;
  const headerFont = 7.5 * layout.scale;

  const pages: PDFPageModel[] =
    partCount <= 1 || template.impartire.asezare === "pagini_noi"
      ? buildPaginiNoiPages(partInfos, layout, template, titleText)
      : buildAceeasiPaginaPages(partInfos, layout, template, titleText);

  const bw = layout.borderW;
  const weekendBg = layout.weekendColor;
  const spacerH = mmToPt(template.impartire.spatiu_mm);

  const absBox = (x: number, y: number, latime: number) => ({
    position: "absolute" as const,
    left: (layout.pageW * x) / 100,
    top: (layout.pageH * y) / 100,
    width: (layout.pageW * latime) / 100,
  });

  function cellBox(
    width: number,
    height: number,
    weekend?: boolean,
    extra?: Record<string, unknown>,
  ) {
    return {
      width,
      height,
      borderRightWidth: bw,
      borderBottomWidth: bw,
      borderColor: "#000",
      alignItems: "center" as const,
      justifyContent: "center" as const,
      paddingHorizontal: CELL_PAD_X,
      backgroundColor: weekend ? weekendBg : undefined,
      ...extra,
    };
  }

  function headerFontForText(text: string, colW: number): number {
    const usable = colW - CELL_PAD_X * 2 - 1;
    const fitted = usable / (Math.max(1, text.length) * PDF_CHAR_RATIO);
    return Math.min(headerFont, Math.max(4 * layout.scale, fitted));
  }

  return (
    <Document
      title={data.title}
      author="Grila ATI"
      subject="Grafic asisten\u021bi ATI"
    >
      {pages.map((page) => {
        const hasHint = page.totalPages > 1;
        const pageHint = pageHintTpl
          .replace(/\{page\}/g, String(page.globalIdx + 1))
          .replace(/\{total\}/g, String(page.totalPages));
        const stretchH = computeStretchH(page, layout, spacerH);
        const tabelLeftPt = (layout.pageW * template.tabel.x) / 100;
        const tabelWidthPt =
          (layout.pageW * template.tabel.latime) / 100;

        return (
          <Page
            key={`page-${page.globalIdx}`}
            size="A4"
            orientation={template.pagina.orientare}
            style={{
              paddingTop: 0,
              paddingBottom: 0,
              paddingLeft: 0,
              paddingRight: 0,
              fontFamily: FONT_FAMILY,
              fontSize: layout.cellFont,
              color: "#000",
              position: "relative",
            }}
            wrap={false}
          >
            {/* Title (absolute) */}
            {page.showTitle && template.titlu.afisat && page.titleText ? (
              <View
                style={absBox(
                  template.titlu.x,
                  template.titlu.y,
                  template.titlu.latime,
                )}
              >
                <Text
                  style={{
                    fontFamily: FONT_FAMILY,
                    fontWeight: template.titlu.bold ? "bold" : "normal",
                    fontSize: template.titlu.marime * layout.scale,
                    textAlign: alignCss(template.titlu.aliniere),
                    textTransform: "uppercase",
                  }}
                >
                  {page.titleText}
                </Text>
              </View>
            ) : null}

            {/* Page hint */}
            {hasHint && (
              <Text
                style={{
                  position: "absolute",
                  right:
                    (layout.pageW *
                      (100 - template.tabel.x - template.tabel.latime)) /
                    100,
                  top: Math.max(2, page.contentTopPt - HINT_H),
                  fontFamily: FONT_FAMILY,
                  fontSize: 7 * layout.scale,
                  textAlign: "right",
                  color: "#333",
                }}
              >
                {pageHint}
              </Text>
            )}

            {/* Content area — part tables flow vertically */}
            <View
              style={{
                position: "absolute",
                left: tabelLeftPt,
                top: page.contentTopPt,
                width: tabelWidthPt,
              }}
            >
              {page.slots.map((slot, si) => {
                const { info, staffRows, addTrailing } = slot;
                const { days, cols, showOsd } = info;
                return (
                  <View key={`slot-${si}-p${info.index}`}>
                    {si > 0 && <View style={{ height: spacerH }} />}

                    <View
                      style={{
                        borderTopWidth: bw,
                        borderLeftWidth: bw,
                        borderColor: "#000",
                      }}
                    >
                      {/* Header row 1 */}
                      <View
                        style={{
                          flexDirection: "row",
                          height: layout.headerH,
                        }}
                      >
                        <View
                          style={cellBox(cols.nameW, layout.headerH, false, {
                            alignItems: "flex-start" as const,
                          })}
                        />
                        {days.map((d, i) => {
                          const hText =
                            info.antetStil === "detaliat"
                              ? dayNameRo(info.an, info.luna, d.day)
                              : String(d.day);
                          const hFs =
                            info.antetStil === "detaliat"
                              ? headerFontForText(hText, cols.dayWs[i])
                              : headerFont;
                          return (
                            <View
                              key={`n-${d.day}`}
                              style={cellBox(
                                cols.dayWs[i],
                                layout.headerH,
                                d.weekend,
                              )}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontWeight: layout.headerBold
                                    ? "bold"
                                    : "normal",
                                  fontSize: hFs,
                                  textAlign: "center",
                                }}
                              >
                                {hText}
                              </Text>
                            </View>
                          );
                        })}
                        {showOsd && (
                          <View
                            style={cellBox(
                              cols.osdW,
                              layout.headerH,
                              false,
                            )}
                          >
                            <Text
                              style={{
                                fontFamily: FONT_FAMILY,
                                fontWeight: layout.headerBold
                                  ? "bold"
                                  : "normal",
                                fontSize: headerFont - 0.5,
                                textAlign: "center",
                              }}
                            >
                              {osdLabel}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Header row 2 */}
                      <View
                        style={{
                          flexDirection: "row",
                          height: layout.abbrH,
                        }}
                      >
                        <View
                          style={cellBox(cols.nameW, layout.abbrH, false, {
                            alignItems: "flex-start" as const,
                          })}
                        />
                        {days.map((d, i) => {
                          const aText =
                            info.antetStil === "detaliat"
                              ? formatDayDate(info.an, info.luna, d.day)
                              : d.abbr;
                          const aFs =
                            info.antetStil === "detaliat"
                              ? headerFontForText(aText, cols.dayWs[i])
                              : headerFont - 1;
                          return (
                            <View
                              key={`a-${d.day}`}
                              style={cellBox(
                                cols.dayWs[i],
                                layout.abbrH,
                                d.weekend,
                              )}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontWeight: layout.headerBold
                                    ? "bold"
                                    : "normal",
                                  fontSize: aFs,
                                  textAlign: "center",
                                }}
                              >
                                {aText}
                              </Text>
                            </View>
                          );
                        })}
                        {showOsd && (
                          <View
                            style={cellBox(cols.osdW, layout.abbrH, false)}
                          />
                        )}
                      </View>

                      {/* Staff rows */}
                      {staffRows.map((row, idx) => {
                        const rowH =
                          stretchH ??
                          staffRowHeight(row, cols.dayWs, layout);
                        return (
                          <View
                            key={`r-${si}-${idx}`}
                            style={{
                              flexDirection: "row",
                              height: rowH,
                            }}
                            wrap={false}
                          >
                            <View
                              style={cellBox(cols.nameW, rowH, false, {
                                alignItems: "flex-start" as const,
                                paddingHorizontal: 3,
                              })}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontSize: info.nameFont,
                                  textTransform: "uppercase",
                                  textAlign: "left",
                                }}
                              >
                                {row.name}
                              </Text>
                            </View>
                            {days.map((d, i) => {
                              const value = row.cells[i] ?? "";
                              const cell = layoutCell(
                                value,
                                cols.dayWs[i],
                                layout,
                              );
                              return (
                                <View
                                  key={`c-${si}-${idx}-${d.day}`}
                                  style={cellBox(
                                    cols.dayWs[i],
                                    rowH,
                                    d.weekend,
                                  )}
                                >
                                  <Text
                                    style={{
                                      fontFamily: FONT_FAMILY,
                                      fontWeight: "normal",
                                      fontSize: cell.fontSize,
                                      textAlign: "center",
                                      lineHeight:
                                        cell.lineCount === 2
                                          ? 1.05
                                          : 1.1,
                                    }}
                                  >
                                    {cell.lines.join("\n")}
                                  </Text>
                                </View>
                              );
                            })}
                            {showOsd && (
                              <View
                                style={cellBox(cols.osdW, rowH, false)}
                              >
                                <Text
                                  style={{
                                    fontFamily: FONT_FAMILY,
                                    fontSize: layout.cellFont,
                                    textAlign: "center",
                                  }}
                                >
                                  {row.osd || ""}
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}

                      {/* Empty + Delegat trailing rows */}
                      {addTrailing && (
                        <>
                          <View
                            style={{
                              flexDirection: "row",
                              height: layout.emptyH,
                            }}
                            wrap={false}
                          >
                            <View
                              style={cellBox(
                                cols.nameW,
                                layout.emptyH,
                                false,
                              )}
                            />
                            {days.map((d, i) => (
                              <View
                                key={`e-${d.day}`}
                                style={cellBox(
                                  cols.dayWs[i],
                                  layout.emptyH,
                                  d.weekend,
                                )}
                              />
                            ))}
                            {showOsd && (
                              <View
                                style={cellBox(
                                  cols.osdW,
                                  layout.emptyH,
                                  false,
                                )}
                              />
                            )}
                          </View>
                          <View
                            style={{
                              flexDirection: "row",
                              height: layout.delegatH,
                            }}
                            wrap={false}
                          >
                            <View
                              style={cellBox(
                                cols.nameW,
                                layout.delegatH,
                                false,
                                {
                                  alignItems: "flex-start" as const,
                                  paddingHorizontal: 3,
                                },
                              )}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontSize: info.nameFont,
                                  textTransform: "uppercase",
                                  textAlign: "left",
                                }}
                              >
                                {footer.delegatName}
                              </Text>
                            </View>
                            <View
                              style={cellBox(
                                cols.dayWs.reduce((a, b) => a + b, 0) +
                                  cols.osdW,
                                layout.delegatH,
                                false,
                              )}
                            >
                              <Text
                                style={{
                                  fontFamily: FONT_FAMILY,
                                  fontSize: layout.cellFont,
                                  textAlign: "center",
                                }}
                              >
                                {footer.delegatLabel}
                              </Text>
                            </View>
                          </View>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Footer (absolute) */}
            {page.showFooter && template.footer.afisat && (
              <View
                style={{
                  ...absBox(
                    template.footer.x,
                    template.footer.y,
                    template.footer.latime,
                  ),
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View style={{ width: "42%" }}>
                  <Text
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontStyle: "italic",
                      fontSize: template.footer.marime * layout.scale,
                      textTransform: "uppercase",
                      textAlign: alignCss(template.footer.aliniere),
                    }}
                  >
                    {footer.medicSef}
                  </Text>
                </View>
                <View style={{ width: "42%", alignItems: "flex-end" }}>
                  <Text
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontStyle: "italic",
                      fontSize: template.footer.marime * layout.scale,
                      textTransform: "uppercase",
                      textAlign: "right",
                    }}
                  >
                    {footer.asSef}
                  </Text>
                </View>
              </View>
            )}

            {/* Casete text (absolute, on every page) */}
            {template.casete_text.map((c) => {
              if (!c.afisat) return null;
              const label = applyPdfTemplateVars(c.text, vars);
              if (!label.trim()) return null;
              return (
                <View key={c.id} style={absBox(c.x, c.y, c.latime)}>
                  <Text
                    style={{
                      fontFamily: FONT_FAMILY,
                      fontWeight: c.bold ? "bold" : "normal",
                      fontSize: c.marime * layout.scale,
                      textAlign: alignCss(c.aliniere),
                    }}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
}

export const PDF_ROWS_PER_PAGE = 40;
