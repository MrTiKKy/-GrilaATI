"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { WorkspaceRole } from "@/lib/workspace";

type GeneralPayload = {
  nume: string;
  rol: WorkspaceRole;
  isOwner: boolean;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function rolLabel(rol: WorkspaceRole): string {
  if (rol === "admin") return "Admin";
  if (rol === "editor") return "Editor";
  return "Viewer";
}

export function GeneralSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [nume, setNume] = useState("");
  const [savedNume, setSavedNume] = useState("");
  const [rol, setRol] = useState<WorkspaceRole | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/general");
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as GeneralPayload;
      setNume(data.nume);
      setSavedNume(data.nume);
      setRol(data.rol);
      setIsOwner(data.isOwner);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = nume.trim().replace(/\s+/g, " ");
    if (!trimmed) {
      setError("Numele workspace-ului nu poate fi gol");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume: trimmed }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as GeneralPayload;
      setNume(data.nume);
      setSavedNume(data.nume);
      setRol(data.rol);
      setIsOwner(data.isOwner);
      flash("Salvat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Se încarcă…</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">General</h1>
        <p className="mt-1 text-sm text-slate-600">
          Numele și rolul tău în workspace-ul activ.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {status && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {status}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-800">
            Nume workspace
          </span>
          <input
            type="text"
            value={nume}
            onChange={(e) => setNume(e.target.value)}
            maxLength={120}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-200 focus:border-sky-300 focus:ring-2"
            autoComplete="organization"
          />
        </label>

        <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Rolul tău
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {rol ? rolLabel(rol) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Owner
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {isOwner ? "Da" : "Nu"}
            </dd>
          </div>
        </dl>

        <button
          type="submit"
          disabled={saving || nume.trim().replace(/\s+/g, " ") === savedNume}
          className="rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? "Se salvează…" : "Salvează"}
        </button>
      </form>
    </div>
  );
}
