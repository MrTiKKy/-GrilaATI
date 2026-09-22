"use client";

import type { CSSProperties } from "react";
import { culoareHex, type ProgramareCuloare } from "@/lib/culoare";
import type { SectieValoare } from "@/lib/types";

type CellFocusProps = {
  value: string;
  ciorna?: SectieValoare | null;
  culoare?: ProgramareCuloare | null;
  active: boolean;
  weekend?: boolean;
  onClick: () => void;
};

export function CellFocus({
  value,
  ciorna,
  culoare,
  active,
  weekend,
  onClick,
}: CellFocusProps) {
  const sectie = ciorna === "A" || ciorna === "R" ? ciorna : null;
  const color = culoareHex(culoare);

  const activeRing: CSSProperties | undefined = active
    ? { boxShadow: "inset 0 0 0 2px rgb(14 165 233)" }
    : undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      tabIndex={-1}
      data-cell-active={active ? "true" : undefined}
      style={activeRing}
      className={[
        "flex h-full min-h-9 w-full min-w-[2.1rem] items-center justify-center gap-0.5 px-0",
        "text-[15px] font-medium",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "outline-none focus-visible:outline-none rounded-none",
        active
          ? "relative z-[1] bg-sky-50"
          : [
              weekend ? "bg-[#F5C09A]" : "bg-white",
              "hover:z-[1] hover:bg-sky-100",
              "hover:shadow-[inset_0_0_0_1.5px_rgb(56_189_248)]",
            ].join(" "),
      ].join(" ")}
    >
      <span
        className={[
          "leading-none font-semibold",
          value ? "" : sectie ? "text-slate-300" : "text-transparent",
        ].join(" ")}
        style={value ? { color } : undefined}
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
