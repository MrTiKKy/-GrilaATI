"use client";

import { useEffect, useRef, useState } from "react";
import { SECTIE_VALUES, type SectieValoare } from "@/lib/types";

export const CELL_OPTIONS = [
  { value: "", label: "Gol" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "1/3", label: "1/3" },
  { value: "2*", label: "2*" },
  { value: "L", label: "L" },
  { value: "CO", label: "CO" },
  { value: "CM", label: "CM" },
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

type RightOptionPanelProps = {
  open: boolean;
  context: PanelContext | null;
  onConfirm: (payload: ConfirmPayload) => boolean | void | Promise<boolean | void>;
  onClose: () => void;
};

type ConfirmPhase = "idle" | "pending" | "done";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path
        className="confirm-check-path"
        d="M5 13l4 4L19 7"
        pathLength={1}
      />
    </svg>
  );
}

function PanelBody({
  context,
  onConfirm,
  onClose,
}: {
  context: PanelContext;
  onConfirm: RightOptionPanelProps["onConfirm"];
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(context.currentValue);
  const [sectie, setSectie] = useState<SectieValoare | null>(
    context.currentCiorna,
  );
  const [phase, setPhase] = useState<ConfirmPhase>("idle");
  const resetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  function pickSectie(next: SectieValoare) {
    if (phase !== "idle") return;
    setSectie((prev) => (prev === next ? null : next));
  }

  async function runConfirm(payload: ConfirmPayload) {
    if (phase !== "idle") return;
    setPhase("pending");
    try {
      const result = await onConfirm(payload);
      if (result === false) {
        setPhase("idle");
        return;
      }
      setPhase("done");
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => {
        setPhase("idle");
      }, 1600);
    } catch {
      setPhase("idle");
    }
  }

  function confirm() {
    void runConfirm({ valoare: draft, ciorna: sectie });
  }

  function clearAll() {
    setDraft("");
    setSectie(null);
    void runConfirm({ valoare: "", ciorna: null });
  }

  const preview =
    draft || sectie
      ? `${draft || "·"}${sectie ? ` ${sectie}` : ""}`
      : "Gol";

  const locked = phase !== "idle";

  return (
    <>
      {/* Handle mobil — bottom sheet */}
      <div className="flex justify-center pt-2 lg:hidden" aria-hidden>
        <span className="h-1 w-10 rounded-full bg-slate-300" />
      </div>

      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
            Editare casuță
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
            {context.personName}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {context.columnLabel} · {context.detail}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800"
        >
          Închide
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase">
          Previzualizare casuță
        </p>
        <div
          className={[
            "mb-5 rounded-xl border px-3 py-2.5 text-center text-base font-semibold",
            "transition-[background-color,border-color,color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            phase === "done"
              ? "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-500/10"
              : "border-slate-200 bg-slate-50 text-slate-800",
          ].join(" ")}
        >
          <span>{draft || "·"}</span>
          {sectie && (
            <span className="draft-only ml-1.5 text-amber-700">{sectie}</span>
          )}
          <span className="sr-only">{preview}</span>
        </div>

        <p className="mb-2 text-xs font-medium text-slate-500 uppercase">
          Schimb (oficial)
        </p>
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-2">
          {CELL_OPTIONS.map((opt) => {
            const selected = draft === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                disabled={locked}
                onClick={() => setDraft(opt.value)}
                className={[
                  "rounded-xl border px-3 py-3 text-sm font-semibold lg:py-2.5",
                  "transition-[background-color,border-color,box-shadow,color] duration-150",
                  "disabled:opacity-60",
                  selected
                    ? "border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/30"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs font-medium text-slate-500 uppercase">
          Secție (A sau R)
        </p>
        <div className="draft-only grid grid-cols-2 gap-2">
          {SECTIE_VALUES.map((s) => {
            const selected = sectie === s;
            return (
              <button
                key={s}
                type="button"
                disabled={locked}
                onClick={() => pickSectie(s)}
                className={[
                  "rounded-xl border px-3 py-3 text-base font-bold",
                  "transition-[background-color,border-color,box-shadow,color] duration-150",
                  "disabled:opacity-60",
                  selected
                    ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/30"
                    : "border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/60",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
        <p className="draft-only mt-2 text-[11px] leading-relaxed text-slate-500">
          Alege o singură secție (A sau R). Apare lângă schimb în casuță; nu
          apare pe documentul oficial / la print.
        </p>
      </div>

      <div className="flex gap-2 border-t border-slate-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-4">
        <button
          type="button"
          disabled={locked}
          onClick={clearAll}
          className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 disabled:opacity-50 lg:py-2.5"
        >
          Golire
        </button>
        <button
          type="button"
          disabled={phase === "pending"}
          onClick={confirm}
          aria-live="polite"
          className={[
            "confirm-morph-btn relative flex-1 overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold lg:py-2.5",
            "transition-[background-color,box-shadow,transform,border-radius] duration-500",
            "ease-[cubic-bezier(0.22,1,0.36,1)]",
            phase === "done"
              ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-[1.02]"
              : phase === "pending"
                ? "bg-sky-500 text-white scale-[0.99]"
                : "bg-sky-600 text-white hover:bg-sky-700",
          ].join(" ")}
        >
          <span className="grid [grid-template-areas:'stack'] place-items-center">
            <span
              className={[
                "[grid-area:stack] inline-flex items-center justify-center gap-2",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                phase === "done"
                  ? "pointer-events-none translate-y-1 scale-90 opacity-0"
                  : "translate-y-0 scale-100 opacity-100",
              ].join(" ")}
            >
              {phase === "pending" ? "Se salvează…" : "Confirmă"}
            </span>
            <span
              className={[
                "[grid-area:stack] inline-flex items-center justify-center gap-2",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                phase === "done"
                  ? "confirm-morph-done translate-y-0 scale-100 opacity-100"
                  : "pointer-events-none -translate-y-1 scale-110 opacity-0",
              ].join(" ")}
            >
              <CheckIcon className="shrink-0" />
              Confirmat
            </span>
          </span>
        </button>
      </div>
    </>
  );
}

export function RightOptionPanel({
  open,
  context,
  onConfirm,
  onClose,
}: RightOptionPanelProps) {
  const cellKey = context
    ? `${context.personName}::${context.columnLabel}`
    : "none";

  return (
    <>
      {/* Scrim doar pe mobil */}
      <button
        type="button"
        aria-label="Închide panoul"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
        className={[
          "fixed inset-0 z-30 bg-slate-900/40 transition-opacity duration-200 lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      <aside
        aria-hidden={!open}
        className={[
          "fixed z-40 flex flex-col bg-white shadow-xl shadow-slate-900/10",
          "transition-transform duration-200 ease-out",
          // Mobil: bottom sheet
          "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t border-slate-200",
          open ? "translate-y-0" : "pointer-events-none translate-y-full",
          // Desktop (≥lg): panou dreapta — identic cu înainte
          "lg:inset-y-0 lg:right-0 lg:left-auto lg:bottom-auto",
          "lg:max-h-none lg:w-full lg:max-w-sm lg:rounded-none",
          "lg:border-t-0 lg:border-l lg:border-slate-200",
          open
            ? "lg:translate-x-0 lg:translate-y-0"
            : "lg:translate-x-full lg:translate-y-0",
        ].join(" ")}
      >
        {context ? (
          <PanelBody
            key={cellKey}
            context={context}
            onConfirm={onConfirm}
            onClose={onClose}
          />
        ) : (
          <div className="p-5 text-sm text-slate-500">Selectează o casuță</div>
        )}
      </aside>
    </>
  );
}
