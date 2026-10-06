import type { PdfTemplateImpartire, PdfTemplateSetari } from "@/lib/pdfTemplate";

export type PdfDayPart = {
  /** 0-based index */
  index: number;
  /** inclusive day numbers (1..daysInMonth) */
  from: number;
  to: number;
};

/** Preset taieturi pentru 2 / 3 părți (ultima zi a fiecărei părți, fără ultima). */
export function presetTaieturi(
  parti: 2 | 3,
  daysInMonth: number,
): number[] {
  if (parti === 2) {
    return [Math.min(15, daysInMonth - 1)];
  }
  const a = Math.min(10, daysInMonth - 2);
  const b = Math.min(20, daysInMonth - 1);
  return a < b ? [a, b] : [Math.floor(daysInMonth / 3), Math.floor((2 * daysInMonth) / 3)];
}

export function resolveTaieturi(
  impartire: PdfTemplateImpartire,
  daysInMonth: number,
): number[] {
  if (impartire.personalizat && impartire.taieturi.length > 0) {
    return impartire.taieturi
      .map((t) => Math.min(daysInMonth - 1, Math.max(1, Math.round(t))))
      .filter((t, i, arr) => arr.indexOf(t) === i)
      .sort((a, b) => a - b)
      .slice(0, 2);
  }
  if (impartire.parti === 1) return [];
  return presetTaieturi(impartire.parti as 2 | 3, daysInMonth);
}

/** Intervale [from, to] inclusiv pe baza taieturilor. */
export function buildDayParts(
  daysInMonth: number,
  impartire: PdfTemplateImpartire,
): PdfDayPart[] {
  const n = Math.max(1, daysInMonth);
  const cuts = resolveTaieturi(impartire, n);
  if (cuts.length === 0) {
    return [{ index: 0, from: 1, to: n }];
  }
  const ends = [...cuts, n];
  const parts: PdfDayPart[] = [];
  let start = 1;
  for (let i = 0; i < ends.length; i++) {
    const to = ends[i];
    if (to < start) continue;
    parts.push({ index: parts.length, from: start, to });
    start = to + 1;
  }
  if (parts.length === 0) return [{ index: 0, from: 1, to: n }];
  return parts;
}

export function shouldShowOsd(
  impartire: PdfTemplateImpartire,
  partIndex: number,
  partCount: number,
): boolean {
  if (impartire.osd === "ascunde") return false;
  if (impartire.osd === "fiecare") return true;
  return partIndex === partCount - 1;
}

/** ~30% celule cu text > 5 caractere → sugerează 2 părți. */
export function shouldSuggestTwoParts(
  cells: string[][],
  impartire: PdfTemplateImpartire,
): boolean {
  if (impartire.parti !== 1 || impartire.personalizat) return false;
  let total = 0;
  let long = 0;
  for (const row of cells) {
    for (const c of row) {
      const t = (c ?? "").trim();
      if (!t) continue;
      total++;
      if (t.length > 5) long++;
    }
  }
  if (total < 8) return false;
  return long / total >= 0.3;
}

export const DAY_NAMES_RO = [
  "DUMINICĂ",
  "LUNI",
  "MARȚI",
  "MIERCURI",
  "JOI",
  "VINERI",
  "SÂMBĂTĂ",
] as const;

export function formatDayDate(
  an: number,
  luna: number,
  day: number,
): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(luna).padStart(2, "0");
  return `${dd}/${mm}/${an}`;
}

export function dayNameRo(an: number, luna: number, day: number): string {
  const wd = new Date(an, luna - 1, day).getDay();
  return DAY_NAMES_RO[wd] ?? "";
}

/** Slice rows/days for one part (cells aligned to part days). */
export function slicePartData<
  D extends { day: number },
  R extends { cells: string[]; osd: string },
>(days: D[], rows: R[], part: PdfDayPart) {
  const idxs: number[] = [];
  for (let i = 0; i < days.length; i++) {
    if (days[i].day >= part.from && days[i].day <= part.to) idxs.push(i);
  }
  return {
    days: idxs.map((i) => days[i]),
    rows: rows.map((r) => ({
      ...r,
      cells: idxs.map((i) => r.cells[i] ?? ""),
    })),
  };
}

export function effectivePartiCount(setari: PdfTemplateSetari, daysInMonth: number) {
  return buildDayParts(daysInMonth, setari.impartire).length;
}
