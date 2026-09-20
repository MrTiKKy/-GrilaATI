"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SECTIE_VALUES, type SectieValoare } from "@/lib/types";

export const CELL_OPTIONS = [
  { value: "", label: "Gol" },
  { value: "-", label: "-" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "1/3", label: "1/3" },
  { value: "2*", label: "2*" },
  { value: "L", label: "L" },
  { value: "CO", label: "CO" },
  { value: "CM", label: "CM" },
  { value: "CIC", label: "CIC" },
] as const;

export type PanelContext = {
  personName: string;
  columnLabel: string;
  detail: string;
  currentValue: string;
  currentCiorna: SectieValoare | null;
};

export type ConfirmPayload = {
  valoare: string;
  ciorna: SectieValoare | null;
};

type CellOptionPopupProps = {
  open: boolean;
  context: PanelContext | null;
  /** Salvare imediată la selectare (fără Confirmă) */
  onSelect: (payload: ConfirmPayload) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};

const GAP = 8;
const MARGIN = 8;
const POPUP_W = 260;

function computePosition(
  anchor: DOMRect,
  popupW: number,
  popupH: number,
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Vertical: preferință sub casuță; la extremă jos → sus (partea opusă)
  const spaceBelow = vh - anchor.bottom - MARGIN;
  const spaceAbove = anchor.top - MARGIN;
  const placeBelow =
    spaceBelow >= popupH + GAP || spaceBelow >= spaceAbove;

  let top = placeBelow
    ? anchor.bottom + GAP
    : anchor.top - GAP - popupH;
  top = Math.max(MARGIN, Math.min(top, vh - popupH - MARGIN));

  // Orizontal: preferință aliniat la stânga casuței (se deschide spre dreapta).
  // Extremă dreapta → se deschide spre stânga (partea opusă).
  // Extremă stânga → rămâne spre dreapta.
  const fitsLeftAligned = anchor.left + popupW <= vw - MARGIN;
  const fitsRightAligned = anchor.right - popupW >= MARGIN;
  let left: number;
  if (fitsLeftAligned) {
    left = anchor.left;
  } else if (fitsRightAligned) {
    left = anchor.right - popupW;
  } else {
    left = Math.max(MARGIN, (vw - popupW) / 2);
  }
  left = Math.max(MARGIN, Math.min(left, vw - popupW - MARGIN));

  return { top, left };
}

export function CellOptionPopup({
  open,
  context,
  onSelect,
  onClose,
}: CellOptionPopupProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [draft, setDraft] = useState(context?.currentValue ?? "");
  const [sectie, setSectie] = useState<SectieValoare | null>(
    context?.currentCiorna ?? null,
  );
  const [saving, setSaving] = useState(false);

  const cellKey = context
    ? `${context.personName}::${context.columnLabel}`
    : "none";

  useEffect(() => {
    if (!context) return;
    setDraft(context.currentValue);
    setSectie(context.currentCiorna);
    // Reset doar la schimbarea casuței
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellKey
  }, [cellKey]);

  const reposition = useCallback(() => {
    if (!open) return;
    const anchorEl = document.querySelector<HTMLElement>(
      '[data-cell-active="true"]',
    );
    const panel = panelRef.current;
    if (!anchorEl || !panel) return;

    const anchor = anchorEl.getBoundingClientRect();
    const popupH = panel.offsetHeight || 320;
    const popupW = Math.min(POPUP_W, panel.offsetWidth || POPUP_W);
    setPos(computePosition(anchor, popupW, popupH));
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    reposition();
    const t = window.setTimeout(reposition, 0);
    return () => window.clearTimeout(t);
  }, [open, cellKey, reposition]);

  useEffect(() => {
    if (!open) return;
    function onScrollOrResize() {
      reposition();
    }
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    function onPointerDown(e: PointerEvent) {
      const panel = panelRef.current;
      const target = e.target as Node | null;
      if (!panel || !target) return;
      if (panel.contains(target)) return;
      const cell = (target as HTMLElement).closest?.(
        '[data-cell-active="true"]',
      );
      if (cell) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose]);

  async function commit(next: ConfirmPayload) {
    if (saving) return;
    const rollback = { valoare: draft, ciorna: sectie };
    setDraft(next.valoare);
    setSectie(next.ciorna);
    setSaving(true);
    try {
      const result = await onSelect(next);
      if (result === false) {
        setDraft(rollback.valoare);
        setSectie(rollback.ciorna);
      }
    } finally {
      setSaving(false);
    }
  }

  function pickValoare(value: string) {
    void commit({ valoare: value, ciorna: sectie });
  }

  function pickSectie(next: SectieValoare) {
    const ciorna = sectie === next ? null : next;
    void commit({ valoare: draft, ciorna });
  }

  if (!open || !context) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Editare casuță"
      style={
        pos
          ? { top: pos.top, left: pos.left, width: POPUP_W }
          : { top: -9999, left: -9999, width: POPUP_W, visibility: "hidden" }
      }
      className="fixed z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/15"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-medium tracking-wide text-sky-700 uppercase">
            Editare
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {context.personName}
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {context.columnLabel} · {context.detail}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          ✕
        </button>
      </div>

      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center text-sm font-semibold text-slate-800">
        <span>{draft || "·"}</span>
        {sectie && (
          <span className="draft-only ml-1 text-amber-700">{sectie}</span>
        )}
      </div>

      <p className="mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Schimb
      </p>
      <div className="mb-2 grid grid-cols-4 gap-1">
        {CELL_OPTIONS.map((opt) => {
          const selected = draft === opt.value;
          return (
            <button
              key={opt.label}
              type="button"
              disabled={saving}
              onClick={() => pickValoare(opt.value)}
              className={[
                "rounded-lg border px-1 py-1.5 text-xs font-semibold",
                "transition-colors duration-100 disabled:opacity-50",
                selected
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <p className="draft-only mb-1 text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        Secție
      </p>
      <div className="draft-only grid grid-cols-2 gap-1">
        {SECTIE_VALUES.map((s) => {
          const selected = sectie === s;
          return (
            <button
              key={s}
              type="button"
              disabled={saving}
              onClick={() => pickSectie(s)}
              className={[
                "rounded-lg border px-1 py-1.5 text-sm font-bold",
                "transition-colors duration-100 disabled:opacity-50",
                selected
                  ? "border-amber-500 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-amber-50/50",
              ].join(" ")}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** @deprecated — folosește CellOptionPopup */
export const RightOptionPanel = CellOptionPopup;
