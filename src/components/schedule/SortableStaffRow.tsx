"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { CellFocus } from "./CellFocus";

export type StaffMember = {
  id: string;
  name: string;
  zileCoAn: number;
  zileCoFolosite: number;
  zileCoRamase: number;
};

type ColumnForRow =
  | { kind: "day"; key: string; weekend: boolean }
  | { kind: "custom"; key: string };

type SortableStaffRowProps = {
  staff: StaffMember;
  rowIndex: number;
  columns: ColumnForRow[];
  values: Record<string, { valoare: string; ciorna: "A" | "R" | null }>;
  activeCol: number | null;
  onActivate: (row: number, col: number) => void;
  onDelete: (staff: StaffMember) => void;
  onCellFocus: () => void;
};

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className="text-slate-400"
    >
      <circle cx="5" cy="4" r="1.2" />
      <circle cx="11" cy="4" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="11" cy="12" r="1.2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function SortableStaffRow({
  staff,
  rowIndex,
  columns,
  values,
  activeCol,
  onActivate,
  onDelete,
  onCellFocus,
}: SortableStaffRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: staff.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "transform 150ms ease",
    opacity: isDragging ? 0.85 : 1,
    position: "relative",
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={[
        "group bg-white",
        isDragging ? "shadow-md shadow-slate-300/50 ring-1 ring-sky-300" : "",
      ].join(" ")}
    >
      <th
        scope="row"
        className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-1.5 py-0 text-left group-hover:bg-slate-50"
      >
        <div className="flex min-w-[168px] items-center gap-0.5">
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing touch-none"
            aria-label={`Mută ${staff.name}`}
            title="Trage pentru reordonare"
            {...attributes}
            {...listeners}
          >
            <GripIcon />
          </button>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
            <span className="truncate text-[11px] font-semibold tracking-wide text-slate-800 uppercase">
              {staff.name}
            </span>
            <span
              className={[
                "text-[9px] font-medium leading-none tabular-nums",
                staff.zileCoAn === 0
                  ? "text-slate-400"
                  : staff.zileCoRamase < 0
                    ? "text-rose-600"
                    : "text-sky-700",
              ].join(" ")}
              title="Zile CO rămase (an curent)"
            >
              CO{" "}
              {staff.zileCoAn === 0 && staff.zileCoFolosite === 0
                ? "—"
                : staff.zileCoRamase}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onDelete(staff)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-70 transition-all duration-150 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
            aria-label={`Șterge ${staff.name}`}
            title="Șterge angajat"
          >
            <TrashIcon />
          </button>
        </div>
      </th>
      {columns.map((col, colIndex) => {
        const isActive = activeCol === colIndex;
        const weekend = col.kind === "day" ? col.weekend : false;
        return (
          <td
            key={`${staff.id}-${col.key}`}
            className={[
              "border-b border-slate-100 p-0",
              weekend ? "bg-slate-100" : "bg-white",
              col.kind === "custom" ? "border-l border-slate-100" : "",
            ].join(" ")}
          >
            <CellFocus
              value={values[col.key]?.valoare ?? ""}
              ciorna={values[col.key]?.ciorna ?? null}
              active={isActive}
              weekend={weekend}
              onClick={() => {
                onActivate(rowIndex, colIndex);
                onCellFocus();
              }}
            />
          </td>
        );
      })}
      <td className="border-b border-l border-slate-100 bg-slate-50/80 px-1.5 text-center text-slate-400">
        —
      </td>
    </tr>
  );
}

export function SortableOverlayRow({ children }: { children: ReactNode }) {
  return (
    <table className="border-collapse text-[11px]">
      <tbody>{children}</tbody>
    </table>
  );
}
