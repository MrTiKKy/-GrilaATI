"use client";

import { useCallback, useEffect, useState } from "react";

type CategorieItem = {
  id: string;
  nume: string;
  titluGrafic: string;
  ordine: number;
  activ: boolean;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

export function CategoriiSettingsForm() {
  const [items, setItems] = useState<CategorieItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newNume, setNewNume] = useState("");
  const [newTitlu, setNewTitlu] = useState("");
  const [creating, setCreating] = useState(false);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/categorii");
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { items: CategorieItem[] };
      setItems(
        [...(data.items ?? [])].sort((a, b) => a.ordine - b.ordine),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategorie() {
    const nume = newNume.trim();
    const titluGrafic = newTitlu.trim();
    if (!nume || !titluGrafic) {
      setError("Completează numele și titlul graficului");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/categorii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume, titluGrafic }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setNewNume("");
      setNewTitlu("");
      flash("Categorie adăugată");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut crea");
    } finally {
      setCreating(false);
    }
  }

  async function updateField(
    id: string,
    patch: Partial<Pick<CategorieItem, "nume" | "titluGrafic" | "activ">>,
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/categorii", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { item: CategorieItem };
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
    const idx = items.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const swap = direction === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= items.length) return;
    const next = [...items];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const ordineIds = next.map((c) => c.id);
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/categorii", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineIds }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { items: CategorieItem[] };
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

  async function deleteCategorie(id: string) {
    const row = items.find((c) => c.id === id);
    if (!row) return;
    const ok = window.confirm(`Ștergi categoria „${row.nume}”?`);
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/categorii", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 409) {
        const data = (await res.json()) as { error?: string };
        setError(
          data.error ??
            "Categoria are angajați sau programări — poți doar să o dezactivezi",
        );
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      flash("Categorie ștearsă");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Workspace
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Categorii grafic
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Taburi pe grilă, titluri export și ore O.SD per categorie.
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

        <div className="mt-6 space-y-3">
          {items.map((row, index) => (
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
                    aria-label={`Mută ${row.nume} în sus`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id || index === items.length - 1}
                    onClick={() => void move(row.id, "down")}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label={`Mută ${row.nume} în jos`}
                  >
                    ↓
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() =>
                      void updateField(row.id, { activ: !row.activ })
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {row.activ ? "Dezactivează" : "Reactivează"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void deleteCategorie(row.id)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  >
                    Șterge
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Nume tab
                  <input
                    type="text"
                    defaultValue={row.nume}
                    disabled={busyId === row.id}
                    key={`nume-${row.id}-${row.nume}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== row.nume) void updateField(row.id, { nume: v });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                  />
                </label>
                <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Titlu grafic
                  <input
                    type="text"
                    defaultValue={row.titluGrafic}
                    disabled={busyId === row.id}
                    key={`titlu-${row.id}-${row.titluGrafic}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== row.titluGrafic)
                        void updateField(row.id, { titluGrafic: v });
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
                  />
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {row.activ ? (
                  <span className="font-medium text-emerald-700">Activă</span>
                ) : (
                  <span className="font-medium text-slate-500">Inactivă</span>
                )}
                {" · "}
                Ordine {row.ordine}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Categorie nouă
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Nume tab
              <input
                type="text"
                value={newNume}
                onChange={(e) => setNewNume(e.target.value)}
                placeholder="ex. Asistenți"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Titlu grafic
              <input
                type="text"
                value={newTitlu}
                onChange={(e) => setNewTitlu(e.target.value)}
                placeholder="ex. GRAFIC ASISTENTI ATI"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={creating || !newNume.trim() || !newTitlu.trim()}
            onClick={() => void createCategorie()}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {creating ? "Se adaugă…" : "Adaugă categorie"}
          </button>
        </div>
      </div>
    </div>
  );
}
