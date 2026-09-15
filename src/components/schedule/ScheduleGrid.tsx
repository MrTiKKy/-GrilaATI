"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { LunaResponse } from "@/lib/types";
import { AddStaffDialog } from "./AddStaffDialog";
import { CellFocus } from "./CellFocus";
import {
  RightOptionPanel,
  type ConfirmPayload,
  type PanelContext,
} from "./RightOptionPanel";
import {
  SortableOverlayRow,
  SortableStaffRow,
  type StaffMember,
} from "./SortableStaffRow";
import { downloadGraficPdf } from "@/components/pdf/exportGraficPdf";
import type { GraficPdfData } from "@/components/pdf/GraficAtiPdf";

const DAY_ABBR = ["D", "L", "Ma", "Mi", "J", "V", "S"] as const;

type DayColumn = {
  kind: "day";
  key: string;
  day: number;
  abbr: string;
  weekend: boolean;
  date: string; // YYYY-MM-DD
};

type ActiveCell = { row: number; col: number };

type CellData = { valoare: string; ciorna: "A" | "R" | null };

// staffId -> columnKey (d-N) -> cell
type GridState = Record<string, Record<string, CellData>>;

function buildDayColumns(year: number, monthIndex: number): DayColumn[] {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const weekday = new Date(year, monthIndex, day).getDay();
    const abbr = DAY_ABBR[weekday];
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      kind: "day" as const,
      key: `d-${day}`,
      day,
      abbr,
      weekend: abbr === "S" || abbr === "D",
      date,
    };
  });
}

function emptyCell(): CellData {
  return { valoare: "", ciorna: null };
}

function emptyRow(columns: DayColumn[]): Record<string, CellData> {
  const row: Record<string, CellData> = {};
  for (const col of columns) row[col.key] = emptyCell();
  return row;
}

function monthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1)
    .toLocaleDateString("ro-RO", { month: "long", year: "numeric" })
    .toUpperCase();
}

