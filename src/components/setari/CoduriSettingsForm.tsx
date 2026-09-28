"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CodItem = {
  id: string;
  categorieId: string | null;
  cod: string;
  eticheta: string;
  culoare: string;
  ordine: number;
  activ: boolean;
  sistem: "CO" | "CM" | "CIC" | null;
  comportamentVechi: string | null;
};

type CategorieInfo = {
  id: string;
  nume: string;
  permiteTextLiber: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function isSistem(c: CodItem): boolean {
  return c.sistem === "CO" || c.sistem === "CM" || c.sistem === "CIC";
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoduriSettingsForm() {
  const [items, setItems] = useState<CodItem[]>([]);
  const [categorii, setCategorii] = useState<CategorieInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filtru categorie (null = common)
  const [filterCat, setFilterCat] = useState<string | null>(null);

  // New code form
  const [newCod, setNewCod] = useState("");
  const [newEticheta, setNewEticheta] = useState("");
  const [newCuloare, setNewCuloare] = useState("#111111");
  const [newCategorieId, setNewCategorieId] = useState<string>("__common__");
  const [creating, setCreating] = useState(false);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri");
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        items: CodItem[];
        categorii: CategorieInfo[];
      };
      setItems(
        [...(data.items ?? [])].sort((a, b) => a.ordine - b.ordine),
      );
      setCategorii(data.categorii ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Filtered items
  const filteredItems =
    filterCat === null
      ? items
      : filterCat === "__common__"
        ? items.filter((c) => c.categorieId === null)
        : items.filter(
            (c) => c.categorieId === filterCat || c.categorieId === null,
          );

  async function createCod() {
    const cod = newCod.trim();
    const eticheta = newEticheta.trim() || cod;
    if (!cod || cod.length > 6) {
      setError("Codul este obligatoriu (max 6 caractere)");
      return;
    }
    if (!HEX_RE.test(newCuloare)) {
      setError("Culoare invalidă");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const categorieId =
        newCategorieId === "__common__" ? null : newCategorieId;
      const res = await fetch("/api/setari/coduri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cod,
          eticheta,
          culoare: newCuloare,
          categorieId,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setNewCod("");
      setNewEticheta("");
      setNewCuloare("#111111");
      flash("Cod adăugat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut crea");
    } finally {
      setCreating(false);
    }
  }

  async function updateField(
    id: string,
    patch: Partial<Pick<CodItem, "eticheta" | "culoare" | "activ" | "cod">>,
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { item: CodItem };
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.item } : c)),
      );
      flash("Salvat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function move(id: string, direction: "up" | "down") {
    const idx = filteredItems.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= filteredItems.length) return;
    const next = [...filteredItems];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const ordineIds = next.map((c) => c.id);
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineIds }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { items: CodItem[] };
      setItems(
        [...(data.items ?? [])].sort((a, b) => a.ordine - b.ordine),
      );
      flash("Ordine actualizată");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reordonare eșuată");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteCod(id: string) {
    const row = items.find((c) => c.id === id);
    if (!row) return;
    const ok = window.confirm(`Ștergi codul „${row.cod}"?`);
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 409 || res.status === 403) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nu se poate șterge codul");
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      flash("Cod șters");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTextLiber(catId: string, value: boolean) {
    setBusyId(`tl-${catId}`);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorieId: catId, permiteTextLiber: value }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setCategorii((prev) =>
        prev.map((c) =>
          c.id === catId ? { ...c, permiteTextLiber: value } : c,
        ),
      );
      flash(value ? "Text liber activat" : "Text liber dezactivat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusyId(null);
    }
  }

  function categorieName(catId: string | null): string {
    if (catId === null) return "Comun (toate categoriile)";
    return categorii.find((c) => c.id === catId)?.nume ?? catId;
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Workspace
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Coduri programare
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Valorile disponibile în casutele de pe grilă. Codurile sistem
          (CO, CM, CIC) nu pot fi redenumite sau dezactivate.
        </p>

        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Codurile noi nu adaugă ore până la Faza 4.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
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

        {/* Category filter */}
        <div className="mt-4">
          <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Filtrează după categorie
          </label>
          <select
            value={filterCat ?? "__all__"}
            onChange={(e) => {
              const v = e.target.value;
              setFilterCat(
                v === "__all__"
                  ? null
                  : v === "__common__"
                    ? "__common__"
                    : v,
              );
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          >
            <option value="__all__">Toate codurile</option>
            <option value="__common__">Doar comune</option>
            {categorii.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nume}
              </option>
            ))}
          </select>
        </div>

        {/* permite_text_liber toggles */}
        {categorii.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-800">
              Text liber per categorie
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Permite angajaților să introducă text liber (max 6 caractere) în
              casute, pe lângă codurile definite.
            </p>
            <div className="mt-2 space-y-1">
              {categorii.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={cat.permiteTextLiber}
                    disabled={busyId === `tl-${cat.id}`}
                    onChange={(e) =>
                      void toggleTextLiber(cat.id, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                  />
                  <span className="text-sm text-slate-700">{cat.nume}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Code list */}
        <div className="mt-6 space-y-3">
          {filteredItems.map((row, index) => (
            <article
              key={row.id}
              className={[
                "rounded-xl border p-4",
                row.activ
                  ? "border-slate-200 bg-white"
                  : "border-slate-200 bg-slate-50 opacity-90",
              ].join(" ")}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={busyId === row.id || index === 0}
                    onClick={() => void move(row.id, "up")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label={`Mută ${row.cod} în sus`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={
                      busyId === row.id ||
                      index === filteredItems.length - 1
                    }
                    onClick={() => void move(row.id, "down")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label={`Mută ${row.cod} în jos`}
                  >
                    ↓
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-md border border-slate-200"
                    style={{ backgroundColor: row.culoare }}
                    title={row.culoare}
                  />
                  <span className="text-base font-bold text-slate-900">
                    {row.cod}
                  </span>
                  {row.eticheta !== row.cod && (
                    <span className="text-sm text-slate-500">
                      ({row.eticheta})
                    </span>
                  )}
                  {isSistem(row) && (
                    <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                      Sistem
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isSistem(row) && (
                    <>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() =>
                          void updateField(row.id, {
                            activ: !row.activ,
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {row.activ ? "Dezactivează" : "Reactivează"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => void deleteCod(row.id)}
                        className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      >
                        Șterge
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {/* Eticheta */}
                <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Etichetă
                  <input
                    type="text"
                    defaultValue={row.eticheta}
                    disabled={busyId === row.id || isSistem(row)}
                    key={`et-${row.id}-${row.eticheta}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== row.eticheta)
                        void updateField(row.id, { eticheta: v });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                  />
                </label>
                {/* Culoare */}
                <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Culoare
                  <div className="mt-1 flex gap-2">
                    <input
                      type="color"
                      defaultValue={row.culoare}
                      disabled={busyId === row.id}
                      key={`col-${row.id}-${row.culoare}`}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v && v !== row.culoare && HEX_RE.test(v))
                          void updateField(row.id, { culoare: v });
                      }}
                      className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <input
                      type="text"
                      defaultValue={row.culoare}
                      disabled={busyId === row.id}
                      key={`colhex-${row.id}-${row.culoare}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== row.culoare && HEX_RE.test(v))
                          void updateField(row.id, { culoare: v });
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                    />
                  </div>
                </label>
                {/* Categorie (read-only) */}
                <div className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Domeniu
                  <p className="mt-2 text-sm font-normal normal-case text-slate-700">
                    {categorieName(row.categorieId)}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                {row.activ ? (
                  <span className="font-medium text-emerald-700">Activ</span>
                ) : (
                  <span className="font-medium text-slate-500">Inactiv</span>
                )}
                {" · "}
                Ordine {row.ordine}
                {row.comportamentVechi && row.comportamentVechi !== row.cod && (
                  <>
                    {" · "}
                    Comportament: {row.comportamentVechi}
                  </>
                )}
              </p>
            </article>
          ))}
        </div>

        {/* New code form */}
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Cod nou</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Codurile noi nu adaugă ore pe weekend/O.SD până la Faza 4.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Cod (max 6 car.)
              <input
                type="text"
                maxLength={6}
                value={newCod}
                onChange={(e) => setNewCod(e.target.value)}
                placeholder="ex. G12"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Etichetă
              <input
                type="text"
                value={newEticheta}
                onChange={(e) => setNewEticheta(e.target.value)}
                placeholder="Afișare popup (opțional)"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Culoare
              <div className="mt-1 flex gap-2">
                <input
                  type="color"
                  value={newCuloare}
                  onChange={(e) => setNewCuloare(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
                />
                <input
                  type="text"
                  value={newCuloare}
                  onChange={(e) => setNewCuloare(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </div>
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Categorie
              <select
                value={newCategorieId}
                onChange={(e) => setNewCategorieId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              >
                <option value="__common__">
                  Comun (toate categoriile)
                </option>
                {categorii.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={creating || !newCod.trim()}
            onClick={() => void createCod()}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {creating ? "Se adaugă…" : "Adaugă cod"}
          </button>
        </div>
      </div>
    </div>
  );
}
