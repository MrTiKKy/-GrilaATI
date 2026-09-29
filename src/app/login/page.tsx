"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nume, setNume] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Autentificare eșuată");
        return;
      }
      const next = searchParams.get("next") || "/workspaces";
      router.replace(next.startsWith("/") ? next : "/workspaces");
      router.refresh();
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  async function onRegisterSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (password !== confirmPassword) {
        setError("Parolele nu coincid");
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume, email, password, confirmPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Înregistrare eșuată");
        return;
      }
      router.replace("/workspaces");
      router.refresh();
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "register") {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center bg-slate-100 px-4 py-10">
        <form
          onSubmit={onRegisterSubmit}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60"
        >
          <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
            Cont nou
          </p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            Creează cont
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Completează datele pentru a-ți crea un cont.
          </p>

          <label className="mt-5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Nume
            <input
              type="text"
              autoFocus
              autoComplete="name"
              required
              minLength={1}
              maxLength={80}
              value={nume}
              onChange={(e) => setNume(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          <label className="mt-3 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Email
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          <label className="mt-3 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Parolă (min. 10 caractere)
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          <label className="mt-3 block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Confirmă parola
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
            />
          </label>

          {error && (
            <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password || !confirmPassword || !nume}
            className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? "Se creează…" : "Creează cont"}
          </button>

          <p className="mt-4 text-center text-sm text-slate-500">
            Ai deja cont?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className="font-medium text-sky-600 hover:text-sky-700"
            >
              Autentifică-te
            </button>
          </p>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-slate-100 px-4 py-10">
      <form
        onSubmit={onLoginSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/60"
      >
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Acces securizat
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">
          Autentificare Grila ATI
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Introdu emailul și parola pentru a continua.
        </p>

        <label className="mt-5 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Email
          <input
            type="email"
            autoFocus
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          />
        </label>

        <label className="mt-3 block text-xs font-medium tracking-wide text-slate-500 uppercase">
          Parolă
          <input
            type="password"
            autoComplete="current-password"
            required
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
          disabled={loading || !email || !password}
          className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "Se verifică…" : "Intră"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Nu ai cont?{" "}
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className="font-medium text-sky-600 hover:text-sky-700"
          >
            Creează cont
          </button>
        </p>
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
