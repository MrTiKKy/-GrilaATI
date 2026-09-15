"use client";

import type { CSSProperties } from "react";
import type { SectieValoare } from "@/lib/types";

type CellFocusProps = {
  value: string;
  ciorna?: SectieValoare | null;
  active: boolean;
  weekend?: boolean;
  onClick: () => void;
};

export function CellFocus({
  value,
  ciorna,
  active,
  weekend,
  onClick,
}: CellFocusProps) {
  const sectie = ciorna === "A" || ciorna === "R" ? ciorna : null;

  // Verticale mai vizibile, orizontale fine — pe buton, ca să nu fie acoperite
  const gridShadow: CSSProperties["boxShadow"] = [
    "inset -1px 0 0 0 #94a3b8", // vertical
    "inset 0 -1px 0 0 #e2e8f0", // orizontal subțire
    active ? "inset 0 0 0 2px rgb(14 165 233)" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      data-cell-active={active ? "true" : undefined}
      style={{ boxShadow: gridShadow }}
      className={[
        "flex h-9 w-full min-w-[2.5rem] items-center justify-center gap-0.5 px-0.5 lg:h-8 lg:min-w-[2.25rem]",
        "text-[11px] font-medium text-slate-800",
        "transition-[background-color] duration-150 ease-out",
        "outline-none focus-visible:outline-none rounded-none",
        weekend ? "bg-slate-100" : "bg-white",
        active ? "relative z-[1] bg-sky-50" : "hover:bg-sky-50/70",
      ].join(" ")}
    >
      <span
        className={[
          "leading-none",
          value ? "text-slate-900" : sectie ? "text-slate-300" : "text-transparent",
        ].join(" ")}
      >
        {value || "·"}
      </span>
      {sectie && (
        <span className="draft-only text-[9px] font-bold leading-none text-amber-700">
          {sectie}
        </span>
      )}
    </button>
  );
}
