"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  EXPORT_FORMAT_OPTIONS,
  type ExportFormat,
} from "@/lib/exportFormats";

type ExportGraficMenuProps = {
  disabled?: boolean;
  busy?: boolean;
  /** Text pe butonul principal când nu e busy */
  label?: string;
  busyLabel?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  onSelect: (format: ExportFormat) => void;
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
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (busy || disabled) setOpen(false);
  }, [busy, disabled]);

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
          className={`absolute z-40 mt-1 min-w-[11.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80 ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {EXPORT_FORMAT_OPTIONS.map((opt) => (
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
          ))}
        </div>
      )}
    </div>
  );
}
