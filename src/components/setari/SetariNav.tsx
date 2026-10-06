"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETARI_TABS } from "@/lib/setariTabs";

export function SetariNav() {
  const pathname = usePathname();
  const tabs = SETARI_TABS.filter((tab) => tab.enabled);

  return (
    <nav aria-label="Setări" className="border-b border-slate-200">
      <div className="flex gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/setari"
              ? pathname === "/setari"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "relative shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "text-sky-700"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {tab.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute right-2 bottom-0 left-2 h-[2.5px] rounded-full bg-sky-600"
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
