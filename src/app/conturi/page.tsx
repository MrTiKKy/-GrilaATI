"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type MeUser = {
  id: string;
  email: string;
  createdAt: string;
};

type ContItem = {
  id: string;
  email: string;
  activ: boolean;
  createdAt: string;
  isMe: boolean;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ConturiPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeUser | null>(null);
  const [items, setItems] = useState<ContItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, listRes] = await Promise.all([
        fetch("/api/conturi/me"),
        fetch("/api/conturi"),
      ]);
      if (!meRes.ok) throw new Error(await readError(meRes));
      if (!listRes.ok) throw new Error(await readError(listRes));
      const meData = (await meRes.json()) as { user: MeUser };
      const listData = (await listRes.json()) as { items: ContItem[] };
      setMe(meData.user);
      setEmail(meData.user.email);
      setItems(listData.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!currentPassword) {
      setError("Introdu parola curentă pentru a salva");
      return;
    }
    setSavingProfile(true);
    setError(null);
    try {
      const body: {
        currentPassword: string;
        email?: string;
        newPassword?: string;
      } = { currentPassword };
      if (email.trim().toLowerCase() !== me?.email) {
        body.email = email.trim();
      }
      if (newPassword) body.newPassword = newPassword;

      const res = await fetch("/api/conturi/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { user: MeUser };
      setMe(data.user);
      setEmail(data.user.email);
      setCurrentPassword("");
      setNewPassword("");
      flash("Profil actualizat");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Salvare eșuată");
    } finally {
      setSavingProfile(false);
    }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/conturi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newUserPassword,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setNewEmail("");
      setNewUserPassword("");
      flash("Cont creat");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creare eșuată");
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-full flex-1 bg-slate-100 py-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
                Conturi
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                Gestionare conturi
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Schimbă emailul / parola ta sau creează conturi pentru colegi.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href="/"
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 sm:py-2"
              >
                ← Înapoi la grilă
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-50 sm:py-2"
              >
                Deconectare
              </button>
            </div>
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

          <form onSubmit={(e) => void saveProfile(e)} className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Contul tău</h2>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Parola curentă (obligatorie la salvare)
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Parolă nouă (opțional)
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minim 8 caractere"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <button
              type="submit"
              disabled={savingProfile || loading}
              className="w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50 sm:w-auto"
            >
              {savingProfile ? "Se salvează…" : "Salvează profilul"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">
            Creează cont nou
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Pentru cineva care ți-a cerut acces la aplicație.
          </p>
          <form
            onSubmit={(e) => void createUser(e)}
            className="mt-4 space-y-3"
          >
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Email
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Parolă inițială
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Minim 8 caractere"
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
            </label>
            <button
              type="submit"
              disabled={creating || !newEmail || !newUserPassword}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:opacity-50 sm:w-auto"
            >
              {creating ? "Se creează…" : "Creează cont"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-800">
            Conturi existente
          </h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {items.length === 0 && !loading ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                Niciun cont.
              </li>
            ) : (
              items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {item.email}
                      {item.isMe && (
                        <span className="ml-2 text-xs font-medium text-sky-700">
                          (tu)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Creat {formatWhen(item.createdAt)}
                      {!item.activ && " · inactiv"}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </main>
  );
}
