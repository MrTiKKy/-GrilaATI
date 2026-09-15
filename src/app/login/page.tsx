"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Autentificare eșuată");
        return;
      }
      const next = searchParams.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-100 px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60"
      >
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Acces secție
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Autentificare Grila ATI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Introdu parola de secție pentru a continua.
        </p>

        <label className="mt-5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Parolă
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          />
        </label>

        {error && (
          <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Se verifică…" : "Intră"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-full flex-1 items-center justify-center text-sm text-slate-500">
          Se încarcă…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
