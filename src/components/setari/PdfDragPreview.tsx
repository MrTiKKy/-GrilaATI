"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  a4SizePt,
  applyPdfTemplateVars,
  PDF_TABEL_SCARA_MAX,
  PDF_TABEL_SCARA_MIN,
  tabelLatimeEfectiva,
  type PdfTemplateSetari,
  type PdfTemplateVars,
} from "@/lib/pdfTemplate";
import {
  buildDayParts,
  dayNameRo,
  formatDayDate,
  shouldShowOsd,
  slicePartData,
  type PdfDayPart,
} from "@/lib/pdfSplit";
import { formatFooterSignatureLines } from "@/lib/graficFooter";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type PreviewDay = { day: number; abbr: string; weekend: boolean };
export type PreviewRow = { name: string; cells: string[]; osd: string };
export type DragTarget = "titlu" | "tabel" | "footer" | `caseta:${number}`;

type Guide = { orient: "h" | "v"; pos: number };

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const SNAP_PX = 6;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function targetLabel(t: DragTarget): string {
  if (t === "titlu") return "Titlu";
  if (t === "tabel") return "Tabel";
  if (t === "footer") return "Footer";
  return "Casetă";
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

type PdfDragPreviewProps = {
  setari: PdfTemplateSetari;
  onChange: (next: PdfTemplateSetari) => void;
  onCommit: () => void;
  onDragStart?: () => void;
  title: string;
  days: PreviewDay[];
  rows: PreviewRow[];
  footer: {
    medicSef: string;
    asSef: string;
    delegatName?: string;
    delegatLabel?: string;
  };
  vars: PdfTemplateVars;
  selected: DragTarget | null;
  onSelect: (t: DragTarget | null) => void;
  dragEnabled: boolean;
  zoomMode: "fit" | "pct";
  zoomPct: number;
  an: number;
  luna: number;
  pageIndex: number;
  onPageIndexChange: (i: number) => void;
  onPageCount?: (n: number) => void;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PdfDragPreview({
  setari,
  onChange,
  onCommit,
  onDragStart,
  title,
  days,
  rows,
  footer,
  vars,
  selected,
  onSelect,
  dragEnabled,
  zoomMode,
  zoomPct,
  an,
  luna,
  pageIndex,
  onPageIndexChange,
  onPageCount,
}: PdfDragPreviewProps) {
  const page = a4SizePt(setari.pagina.orientare);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  /* ---- measure container for "fit" zoom ---- */
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setContainerSize({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---- compute scale ---- */
  const fitScale = Math.min(
    containerSize.w / page.w,
    containerSize.h / page.h,
    1,
  );
  const renderScale = zoomMode === "fit" ? fitScale : zoomPct / 100;

  /* ---- split parts ---- */
  const daysInMonth = days.length || new Date(an, luna, 0).getDate();
  const parts = buildDayParts(daysInMonth, setari.impartire);
  const isMultiPage = setari.impartire.asezare === "pagini_noi" && parts.length > 1;
  const pageCount = isMultiPage ? parts.length : 1;
  const safePageIndex = clamp(pageIndex, 0, pageCount - 1);

  useEffect(() => {
    onPageCount?.(pageCount);
  }, [pageCount, onPageCount]);

  useEffect(() => {
    if (safePageIndex !== pageIndex) onPageIndexChange(safePageIndex);
  }, [safePageIndex, pageIndex, onPageIndexChange]);

  /* ---- title text ---- */
  const baseTitle = setari.titlu.afisat
    ? setari.titlu.text.trim()
      ? applyPdfTemplateVars(setari.titlu.text, vars as Record<string, string>)
      : title
    : "";

  /* ---- scaling / font — scara = scale pe cutie + conținut ---- */
  const tblScale = setari.tabel.scara / 100;
  const tabelW = tabelLatimeEfectiva(setari.tabel);
  const cellFs = setari.tabel.font_pt * tblScale;
  const border = `${Math.max(0.4, setari.tabel.grosime_linii * tblScale)}px solid #000`;
  const rowHBase = setari.tabel.inaltime_rand * tblScale;
  const headerH = rowHBase * (12 / 14);
  const abbrH = rowHBase * (11 / 14);
  const emptyH = rowHBase;
  const delegatH = rowHBase * (16 / 14);

  /**
   * Stretch + footer Y ca în PDF: footer la mijloc între tabel și josul paginii.
   */
  const { staffRowH, footerTopPct } = (() => {
    const contentTop = (page.h * setari.tabel.y) / 100;
    const padBottomPt = (setari.pagina.margini.bottom / 25.4) * 72;
    const pageBottom = page.h - padBottomPt;
    const nParts = isMultiPage ? 1 : parts.length;
    const headersTotal = nParts * (headerH + abbrH);
    const spacer =
      !isMultiPage && parts.length > 1
        ? ((setari.impartire.spatiu_mm / 25.4) * 72) * (parts.length - 1)
        : 0;
    const trailing = emptyH + delegatH;
    const staffN = Math.max(1, rows.length);
    const naturalTableH = headersTotal + spacer + trailing + staffN * rowHBase;
    const tableBottomNatural = contentTop + naturalTableH;

    if (!setari.footer.afisat) {
      if (setari.pagina.tabel_compact) {
        return { staffRowH: rowHBase, footerTopPct: setari.footer.y };
      }
      const budget =
        pageBottom - contentTop - headersTotal - spacer - trailing;
      return {
        staffRowH: Math.max(rowHBase * 0.75, budget / staffN),
        footerTopPct: setari.footer.y,
      };
    }

    let footerTop = (tableBottomNatural + pageBottom) / 2;
    let staffH = rowHBase;
    if (!setari.pagina.tabel_compact) {
      const contentBottom = Math.max(contentTop + rowHBase, footerTop - 6);
      const budget =
        contentBottom - contentTop - headersTotal - spacer - trailing;
      staffH = Math.max(rowHBase * 0.75, budget / staffN);
    }
    const tableBottom =
      contentTop + headersTotal + spacer + trailing + staffN * staffH;
    footerTop = (tableBottom + pageBottom) / 2;
    return {
      staffRowH: staffH,
      footerTopPct: (footerTop / page.h) * 100,
    };
  })();

  /* ---- drag state ---- */
  const dragRef = useRef<{
    target: DragTarget;
    mode: "move" | "resize";
    startX: number;
    startY: number;
    orig: {
      x: number;
      y: number;
      latime: number;
      scara: number;
      /** latime bază (fără scara) — doar pentru tabel */
      baseLatime: number;
    };
    alt: boolean;
  } | null>(null);

  /* ---- snap ---- */
  const applySnap = useCallback(
    (
      x: number,
      y: number,
      w: number,
      h: number,
      others: { x: number; y: number; w: number; h: number }[],
      disable: boolean,
    ) => {
      if (disable) return { x, y, guides: [] as Guide[] };
      const g: Guide[] = [];
      let nx = x;
      let ny = y;
      const cX = [0, 50, 100, ...others.flatMap((o) => [o.x, o.x + o.w])];
      const cY = [0, 50, 100, ...others.flatMap((o) => [o.y, o.y + o.h])];
      const midX = x + w / 2;
      const midY = y + h / 2;
      for (const c of cX) {
        if (Math.abs(x - c) * (page.w / 100) < SNAP_PX) {
          nx = c; g.push({ orient: "v", pos: c });
        } else if (Math.abs(midX - c) * (page.w / 100) < SNAP_PX) {
          nx = c - w / 2; g.push({ orient: "v", pos: c });
        } else if (Math.abs(x + w - c) * (page.w / 100) < SNAP_PX) {
          nx = c - w; g.push({ orient: "v", pos: c });
        }
      }
      for (const c of cY) {
        if (Math.abs(y - c) * (page.h / 100) < SNAP_PX) {
          ny = c; g.push({ orient: "h", pos: c });
        } else if (Math.abs(midY - c) * (page.h / 100) < SNAP_PX) {
          ny = c - h / 2; g.push({ orient: "h", pos: c });
        } else if (Math.abs(y + h - c) * (page.h / 100) < SNAP_PX) {
          ny = c - h; g.push({ orient: "h", pos: c });
        }
      }
      return { x: nx, y: ny, guides: g };
    },
    [page.w, page.h],
  );

  /* ---- box helpers ---- */
  function getBox(t: DragTarget) {
    if (t === "titlu")
      return { x: setari.titlu.x, y: setari.titlu.y, latime: setari.titlu.latime, h: 4 };
    if (t === "tabel")
      return {
        x: setari.tabel.x,
        y: setari.tabel.y,
        latime: tabelLatimeEfectiva(setari.tabel),
        h: 70,
      };
    if (t === "footer")
      return {
        x: setari.footer.x,
        y: footerTopPct,
        latime: setari.footer.latime,
        h: 4,
      };
    const i = Number(t.split(":")[1]);
    const c = setari.casete_text[i];
    return { x: c?.x ?? 0, y: c?.y ?? 0, latime: c?.latime ?? 20, h: 4 };
  }

  function otherBoxes(except: DragTarget) {
    const all: DragTarget[] = ["titlu", "tabel", "footer"];
    setari.casete_text.forEach((_, i) => all.push(`caseta:${i}`));
    return all.filter((t) => t !== except).map((t) => {
      const b = getBox(t);
      return { x: b.x, y: b.y, w: b.latime, h: b.h };
    });
  }

  function patchTarget(
    t: DragTarget,
    patch: { x?: number; y?: number; latime?: number; scara?: number },
  ) {
    const next = structuredClone(setari);
    if (t === "titlu") {
      if (patch.x !== undefined) next.titlu.x = patch.x;
      if (patch.y !== undefined) next.titlu.y = patch.y;
      if (patch.latime !== undefined) next.titlu.latime = patch.latime;
    } else if (t === "tabel") {
      if (patch.x !== undefined) next.tabel.x = patch.x;
      if (patch.y !== undefined) next.tabel.y = patch.y;
      if (patch.latime !== undefined) next.tabel.latime = patch.latime;
      if (patch.scara !== undefined) next.tabel.scara = patch.scara;
    } else if (t === "footer") {
      if (patch.x !== undefined) next.footer.x = patch.x;
      if (patch.y !== undefined) next.footer.y = patch.y;
      if (patch.latime !== undefined) next.footer.latime = patch.latime;
    } else {
      const i = Number(t.split(":")[1]);
      if (next.casete_text[i]) {
        if (patch.x !== undefined) next.casete_text[i].x = patch.x;
        if (patch.y !== undefined) next.casete_text[i].y = patch.y;
        if (patch.latime !== undefined) next.casete_text[i].latime = patch.latime;
      }
    }
    onChange(next);
  }

  /* ---- pointer handlers ---- */
  function onPointerDown(
    e: ReactPointerEvent,
    target: DragTarget,
    mode: "move" | "resize",
  ) {
    if (!dragEnabled) { onSelect(target); return; }
    e.preventDefault();
    e.stopPropagation();
    onSelect(target);
    onDragStart?.();
    const box = getBox(target);
    dragRef.current = {
      target, mode,
      startX: e.clientX, startY: e.clientY,
      orig: {
        x: box.x,
        y: box.y,
        latime: box.latime,
        scara: setari.tabel.scara,
        baseLatime: setari.tabel.latime,
      },
      alt: e.altKey,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d || !stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - d.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - d.startY) / rect.height) * 100;
      d.alt = e.altKey;
      const box = getBox(d.target);
      if (d.mode === "move") {
        let x = clamp(d.orig.x + dxPct, 0, 100 - box.latime);
        let y = clamp(d.orig.y + dyPct, 0, 100 - box.h);
        const snapped = applySnap(x, y, box.latime, box.h, otherBoxes(d.target), d.alt);
        x = clamp(snapped.x, 0, 100 - box.latime);
        y = clamp(snapped.y, 0, 100 - box.h);
        setGuides(snapped.guides);
        patchTarget(d.target, { x, y });
      } else if (d.target === "tabel") {
        /* Colț SE = scale: cutie + font + rânduri */
        const base = Math.max(20, d.orig.baseLatime);
        const origEff = (base * d.orig.scara) / 100;
        const newEff = clamp(origEff + dxPct, 12, 100 - d.orig.x);
        const scara = clamp(
          Math.round((newEff / base) * 100),
          PDF_TABEL_SCARA_MIN,
          PDF_TABEL_SCARA_MAX,
        );
        patchTarget(d.target, { scara });
        setGuides([]);
      } else {
        const latime = clamp(d.orig.latime + dxPct, 10, 100 - d.orig.x);
        patchTarget(d.target, { latime });
        setGuides([]);
      }
    }
    function onUp() {
      if (dragRef.current) {
        dragRef.current = null;
        setGuides([]);
        onCommit();
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setari, dragEnabled, applySnap, onCommit]);

  /* ---- frame wrapper ---- */
  function frame(
    t: DragTarget,
    children: React.ReactNode,
    style: React.CSSProperties,
  ) {
    const sel = selected === t;
    return (
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(e) => onPointerDown(e, t, "move")}
        onClick={(e) => { e.stopPropagation(); onSelect(t); }}
        className={[
          "absolute box-border",
          dragEnabled ? "cursor-move" : "cursor-pointer",
          sel
            ? "ring-2 ring-sky-500"
            : "hover:ring-1 hover:ring-dashed hover:ring-sky-300",
        ].join(" ")}
        style={style}
      >
        {children}
        {sel && (
          <span className="pointer-events-none absolute -top-4 left-0 rounded bg-sky-500 px-1 py-px text-[9px] leading-none font-semibold text-white whitespace-nowrap">
            {t === "tabel"
              ? `Tabel · ${Math.round(setari.tabel.scara)}%`
              : targetLabel(t)}
          </span>
        )}
        {sel && dragEnabled && (
          <span
            onPointerDown={(e) => onPointerDown(e, t, "resize")}
            title={t === "tabel" ? "Scale (micșorează / mărește)" : "Lățime"}
            className="absolute right-0 bottom-0 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm border border-sky-600 bg-white shadow-sm"
          />
        )}
      </div>
    );
  }

  /* ---- render table for one part ---- */
  function renderPartTable(
    part: PdfDayPart,
    partIdx: number,
    addTrailing: boolean,
  ) {
    const sliced = slicePartData(days, rows, part);
    const showOsd = shouldShowOsd(setari.impartire, partIdx, parts.length);
    const isDetaliat = setari.impartire.antet_stil === "detaliat";
    const namePct = setari.tabel.latime_nume;
    const osdPct = showOsd ? 4.5 : 0;
    const dayPct = (100 - namePct - osdPct) / Math.max(sliced.days.length, 1);
    const colSpanDays = sliced.days.length + (showOsd ? 1 : 0);

    return (
      <table
        key={`part-${partIdx}`}
        className="w-full border-collapse"
        style={{ borderTop: border, borderLeft: border }}
      >
        <thead>
          {/* header row 1 */}
          <tr>
            <th
              style={{
                width: `${namePct}%`,
                borderRight: border,
                borderBottom: border,
                height: headerH,
              }}
            />
            {sliced.days.map((d) => (
              <th
                key={`h1-${d.day}`}
                style={{
                  width: `${dayPct}%`,
                  borderRight: border,
                  borderBottom: border,
                  background: d.weekend ? setari.tabel.culoare_weekend : undefined,
                  fontWeight: setari.tabel.font_antet_bold ? 700 : 400,
                  fontSize: cellFs,
                  textAlign: "center",
                  height: headerH,
                  overflow: "hidden",
                }}
              >
                {isDetaliat
                  ? dayNameRo(an, luna, d.day)
                  : d.day}
              </th>
            ))}
            {showOsd && (
              <th
                style={{
                  width: `${osdPct}%`,
                  borderRight: border,
                  borderBottom: border,
                  fontSize: cellFs * 0.9,
                  fontWeight: setari.tabel.font_antet_bold ? 700 : 400,
                  height: headerH,
                }}
              >
                O.SD
              </th>
            )}
          </tr>
          {/* header row 2 */}
          <tr>
            <th
              style={{
                borderRight: border,
                borderBottom: border,
                height: abbrH,
              }}
            />
            {sliced.days.map((d) => (
              <th
                key={`h2-${d.day}`}
                style={{
                  borderRight: border,
                  borderBottom: border,
                  background: d.weekend ? setari.tabel.culoare_weekend : undefined,
                  fontWeight: setari.tabel.font_antet_bold ? 700 : 400,
                  fontSize: isDetaliat ? cellFs * 0.65 : cellFs * 0.9,
                  textAlign: "center",
                  height: abbrH,
                  overflow: "hidden",
                }}
              >
                {isDetaliat
                  ? formatDayDate(an, luna, d.day)
                  : d.abbr}
              </th>
            ))}
            {showOsd && (
              <th
                style={{
                  borderRight: border,
                  borderBottom: border,
                  height: abbrH,
                }}
              />
            )}
          </tr>
        </thead>
        <tbody>
          {sliced.rows.map((row) => (
            <tr key={row.name}>
              <td
                style={{
                  borderRight: border,
                  borderBottom: border,
                  padding: "0 2px",
                  fontSize: cellFs,
                  textTransform: "uppercase",
                  height: staffRowH,
                  verticalAlign: "middle",
                }}
              >
                {row.name}
              </td>
              {row.cells.map((val, i) => {
                const long = val.length > 5;
                const split =
                  setari.tabel.celule_lungi === "doua_randuri" && long
                    ? val.includes("-")
                      ? val.replace(/-/, "-\n")
                      : val
                    : val;
                return (
                  <td
                    key={`${row.name}-${i}`}
                    style={{
                      borderRight: border,
                      borderBottom: border,
                      background: sliced.days[i]?.weekend
                        ? setari.tabel.culoare_weekend
                        : undefined,
                      textAlign: "center",
                      fontSize:
                        long && setari.tabel.celule_lungi === "micsoreaza"
                          ? cellFs * 0.75
                          : cellFs,
                      height: staffRowH,
                      verticalAlign: "middle",
                      whiteSpace: "pre-line",
                      lineHeight: 1.05,
                      overflow: "hidden",
                    }}
                  >
                    {split}
                  </td>
                );
              })}
              {showOsd && (
                <td
                  style={{
                    borderRight: border,
                    borderBottom: border,
                    textAlign: "center",
                    fontSize: cellFs,
                    height: staffRowH,
                  }}
                >
                  {row.osd}
                </td>
              )}
            </tr>
          ))}
          {addTrailing && (
            <>
              <tr>
                <td
                  style={{
                    borderRight: border,
                    borderBottom: border,
                    height: emptyH,
                  }}
                />
                {sliced.days.map((d) => (
                  <td
                    key={`e-${d.day}`}
                    style={{
                      borderRight: border,
                      borderBottom: border,
                      height: emptyH,
                      background: d.weekend
                        ? setari.tabel.culoare_weekend
                        : undefined,
                    }}
                  />
                ))}
                {showOsd && (
                  <td
                    style={{
                      borderRight: border,
                      borderBottom: border,
                      height: emptyH,
                    }}
                  />
                )}
              </tr>
              <tr>
                <td
                  style={{
                    borderRight: border,
                    borderBottom: border,
                    padding: "0 2px",
                    fontSize: cellFs,
                    textTransform: "uppercase",
                    height: delegatH,
                    verticalAlign: "middle",
                  }}
                >
                  {(footer.delegatName ?? "").toUpperCase()}
                </td>
                <td
                  colSpan={colSpanDays}
                  style={{
                    borderRight: border,
                    borderBottom: border,
                    textAlign: "center",
                    fontSize: cellFs,
                    height: delegatH,
                    verticalAlign: "middle",
                  }}
                >
                  {(footer.delegatLabel ?? "").toUpperCase()}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    );
  }

  /* ---- determine which parts to show ---- */
  const visibleParts: PdfDayPart[] = isMultiPage
    ? parts[safePageIndex] ? [parts[safePageIndex]] : [parts[0]]
    : parts;

  const pageTitleSuffix =
    isMultiPage && parts.length > 1
      ? ` (${safePageIndex + 1}/${parts.length})`
      : "";

  /* ---- mm → % helpers ---- */
  const mmToWPct = (mm: number) => (mm / 25.4) * 72 / page.w * 100;
  const mmToHPct = (mm: number) => (mm / 25.4) * 72 / page.h * 100;

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-auto"
    >
      <div
        ref={stageRef}
        className="relative bg-white shadow-md"
        style={{
          width: page.w * renderScale,
          height: page.h * renderScale,
          fontFamily: "Times New Roman, Times, serif",
          fontSize: cellFs,
          flexShrink: 0,
        }}
        onClick={() => onSelect(null)}
      >
        {/* scale inner content */}
        <div
          className="absolute inset-0"
          style={{
            width: page.w,
            height: page.h,
            transform: `scale(${renderScale})`,
            transformOrigin: "top left",
          }}
        >
          {/* margin guide */}
          <div
            className="pointer-events-none absolute inset-0 border border-dashed border-slate-200"
            style={{
              top: `${mmToHPct(setari.pagina.margini.top)}%`,
              bottom: `${mmToHPct(setari.pagina.margini.bottom)}%`,
              left: `${mmToWPct(setari.pagina.margini.left)}%`,
              right: `${mmToWPct(setari.pagina.margini.right)}%`,
            }}
          />

          {/* snap guides */}
          {guides.map((g, i) =>
            g.orient === "v" ? (
              <div
                key={`g-${i}`}
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-sky-500"
                style={{ left: `${g.pos}%` }}
              />
            ) : (
              <div
                key={`g-${i}`}
                className="pointer-events-none absolute right-0 left-0 h-px bg-sky-500"
                style={{ top: `${g.pos}%` }}
              />
            ),
          )}

          {/* title */}
          {baseTitle &&
            frame(
              "titlu",
              <div
                className="w-full uppercase"
                style={{
                  fontSize: setari.titlu.marime * tblScale,
                  fontWeight: setari.titlu.bold ? 700 : 400,
                  textAlign: setari.titlu.aliniere,
                }}
              >
                {baseTitle}{pageTitleSuffix}
              </div>,
              {
                left: `${setari.titlu.x}%`,
                top: `${setari.titlu.y}%`,
                width: `${setari.titlu.latime}%`,
              },
            )}

          {/* table block: one or multiple stacked parts */}
          {frame(
            "tabel",
            <div className="flex w-full flex-col">
              {visibleParts.map((part, vi) => {
                const isLastVisible =
                  vi === visibleParts.length - 1 &&
                  (!isMultiPage || safePageIndex === pageCount - 1);
                return (
                  <div
                    key={`vp-${part.index}`}
                    style={{
                      marginTop:
                        vi > 0 && !isMultiPage
                          ? `${setari.impartire.spatiu_mm}mm`
                          : undefined,
                    }}
                  >
                    {renderPartTable(part, part.index, isLastVisible)}
                  </div>
                );
              })}
            </div>,
            {
              left: `${setari.tabel.x}%`,
              top: `${setari.tabel.y}%`,
              width: `${tabelW}%`,
            },
          )}

          {/* footer — mijloc între tabel și josul paginii */}
          {setari.footer.afisat &&
            frame(
              "footer",
              <div
                className="flex w-full justify-between italic uppercase"
                style={{ fontSize: setari.footer.marime * tblScale }}
              >
                <span className="whitespace-pre-line leading-snug">
                  {formatFooterSignatureLines(footer.medicSef)}
                </span>
                <span className="whitespace-pre-line text-right leading-snug">
                  {formatFooterSignatureLines(footer.asSef)}
                </span>
              </div>,
              {
                left: `${setari.footer.x}%`,
                top: `${footerTopPct}%`,
                width: `${setari.footer.latime}%`,
              },
            )}

          {/* casete */}
          {setari.casete_text.map((c, i) => {
            if (!c.afisat) return null;
            const label = applyPdfTemplateVars(c.text, vars as Record<string, string>);
            if (!label.trim()) return null;
            return frame(
              `caseta:${i}`,
              <div
                style={{
                  fontSize: c.marime * tblScale,
                  fontWeight: c.bold ? 700 : 400,
                  textAlign: c.aliniere,
                }}
              >
                {label}
              </div>,
              {
                left: `${c.x}%`,
                top: `${c.y}%`,
                width: `${c.latime}%`,
              },
            );
          })}
        </div>
      </div>
    </div>
  );
}
