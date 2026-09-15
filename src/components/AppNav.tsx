"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between gap-3 px-3 py-2 sm:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            Grilă
          </Link>
          <Link
            href="/concedii"
            className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            Concedii
          </Link>
          <Link
            href="/istoric"
            className="rounded-lg px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
          >
            Arhivă
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Ieșire
        </button>
      </div>
    </div>
  );
}
