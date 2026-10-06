/**
 * Text celulă / cod / etichetă: max 20, charset pentru ore + litere.
 * Același plafon ca CHECK `coduri_cod_len` (1..20).
 */

export const CELL_TEXT_MAX = 20;

/** Cifre, litere (inclusiv diacritice), spațiu, : - / * . , */
const CELL_TEXT_ALLOWED = /^[\p{L}\p{N} :\-\/\*\.,]+$/u;

export function normalizeCellText(raw: string): string {
  return raw.trim();
}

/**
 * Validează text liber / etichetă.
 * Returnează textul normalizat, "" dacă e gol, sau null dacă e invalid.
 */
export function parseCellText(raw: string): string | null {
  const trimmed = normalizeCellText(raw);
  if (trimmed.length === 0) return "";
  if (trimmed.length > CELL_TEXT_MAX) return null;
  if (!CELL_TEXT_ALLOWED.test(trimmed)) return null;
  return trimmed;
}

export function cellTextError(raw: string): string | null {
  const trimmed = normalizeCellText(raw);
  if (trimmed.length === 0) return null;
  if (trimmed.length > CELL_TEXT_MAX) {
    return `Maxim ${CELL_TEXT_MAX} caractere`;
  }
  if (!CELL_TEXT_ALLOWED.test(trimmed)) {
    return "Caractere nepermise (litere, cifre, spațiu, : - / * . ,)";
  }
  return null;
}

/** Lățime de bază coloană zi (px) — ~min-w-[2.1rem] la 16px root */
export const DAY_COL_BASE_PX = 34;
export const DAY_COL_MAX_PX = 90;
export const CELL_FONT_BASE = 15;
export const CELL_FONT_MIN = 10;

/**
 * Rupe pe max 2 rânduri la separator natural (- / spațiu),
 * altfel la mijloc. Păstrează separatorul pe primul rând pentru „-”.
 */
export function splitCellDisplayLines(text: string): [string] | [string, string] {
  const t = text.trim();
  if (!t) return [""];
  if (t.length <= 5) return [t];

  for (const sep of ["-", "/", " "]) {
    const idx = t.indexOf(sep);
    if (idx > 0 && idx < t.length - 1) {
      const left = sep === " " ? t.slice(0, idx) : t.slice(0, idx + 1);
      const right = t.slice(idx + 1).trimStart();
      if (left && right) return [left, right];
    }
  }

  const mid = Math.ceil(t.length / 2);
  return [t.slice(0, mid), t.slice(mid)];
}

export type CellLayout = {
  widthPx: number;
  fontSize: number;
  lines: string[];
  truncated: boolean;
  title: string;
};

function estimateWidth(chars: number, fontSize: number): number {
  return chars * fontSize * 0.58 + 8;
}

/** Layout pentru o valoare de celulă (preview / coloană). */
export function layoutCellText(text: string): CellLayout {
  const raw = text.trim();
  if (!raw) {
    return {
      widthPx: DAY_COL_BASE_PX,
      fontSize: CELL_FONT_BASE,
      lines: [""],
      truncated: false,
      title: "",
    };
  }

  const lines = [...splitCellDisplayLines(raw)];
  const longest = Math.max(...lines.map((l) => l.length), 1);

  let fontSize = CELL_FONT_BASE;
  let width = estimateWidth(longest, fontSize);

  if (width <= DAY_COL_BASE_PX) {
    return {
      widthPx: DAY_COL_BASE_PX,
      fontSize,
      lines,
      truncated: false,
      title: raw,
    };
  }

  if (width > DAY_COL_MAX_PX) {
    const target = DAY_COL_MAX_PX - 8;
    fontSize = Math.max(
      CELL_FONT_MIN,
      Math.floor(target / (longest * 0.58)),
    );
    width = DAY_COL_MAX_PX;
    const fits = estimateWidth(longest, fontSize) <= DAY_COL_MAX_PX + 0.5;
    if (!fits) {
      // Truncate each line visually with …
      const maxChars = Math.max(
        1,
        Math.floor((DAY_COL_MAX_PX - 8) / (fontSize * 0.58)),
      );
      const truncatedLines = lines.map((l) =>
        l.length > maxChars ? `${l.slice(0, Math.max(1, maxChars - 1))}…` : l,
      );
      return {
        widthPx: DAY_COL_MAX_PX,
        fontSize,
        lines: truncatedLines,
        truncated: true,
        title: raw,
      };
    }
  }

  return {
    widthPx: Math.min(DAY_COL_MAX_PX, Math.ceil(width)),
    fontSize,
    lines,
    truncated: false,
    title: raw,
  };
}

