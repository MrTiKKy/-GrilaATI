"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { handleUnauthorized } from "@/lib/authClient";

type PropunereListItem = {
  id: string;
  tip: string;
  titlu: string;
  status: string;
  emailAutor: string;
  numeWorkspace: string | null;
  pagina: string | null;
  createdAt: string;
};

type PropunereDetail = PropunereListItem & {
  mesaj: string;
  notaDev: string | null;
  updatedAt: string;
  workspaceId: string | null;
};

function formatBucharest(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      timeZone: "Europe/Bucharest",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function tipLabel(tip: string): string {
  switch (tip) {
    case "idee":
      return "Idee";
    case "problema":
      return "Problemă";
    case "altceva":
      return "Altceva";
    default:
      return tip;
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "noua":
      return "Nouă";
    case "citita":
      return "Citită";
    case "rezolvata":
      return "Rezolvată";
    case "respinsa":
      return "Respinsă";
    default:
      return s;
  }
}

export function PropuneriDevClient() {
  const [items, setItems] = useState<PropunereListItem[]>([]);
  const [nouaCount, setNouaCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [tipFilter, setTipFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PropunereDetail | null>(null);
  const [notaDraft, setNotaDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("noua");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (statusFilter) q.set("status", statusFilter);
      if (tipFilter) q.set("tip", tipFilter);
      const res = await fetch(`/api/propuneri?${q.toString()}`);
      if (handleUnauthorized(res)) return;
      if (res.status === 404) {
        setError("Negăsit");
        return;
      }
      if (!res.ok) throw new Error(`Eroare ${res.status}`);
      const data = (await res.json()) as {
        items: PropunereListItem[];
        nouaCount: number;
      };
      setItems(data.items);
      setNouaCount(data.nouaCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tipFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      const res = await fetch(`/api/propuneri/${id}`);
      if (handleUnauthorized(res)) return;
      if (!res.ok) throw new Error(`Eroare ${res.status}`);
      const data = (await res.json()) as { item: PropunereDetail };
      setDetail(data.item);
      setNotaDraft(data.item.notaDev ?? "");
      setStatusDraft(data.item.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare detaliu");
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/propuneri/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: statusDraft,
          notaDev: notaDraft.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`Eroare ${res.status}`);
      await load();
      await openDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare salvare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Dezvoltator
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Propuneri
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          <span className="font-semibold text-rose-600">{nouaCount}</span> noi
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-xs font-medium text-slate-500 uppercase">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case text-slate-800"
          >
            <option value="">Toate</option>
            <option value="noua">Nouă</option>
            <option value="citita">Citită</option>
            <option value="rezolvata">Rezolvată</option>
            <option value="respinsa">Respinsă</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-500 uppercase">
          Tip
          <select
            value={tipFilter}
            onChange={(e) => setTipFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm normal-case text-slate-800"
          >
            <option value="">Toate</option>
            <option value="idee">Idee</option>
            <option value="problema">Problemă</option>
            <option value="altceva">Altceva</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="text-sm font-medium text-rose-600">{error}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {loading ? (
            <li className="px-4 py-6 text-sm text-slate-500">Se încarcă…</li>
          ) : items.length === 0 ? (
            <li className="px-4 py-6 text-sm text-slate-500">Nicio propunere</li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void openDetail(item.id)}
                  className={[
                    "w-full px-4 py-3 text-left hover:bg-slate-50",
                    selectedId === item.id ? "bg-sky-50" : "",
                  ].join(" ")}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {item.titlu}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {tipLabel(item.tip)} · {statusLabel(item.status)} ·{" "}
                    {formatBucharest(item.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400">{item.emailAutor}</p>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!detail ? (
            <p className="text-sm text-slate-500">
              Selectează o propunere din listă.
            </p>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {detail.titlu}
              </h2>
              <p className="text-xs text-slate-500">
                {tipLabel(detail.tip)} · {statusLabel(detail.status)}
              </p>
              <dl className="space-y-1 text-sm text-slate-700">
                <div>
                  <dt className="inline text-slate-500">Autor: </dt>
                  <dd className="inline">{detail.emailAutor}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Workspace: </dt>
                  <dd className="inline">
                    {detail.numeWorkspace || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Pagină: </dt>
                  <dd className="inline font-mono text-xs">
                    {detail.pagina || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Creat: </dt>
                  <dd className="inline">
                    {formatBucharest(detail.createdAt)}
                  </dd>
                </div>
              </dl>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="whitespace-pre-wrap text-sm text-slate-800">
                  {detail.mesaj}
                </p>
              </div>

              <form onSubmit={(e) => void onSave(e)} className="space-y-3 border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-500 uppercase">
                  Status
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case"
                  >
                    <option value="noua">Nouă</option>
                    <option value="citita">Citită</option>
                    <option value="rezolvata">Rezolvată</option>
                    <option value="respinsa">Respinsă</option>
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-500 uppercase">
                  Notă dezvoltator
                  <textarea
                    value={notaDraft}
                    onChange={(e) => setNotaDraft(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {saving ? "Se salvează…" : "Salvează"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
