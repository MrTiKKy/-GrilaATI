"use client";

import { useEffect, useRef, useState } from "react";
import type { GraficFooterKey } from "@/lib/graficFooter";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

type EditableFooterTextProps = {
  fieldKey: GraficFooterKey;
  value: string;
  align?: "left" | "center" | "right";
  italic?: boolean;
  className?: string;
  onSaved: (value: string) => void;
  onError?: (message: string) => void;
};

export function EditableFooterText({
  fieldKey,
  value,
  align = "left",
  italic = false,
  className = "",
  onSaved,
  onError,
}: EditableFooterTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  function openEdit() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setEditing(true);
  }

  function scheduleOpen() {
    if (editing || saving) return;
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setEditing(true), 180);
  }

  function cancelSchedule() {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  }

  async function commit() {
    const next = draft.trim();
    if (!next || next === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/grafic-footer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: fieldKey, value: next }),
      });
      if (!res.ok) throw new Error(await readError(res));
      onSaved(next);
      setEditing(false);
    } catch (e) {
      setDraft(value);
      setEditing(false);
      onError?.(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  const alignClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left";

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={saving}
        maxLength={120}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`w-full min-w-0 rounded-lg border border-sky-300 bg-white px-2 py-1 text-[11px] font-medium tracking-wide text-slate-800 uppercase outline-none ring-2 ring-sky-400/20 ${alignClass} ${italic ? "italic" : ""} ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      title="Hover sau click pentru editare"
      onClick={openEdit}
      onMouseEnter={scheduleOpen}
      onMouseLeave={cancelSchedule}
      className={`group w-full min-w-0 rounded-lg border border-transparent px-2 py-1 text-[11px] font-medium tracking-wide text-slate-600 uppercase transition-colors hover:border-sky-200 hover:bg-sky-50 hover:text-slate-900 ${alignClass} ${italic ? "italic" : ""} ${className}`}
    >
      <span className="block truncate">{value}</span>
    </button>
  );
}
