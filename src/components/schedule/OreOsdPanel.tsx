"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ORE_OSD_COLUMNS,
  ORE_OSD_DEFAULT_TEMPLATE,
  mergeWithDefaultsForCategorie,
  oreOsdKey,
  type OreOsdCell,
  type OreOsdZi,
  type OreOsdSchimb,
} from "@/lib/oreOsd";

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

type OreOsdPanelProps = {
  categorieId: string;
  categorieNume: string;
  onRatesChange?: (cells: OreOsdCell[]) => void;
};

function defaultCellsFor(categorieId: string): OreOsdCell[] {
  return ORE_OSD_DEFAULT_TEMPLATE.map((d) => ({
    categorieId,
    zi: d.zi,
    schimb: d.schimb,
    ore: d.ore,
  }));
}

export function OreOsdPanel({
  categorieId,
  categorieNume,
  onRatesChange,
}: OreOsdPanelProps) {
  const [cells, setCells] = useState<OreOsdCell[]>(() =>
    defaultCellsFor(categorieId),
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const syncDrafts = useCallback((list: OreOsdCell[]) => {
    const next: Record<string, string> = {};
    for (const c of list) {
      next[oreOsdKey(c.categorieId, c.zi, c.schimb)] = String(c.ore);
    }
    setDrafts(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/ore-osd?categorie=${encodeURIComponent(categorieId)}`,
        );
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as { items: OreOsdCell[] };
        if (cancelled) return;
        const merged = mergeWithDefaultsForCategorie(
          categorieId,
          data.items ?? [],
        );
        setCells(merged);
        syncDrafts(merged);
        onRatesChange?.(merged);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Eroare la încărcare");
          const defaults = defaultCellsFor(categorieId);
          syncDrafts(defaults);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [categorieId, onRatesChange, syncDrafts]);

  function flash(msg: string) {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2000);
  }

  function getOre(zi: OreOsdZi, schimb: OreOsdSchimb) {
    return (
      cells.find(
        (c) =>
          c.categorieId === categorieId &&
          c.zi === zi &&
          c.schimb === schimb,
      )?.ore ?? 0
    );
  }

  async function saveCell(zi: OreOsdZi, schimb: OreOsdSchimb) {
    const key = oreOsdKey(categorieId, zi, schimb);
    const raw = (drafts[key] ?? "").trim().replace(",", ".");
    const ore = Number(raw);
    if (!Number.isFinite(ore) || ore < 0 || ore > 48) {
      setError("Introdu un număr între 0 și 48");
      setDrafts((d) => ({
        ...d,
        [key]: String(getOre(zi, schimb)),
      }));
      return;
    }
    const rounded = Math.round(ore * 10) / 10;
    if (rounded === getOre(zi, schimb)) {
      setDrafts((d) => ({ ...d, [key]: String(rounded) }));
      return;
    }

    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/ore-osd", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorieId, zi, schimb, ore: rounded }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { item: OreOsdCell };
      const next = mergeWithDefaultsForCategorie(
        categorieId,
        cells
          .filter((c) => oreOsdKey(c.categorieId, c.zi, c.schimb) !== key)
          .concat([data.item]),
      );
      setCells(next);
      syncDrafts(next);
      onRatesChange?.(next);
      flash("Salvat");
    } catch (e) {
      setDrafts((d) => ({
        ...d,
        [key]: String(getOre(zi, schimb)),
      }));
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Ore suplimentare · {categorieNume}
        </p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Ore O.SD
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Vineri doar 1/3 · Sâmbătă / Duminică: 1, 1/3, 2
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
        {loading && (
          <span className="font-medium text-sky-700">Se încarcă…</span>
        )}
        {error && (
          <span className="font-medium text-rose-600">{error}</span>
        )}
        {status && !error && (
          <span className="font-medium text-emerald-700">{status}</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold tracking-wide text-slate-500 uppercase sm:text-xs">
              {ORE_OSD_COLUMNS.map((col) => (
                <th
                  key={`${col.zi}-${col.schimb}`}
                  className="px-2 py-2.5 text-center"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 last:border-0">
              {ORE_OSD_COLUMNS.map((col) => {
                const key = oreOsdKey(categorieId, col.zi, col.schimb);
                const busy = savingKey === key;
                return (
                  <td key={key} className="px-1.5 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={48}
                      step={0.5}
                      inputMode="decimal"
                      disabled={loading || busy}
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({
                          ...d,
                          [key]: e.target.value,
                        }))
                      }
                      onBlur={() => void saveCell(col.zi, col.schimb)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-14 rounded-lg border border-slate-200 bg-white px-1.5 py-1.5 text-center text-sm tabular-nums text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                      aria-label={`${categorieNume} ${col.label}`}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
