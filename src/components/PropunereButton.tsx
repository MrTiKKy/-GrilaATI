"use client";

import {
  FormEvent,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { usePathname } from "next/navigation";

type Tip = "idee" | "problema" | "altceva";

type PropunereButtonProps = {
  children?: ReactNode;
  className?: string;
  title?: string;
  onOpen?: () => void;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick" | "children">;

export function PropunereButton({
  children,
  className,
  title,
  onOpen,
  ...rest
}: PropunereButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title={title}
        className={
          className ??
          "rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:py-1.5"
        }
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
        {...rest}
      >
        {children ?? "Propune o îmbunătățire"}
      </button>
      {open && <PropunereModal onClose={() => setOpen(false)} />}
    </>
  );
}

function PropunereModal({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [tip, setTip] = useState<Tip>("idee");
  const [titlu, setTitlu] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/propuneri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tip,
          titlu,
          mesaj,
          pagina: pathname || "/",
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Eroare ${res.status}`);
        return;
      }
      setThanks(true);
      setTitlu("");
      setMesaj("");
      setTip("idee");
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="propunere-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
              Feedback
            </p>
            <h2
              id="propunere-title"
              className="mt-1 text-lg font-semibold text-slate-900"
            >
              Propune o îmbunătățire
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Închide
          </button>
        </div>

        {thanks ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Mulțumim! Propunerea a fost trimisă.
            </p>
            <button
              type="button"
              onClick={() => setThanks(false)}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Trimite alta
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Tip
              <select
                value={tip}
                onChange={(e) => setTip(e.target.value as Tip)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              >
                <option value="idee">Idee</option>
                <option value="problema">Problemă</option>
                <option value="altceva">Altceva</option>
              </select>
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Titlu
              <input
                value={titlu}
                onChange={(e) => setTitlu(e.target.value)}
                maxLength={150}
                required
                minLength={3}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Mesaj
              <textarea
                value={mesaj}
                onChange={(e) => setMesaj(e.target.value)}
                required
                minLength={10}
                maxLength={5000}
                rows={5}
                className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            {error && (
              <p className="text-sm font-medium text-rose-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? "Se trimite…" : "Trimite"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
