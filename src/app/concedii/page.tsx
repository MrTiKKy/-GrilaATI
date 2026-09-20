"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { postLabel, type AngajatPost } from "@/lib/post";
import type { ConcediiResponse, ConcediuDto } from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function useConcediuEdit(
  row: ConcediuDto,
  onSaved: (next: ConcediuDto) => void,
  onError: (msg: string) => void,
  onStatus: (msg: string) => void,
) {
  const [draft, setDraft] = useState(
    row.zileCoAn === 0 ? "" : String(row.zileCoAn),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    let zileCoAn: number | null;
    if (trimmed === "") {
      zileCoAn = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 0) {
        onError("Introdu un număr întreg ≥ 0 (sau lasă gol)");
        setDraft(row.zileCoAn === 0 ? "" : String(row.zileCoAn));
        return;
      }
      zileCoAn = n;
    }

    const previous = row.zileCoAn;
    const nextAn = zileCoAn ?? 0;
    if (nextAn === previous) return;

    const snapshot = row;
    setSaving(true);
    onSaved({
      ...row,
      zileCoAn: nextAn,
      ramase: nextAn - row.folosite,
    });

    try {
      const res = await fetch(`/api/angajati/${row.id}/concediu`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zileCoAn }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setDraft(nextAn === 0 ? "" : String(nextAn));
      onStatus("Salvat");
    } catch (e) {
      onSaved(snapshot);
      setDraft(previous === 0 ? "" : String(previous));
      onError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  return { draft, setDraft, saving, save };
}

function ConcediuCard({
  row,
  onSaved,
  onError,
  onStatus,
}: {
  row: ConcediuDto;
  onSaved: (next: ConcediuDto) => void;
  onError: (msg: string) => void;
  onStatus: (msg: string) => void;
}) {
  const { draft, setDraft, saving, save } = useConcediuEdit(
    row,
    onSaved,
    onError,
    onStatus,
  );
  const ramaseNegative = row.ramase < 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">
        {row.nume}
      </h3>
      <label className="mt-3 block text-xs font-medium tracking-wide text-slate-500 uppercase">
        Zile CO alocate
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={draft}
          placeholder="—"
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
          aria-label={`Zile CO alocate pentru ${row.nume}`}
        />
      </label>
      <div className="mt-3 flex gap-4 text-sm">
        <p className="text-slate-600">
          Folosite{" "}
          <span className="font-semibold tabular-nums text-slate-800">
            {row.folosite}
          </span>
        </p>
        <p className={ramaseNegative ? "text-rose-600" : "text-slate-600"}>
          Rămase{" "}
          <span className="font-semibold tabular-nums">
            {row.zileCoAn === 0 && row.folosite === 0 ? "—" : row.ramase}
          </span>
          {ramaseNegative && (
            <span className="ml-1 text-xs font-medium text-rose-500">
              depășit
            </span>
          )}
        </p>
      </div>
    </article>
  );
}

function ConcediuRow({
  row,
  onSaved,
  onError,
  onStatus,
}: {
  row: ConcediuDto;
  onSaved: (next: ConcediuDto) => void;
  onError: (msg: string) => void;
  onStatus: (msg: string) => void;
}) {
  const { draft, setDraft, saving, save } = useConcediuEdit(
    row,
    onSaved,
    onError,
    onStatus,
  );
  const ramaseNegative = row.ramase < 0;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 text-sm font-semibold tracking-wide text-slate-800 uppercase">
        {row.nume}
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={draft}
          placeholder="—"
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
          aria-label={`Zile CO alocate pentru ${row.nume}`}
        />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 tabular-nums">
        {row.folosite}
      </td>
      <td
        className={[
          "px-4 py-3 text-sm font-semibold tabular-nums",
          ramaseNegative ? "text-rose-600" : "text-slate-800",
        ].join(" ")}
      >
        {row.zileCoAn === 0 && row.folosite === 0 ? (
          <span className="font-normal text-slate-400">—</span>
        ) : (
          row.ramase
        )}
        {ramaseNegative && (
          <span className="ml-2 text-xs font-medium text-rose-500">
            depășit
          </span>
        )}
      </td>
    </tr>
  );
}

export default function ConcediiPage() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const [an, setAn] = useState(currentYear);
  const [post, setPost] = useState<AngajatPost>("asistent");
  const [allRows, setAllRows] = useState<ConcediuDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => [currentYear - 1, currentYear, currentYear + 1],
    [currentYear],
  );

  const rows = useMemo(
    () => allRows.filter((r) => r.post === post),
    [allRows, post],
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/concedii?an=${an}`);
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as ConcediiResponse;
        if (cancelled) return;
        setAllRows(data.angajati);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Eroare la încărcare");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [an]);

  function flash(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  }

  function onSaved(next: ConcediuDto) {
    setAllRows((prev) => prev.map((r) => (r.id === next.id ? next : r)));
  }

  const [desktopLayout, setDesktopLayout] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktopLayout(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const emptyLabel =
    post === "infirmier"
      ? "Nicio infirmieră activă."
      : "Niciun asistent activ.";

  return (
    <main className="min-h-full flex-1 bg-slate-100 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
                Concediu de odihnă · {postLabel(post)}
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Zile CO pe angajat
              </h1>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 sm:py-2"
            >
              ← Înapoi la grilă
            </Link>
          </div>

          <div
            className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
            role="tablist"
            aria-label="Tip personal"
          >
            {(
              [
                { id: "asistent" as const, label: "Asistenți" },
                { id: "infirmier" as const, label: "Infirmiere" },
              ] as const
            ).map((tab) => {
              const selected = post === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setPost(tab.id)}
                  className={[
                    "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150",
                    selected
                      ? "bg-white text-sky-800 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              An
              <select
                value={an}
                onChange={(e) => {
                  setLoading(true);
                  setAn(Number(e.target.value));
                }}
                className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            {loading && (
              <span className="text-xs font-medium text-sky-700">
                Se încarcă…
              </span>
            )}
            {error && (
              <span className="text-xs font-medium text-rose-600">{error}</span>
            )}
            {status && !error && (
              <span className="text-xs font-medium text-emerald-700">
                {status}
              </span>
            )}
          </div>

          {!desktopLayout ? (
            <div className="space-y-3">
              {!loading && rows.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  {emptyLabel}
                </p>
              ) : (
                rows.map((row) => (
                  <ConcediuCard
                    key={`${an}-${row.id}`}
                    row={row}
                    onSaved={onSaved}
                    onError={setError}
                    onStatus={flash}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    <th className="px-4 py-3">Nume</th>
                    <th className="px-4 py-3">Zile CO alocate</th>
                    <th className="px-4 py-3">Folosite</th>
                    <th className="px-4 py-3">Rămase</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        {emptyLabel}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <ConcediuRow
                        key={`${an}-${row.id}`}
                        row={row}
                        onSaved={onSaved}
                        onError={setError}
                        onStatus={flash}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
