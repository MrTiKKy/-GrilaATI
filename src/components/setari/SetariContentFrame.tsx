"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** export-pdf = editor full-height fără scroll de pagină; restul = scroll normal. */
export function SetariContentFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const editor = pathname?.includes("/setari/export-pdf");
  if (editor) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </section>
    );
  }
  return (
    <section className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-5 sm:py-5">
      {children}
    </section>
  );
}
