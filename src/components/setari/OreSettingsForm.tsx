"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type OreItem = {
  codId: string;
  cod: string;
  eticheta: string;
  oreVineri: number;
  oreSambata: number;
  oreDuminica: number;
};

type Cat = { id: string; nume: string };

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

export function OreSettingsForm() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [categorieId, setCategorieId] = useState("");
  const [items, setItems] = useState<OreItem[]>([]);
  const [drafts, setDrafts] = useState<
    Record<string, { v: string; s: string; d: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const applyItems = useCallback((list: OreItem[]) => {
    setItems(list);
    const d: Record<string, { v: string; s: string; d: string }> = {};
    for (const it of list) {
      d[it.codId] = {
        v: String(it.oreVineri),
        s: String(it.oreSambata),
        d: String(it.oreDuminica),
      };
    }
    setDrafts(d);
  }, []);

  const load = useCallback(
    async (catId: string) => {
      setLoading(true);
      setError(null);
      try {
        const url = catId
          ? `/api/setari/ore?categorie=${encodeURIComponent(catId)}`
          : "/api/setari/ore";
        const res = await fetch(url);
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as {
          categorii: Cat[];
          items: OreItem[];
          categorieId?: string;
        };
        setCats(data.categorii ?? []);
        const nextCat = catId || data.categorii?.[0]?.id || "";
        if (!catId && nextCat) {
          setCategorieId(nextCat);
          const res2 = await fetch(
            `/api/setari/ore?categorie=${encodeURIComponent(nextCat)}`,
          );
          if (!res2.ok) throw new Error(await readError(res2));
          const data2 = (await res2.json()) as {
            categorii: Cat[];
            items: OreItem[];
          };
          setCats(data2.categorii ?? []);
          applyItems(data2.items ?? []);
          return;
        }
        applyItems(data.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Eroare la încărcare");
      } finally {
        setLoading(false);
      }
    },
    [applyItems],
  );

  useEffect(() => {
    void load(categorieId);
  }, [categorieId, load]);

  const dirty = useMemo(() => {
    return items.some((it) => {
      const d = drafts[it.codId];
      if (!d) return false;
      return (
        d.v !== String(it.oreVineri) ||
        d.s !== String(it.oreSambata) ||
        d.d !== String(it.oreDuminica)
      );
    });
  }, [items, drafts]);

  async function onSave() {
    if (!categorieId) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const body = {
        categorieId,
        items: items.map((it) => ({
          codId: it.codId,
          oreVineri: drafts[it.codId]?.v ?? it.oreVineri,
          oreSambata: drafts[it.codId]?.s ?? it.oreSambata,
          oreDuminica: drafts[it.codId]?.d ?? it.oreDuminica,
        })),
      };
      const res = await fetch("/api/setari/ore", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));
      setStatus("Salvat");
      window.setTimeout(() => setStatus(null), 2500);
      await load(categorieId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Ore pe cod
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ore O.SD pe Vineri / Sâmbătă / Duminică, pe categorie.{" "}
          <Link href="/setari/coduri" className="text-sky-700 underline">
            Coduri
          </Link>
        </p>
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Orele se aplică la calculul O.SD al lunilor afișate; graficele deja
          arhivate rămân neschimbate.
        </p>

        <label className="mt-4 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Categorie
          <select
            value={categorieId}
            onChange={(e) => setCategorieId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nume}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
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

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">Cod</th>
                <th className="px-2 py-2 text-right">Vineri</th>
                <th className="px-2 py-2 text-right">Sâmbătă</th>
                <th className="px-2 py-2 text-right">Duminică</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.codId} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-slate-900">{it.cod}</span>
                    {it.eticheta !== it.cod && (
                      <span className="ml-2 text-xs text-slate-500">
                        {it.eticheta}
                      </span>
                    )}
                  </td>
                  {(["v", "s", "d"] as const).map((k) => (
                    <td key={k} className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        max={24}
                        step={0.5}
                        value={drafts[it.codId]?.[k] ?? "0"}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [it.codId]: {
                              v: prev[it.codId]?.v ?? "0",
                              s: prev[it.codId]?.s ?? "0",
                              d: prev[it.codId]?.d ?? "0",
                              [k]: e.target.value,
                            },
                          }))
                        }
                        className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-right tabular-nums outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-slate-500"
                  >
                    Niciun cod activ pe această categorie.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          disabled={saving || loading || !dirty || !categorieId}
          onClick={() => void onSave()}
          className="mt-4 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          {saving ? "Se salvează…" : "Salvează"}
        </button>
      </div>
    </div>
  );
}
