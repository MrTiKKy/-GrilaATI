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

  const activeRing: CSSProperties | undefined = active
    ? { boxShadow: "inset 0 0 0 2px rgb(14 165 233)" }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => {
        // Previne focus + scroll automat în container la click
        e.preventDefault();
      }}
      tabIndex={-1}
      data-cell-active={active ? "true" : undefined}
      style={activeRing}
      className={[
        "flex h-full min-h-8 w-full min-w-[2.25rem] items-center justify-center gap-0.5 px-0.5",
        "text-[11px] font-medium text-slate-800",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "outline-none focus-visible:outline-none rounded-none",
        active
          ? "relative z-[1] bg-sky-50"
          : [
              weekend ? "bg-slate-100" : "bg-white",
              "hover:z-[1] hover:bg-sky-100",
              "hover:shadow-[inset_0_0_0_1.5px_rgb(56_189_248)]",
            ].join(" "),
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
