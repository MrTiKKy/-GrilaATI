"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { downloadGraficPdf } from "@/components/pdf/exportGraficPdf";
import type { GraficPdfData } from "@/components/pdf/GraficAtiPdf";
import type {
  GraficFinalDetail,
  GraficFinalMeta,
  GraficeListResponse,
} from "@/lib/types";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function monthName(an: number, luna: number) {
  return new Date(an, luna - 1, 1)
    .toLocaleDateString("ro-RO", { month: "long", year: "numeric" })
    .toUpperCase();
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IstoricPage() {
  const [items, setItems] = useState<GraficFinalMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/api/grafice");
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as GraficeListResponse;
        if (cancelled) return;
        setItems(data.items);
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
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, GraficFinalMeta[]>();
    for (const item of items) {
      const key = `${item.an}-${String(item.luna).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      an: list[0].an,
      luna: list[0].luna,
      items: list,
    }));
  }, [items]);

  async function regenerate(id: string, an: number, luna: number) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/grafice/${id}`);
      if (!res.ok) throw new Error(await readError(res));
      const detail = (await res.json()) as GraficFinalDetail;
      const pdfData: GraficPdfData = detail.snapshot;
      const fileName = `grafic-ati-${an}-${String(luna).padStart(2, "0")}-arhiva.pdf`;
      await downloadGraficPdf(pdfData, fileName);
      setStatus("PDF regenerat din arhivă");
      window.setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerare eșuată");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: GraficFinalMeta) {
    const label = `${formatWhen(item.createdAt)} — ${monthName(item.an, item.luna)}`;
    const ok = window.confirm(
      `Ștergi definitiv această salvare din arhivă?\n\n${label}\n\nAcțiunea nu poate fi anulată.`,
    );
    if (!ok) return;

    setBusyId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/grafice/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setStatus("Salvare ștearsă din arhivă");
      window.setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-full flex-1 bg-slate-100 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
                Arhivă
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Istoric grafice salvate
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Fiecare export PDF salvează un snapshot pe lună. Poți regenera
                PDF-ul oricând din versiunea arhivată.
              </p>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
            >
              ← Înapoi la grilă
            </Link>
          </div>

          {loading && (
            <p className="text-sm font-medium text-sky-700">Se încarcă…</p>
          )}
          {error && (
            <p className="mb-3 text-sm font-medium text-rose-600">{error}</p>
          )}
          {status && !error && (
            <p className="mb-3 text-sm font-medium text-emerald-700">{status}</p>
          )}

          {!loading && grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
              Nicio salvare încă. Din grilă apasă „Export PDF test” — se salvează
              automat în arhivă.
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <header className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">
                      {monthName(group.an, group.luna)}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {group.items.length}{" "}
                      {group.items.length === 1 ? "salvare" : "salvări"}
                    </p>
                  </header>
                  <ul className="divide-y divide-slate-100">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800">
                            {formatWhen(item.createdAt)}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-1">
                            {item.titlu}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void regenerate(item.id, item.an, item.luna)
                            }
                            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:opacity-50"
                          >
                            {busyId === item.id
                              ? "Se procesează…"
                              : "Generează PDF din nou"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void deleteItem(item)}
                            className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Șterge
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
