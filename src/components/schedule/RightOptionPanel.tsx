"use client";

import { useState } from "react";
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
  onConfirm: (payload: ConfirmPayload) => void;
  onClose: () => void;
};

function PanelBody({
  context,
  onConfirm,
  onClose,
}: {
  context: PanelContext;
  onConfirm: (payload: ConfirmPayload) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(context.currentValue);
  const [sectie, setSectie] = useState<SectieValoare | null>(
    context.currentCiorna,
  );

  function pickSectie(next: SectieValoare) {
    // fie A, fie R — click pe aceeași deselectează
    setSectie((prev) => (prev === next ? null : next));
  }

  function confirm() {
    onConfirm({ valoare: draft, ciorna: sectie });
  }

  function clearAll() {
    setDraft("");
    setSectie(null);
    onConfirm({ valoare: "", ciorna: null });
  }

  const preview =
    draft || sectie
      ? `${draft || "·"}${sectie ? ` ${sectie}` : ""}`
      : "Gol";

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
            Editare casuță
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {context.personName}
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {context.columnLabel} · {context.detail}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800"
        >
          Închide
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase">
          Previzualizare casuță
        </p>
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-base font-semibold text-slate-800">
          <span>{draft || "·"}</span>
          {sectie && (
            <span className="draft-only ml-1.5 text-amber-700">{sectie}</span>
          )}
          <span className="sr-only">{preview}</span>
        </div>

        <p className="mb-2 text-xs font-medium text-slate-500 uppercase">
          Schimb (oficial)
        </p>
        <div className="mb-5 grid grid-cols-2 gap-2">
          {CELL_OPTIONS.map((opt) => {
            const selected = draft === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDraft(opt.value)}
                className={[
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold",
                  "transition-[background-color,border-color,box-shadow,color] duration-150",
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
                onClick={() => pickSectie(s)}
                className={[
                  "rounded-xl border px-3 py-3 text-base font-bold",
                  "transition-[background-color,border-color,box-shadow,color] duration-150",
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

      <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50"
        >
          Golire
        </button>
        <button
          type="button"
          onClick={confirm}
          className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-sky-700"
        >
          Confirmă
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
    <aside
      aria-hidden={!open}
      className={[
        "fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col",
        "border-l border-slate-200 bg-white shadow-xl shadow-slate-900/10",
        "transition-transform duration-200 ease-out",
        open ? "translate-x-0" : "translate-x-full pointer-events-none",
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
  );
}