function mapLunaToState(
  data: LunaResponse,
  columns: DayColumn[],
): { staff: StaffMember[]; grid: GridState } {
  const staff: StaffMember[] = data.angajati.map((a) => ({
    id: a.id,
    name: a.nume,
    zileCoAn: a.zileCoAn,
    zileCoFolosite: a.zileCoFolosite,
    zileCoRamase: a.zileCoRamase,
  }));

  const grid: GridState = {};
  for (const person of staff) {
    grid[person.id] = emptyRow(columns);
  }

  const dayByDate = new Map(columns.map((c) => [c.date, c.key]));
  for (const p of data.programari) {
    const key = dayByDate.get(p.data);
    if (!key || !grid[p.angajatId]) continue;
    grid[p.angajatId][key] = {
      valoare: p.valoare ?? "",
      ciorna: p.ciorna === "A" || p.ciorna === "R" ? p.ciorna : null,
    };
  }

  return { staff, grid };
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

export function ScheduleGrid() {
  const { year, month, monthIndex } = useMemo(() => {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1, // 1-indexed for API
      monthIndex: now.getMonth(),
    };
  }, []);

  const dayColumns = useMemo(
    () => buildDayColumns(year, monthIndex),
    [year, monthIndex],
  );
  const columns = dayColumns;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [grid, setGrid] = useState<GridState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [active, setActive] = useState<ActiveCell | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef<number | null>(null);

  const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const flashStatus = useCallback((message: string) => {
    setStatus(message);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(null), 2500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/luna?an=${year}&luna=${month}`);
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as LunaResponse;
        if (cancelled) return;
        const mapped = mapLunaToState(data, dayColumns);
        setStaff(mapped.staff);
        setGrid(mapped.grid);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Eroare la încărcare");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, [dayColumns, year, month]);

  const activate = useCallback(
    (row: number, col: number) => {
      const maxRow = Math.max(0, staff.length - 1);
      const maxCol = Math.max(0, columns.length - 1);
      const clampedRow = Math.max(0, Math.min(maxRow, row));
      const clampedCol = Math.max(0, Math.min(maxCol, col));
      setActive((prev) => {
        if (prev?.row === clampedRow && prev?.col === clampedCol) return prev;
        return { row: clampedRow, col: clampedCol };
      });
      setPanelOpen(true);
    },
    [columns.length, staff.length],
  );

  // Păstrează casuța activă vizibilă în stânga panelului din dreapta
  useEffect(() => {
    if (!panelOpen || !active) return;

    const PANEL_WIDTH = 384; // max-w-sm
    const STICKY_NAME = 152;
    const MARGIN = 20;

    function scrollActiveIntoView() {
      const container = gridRef.current;
      const cell = container?.querySelector<HTMLElement>(
        '[data-cell-active="true"]',
      );
      if (!container || !cell) return;

      const cRect = container.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();

      const visibleRight = Math.min(
        cRect.right,
        window.innerWidth - PANEL_WIDTH,
      );
      const visibleLeft = cRect.left + STICKY_NAME;

      let deltaX = 0;
      if (cellRect.right > visibleRight - MARGIN) {
        deltaX = cellRect.right - (visibleRight - MARGIN);
      } else if (cellRect.left < visibleLeft + MARGIN) {
        deltaX = cellRect.left - (visibleLeft + MARGIN);
      }

      let deltaY = 0;
      if (cellRect.bottom > cRect.bottom - MARGIN) {
        deltaY = cellRect.bottom - (cRect.bottom - MARGIN);
      } else if (cellRect.top < cRect.top + MARGIN) {
        deltaY = cellRect.top - (cRect.top + MARGIN);
      }

      if (deltaX !== 0 || deltaY !== 0) {
        container.scrollBy({ left: deltaX, top: deltaY, behavior: "smooth" });
      }
    }

    const raf = window.requestAnimationFrame(scrollActiveIntoView);
    // din nou după animația panelului (~200ms)
    const t = window.setTimeout(scrollActiveIntoView, 220);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, [active, panelOpen]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!staff.length || !columns.length) return;

    if (!active) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        activate(0, 0);
      }
      return;
    }

    const { row, col } = active;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      activate(row - 1, col);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      activate(row + 1, col);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      activate(row, col - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      activate(row, col + 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setPanelOpen(false);
      setActive(null);
    }
  }

  async function confirmCell(payload: ConfirmPayload) {
    if (!active || !columns[active.col] || !staff[active.row]) return;
    const person = staff[active.row];
    const col = columns[active.col];
    const prev = grid[person.id]?.[col.key] ?? emptyCell();
    const next: CellData = {
      valoare: payload.valoare,
      ciorna: payload.ciorna,
    };

    const wasCo = prev.valoare === "CO";
    const willBeCo = payload.valoare === "CO";

    setGrid((g) => ({
      ...g,
      [person.id]: { ...g[person.id], [col.key]: next },
    }));

    // Actualizează soldul CO local (optimistic)
    if (wasCo !== willBeCo) {
      setStaff((prevStaff) =>
        prevStaff.map((s) => {
          if (s.id !== person.id) return s;
          const delta = willBeCo ? 1 : -1;
          const zileCoFolosite = Math.max(0, s.zileCoFolosite + delta);
          return {
            ...s,
            zileCoFolosite,
            zileCoRamase: s.zileCoAn - zileCoFolosite,
          };
        }),
      );
    }

    try {
      const res = await fetch("/api/programari", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          angajatId: person.id,
          data: col.date,
          valoare: payload.valoare || null,
          ciorna: payload.ciorna,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));

      if (willBeCo && person.zileCoAn === 0) {
        flashStatus("CO salvat — atenție: nu sunt setate zile alocate");
      } else if (payload.ciorna) {
        flashStatus(`Salvat (${payload.valoare || "gol"} + ${payload.ciorna})`);
      } else {
        flashStatus("Programare salvată");
      }
    } catch (e) {
      setGrid((g) => ({
        ...g,
        [person.id]: { ...g[person.id], [col.key]: prev },
      }));
      if (wasCo !== willBeCo) {
        setStaff((prevStaff) =>
          prevStaff.map((s) => {
            if (s.id !== person.id) return s;
            const delta = wasCo ? 1 : -1;
            const zileCoFolosite = Math.max(0, s.zileCoFolosite + delta);
            return {
              ...s,
              zileCoFolosite,
              zileCoRamase: s.zileCoAn - zileCoFolosite,
            };
          }),
        );
      }
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      gridRef.current?.focus();
    }
  }

  async function exportPdfTest() {
    if (exporting || loading) return;
    setExporting(true);
    setError(null);
    try {
      // Snapshot construit pe server din DB (nu din stare locală)
      const saveRes = await fetch("/api/grafice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ an: year, luna: month }),
      });
      if (!saveRes.ok) throw new Error(await readError(saveRes));
      const saved = (await saveRes.json()) as { snapshot: GraficPdfData };

      const fileName = `grafic-ati-${year}-${String(month).padStart(2, "0")}.pdf`;
      await downloadGraficPdf(saved.snapshot, fileName);
      flashStatus("PDF descărcat + salvat în arhivă");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export PDF eșuat");
    } finally {
      setExporting(false);
    }
  }

  async function addStaff(name: string) {
    try {
      const res = await fetch("/api/angajati", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nume: name }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        angajat: {
          id: string;
          nume: string;
          zileCoAn: number;
          zileCoFolosite: number;
          zileCoRamase: number;
        };
      };
      setStaff((prev) => [
        ...prev,
        {
          id: data.angajat.id,
          name: data.angajat.nume,
          zileCoAn: data.angajat.zileCoAn,
          zileCoFolosite: data.angajat.zileCoFolosite,
          zileCoRamase: data.angajat.zileCoRamase,
        },
      ]);
      setGrid((prev) => ({
        ...prev,
        [data.angajat.id]: emptyRow(columns),
      }));
      flashStatus("Angajat adăugat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut adăuga");
    }
  }

  async function deleteStaff(person: StaffMember) {
    const ok = window.confirm(
      `Ștergi angajatul „${person.name}”? Acțiunea elimină rândul din grilă.`,
    );
    if (!ok) return;

    const oldIndex = staff.findIndex((s) => s.id === person.id);
    const snapshotStaff = staff;
    const snapshotGrid = grid;

    const nextStaff = staff.filter((s) => s.id !== person.id);
    setStaff(nextStaff);
    setGrid((prev) => {
      const next = { ...prev };
      delete next[person.id];
      return next;
    });

    if (active && oldIndex >= 0) {
      if (nextStaff.length === 0) {
        setActive(null);
        setPanelOpen(false);
      } else {
        const newRow =
          active.row > oldIndex
            ? active.row - 1
            : Math.min(active.row, nextStaff.length - 1);
        setActive({ row: Math.max(0, newRow), col: active.col });
      }
    }

    try {
      const res = await fetch(`/api/angajati/${person.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      flashStatus("Angajat șters");
    } catch (e) {
      setStaff(snapshotStaff);
      setGrid(snapshotGrid);
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event;
    setDraggingId(null);
    if (!over || dragActive.id === over.id) return;

    const oldIndex = staff.findIndex((s) => s.id === dragActive.id);
    const newIndex = staff.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prevStaff = staff;
    const nextStaff = arrayMove(staff, oldIndex, newIndex);
    setStaff(nextStaff);

    if (active) {
      if (active.row === oldIndex) {
        setActive({ ...active, row: newIndex });
      } else if (oldIndex < active.row && newIndex >= active.row) {
        setActive({ ...active, row: active.row - 1 });
      } else if (oldIndex > active.row && newIndex <= active.row) {
        setActive({ ...active, row: active.row + 1 });
      }
    }

    try {
      const res = await fetch("/api/angajati/ordine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: nextStaff.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error(await readError(res));
      flashStatus("Ordine salvată");
    } catch (e) {
      setStaff(prevStaff);
      setError(e instanceof Error ? e.message : "Reordonare eșuată");
    }
  }

  const panelContext: PanelContext | null = useMemo(() => {
    if (!active || !columns[active.col] || !staff[active.row]) return null;
    const person = staff[active.row];
    const col = columns[active.col];
    const cell = grid[person.id]?.[col.key] ?? emptyCell();
    const date = new Date(year, monthIndex, col.day);
    const detail = date.toLocaleDateString("ro-RO", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return {
      personName: person.name,
      columnLabel: `Ziua ${col.day}`,
      detail: `${col.abbr} · ${detail}`,
      currentValue: cell.valoare,
      currentCiorna: cell.ciorna,
    };
  }, [active, columns, grid, staff, year, monthIndex]);

  const draggingStaff = draggingId
    ? staff.find((s) => s.id === draggingId)
    : null;

  const titleMonth = monthLabel(year, monthIndex);

  const rowColumns = columns.map((col) => ({
    kind: "day" as const,
    key: col.key,
    weekend: col.weekend,
  }));

  return (
    <div className="relative mx-auto w-full max-w-[1500px] px-3 py-6 sm:px-6">
      <div
        className={[
          "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:p-6",
          "transition-[padding] duration-200",
          panelOpen ? "lg:pr-[22rem]" : "",
        ].join(" ")}
      >
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
              Programare lunară
            </p>
            <h1 className="mt-1 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II – {titleMonth}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Click / săgeți pe casuțe · grip pe nume pentru reordonare · date din
              Neon
            </p>
            {loading && (
              <p className="mt-2 text-xs font-medium text-sky-700">Se încarcă…</p>
            )}
            {error && (
              <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>
            )}
            {status && !error && (
              <p className="mt-2 text-xs font-medium text-emerald-700">{status}</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void exportPdfTest()}
              disabled={exporting || loading || staff.length === 0}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? "Se generează…" : "Export PDF test"}
            </button>
            <Link
              href="/istoric"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
            >
              Arhivă →
            </Link>
            <Link
              href="/concedii"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
            >
              Zile CO →
            </Link>
          </div>
        </header>

        <div
          ref={gridRef}
          tabIndex={0}
          role="grid"
          aria-label="Grilă programare ATI"
          onKeyDown={handleKeyDown}
          className="overflow-x-auto rounded-xl border border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(e) => void handleDragEnd(e)}
            onDragCancel={() => setDraggingId(null)}
          >
            <table className="w-max min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 min-w-[168px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase"
                  >
                    Nume
                  </th>
                  {columns.map((col) => (
                    <th
                      key={`${col.key}-n`}
                      className={[
                        "min-w-[2rem] border-b border-slate-200 px-0.5 py-1.5 text-center font-semibold text-slate-700",
                        col.weekend ? "bg-slate-100" : "bg-slate-50",
                      ].join(" ")}
                    >
                      {col.day}
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="min-w-[2.75rem] border-b border-l border-slate-200 bg-slate-50 px-1.5 py-2 text-center text-xs font-semibold text-slate-600"
                  >
                    O.SD
                  </th>
                </tr>
                <tr>
                  {dayColumns.map((col) => (
                    <th
                      key={`${col.key}-a`}
                      className={[
                        "min-w-[2rem] border-b border-slate-200 px-0.5 py-1 text-center font-medium text-slate-500",
                        col.weekend ? "bg-slate-100" : "bg-white",
                      ].join(" ")}
                    >
                      {col.abbr}
                    </th>
                  ))}
                </tr>
              </thead>
              <SortableContext
                items={staffIds}
                strategy={verticalListSortingStrategy}
              >
                <tbody>
                  {!loading && staff.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length + 2}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        Niciun angajat activ. Adaugă primul rând mai jos.
                      </td>
                    </tr>
                  ) : (
                    staff.map((person, rowIndex) => (
                      <SortableStaffRow
                        key={person.id}
                        staff={person}
                        rowIndex={rowIndex}
                        columns={rowColumns}
                        values={grid[person.id] ?? {}}
                        activeCol={
                          active?.row === rowIndex ? active.col : null
                        }
                        onActivate={activate}
                        onDelete={(p) => void deleteStaff(p)}
                        onCellFocus={() => gridRef.current?.focus()}
                      />
                    ))
                  )}
                </tbody>
              </SortableContext>
            </table>

            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {draggingStaff ? (
                <SortableOverlayRow>
                  <tr className="bg-white shadow-lg ring-1 ring-sky-300">
                    <th className="border border-slate-200 px-3 py-2 text-left text-[11px] font-semibold uppercase">
                      {draggingStaff.name}
                    </th>
                    {rowColumns.slice(0, 3).map((col) => (
                      <td
                        key={col.key}
                        className="border border-slate-200 p-0"
                      >
                        <CellFocus
                          value={grid[draggingStaff.id]?.[col.key]?.valoare ?? ""}
                          ciorna={grid[draggingStaff.id]?.[col.key]?.ciorna ?? null}
                          active={false}
                          weekend={col.weekend}
                          onClick={() => {}}
                        />
                      </td>
                    ))}
                    <td className="border border-slate-200 px-2 text-slate-400">
                      …
                    </td>
                  </tr>
                </SortableOverlayRow>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800"
          >
            + Adaugă angajat
          </button>
        </div>

        <footer className="mt-5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 text-[11px] font-medium tracking-wide text-slate-600 uppercase sm:grid-cols-3">
          <p className="text-left">MEDIC SEF: DR. SUSANU CAROLINA</p>
          <p className="text-center">DELEGAT</p>
          <p className="text-right">AS SEF: POPA NICOLETA</p>
        </footer>
      </div>

      <RightOptionPanel
        open={panelOpen && !!panelContext}
        context={panelContext}
        onConfirm={(payload) => void confirmCell(payload)}
        onClose={() => {
          setPanelOpen(false);
          setActive(null);
          gridRef.current?.focus();
        }}
      />

      <AddStaffDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={(name) => void addStaff(name)}
      />
    </div>
  );
}
