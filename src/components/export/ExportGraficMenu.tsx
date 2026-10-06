"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  EXPORT_FORMAT_OPTIONS,
  type ExportFormat,
} from "@/lib/exportFormats";

type PdfTplOpt = { id: string; nume: string; implicit: boolean };

type ExportGraficMenuProps = {
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  busyLabel?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  onSelect: (format: ExportFormat, pdfTemplateId?: string | null) => void;
};

export function ExportGraficMenu({
  disabled = false,
  busy = false,
  label = "Export",
  busyLabel = "Se generează…",
  className = "",
  buttonClassName = "",
  align = "right",
  onSelect,
}: ExportGraficMenuProps) {
  const [open, setOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTpls, setPdfTpls] = useState<PdfTplOpt[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setPdfOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPdfOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (busy || disabled) {
      setOpen(false);
      setPdfOpen(false);
    }
  }, [busy, disabled]);

  useEffect(() => {
    if (!pdfOpen) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/setari/export-pdf");
        if (!res.ok) {
          if (!cancelled) setPdfTpls([]);
          return;
        }
        const data = (await res.json()) as {
          items?: PdfTplOpt[];
        };
        if (!cancelled) setPdfTpls(data.items ?? []);
      } catch {
        if (!cancelled) setPdfTpls([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pdfOpen]);

  const locked = disabled || busy;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={locked}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={
          buttonClassName ||
          "inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
        }
      >
        <span>{busy ? busyLabel : label}</span>
        {!busy && (
          <span aria-hidden className="text-[10px] leading-none text-slate-400">
            ▾
          </span>
        )}
      </button>

      {open && !locked && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-40 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {EXPORT_FORMAT_OPTIONS.map((opt) => {
            if (opt.id !== "pdf") {
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-800"
                  onClick={() => {
                    setOpen(false);
                    onSelect(opt.id);
                  }}
                >
                  {opt.label}
                </button>
              );
            }
            return (
              <div key={opt.id} className="border-b border-slate-100 pb-1">
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-800"
                  onClick={() => {
                    setOpen(false);
                    onSelect("pdf", null);
                  }}
                >
                  <span>{opt.label}</span>
                  <span className="text-[10px] text-slate-400">implicit</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center px-3.5 py-1.5 text-left text-xs font-medium text-sky-700 hover:bg-sky-50"
                  onClick={() => setPdfOpen((v) => !v)}
                >
                  Alege template PDF…
                </button>
                {pdfOpen && (
                  <div className="max-h-40 overflow-auto px-1 pb-1">
                    {pdfTpls.length === 0 ? (
                      <p className="px-2.5 py-1 text-[11px] text-slate-400">
                        Format inițial (niciun template salvat)
                      </p>
                    ) : (
                      pdfTpls.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-sky-50"
                          onClick={() => {
                            setOpen(false);
                            setPdfOpen(false);
                            onSelect("pdf", t.id);
                          }}
                        >
                          <span className="truncate">{t.nume}</span>
                          {t.implicit && (
                            <span className="text-amber-500">★</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
