"use client";

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

  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      data-cell-active={active ? "true" : undefined}
      className={[
        "flex h-8 w-full min-w-[2.25rem] items-center justify-center gap-0.5 px-0.5",
        "text-[11px] font-medium text-slate-800",
        "transition-[background-color,box-shadow,border-color] duration-150 ease-out",
        "outline-none focus-visible:outline-none",
        weekend ? "bg-slate-100" : "bg-white",
        active
          ? "relative z-[1] bg-sky-50 ring-2 ring-sky-500 ring-inset"
          : "hover:bg-sky-50/70",
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
