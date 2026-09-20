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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import type { LunaResponse } from "@/lib/types";
import {
  buildGraficTitle,
  graficPdfFileName,
  postFromTabParam,
  postLabel,
  tabParamFromPost,
  type AngajatPost,
} from "@/lib/post";
import { parseMonth, parseYear } from "@/lib/validate";
import { AddStaffDialog } from "./AddStaffDialog";
import { CellFocus } from "./CellFocus";
import {
  CellOptionPopup,
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
import { totalOsdOre } from "@/lib/weekendOre";

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

/** Săptămâni Luni–Duminică (prima/ultima pot fi incomplete) */
function buildWeeks(days: DayColumn[]): DayColumn[][] {
  const weeks: DayColumn[][] = [];
  let current: DayColumn[] = [];

  for (const day of days) {
    const dow = new Date(`${day.date}T12:00:00`).getDay(); // 0 = D
    const isMonday = dow === 1;
    if (isMonday && current.length > 0) {
      weeks.push(current);
      current = [];
    }
    current.push(day);
  }
  if (current.length > 0) weeks.push(current);
  return weeks;
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
    post: a.post,
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

function mergeStaffOrder(
  all: StaffMember[],
  visibleOrdered: StaffMember[],
  post: AngajatPost,
): StaffMember[] {
  const queue = [...visibleOrdered];
  return all.map((s) => (s.post === post ? queue.shift()! : s));
}

function buildMonthQuery(
  year: number,
  month: number,
  post: AngajatPost,
): string {
  const params = new URLSearchParams();
  params.set("an", String(year));
  params.set("luna", String(month));
  params.set("tab", tabParamFromPost(post));
  return params.toString();
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const now = useMemo(() => new Date(), []);
  const yearFromUrl = parseYear(searchParams.get("an"));
  const monthFromUrl = parseMonth(searchParams.get("luna"));
  const year = yearFromUrl ?? now.getFullYear();
  const month = monthFromUrl ?? now.getMonth() + 1;
  const monthIndex = month - 1;
  const post = postFromTabParam(searchParams.get("tab"));

  // Completează URL-ul când lipsește an/luna/tab (intrare pe / → luna curentă)
  useEffect(() => {
    const hasAn = searchParams.get("an") != null;
    const hasLuna = searchParams.get("luna") != null;
    const hasTab = searchParams.get("tab") != null;
    if (hasAn && hasLuna && hasTab) return;
    router.replace(`${pathname}?${buildMonthQuery(year, month, post)}`, {
      scroll: false,
    });
  }, [searchParams, pathname, router, year, month, post]);

  function goMonth(delta: number) {
    const d = new Date(year, monthIndex + delta, 1);
    router.push(
      `${pathname}?${buildMonthQuery(d.getFullYear(), d.getMonth() + 1, post)}`,
    );
  }

  function setPostTab(next: AngajatPost) {
    if (next === post) return;
    setActive(null);
    setPanelOpen(false);
    router.push(`${pathname}?${buildMonthQuery(year, month, next)}`, {
      scroll: false,
    });
  }

  const dayColumns = useMemo(
    () => buildDayColumns(year, monthIndex),
    [year, monthIndex],
  );
  const weeks = useMemo(() => buildWeeks(dayColumns), [dayColumns]);
  /** Index global în dayColumns — folosit la salvare / panel */
  const columns = dayColumns;

  const [isDesktop, setIsDesktop] = useState(true);
  const [weekIndex, setWeekIndex] = useState(0);

  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
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
  const touchStartX = useRef<number | null>(null);

  const staff = useMemo(
    () => allStaff.filter((s) => s.post === post),
    [allStaff, post],
  );
  const staffIds = useMemo(() => staff.map((s) => s.id), [staff]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Săptămâna curentă (ziua de azi, dacă e în lună)
  useEffect(() => {
    const today = new Date();
    const sameMonth =
      today.getFullYear() === year && today.getMonth() === monthIndex;
    if (sameMonth) {
      const d = today.getDate();
      const idx = weeks.findIndex((w) => w.some((col) => col.day === d));
      setWeekIndex(idx >= 0 ? idx : 0);
    } else {
      setWeekIndex(0);
    }
  }, [weeks, year, monthIndex]);

  const visibleColumns = isDesktop
    ? dayColumns
    : (weeks[weekIndex] ?? []);

  const weekLabel = useMemo(() => {
    const w = weeks[weekIndex];
    if (!w?.length) return "";
    const first = w[0].day;
    const last = w[w.length - 1].day;
    return first === last ? `${first}` : `${first}–${last}`;
  }, [weeks, weekIndex]);

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

  const goWeek = useCallback(
    (delta: number) => {
      setWeekIndex((i) =>
        Math.max(0, Math.min(weeks.length - 1, i + delta)),
      );
    },
    [weeks.length],
  );

  // La schimbarea săptămânii, închide selecția dacă ziua nu mai e vizibilă
  useEffect(() => {
    if (isDesktop || !active) return;
    const key = dayColumns[active.col]?.key;
    if (!key) return;
    const inWeek = (weeks[weekIndex] ?? []).some((c) => c.key === key);
    if (!inWeek) {
      setActive(null);
      setPanelOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doar la weekIndex
  }, [weekIndex]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/luna?an=${year}&luna=${month}`);
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as LunaResponse;
        if (cancelled) return;
        const mapped = mapLunaToState(data, dayColumns);
        setAllStaff(mapped.staff);
        setGrid(mapped.grid);
        setActive(null);
        setPanelOpen(false);
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

  async function confirmCell(payload: ConfirmPayload): Promise<boolean> {
    if (!active || !columns[active.col] || !staff[active.row]) return false;
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
      setAllStaff((prevStaff) =>
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
      return true;
    } catch (e) {
      setGrid((g) => ({
        ...g,
        [person.id]: { ...g[person.id], [col.key]: prev },
      }));
      if (wasCo !== willBeCo) {
        setAllStaff((prevStaff) =>
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
      return false;
    } finally {
      gridRef.current?.focus({ preventScroll: true });
    }
  }

  async function exportPdfTest() {
    if (exporting || loading) return;
    setExporting(true);
    setError(null);
    try {
      const saveRes = await fetch("/api/grafice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ an: year, luna: month, post }),
      });
      if (!saveRes.ok) throw new Error(await readError(saveRes));
      const saved = (await saveRes.json()) as { snapshot: GraficPdfData };

      const fileName = graficPdfFileName(year, month, post);
      await downloadGraficPdf(saved.snapshot, fileName);
      flashStatus(`PDF ${postLabel(post)} descărcat + salvat în arhivă`);
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
        body: JSON.stringify({ nume: name, post }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        angajat: {
          id: string;
          nume: string;
          post: AngajatPost;
          zileCoAn: number;
          zileCoFolosite: number;
          zileCoRamase: number;
        };
      };
      setAllStaff((prev) => [
        ...prev,
        {
          id: data.angajat.id,
          name: data.angajat.nume,
          post: data.angajat.post,
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
    const snapshotStaff = allStaff;
    const snapshotGrid = grid;

    const nextAll = allStaff.filter((s) => s.id !== person.id);
    const nextVisible = nextAll.filter((s) => s.post === post);
    setAllStaff(nextAll);
    setGrid((prev) => {
      const next = { ...prev };
      delete next[person.id];
      return next;
    });

    if (active && oldIndex >= 0) {
      if (nextVisible.length === 0) {
        setActive(null);
        setPanelOpen(false);
      } else {
        const newRow =
          active.row > oldIndex
            ? active.row - 1
            : Math.min(active.row, nextVisible.length - 1);
        setActive({ row: Math.max(0, newRow), col: active.col });
      }
    }

    try {
      const res = await fetch(`/api/angajati/${person.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res));
      flashStatus("Angajat șters");
    } catch (e) {
      setAllStaff(snapshotStaff);
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

    const prevAll = allStaff;
    const nextVisible = arrayMove(staff, oldIndex, newIndex);
    const nextAll = mergeStaffOrder(allStaff, nextVisible, post);
    setAllStaff(nextAll);

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
        body: JSON.stringify({ ids: nextAll.map((s) => s.id) }),
      });
      if (!res.ok) throw new Error(await readError(res));
      flashStatus("Ordine salvată");
    } catch (e) {
      setAllStaff(prevAll);
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

  const osdDays = useMemo(
    () => dayColumns.map((c) => ({ abbr: c.abbr, key: c.key })),
    [dayColumns],
  );

  const osdByStaffId = useMemo(() => {
    const map = new Map<string, number>();
    for (const person of staff) {
      map.set(
        person.id,
        totalOsdOre(person.post, osdDays, grid[person.id] ?? {}),
      );
    }
    return map;
  }, [staff, osdDays, grid]);

  const titleMonth = monthLabel(year, monthIndex);

  const rowColumns = visibleColumns.map((col) => ({
    kind: "day" as const,
    key: col.key,
    weekend: col.weekend,
  }));

  function activateFromVisible(row: number, localCol: number) {
    const key = visibleColumns[localCol]?.key;
    if (!key) return;
    const globalCol = dayColumns.findIndex((c) => c.key === key);
    if (globalCol >= 0) activate(row, globalCol);
  }

  function activeLocalCol(rowIndex: number): number | null {
    if (!active || active.row !== rowIndex) return null;
    const key = dayColumns[active.col]?.key;
    if (!key) return null;
    const local = visibleColumns.findIndex((c) => c.key === key);
    return local >= 0 ? local : null;
  }

  function onTouchStartGrid(e: TouchEvent) {
    if (isDesktop) return;
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEndGrid(e: TouchEvent) {
    if (isDesktop || touchStartX.current == null) return;
    const x = e.changedTouches[0]?.clientX;
    if (x == null) {
      touchStartX.current = null;
      return;
    }
    const dx = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 56) return;
    goWeek(dx < 0 ? 1 : -1);
  }

  return (
    <div className="relative mx-auto w-full max-w-[1500px] px-3 py-6 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60 sm:p-6">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
              Programare lunară · {postLabel(post)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => goMonth(-1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-800"
                aria-label="Luna anterioară"
              >
                ‹
              </button>
              <h1 className="min-w-0 flex-1 text-center text-base font-semibold tracking-tight text-slate-900 sm:text-left sm:text-lg">
                <span className="lg:hidden">
                  {postLabel(post)} · {titleMonth}
                </span>
                <span className="hidden lg:inline">
                  {buildGraficTitle(year, month, post)}
                </span>
              </h1>
              <button
                type="button"
                onClick={() => goMonth(1)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-800"
                aria-label="Luna următoare"
              >
                ›
              </button>
            </div>
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
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => void exportPdfTest()}
              disabled={exporting || loading || staff.length === 0}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
            >
              {exporting
                ? "Se generează…"
                : `Export PDF ${postLabel(post)}`}
            </button>
            <Link
              href="/istoric"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 sm:w-auto sm:py-2"
            >
              Arhivă →
            </Link>
            <Link
              href="/concedii"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-center text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800 sm:w-auto sm:py-2"
            >
              Zile CO →
            </Link>
          </div>
        </header>

        <div
          className="mb-4 flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
          role="tablist"
          aria-label="Tip personal"
        >
          {(
            [
              { id: "asistent" as const, label: "Asistenți" },
              { id: "infirmier" as const, label: "Infirmiere" },
            ] as const
          ).map((tab) => {
            const selected = post === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setPostTab(tab.id)}
                className={[
                  "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150",
                  selected
                    ? "bg-white text-sky-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Navigator săptămână — doar mobil */}
        <div className="mb-3 flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => goWeek(-1)}
            disabled={weekIndex <= 0}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 disabled:opacity-40"
            aria-label="Săptămâna anterioară"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-slate-800">
              Săpt. {weekIndex + 1} / {Math.max(weeks.length, 1)}
            </p>
            <p className="text-xs text-slate-500">
              {weekLabel ? `Zilele ${weekLabel}` : "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => goWeek(1)}
            disabled={weekIndex >= weeks.length - 1}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-700 disabled:opacity-40"
            aria-label="Săptămâna următoare"
          >
            ›
          </button>
        </div>

        <div
          ref={gridRef}
          tabIndex={0}
          role="grid"
          aria-label="Grilă programare ATI"
          onKeyDown={handleKeyDown}
          onTouchStart={onTouchStartGrid}
          onTouchEnd={onTouchEndGrid}
          className={[
            "rounded-xl border border-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50",
            isDesktop ? "overflow-x-auto" : "overflow-x-hidden touch-pan-y",
          ].join(" ")}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={(e) => void handleDragEnd(e)}
            onDragCancel={() => setDraggingId(null)}
          >
            <table
              className={[
                "schedule-grid border-separate border-spacing-0 text-[11px]",
                isDesktop ? "w-max min-w-full" : "w-full table-fixed",
              ].join(" ")}
            >
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={[
                      "sticky left-0 z-20 border-0 border-b border-r border-b-slate-200 border-r-slate-300 bg-slate-50 py-2 text-left text-xs font-semibold tracking-wide text-slate-600 uppercase",
                      isDesktop
                        ? "min-w-[168px] px-3"
                        : "w-[4.75rem] max-w-[4.75rem] px-1",
                    ].join(" ")}
                  >
                    Nume
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={`${col.key}-n`}
                      className={[
                        "border-0 border-r border-b border-b-slate-200 border-r-slate-300 px-0.5 py-1.5 text-center font-semibold text-slate-700",
                        isDesktop ? "min-w-[2rem]" : "",
                        col.weekend ? "bg-slate-100" : "bg-slate-50",
                      ].join(" ")}
                    >
                      {col.day}
                    </th>
                  ))}
                  {isDesktop && (
                    <th
                      rowSpan={2}
                      className="min-w-[2.75rem] border-0 border-b border-l border-b-slate-200 border-l-slate-300 bg-slate-50 px-1.5 py-2 text-center text-xs font-semibold text-slate-600"
                    >
                      O.SD
                    </th>
                  )}
                </tr>
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={`${col.key}-a`}
                      className={[
                        "border-0 border-r border-b border-b-slate-200 border-r-slate-300 px-0.5 py-1 text-center font-medium text-slate-500",
                        isDesktop ? "min-w-[2rem]" : "",
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
                        colSpan={visibleColumns.length + (isDesktop ? 2 : 1)}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        {post === "infirmier"
                          ? "Nicio infirmieră pe această grilă. Adaugă primul rând mai jos."
                          : "Niciun asistent pe această grilă. Adaugă primul rând mai jos."}
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
                        activeCol={activeLocalCol(rowIndex)}
                        onActivate={activateFromVisible}
                        onDelete={(p) => void deleteStaff(p)}
                        onCellFocus={() => gridRef.current?.focus({ preventScroll: true })}
                        showOsd={isDesktop}
                        osdHours={osdByStaffId.get(person.id) ?? 0}
                        compactName={!isDesktop}
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
            className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-800 sm:w-auto sm:py-2"
          >
            + Adaugă {post === "infirmier" ? "infirmieră" : "asistent"}
          </button>
        </div>

        <footer className="mt-5 grid grid-cols-1 gap-2 border-t border-slate-100 pt-4 text-[11px] font-medium tracking-wide text-slate-600 uppercase sm:grid-cols-2">
          <p className="text-left">MEDIC SEF: DR. SUSANU CAROLINA</p>
          <p className="text-left sm:text-right">AS SEF: POPA NICOLETA</p>
        </footer>
      </div>

      <CellOptionPopup
        open={panelOpen && !!panelContext}
        context={panelContext}
        onSelect={(payload) => confirmCell(payload)}
        onClose={() => {
          setPanelOpen(false);
          setActive(null);
          gridRef.current?.focus({ preventScroll: true });
        }}
      />

      <AddStaffDialog
        open={addOpen}
        post={post}
        onClose={() => setAddOpen(false)}
        onSubmit={(name) => void addStaff(name)}
      />
    </div>
  );
}
