"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type MemberItem = {
  userId: string;
  email: string;
  nume: string | null;
  rol: string;
  poateModificaSetari: boolean;
  isOwner: boolean;
  createdAt: string;
};

type InviteItem = {
  id: string;
  email: string;
  rol: string;
  poateModificaSetari: boolean;
  status: string;
  createdAt: string;
  invitatDeEmail: string;
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

export function MembriSettingsForm() {
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Invite form
  const [invEmail, setInvEmail] = useState("");
  const [invRol, setInvRol] = useState("editor");
  const [invPoate, setInvPoate] = useState(false);
  const [sending, setSending] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, iRes] = await Promise.all([
        fetch("/api/setari/membri"),
        fetch("/api/setari/membri/invitatii"),
      ]);
      if (!mRes.ok) throw new Error(await readError(mRes));
      if (!iRes.ok) throw new Error(await readError(iRes));
      const mData = (await mRes.json()) as { items: MemberItem[] };
      const iData = (await iRes.json()) as { items: InviteItem[] };
      setMembers(mData.items);
      setInvites(iData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendInvite(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/membri/invitatii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: invEmail,
          rol: invRol,
          poateModificaSetari: invPoate,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setInvEmail("");
      setInvPoate(false);
      flash("Invitație trimisă");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la trimitere");
    } finally {
      setSending(false);
    }
  }

  async function cancelInvite(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch("/api/setari/membri/invitatii", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(await readError(res));
      flash("Invitație anulată");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setActionLoading(null);
    }
  }

  async function updateMember(
    userId: string,
    update: { rol?: string; poateModificaSetari?: boolean },
  ) {
    setActionLoading(userId);
    try {
      const res = await fetch("/api/setari/membri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...update }),
      });
      if (!res.ok) throw new Error(await readError(res));
      flash("Membru actualizat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setActionLoading(null);
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm("Sigur vrei să elimini acest membru?")) return;
    setActionLoading(userId);
    try {
      const res = await fetch("/api/setari/membri", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(await readError(res));
      flash("Membru eliminat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Membri
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Gestionare membri
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Adaugă sau elimină membri din workspace.
        </p>
      </div>

      {error && (
        <p className="text-sm font-medium text-rose-600">{error}</p>
      )}
      {status && !error && (
        <p className="text-sm font-medium text-emerald-700">{status}</p>
      )}

      {/* Invite form */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">
          Trimite invitație
        </h2>
        <form
          onSubmit={(e) => void sendInvite(e)}
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
            Email
            <input
              type="email"
              required
              value={invEmail}
              onChange={(e) => setInvEmail(e.target.value)}
              placeholder="email@exemplu.ro"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </label>
          <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Rol
            <select
              value={invRol}
              onChange={(e) => setInvRol(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 sm:w-32"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Vizualizare</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={invPoate}
              onChange={(e) => setInvPoate(e.target.checked)}
              className="rounded border-slate-300"
            />
            Poate modifica setări
          </label>
          <button
            type="submit"
            disabled={sending || !invEmail}
            className="shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {sending ? "Se trimite…" : "Invită"}
          </button>
        </form>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-800">
            Invitații în așteptare
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {inv.email}
                  </p>
                  <p className="text-xs text-slate-500">
                    Rol: {rolLabel(inv.rol)}
                    {inv.poateModificaSetari && " · Poate modifica setări"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionLoading === inv.id}
                  onClick={() => void cancelInvite(inv.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Anulează
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Membri</h2>
        {loading ? (
          <p className="mt-3 text-sm text-sky-700">Se încarcă…</p>
        ) : members.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Niciun membru.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {m.nume || m.email}
                    {m.isOwner && (
                      <span className="ml-2 text-xs font-medium text-sky-700">
                        Owner
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    {m.email} · {rolLabel(m.rol)}
                    {m.poateModificaSetari && " · Setări"}
                  </p>
                </div>
                {!m.isOwner && (
                  <div className="flex items-center gap-2">
                    <select
                      value={m.rol}
                      disabled={actionLoading === m.userId}
                      onChange={(e) =>
                        void updateMember(m.userId, { rol: e.target.value })
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700"
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Vizualizare</option>
                    </select>
                    <button
                      type="button"
                      disabled={actionLoading === m.userId}
                      onClick={() => void removeMember(m.userId)}
                      className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                    >
                      Elimină
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
