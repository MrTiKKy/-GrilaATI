"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Grilă" },
  { href: "/concedii", label: "Concedii" },
  { href: "/istoric", label: "Arhivă" },
  { href: "/conturi", label: "Conturi" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  return (
    <div className="border-b border-slate-200 bg-white/90">
      <div className="mx-auto flex w-full max-w-[1800px] items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 lg:px-4">
        <nav className="flex min-w-0 items-center gap-1 text-sm sm:gap-2">
          {links.map((link) => {
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
      </div>
    </div>
  );
}
