"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETARI_TABS } from "@/lib/setariTabs";

export function SetariNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Setări"
      className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:px-3 lg:py-4"
    >
      {SETARI_TABS.map((tab) => {
        const isActive =
          tab.href === "/setari"
            ? pathname === "/setari"
            : pathname.startsWith(tab.href);
        if (!tab.enabled) {
          return (
            <span
              key={tab.id}
              className="flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 lg:w-full"
              aria-disabled="true"
              title="În curând"
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                în curând
              </span>
            </span>
          );
        }
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:w-full",
              isActive
                ? "bg-sky-50 text-sky-800"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
