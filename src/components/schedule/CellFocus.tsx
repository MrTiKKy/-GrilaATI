"use client";

import type { CSSProperties } from "react";
import { culoareHex, type ProgramareCuloare } from "@/lib/culoare";
import { layoutCellText } from "@/lib/cellText";
import type { SectieValoare } from "@/lib/types";

type CellFocusProps = {
  value: string;
  ciorna?: SectieValoare | null;
  culoare?: ProgramareCuloare | null;
  /** Hex din tabelul coduri; manualul (non-black) are prioritate */
  codCuloare?: string | null;
  active: boolean;
  weekend?: boolean;
  onClick: () => void;
};

export function CellFocus({
  value,
  ciorna,
  culoare,
  codCuloare,
  active,
  weekend,
  onClick,
}: CellFocusProps) {
  const sectie = ciorna === "A" || ciorna === "R" ? ciorna : null;
  const manual = culoare && culoare !== "black" ? culoareHex(culoare) : null;
  const color = manual || codCuloare || culoareHex("black");
  const layout = layoutCellText(value);

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
      title={layout.truncated || value.length > 5 ? layout.title || value : undefined}
      data-cell-active={active ? "true" : undefined}
      style={activeRing}
      className={[
        "flex h-full min-h-9 w-full items-center justify-center gap-0.5 px-0.5",
        "font-medium",
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
          "flex max-w-full flex-col items-center justify-center leading-tight font-semibold",
          value ? "" : sectie ? "text-slate-300" : "text-transparent",
        ].join(" ")}
        style={
          value
            ? { color, fontSize: `${layout.fontSize}px` }
            : { fontSize: `${layout.fontSize}px` }
        }
      >
        {value
          ? layout.lines.map((line, i) => (
              <span key={i} className="max-w-full truncate">
                {line}
              </span>
            ))
          : "·"}
      </span>
      {sectie && (
        <span className="draft-only text-[9px] font-bold leading-none text-amber-700">
          {sectie}
        </span>
      )}
    </button>
  );
}
