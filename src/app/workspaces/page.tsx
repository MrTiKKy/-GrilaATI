"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type WorkspaceItem = {
  id: string;
  nume: string;
  isOwner: boolean;
  rol: string;
  poateModificaSetari: boolean;
  memberCount: number;
  ownerEmail: string;
  ownerNume: string | null;
};

type InviteItem = {
  id: string;
  rol: string;
  poateModificaSetari: boolean;
  workspaceNume: string;
  ownerEmail: string;
  ownerNume: string | null;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function rolLabel(rol: string): string {
  switch (rol) {
    case "admin":
      return "Admin";
    case "editor":
      return "Editor";
    case "viewer":
      return "Vizualizare";
    default:
      return rol;
  }
}

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, invRes] = await Promise.all([
        fetch("/api/workspaces"),
        fetch("/api/invitatii"),
      ]);
      if (!wsRes.ok) throw new Error(await readError(wsRes));
      if (!invRes.ok) throw new Error(await readError(invRes));
      const wsData = (await wsRes.json()) as { items: WorkspaceItem[] };
      const invData = (await invRes.json()) as { items: InviteItem[] };
      setWorkspaces(wsData.items);
      setInvites(invData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectWorkspace(id: string) {
    try {
      const res = await fetch("/api/workspaces/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: id }),
      });
      if (!res.ok) throw new Error(await readError(res));
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la selectare");
    }
  }

  async function createWorkspace(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume: createName }),
      });
      if (!res.ok) throw new Error(await readError(res));
      router.replace("/setari?welcome=1");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la creare");
    } finally {
      setCreating(false);
    }
  }

  async function acceptInvite(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitatii/${id}/accept`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readError(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setActionLoading(null);
    }
  }

  async function refuseInvite(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/invitatii/${id}/refuse`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(await readError(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <main className="min-h-full flex-1 bg-slate-100 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 sm:px-6">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
                Workspace-uri
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Alege un workspace
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Selectează un workspace existent sau creează unul nou.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreate(!showCreate)}
              className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              + Workspace nou
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-sm font-medium text-rose-600">{error}</p>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-800">
              Creează workspace nou
            </h2>
            <form
              onSubmit={(e) => void createWorkspace(e)}
              className="mt-3 flex items-end gap-3"
            >
              <label className="flex-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Nume workspace
                <input
                  type="text"
                  autoFocus
                  required
                  minLength={2}
                  maxLength={80}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="ex: Clinica Mea"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              </label>
              <button
                type="submit"
                disabled={creating || createName.trim().length < 2}
                className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
              >
                {creating ? "Se creează…" : "Creează"}
              </button>
            </form>
          </div>
        )}

        {/* Invites */}
        {invites.length > 0 && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 shadow-sm shadow-slate-200/60 sm:p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                Invitații
              </h2>
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
                {invites.length}
              </span>
            </div>
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {inv.workspaceNume}
                    </p>
                    <p className="text-xs text-slate-500">
                      De la {inv.ownerNume || inv.ownerEmail} · Rol:{" "}
                      {rolLabel(inv.rol)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionLoading === inv.id}
                      onClick={() => void acceptInvite(inv.id)}
                      className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                    >
                      Acceptă
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading === inv.id}
                      onClick={() => void refuseInvite(inv.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Refuză
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Workspaces list */}
        {loading ? (
          <p className="text-sm font-medium text-sky-700">Se încarcă…</p>
        ) : workspaces.length === 0 && invites.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm shadow-slate-200/60">
            <p className="text-base font-medium text-slate-800">
              Bine ai venit!
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Creează primul tău workspace pentru a începe.
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Creează primul tău workspace
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200/60">
            <p className="text-sm text-slate-500">
              Nu faci parte încă din niciun workspace. Acceptă o invitație sau
              creează unul nou.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => void selectWorkspace(ws.id)}
                className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm shadow-slate-200/60 transition-all hover:border-sky-300 hover:shadow-sky-100"
              >
                <p className="text-sm font-semibold text-slate-900 group-hover:text-sky-800">
                  {ws.nume}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {ws.isOwner ? "Owner" : rolLabel(ws.rol)}
                  {ws.poateModificaSetari ? " · setări da" : ""} ·{" "}
                  {ws.memberCount}{" "}
                  {ws.memberCount === 1 ? "participant" : "participanți"}
                </p>
                {!ws.isOwner && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Owner: {ws.ownerNume || ws.ownerEmail}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
