"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CULOARE_OPTIONS,
  type ProgramareCuloare,
} from "@/lib/culoare";
import {
  CELL_TEXT_MAX,
  cellTextError,
  layoutCellText,
  parseCellText,
} from "@/lib/cellText";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CodItem = {
  id: string;
  categorieId: string | null;
  cod: string;
  eticheta: string;
  culoare: string;
  ordine: number;
  activ: boolean;
  sistem: "CO" | "CM" | "CIC" | null;
  comportamentVechi: string | null;
};

type CategorieInfo = {
  id: string;
  nume: string;
  permiteTextLiber: boolean;
};

type EditDraft = {
  eticheta: string;
  culoare: string;
  colorMode: ProgramareCuloare | "other";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

function isSistem(c: CodItem): boolean {
  return c.sistem === "CO" || c.sistem === "CM" || c.sistem === "CIC";
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function presetFromHex(hex: string): ProgramareCuloare | "other" {
  const h = hex.trim().toLowerCase();
  const found = CULOARE_OPTIONS.find((o) => o.hex.toLowerCase() === h);
  return found ? found.id : "other";
}

function draftFromItem(row: CodItem): EditDraft {
  return {
    eticheta: row.eticheta,
    culoare: row.culoare,
    colorMode: presetFromHex(row.culoare),
  };
}

/** Aplică noua ordine din filtrul vizibil pe lista completă (ordineIds = toate). */
function mergeFilteredOrder(
  all: CodItem[],
  filteredBefore: CodItem[],
  filteredAfter: CodItem[],
): string[] {
  const sorted = [...all].sort((a, b) => a.ordine - b.ordine);
  const beforeIds = new Set(filteredBefore.map((c) => c.id));
  let i = 0;
  return sorted.map((item) => {
    if (beforeIds.has(item.id)) {
      return filteredAfter[i++]!.id;
    }
    return item.id;
  });
}

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

/** Preview identic ca stil cu celula din grilă (CellFocus + layout adaptiv). */
function CodCellPreview({
  text,
  culoare,
  dimmed,
  large,
}: {
  text: string;
  culoare: string;
  dimmed?: boolean;
  large?: boolean;
}) {
  const layout = layoutCellText(text);
  const w = large ? Math.max(layout.widthPx, 52) : layout.widthPx;
  return (
    <div
      aria-hidden
      title={layout.title || undefined}
      className={[
        "flex shrink-0 flex-col items-center justify-center border border-slate-300 bg-white px-0.5",
        "leading-tight font-semibold",
        large ? "min-h-12 rounded-md" : "min-h-9",
        dimmed ? "opacity-45" : "",
      ].join(" ")}
      style={{
        width: w,
        minWidth: w,
        maxWidth: w,
        color: /^#[0-9a-fA-F]{6}$/.test(culoare) ? culoare : "#111111",
        fontSize: `${large ? Math.max(layout.fontSize, 13) : layout.fontSize}px`,
      }}
    >
      {text.trim()
        ? layout.lines.map((line, i) => (
            <span key={i} className="max-w-full truncate">
              {line}
            </span>
          ))
        : "·"}
    </div>
  );
}

function ColorPicker({
  mode,
  hex,
  disabled,
  onMode,
  onHex,
}: {
  mode: ProgramareCuloare | "other";
  hex: string;
  disabled?: boolean;
  onMode: (m: ProgramareCuloare | "other") => void;
  onHex: (h: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {CULOARE_OPTIONS.map((opt) => {
          const selected = mode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              title={opt.label}
              aria-label={opt.label}
              aria-pressed={selected}
              onClick={() => {
                onMode(opt.id);
                onHex(opt.hex);
              }}
              className={[
                "h-8 flex-1 rounded-lg border-2 transition-transform duration-100 disabled:opacity-50",
                selected
                  ? "scale-105 border-slate-900 ring-2 ring-sky-400 ring-offset-1"
                  : "border-slate-300 hover:scale-[1.03]",
              ].join(" ")}
              style={{ backgroundColor: opt.hex }}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onMode("other")}
        className={[
          "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
          mode === "other"
            ? "border-sky-500 bg-sky-50 text-sky-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        Altă culoare
      </button>
      {mode === "other" && (
        <div className="flex gap-2">
          <input
            type="color"
            value={HEX_RE.test(hex) ? hex : "#111111"}
            disabled={disabled}
            onChange={(e) => onHex(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
          />
          <input
            type="text"
            value={hex}
            disabled={disabled}
            onChange={(e) => onHex(e.target.value)}
            placeholder="#111111"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable card
// ---------------------------------------------------------------------------

function SortableCodCard({
  row,
  domainLabel,
  editing,
  draft,
  busy,
  menuOpen,
  onToggleMenu,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDraftChange,
  onToggleActiv,
  onDelete,
}: {
  row: CodItem;
  domainLabel: string;
  editing: boolean;
  draft: EditDraft | null;
  busy: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDraftChange: (patch: Partial<EditDraft>) => void;
  onToggleActiv: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: editing });

  const style: CSSProperties = {
    ...(transform ? { transform: CSS.Transform.toString(transform) } : {}),
    transition: isDragging ? (transition ?? "transform 150ms ease") : undefined,
    opacity: isDragging ? 0.85 : 1,
    position: "relative",
    zIndex: isDragging ? 30 : undefined,
  };

  const previewCod = row.cod;
  const previewCuloare = editing && draft ? draft.culoare : row.culoare;
  const sistem = isSistem(row);

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-xl border bg-white",
        row.activ ? "border-slate-200" : "border-slate-200 bg-slate-50",
        isDragging ? "shadow-md shadow-slate-300/50 ring-1 ring-sky-300" : "",
        editing ? "ring-1 ring-sky-300" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
        <button
          type="button"
          className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing touch-none disabled:opacity-40"
          aria-label={`Mută ${row.cod}`}
          title="Trage pentru reordonare"
          disabled={editing || busy}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>

        <button
          type="button"
          onClick={onStartEdit}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3"
          disabled={busy}
        >
          <CodCellPreview
            text={previewCod}
            culoare={previewCuloare}
            dimmed={!row.activ}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium text-slate-800">
                {row.cod}
              </span>
              <span className="truncate text-xs text-slate-500">
                {domainLabel}
              </span>
              {row.eticheta && row.eticheta !== row.cod && (
                <span className="truncate text-xs text-slate-400">
                  · {row.eticheta}
                </span>
              )}
              {sistem && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-sky-700 uppercase">
                  Sistem
                </span>
              )}
              {!row.activ && (
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                  Inactiv
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {!editing && (
            <button
              type="button"
              disabled={busy}
              onClick={onStartEdit}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Editează
            </button>
          )}
          {!sistem && (
            <div className="relative">
              <button
                type="button"
                disabled={busy}
                onClick={onToggleMenu}
                aria-label="Mai multe acțiuni"
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute top-full right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      onToggleMenu();
                      onToggleActiv();
                    }}
                  >
                    {row.activ ? "Dezactivează" : "Activează"}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      onToggleMenu();
                      onDelete();
                    }}
                  >
                    Șterge
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && draft && (
        <div className="space-y-3 border-t border-slate-100 px-3 py-3 sm:px-4">
          <div className="flex justify-center py-1">
            <CodCellPreview
              text={row.cod}
              culoare={draft.culoare}
              large
            />
          </div>

          <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Etichetă (descriere)
            <input
              type="text"
              value={draft.eticheta}
              maxLength={CELL_TEXT_MAX}
              disabled={busy || sistem}
              onChange={(e) => onDraftChange({ eticheta: e.target.value })}
              placeholder="Opțional — nu apare în grilă"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-60"
            />
            <span className="mt-0.5 block text-right text-[10px] tabular-nums text-slate-500">
              {draft.eticheta.trim().length}/{CELL_TEXT_MAX}
            </span>
          </label>

          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
              Culoare
            </p>
            <ColorPicker
              mode={draft.colorMode}
              hex={draft.culoare}
              disabled={busy}
              onMode={(m) => onDraftChange({ colorMode: m })}
              onHex={(h) =>
                onDraftChange({
                  culoare: h,
                  colorMode:
                    presetFromHex(h) === "other" ? "other" : presetFromHex(h),
                })
              }
            />
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={onSaveEdit}
              className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Salvează
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelEdit}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Anulează
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page form
// ---------------------------------------------------------------------------

export function CoduriSettingsForm() {
  const [items, setItems] = useState<CodItem[]>([]);
  const [categorii, setCategorii] = useState<CategorieInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [filterCat, setFilterCat] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const [newCod, setNewCod] = useState("");
  const [newEticheta, setNewEticheta] = useState("");
  const [newCuloare, setNewCuloare] = useState("#111111");
  const [newColorMode, setNewColorMode] = useState<ProgramareCuloare | "other">(
    "black",
  );
  const [newCategorieId, setNewCategorieId] = useState<string>("__common__");
  const [creating, setCreating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri");
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        items: CodItem[];
        categorii: CategorieInfo[];
      };
      setItems([...(data.items ?? [])].sort((a, b) => a.ordine - b.ordine));
      setCategorii(data.categorii ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la încărcare");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest("[data-cod-menu]")) return;
      setMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const filteredItems = useMemo(() => {
    if (filterCat === null) return items;
    if (filterCat === "__common__") {
      return items.filter((c) => c.categorieId === null);
    }
    return items.filter(
      (c) => c.categorieId === filterCat || c.categorieId === null,
    );
  }, [items, filterCat]);

  function categorieName(catId: string | null): string {
    if (catId === null) return "Toate categoriile";
    return categorii.find((c) => c.id === catId)?.nume ?? catId;
  }

  async function createCod() {
    const codErr = cellTextError(newCod);
    if (codErr || !parseCellText(newCod)) {
      setError(
        codErr
          ? `Cod: ${codErr}`
          : `Codul este obligatoriu (max ${CELL_TEXT_MAX} caractere)`,
      );
      return;
    }
    const cod = parseCellText(newCod)!;
    const eticheta = newEticheta.trim() || cod;
    const etErr = cellTextError(eticheta);
    if (etErr) {
      setError(`Etichetă: ${etErr}`);
      return;
    }
    if (!parseCellText(eticheta)) {
      setError(`Eticheta este obligatorie (max ${CELL_TEXT_MAX} caractere)`);
      return;
    }
    if (!HEX_RE.test(newCuloare)) {
      setError("Culoare invalidă");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const categorieId =
        newCategorieId === "__common__" ? null : newCategorieId;
      const res = await fetch("/api/setari/coduri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cod,
          eticheta,
          culoare: newCuloare,
          categorieId,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setNewCod("");
      setNewEticheta("");
      setNewCuloare("#111111");
      setNewColorMode("black");
      flash("Cod adăugat");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nu s-a putut crea");
    } finally {
      setCreating(false);
    }
  }

  async function updateField(
    id: string,
    patch: Partial<Pick<CodItem, "eticheta" | "culoare" | "activ" | "cod">>,
  ) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { item: CodItem };
      setItems((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data.item } : c)),
      );
      flash("Salvat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    const row = items.find((c) => c.id === editingId);
    if (!row) return;
    if (!HEX_RE.test(draft.culoare)) {
      setError("Culoare invalidă");
      return;
    }
    const eticheta = draft.eticheta.trim();
    if (!isSistem(row)) {
      const etErr = cellTextError(eticheta);
      if (etErr) {
        setError(`Etichetă: ${etErr}`);
        return;
      }
      if (!eticheta) {
        setError("Eticheta nu poate fi goală");
        return;
      }
    }
    const patch: Partial<Pick<CodItem, "eticheta" | "culoare">> = {
      culoare: draft.culoare,
    };
    if (!isSistem(row) && eticheta !== row.eticheta) {
      patch.eticheta = eticheta;
    }
    if (patch.culoare === row.culoare && !patch.eticheta) {
      setEditingId(null);
      setDraft(null);
      return;
    }
    await updateField(editingId, patch);
    setEditingId(null);
    setDraft(null);
  }

  async function deleteCod(id: string) {
    const row = items.find((c) => c.id === id);
    if (!row) return;
    const ok = window.confirm(`Ștergi codul „${row.cod}"?`);
    if (!ok) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.status === 409 || res.status === 403) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Nu se poate șterge codul");
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      if (editingId === id) {
        setEditingId(null);
        setDraft(null);
      }
      flash("Cod șters");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTextLiber(catId: string, value: boolean) {
    setBusyId(`tl-${catId}`);
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categorieId: catId, permiteTextLiber: value }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setCategorii((prev) =>
        prev.map((c) =>
          c.id === catId ? { ...c, permiteTextLiber: value } : c,
        ),
      );
      flash(value ? "Text liber activat" : "Text liber dezactivat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (editingId) return;

    const oldIndex = filteredItems.findIndex((c) => c.id === active.id);
    const newIndex = filteredItems.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const beforeFiltered = filteredItems;
    const afterFiltered = arrayMove(filteredItems, oldIndex, newIndex);
    const previousItems = items;
    const ordineIds = mergeFilteredOrder(items, beforeFiltered, afterFiltered);

    // Optimistic: apply new ordine locally
    const ordineMap = new Map(ordineIds.map((id, i) => [id, i + 1]));
    setItems((prev) =>
      [...prev]
        .map((c) => ({
          ...c,
          ordine: ordineMap.get(c.id) ?? c.ordine,
        }))
        .sort((a, b) => a.ordine - b.ordine),
    );

    setBusyId(String(active.id));
    setError(null);
    try {
      const res = await fetch("/api/setari/coduri", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordineIds }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { items: CodItem[] };
      setItems(
        [...(data.items ?? [])].sort((a, b) => a.ordine - b.ordine),
      );
      flash("Ordine actualizată");
    } catch (e) {
      setItems(previousItems);
      setError(e instanceof Error ? e.message : "Reordonare eșuată");
    } finally {
      setBusyId(null);
    }
  }

  const newPreviewLabel = newCod.trim() || "·";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6">
        <p className="text-xs font-medium tracking-wide text-sky-700 uppercase">
          Workspace
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
          Coduri programare
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Valorile disponibile în casutele de pe grilă. Codurile sistem (CO, CM,
          CIC) nu pot fi redenumite sau dezactivate.
        </p>

        <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Ore pe V/S/D se configurează în{" "}
          <Link href="/setari/ore" className="font-semibold underline">
            Setări → Ore
          </Link>
          .
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          {loading && (
            <span className="font-medium text-sky-700">Se încarcă…</span>
          )}
          {error && <span className="font-medium text-rose-600">{error}</span>}
          {status && !error && (
            <span className="font-medium text-emerald-700">{status}</span>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
            Filtrează după categorie
          </label>
          <select
            value={filterCat ?? "__all__"}
            onChange={(e) => {
              const v = e.target.value;
              setFilterCat(
                v === "__all__" ? null : v === "__common__" ? "__common__" : v,
              );
              setEditingId(null);
              setDraft(null);
            }}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
          >
            <option value="__all__">Toate codurile</option>
            <option value="__common__">Doar comune</option>
            {categorii.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nume}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-5 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(e) => void handleDragEnd(e)}
          >
            <SortableContext
              items={filteredItems.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {filteredItems.map((row) => (
                <div key={row.id} data-cod-menu>
                  <SortableCodCard
                    row={row}
                    domainLabel={categorieName(row.categorieId)}
                    editing={editingId === row.id}
                    draft={editingId === row.id ? draft : null}
                    busy={busyId === row.id}
                    menuOpen={menuId === row.id}
                    onToggleMenu={() =>
                      setMenuId((cur) => (cur === row.id ? null : row.id))
                    }
                    onStartEdit={() => {
                      setMenuId(null);
                      setEditingId(row.id);
                      setDraft(draftFromItem(row));
                    }}
                    onCancelEdit={() => {
                      setEditingId(null);
                      setDraft(null);
                    }}
                    onSaveEdit={() => void saveEdit()}
                    onDraftChange={(patch) =>
                      setDraft((d) => (d ? { ...d, ...patch } : d))
                    }
                    onToggleActiv={() =>
                      void updateField(row.id, { activ: !row.activ })
                    }
                    onDelete={() => void deleteCod(row.id)}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {/* New code */}
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
          <h2 className="text-sm font-semibold text-slate-800">Cod nou</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            După creare, setează orele în{" "}
            <Link
              href="/setari/ore"
              className="font-medium text-sky-700 underline"
            >
              Setări → Ore
            </Link>{" "}
            (implicit 0).
          </p>

          <div className="mt-3 flex justify-center">
            <CodCellPreview
              text={newPreviewLabel}
              culoare={newCuloare}
              large
            />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Cod (max {CELL_TEXT_MAX} car.)
              <input
                type="text"
                maxLength={CELL_TEXT_MAX}
                value={newCod}
                onChange={(e) => setNewCod(e.target.value)}
                placeholder="ex. 07:00-15:00"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
              <span className="mt-0.5 block text-right text-[10px] tabular-nums text-slate-500">
                {newCod.trim().length}/{CELL_TEXT_MAX}
              </span>
            </label>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Etichetă (descriere)
              <input
                type="text"
                value={newEticheta}
                maxLength={CELL_TEXT_MAX}
                onChange={(e) => setNewEticheta(e.target.value)}
                placeholder="Opțional — nu apare în grilă"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              />
              <span className="mt-0.5 block text-right text-[10px] tabular-nums text-slate-500">
                {newEticheta.trim().length}/{CELL_TEXT_MAX}
              </span>
            </label>
            <div className="sm:col-span-2">
              <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
                Culoare
              </p>
              <ColorPicker
                mode={newColorMode}
                hex={newCuloare}
                disabled={creating}
                onMode={setNewColorMode}
                onHex={(h) => {
                  setNewCuloare(h);
                  const p = presetFromHex(h);
                  setNewColorMode(p === "other" ? "other" : p);
                }}
              />
            </div>
            <label className="block text-xs font-medium tracking-wide text-slate-500 uppercase sm:col-span-2">
              Categorie
              <select
                value={newCategorieId}
                onChange={(e) => setNewCategorieId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
              >
                <option value="__common__">Comun (toate categoriile)</option>
                {categorii.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nume}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={creating || !newCod.trim()}
            onClick={() => void createCod()}
            className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {creating ? "Se adaugă…" : "Adaugă cod"}
          </button>
        </div>

        {/* Text liber — sub listă, discret */}
        {categorii.length > 0 && (
          <div className="mt-8 border-t border-slate-100 pt-5">
            <h2 className="text-sm font-medium text-slate-700">
              Text liber per categorie
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Permite introducerea de text liber (max {CELL_TEXT_MAX} caractere)
              în casute, pe lângă codurile definite.
            </p>
            <div className="mt-2 space-y-0.5">
              {categorii.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={cat.permiteTextLiber}
                    disabled={busyId === `tl-${cat.id}`}
                    onChange={(e) =>
                      void toggleTextLiber(cat.id, e.target.checked)
                    }
                    className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-400"
                  />
                  <span className="text-sm text-slate-600">{cat.nume}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