/** Lățimea necesară pe o coloană dată fiind toate valorile din zi. */
export function columnWidthForValues(values: string[]): number {
  let max = DAY_COL_BASE_PX;
  for (const v of values) {
    if (!v?.trim()) continue;
    max = Math.max(max, layoutCellText(v).widthPx);
  }
  return max;
}

// ---------------------------------------------------------------------------
// PDF layout (pt) — aceleași reguli de rupere / shrink / … ca pe ecran
// ---------------------------------------------------------------------------

export const PDF_CELL_FONT_BASE = 7;
export const PDF_CELL_FONT_MIN = 5.5;
/** Lățime medie caracter DejaVu Serif */
export const PDF_CHAR_RATIO = 0.55;

export function estimatePdfTextWidth(chars: number, fontSize: number): number {
  return chars * fontSize * PDF_CHAR_RATIO + 2.5;
}

export type PdfCellLayout = {
  lines: string[];
  fontSize: number;
  truncated: boolean;
  /** 1 sau 2 — pentru înălțimea rândului */
  lineCount: 1 | 2;
};

/**
 * Încape textul în `cellWidthPt`: 1 linie dacă merge, altfel 2 după separator,
 * apoi font ↓ (min PDF_CELL_FONT_MIN), apoi „…”.
 */
export function layoutPdfCellText(
  text: string,
  cellWidthPt: number,
  baseFont: number = PDF_CELL_FONT_BASE,
  minFont: number = PDF_CELL_FONT_MIN,
): PdfCellLayout {
  const raw = text.trim();
  if (!raw) {
    return { lines: [""], fontSize: baseFont, truncated: false, lineCount: 1 };
  }

  const usable = Math.max(4, cellWidthPt);

  if (estimatePdfTextWidth(raw.length, baseFont) <= usable) {
    return {
      lines: [raw],
      fontSize: baseFont,
      truncated: false,
      lineCount: 1,
    };
  }

  const lines = [...splitCellDisplayLines(raw)];
  let fontSize = baseFont;
  let longest = Math.max(...lines.map((l) => l.length), 1);

  if (estimatePdfTextWidth(longest, fontSize) > usable) {
    fontSize = Math.max(
      minFont,
      Math.min(baseFont, (usable - 1) / (longest * PDF_CHAR_RATIO)),
    );
  }

  if (estimatePdfTextWidth(longest, fontSize) > usable + 0.25) {
    const maxChars = Math.max(
      1,
      Math.floor((usable - 1) / (fontSize * PDF_CHAR_RATIO)),
    );
    const truncatedLines = lines.map((l) =>
      l.length > maxChars ? `${l.slice(0, Math.max(1, maxChars - 1))}…` : l,
    );
    return {
      lines: truncatedLines,
      fontSize,
      truncated: true,
      lineCount: truncatedLines.length > 1 && truncatedLines[1] ? 2 : 1,
    };
  }

  return {
    lines,
    fontSize,
    truncated: false,
    lineCount: lines.length > 1 && lines[1] ? 2 : 1,
  };
}

/** Lățime dorită (pt) pentru o coloană de zi, la font de bază, cu rupere pe 2. */
export function pdfDesiredDayWidth(
  values: string[],
  baseDayW: number,
  maxDayW: number,
  baseFont: number = PDF_CELL_FONT_BASE,
): number {
  let need = baseDayW;
  for (const v of values) {
    const raw = v?.trim();
    if (!raw) continue;
    if (estimatePdfTextWidth(raw.length, baseFont) <= baseDayW) continue;
    const lines = [...splitCellDisplayLines(raw)];
    const longest = Math.max(...lines.map((l) => l.length), 1);
    need = Math.max(
      need,
      Math.min(maxDayW, estimatePdfTextWidth(longest, baseFont)),
    );
  }
  return need;
}
