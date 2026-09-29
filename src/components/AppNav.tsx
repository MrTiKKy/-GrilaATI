"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PropunereButton } from "@/components/PropunereButton";

const links = [
  { href: "/", label: "Grilă" },
  { href: "/concedii", label: "Concedii" },
  { href: "/istoric", label: "Arhivă" },
  { href: "/conturi", label: "Conturi" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const [inviteCount, setInviteCount] = useState(0);
  const [isDev, setIsDev] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/invitatii");
      if (!res.ok) return;
      const data = (await res.json()) as { items: unknown[] };
      setInviteCount(data.items.length);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (pathname === "/login") return;
    void loadInvites();
    void (async () => {
      try {
        const res = await fetch("/api/conturi/me");
        if (!res.ok) {
          setIsDev(false);
          return;
        }
        const data = (await res.json()) as { user?: { isDev?: boolean } };
        setIsDev(Boolean(data.user?.isDev));
      } catch {
        setIsDev(false);
      }
    })();
  }, [pathname, loadInvites]);

  if (pathname === "/login") return null;

  const isWorkspacesPage = pathname === "/workspaces";
  const isDevPage = pathname.startsWith("/dezvoltator");

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 lg:px-4">
        <nav className="flex min-w-0 items-center gap-1 text-sm sm:gap-2">
          {!isWorkspacesPage &&
            !isDevPage &&
            links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "rounded-lg px-2.5 py-2 font-medium sm:py-1.5",
                    active
                      ? "bg-sky-50 text-sky-800"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
        </nav>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-1 sm:gap-2">
          <PropunereButton />
          {isDev && (
            <Link
              href="/dezvoltator/propuneri"
              className={[
                "rounded-lg px-2.5 py-2 text-sm font-medium sm:py-1.5",
                isDevPage
                  ? "bg-sky-50 text-sky-800"
                  : "text-slate-700 hover:bg-slate-100",
              ].join(" ")}
            >
              Propuneri
            </Link>
          )}
          <Link
            href="/workspaces"
            className={[
              "relative rounded-lg px-2.5 py-2 text-sm font-medium sm:py-1.5",
              isWorkspacesPage
                ? "bg-sky-50 text-sky-800"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {isWorkspacesPage ? "Workspace-uri" : "Schimbă workspace"}
            {inviteCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {inviteCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
