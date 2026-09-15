"use client";

import { useId, useState } from "react";

type AddStaffDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

function DialogForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const titleId = useId();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed.toUpperCase());
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-900/10"
      >
        <h2 id={titleId} className="text-base font-semibold text-slate-900">
          Adaugă angajat
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Numele va apărea cu majuscule în grilă.
        </p>
        <label className="mt-4 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Nume
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            placeholder="ex. POPESCU"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50"
          >
            Anulează
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Adaugă
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddStaffDialog({ open, onClose, onSubmit }: AddStaffDialogProps) {
  if (!open) return null;
  return <DialogForm key="add-staff" onClose={onClose} onSubmit={onSubmit} />;
}
