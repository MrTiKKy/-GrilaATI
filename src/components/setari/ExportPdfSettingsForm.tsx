"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Columns2,
  FileText,
  Minus,
  MoreHorizontal,
  Plus,
  Redo2,
  Table,
  Type,
  Undo2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Trash2,
  Star,
} from "lucide-react";
import {
  DEFAULT_PDF_TEMPLATE,
  PDF_MARGIN_PRESETS,
  detectMarginPreset,
  mergePdfTemplate,
  type PdfAliniere,
  type PdfCeluleLungi,
  type PdfMarginPreset,
  type PdfTemplateCaseta,
  type PdfTemplateSetari,
  type PdfTemplateVars,
} from "@/lib/pdfTemplate";
import {
  presetTaieturi,
  shouldSuggestTwoParts,
} from "@/lib/pdfSplit";
import {
  PdfDragPreview,
  type DragTarget,
  type PreviewDay,
  type PreviewRow,
} from "@/components/setari/PdfDragPreview";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CategorieOpt = { id: string; nume: string };
type TplItem = {
  id: string;
  nume: string;
  implicit: boolean;
  versiune: number;
};

type TabId = "pagina" | "tabel" | "impartire" | "texte";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function moveSelected(
  d: PdfTemplateSetari,
  target: DragTarget,
  dx: number,
  dy: number,
) {
  const move = (box: { x: number; y: number; latime: number }) => {
    box.x = Math.min(100 - box.latime, Math.max(0, box.x + dx));
    box.y = Math.min(96, Math.max(0, box.y + dy));
  };
  if (target === "titlu") move(d.titlu);
  else if (target === "tabel") move(d.tabel);
  else if (target === "footer") move(d.footer);
  else {
    const i = Number(target.split(":")[1]);
    if (d.casete_text[i]) move(d.casete_text[i]);
  }
}

/* ------------------------------------------------------------------ */
/*  Small reusable pieces                                              */
/* ------------------------------------------------------------------ */

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
  title: tooltip,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="block" title={tooltip}>
      <span className="flex justify-between text-xs font-medium text-slate-600">
        <span>{label}</span>
        <span className="tabular-nums text-slate-500">
          {value}{unit ?? ""}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-sky-600"
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { id: T; label: string | React.ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={[
            "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
            value === o.id
              ? "border-sky-500 bg-sky-50 text-sky-800"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const WEEKEND_SWATCHES = ["#cfcfcf", "#e5e5e5", "#d4d4d4", "#bdbdbd", "#a3a3a3"];

/* ------------------------------------------------------------------ */
/*  Tab components                                                     */
/* ------------------------------------------------------------------ */

function TabPagina({
  draft,
  patch,
  busy,
}: {
  draft: PdfTemplateSetari;
  patch: (fn: (d: PdfTemplateSetari) => void) => void;
  busy: boolean;
}) {
  const preset = detectMarginPreset(draft.pagina.margini);

  return (
    <div className="space-y-4">
      {/* orientare */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Orientare</p>
        <Segmented
          value={draft.pagina.orientare}
          options={[
            { id: "landscape" as const, label: "⬌ Landscape" },
            { id: "portrait" as const, label: "⬍ Portret" },
          ]}
          onChange={(v) => patch((d) => { d.pagina.orientare = v; })}
          disabled={busy}
        />
      </div>

      {/* margini preset */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Margini</p>
        <Segmented<PdfMarginPreset>
          value={preset}
          options={[
            { id: "mici", label: "Mici" },
            { id: "normale", label: "Normale" },
            { id: "mari", label: "Mari" },
            { id: "personalizat", label: "Personalizat" },
          ]}
          onChange={(v) => {
            if (v === "personalizat") return;
            const p = PDF_MARGIN_PRESETS[v];
            patch((d) => { d.pagina.margini = { ...p }; });
          }}
          disabled={busy}
        />
        {preset === "personalizat" && (
          <div className="mt-2 space-y-2">
            <SliderField label="Sus" value={draft.pagina.margini.top} min={0} max={25} step={0.5} unit=" mm" disabled={busy}
              onChange={(n) => patch((d) => { d.pagina.margini.top = n; })} />
            <SliderField label="Jos" value={draft.pagina.margini.bottom} min={0} max={25} step={0.5} unit=" mm" disabled={busy}
              onChange={(n) => patch((d) => { d.pagina.margini.bottom = n; })} />
            <SliderField label="Stânga" value={draft.pagina.margini.left} min={0} max={25} step={0.5} unit=" mm" disabled={busy}
              onChange={(n) => patch((d) => { d.pagina.margini.left = n; })} />
            <SliderField label="Dreapta" value={draft.pagina.margini.right} min={0} max={25} step={0.5} unit=" mm" disabled={busy}
              onChange={(n) => patch((d) => { d.pagina.margini.right = n; })} />
          </div>
        )}
      </div>

      {/* tabel compact / întins */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Tabel</p>
        <Segmented
          value={draft.pagina.tabel_compact ? "compact" : "intins"}
          options={[
            {
              id: "compact" as const,
              label: (
                <span className="flex items-center gap-1.5">
                  <svg width={24} height={16} className="shrink-0">
                    <rect x={1} y={2} width={14} height={12} rx={1} fill="none" stroke="currentColor" strokeWidth={1} />
                    <rect x={16} y={2} width={7} height={12} rx={0.5} fill="none" stroke="currentColor" strokeWidth={0.5} strokeDasharray="1,1" />
                  </svg>
                  Compact
                </span>
              ),
            },
            {
              id: "intins" as const,
              label: (
                <span className="flex items-center gap-1.5">
                  <svg width={24} height={16} className="shrink-0">
                    <rect x={1} y={2} width={22} height={12} rx={1} fill="none" stroke="currentColor" strokeWidth={1} />
                  </svg>
                  Întins
                </span>
              ),
            },
          ]}
          onChange={(v) => patch((d) => { d.pagina.tabel_compact = v === "compact"; })}
          disabled={busy}
        />
      </div>
    </div>
  );
}

function TabTabel({
  draft,
  patch,
  busy,
}: {
  draft: PdfTemplateSetari;
  patch: (fn: (d: PdfTemplateSetari) => void) => void;
  busy: boolean;
}) {
  const [advOpen, setAdvOpen] = useState(false);

  return (
    <div className="space-y-4">
      <SliderField label="Scară" value={draft.tabel.scara} min={60} max={120} unit="%" disabled={busy}
        onChange={(n) => patch((d) => { d.tabel.scara = n; })} />

      <SliderField label="Font" value={draft.tabel.font_pt} min={5} max={14} step={0.5} unit=" pt" disabled={busy}
        onChange={(n) => patch((d) => { d.tabel.font_pt = n; })} />

      {/* celule lungi */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Celule lungi</p>
        <div className="grid grid-cols-3 gap-1">
          {([
            { id: "doua_randuri" as PdfCeluleLungi, label: "2 rânduri", lines: ["07:00-", "15:00"] },
            { id: "micsoreaza" as PdfCeluleLungi, label: "Mici", lines: ["07:00-15:00"] },
            { id: "lateste" as PdfCeluleLungi, label: "Lățește", lines: ["07:00-15:00"] },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={busy}
              onClick={() => patch((d) => { d.tabel.celule_lungi = opt.id; })}
              className={[
                "rounded-lg border p-2 text-center text-[10px] leading-tight transition-colors",
                draft.tabel.celule_lungi === opt.id
                  ? "border-sky-500 bg-sky-50"
                  : "border-slate-200 bg-white hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="mx-auto mb-1 flex h-6 w-10 items-center justify-center border border-slate-300 bg-white text-[7px] leading-none">
                {opt.lines.map((l, li) => <div key={li}>{l}</div>)}
              </div>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* weekend color */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Culoare weekend</p>
        <div className="flex items-center gap-1.5">
          <div
            className="h-6 w-6 shrink-0 rounded border border-slate-300"
            style={{ background: draft.tabel.culoare_weekend }}
          />
          {WEEKEND_SWATCHES.map((sw) => (
            <button
              key={sw}
              type="button"
              disabled={busy}
              onClick={() => patch((d) => { d.tabel.culoare_weekend = sw; })}
              className={[
                "h-6 w-6 shrink-0 rounded border transition-shadow",
                draft.tabel.culoare_weekend === sw
                  ? "ring-2 ring-sky-500 border-sky-500"
                  : "border-slate-300 hover:ring-1 hover:ring-sky-300",
              ].join(" ")}
              style={{ background: sw }}
              title={sw}
            />
          ))}
          <input
            type="color"
            value={draft.tabel.culoare_weekend}
            disabled={busy}
            onChange={(e) => patch((d) => { d.tabel.culoare_weekend = e.target.value; })}
            className="h-6 w-6 cursor-pointer rounded border-0 p-0"
          />
        </div>
      </div>

      {/* antet bold */}
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <input
          type="checkbox"
          checked={draft.tabel.font_antet_bold}
          disabled={busy}
          onChange={(e) => patch((d) => { d.tabel.font_antet_bold = e.target.checked; })}
        />
        Antet bold
      </label>

      {/* avansat */}
      <button
        type="button"
        onClick={() => setAdvOpen(!advOpen)}
        className="text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        {advOpen ? "▾" : "▸"} Avansat
      </button>
      {advOpen && (
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
          <SliderField label="Lățime nume" value={draft.tabel.latime_nume} min={8} max={35} unit="%"
            disabled={busy} onChange={(n) => patch((d) => { d.tabel.latime_nume = n; })}
            title="Procentul din lățimea tabelului alocat coloanei cu numele" />
          <SliderField label="Zi min" value={draft.tabel.latime_zi_min} min={6} max={40} unit=" pt"
            disabled={busy} onChange={(n) => patch((d) => { d.tabel.latime_zi_min = n; })}
            title="Lățimea minimă a unei coloane de zi (pt)" />
          <SliderField label="Zi max" value={draft.tabel.latime_zi_max} min={10} max={80} unit=" pt"
            disabled={busy} onChange={(n) => patch((d) => { d.tabel.latime_zi_max = n; })}
            title="Lățimea maximă a unei coloane de zi (pt)" />
          <SliderField label="Înălțime rând" value={draft.tabel.inaltime_rand} min={8} max={36} unit=" pt"
            disabled={busy} onChange={(n) => patch((d) => { d.tabel.inaltime_rand = n; })}
            title="Înălțimea fiecărui rând din tabel (pt)" />
          <SliderField label="Grosime linii" value={draft.tabel.grosime_linii} min={0.4} max={3} step={0.1} unit=" pt"
            disabled={busy} onChange={(n) => patch((d) => { d.tabel.grosime_linii = n; })}
            title="Grosimea liniilor de bordură din tabel (pt)" />
        </div>
      )}
    </div>
  );
}

function TabImpartire({
  draft,
  patch,
  busy,
  daysInMonth,
  cells,
}: {
  draft: PdfTemplateSetari;
  patch: (fn: (d: PdfTemplateSetari) => void) => void;
  busy: boolean;
  daysInMonth: number;
  cells: string[][];
}) {
  const suggest = shouldSuggestTwoParts(cells, draft.impartire);

  return (
    <div className="space-y-4">
      {/* parti cards */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Părți</p>
        <div className="grid grid-cols-3 gap-1">
          {([1, 2, 3] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={busy}
              onClick={() =>
                patch((d) => {
                  d.impartire.parti = n;
                  d.impartire.personalizat = false;
                  if (n > 1) d.impartire.taieturi = presetTaieturi(n as 2 | 3, daysInMonth);
                  else d.impartire.taieturi = [];
                })
              }
              className={[
                "rounded-lg border p-2 text-center text-xs font-medium transition-colors",
                draft.impartire.parti === n && !draft.impartire.personalizat
                  ? "border-sky-500 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="mx-auto mb-1 flex h-5 w-10 items-stretch gap-px">
                {Array.from({ length: n }, (_, i) => (
                  <div key={i} className="flex-1 rounded-sm border border-slate-400 bg-slate-100" />
                ))}
              </div>
              {n} {n === 1 ? "parte" : "părți"}
            </button>
          ))}
        </div>
      </div>

      {/* personalizat */}
      {draft.impartire.parti > 1 && (
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={draft.impartire.personalizat}
            disabled={busy}
            onChange={(e) => patch((d) => { d.impartire.personalizat = e.target.checked; })}
          />
          Personalizat
        </label>
      )}

      {/* taieturi */}
      {draft.impartire.personalizat && draft.impartire.parti > 1 && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">
            Zilele de tăiere (ultima zi inclusiv a fiecărei părți):
          </p>
          {draft.impartire.taieturi.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-16">Tăietură {i + 1}</span>
              <input
                type="number"
                min={1}
                max={daysInMonth - 1}
                value={t}
                disabled={busy}
                onChange={(e) =>
                  patch((d) => {
                    d.impartire.taieturi[i] = Math.max(1, Math.min(daysInMonth - 1, Number(e.target.value) || 1));
                  })
                }
                className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* asezare */}
      {draft.impartire.parti > 1 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Așezare</p>
          <Segmented
            value={draft.impartire.asezare}
            options={[
              { id: "aceeasi_pagina" as const, label: "Aceeași pagină" },
              { id: "pagini_noi" as const, label: "Pagini noi" },
            ]}
            onChange={(v) => patch((d) => { d.impartire.asezare = v; })}
            disabled={busy}
          />
        </div>
      )}

      {/* spatiu mm */}
      {draft.impartire.parti > 1 &&
        draft.impartire.asezare === "aceeasi_pagina" && (
          <SliderField
            label="Spațiu între părți"
            value={draft.impartire.spatiu_mm}
            min={0}
            max={30}
            unit=" mm"
            disabled={busy}
            onChange={(n) => patch((d) => { d.impartire.spatiu_mm = n; })}
          />
        )}

      {/* O.SD */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Coloana O.SD</p>
        <Segmented
          value={draft.impartire.osd}
          options={[
            { id: "ultima" as const, label: "Ultima parte" },
            { id: "fiecare" as const, label: "Fiecare" },
            { id: "ascunde" as const, label: "Ascunde" },
          ]}
          onChange={(v) => patch((d) => { d.impartire.osd = v; })}
          disabled={busy}
        />
      </div>

      {/* antet stil */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-600">Stil antet</p>
        <Segmented
          value={draft.impartire.antet_stil}
          options={[
            { id: "clasic" as const, label: "Clasic" },
            { id: "detaliat" as const, label: "Detaliat" },
          ]}
          onChange={(v) => patch((d) => { d.impartire.antet_stil = v; })}
          disabled={busy}
        />
      </div>

      {/* suggestion banner */}
      {suggest && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs text-amber-800">
            Multe celule lungi — recomandăm 2 părți.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              patch((d) => {
                d.impartire.parti = 2;
                d.impartire.personalizat = false;
                d.impartire.taieturi = presetTaieturi(2, daysInMonth);
              })
            }
            className="mt-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
          >
            Aplică
          </button>
        </div>
      )}
    </div>
  );
}

function TabTexte({
  draft,
  patch,
  busy,
}: {
  draft: PdfTemplateSetari;
  patch: (fn: (d: PdfTemplateSetari) => void) => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* titlu */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Titlu</p>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={draft.titlu.afisat}
            disabled={busy}
            onChange={(e) => patch((d) => { d.titlu.afisat = e.target.checked; })}
          />
          Afișat
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Text (gol = titlul din grafic)
          <input
            type="text"
            value={draft.titlu.text}
            disabled={busy}
            maxLength={300}
            placeholder="{categorie} — {luna} {an}"
            onChange={(e) => patch((d) => { d.titlu.text = e.target.value; })}
            className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-sky-400"
          />
          <span className="mt-0.5 block text-[10px] text-slate-400">
            {"{luna} {an} {categorie} {workspace}"}
          </span>
        </label>
        <SliderField label="Mărime" value={draft.titlu.marime} min={6} max={28} unit=" pt"
          disabled={busy} onChange={(n) => patch((d) => { d.titlu.marime = n; })} />
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Aliniere</p>
          <Segmented<PdfAliniere>
            value={draft.titlu.aliniere}
            options={[
              { id: "left", label: "Stânga" },
              { id: "center", label: "Centru" },
              { id: "right", label: "Dreapta" },
            ]}
            onChange={(v) => patch((d) => { d.titlu.aliniere = v; })}
            disabled={busy}
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox" checked={draft.titlu.bold} disabled={busy}
            onChange={(e) => patch((d) => { d.titlu.bold = e.target.checked; })}
          />
          Bold
        </label>
      </div>

      <hr className="border-slate-100" />

      {/* casete */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Casete text</p>
        {draft.casete_text.map((c, i) => (
          <div
            key={c.id}
            className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Casetă {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    patch((d) => {
                      if (d.casete_text[i]) d.casete_text[i].afisat = !d.casete_text[i].afisat;
                    })
                  }
                  className="rounded p-0.5 text-slate-500 hover:text-slate-700"
                  title={c.afisat ? "Ascunde" : "Afișează"}
                >
                  {c.afisat ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patch((d) => { d.casete_text.splice(i, 1); })}
                  className="rounded p-0.5 text-red-500 hover:text-red-700"
                  title="Șterge"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <input
              type="text"
              value={c.text}
              disabled={busy}
              maxLength={200}
              placeholder="ex. Aprobat"
              onChange={(e) =>
                patch((d) => { if (d.casete_text[i]) d.casete_text[i].text = e.target.value; })
              }
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <SliderField label="Mărime" value={c.marime} min={5} max={24} unit=" pt"
              disabled={busy}
              onChange={(n) => patch((d) => { if (d.casete_text[i]) d.casete_text[i].marime = n; })} />
          </div>
        ))}
        <button
          type="button"
          disabled={busy || draft.casete_text.length >= 6}
          onClick={() =>
            patch((d) => {
              const n = d.casete_text.length + 1;
              d.casete_text.push({
                id: `caseta-${n}-${Date.now()}`,
                text: "Aprobat",
                x: 70,
                y: 88,
                latime: 25,
                marime: 9,
                bold: true,
                aliniere: "right",
                afisat: true,
              });
            })
          }
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Adaugă casetă (max 6)
        </button>
      </div>

      <hr className="border-slate-100" />

      {/* footer */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-700">Footer</p>
        <p className="text-[11px] text-slate-500">
          Textele vin din Setări → Texte.
        </p>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox" checked={draft.footer.afisat} disabled={busy}
            onChange={(e) => patch((d) => { d.footer.afisat = e.target.checked; })}
          />
          Afișat
        </label>
        <SliderField label="Mărime" value={draft.footer.marime} min={5} max={18} step={0.5} unit=" pt"
          disabled={busy} onChange={(n) => patch((d) => { d.footer.marime = n; })} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab icon button                                                    */
/* ------------------------------------------------------------------ */

const TAB_ICONS: Record<TabId, typeof FileText> = {
  pagina: FileText,
  tabel: Table,
  impartire: Columns2,
  texte: Type,
};
const TAB_LABELS: Record<TabId, string> = {
  pagina: "Pagină",
  tabel: "Tabel",
  impartire: "Împărțire",
  texte: "Texte",
};
const TAB_IDS: TabId[] = ["pagina", "tabel", "impartire", "texte"];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ExportPdfSettingsForm() {
  /* ---- state ---- */
  const [draft, setDraft] = useState<PdfTemplateSetari>(() => structuredClone(DEFAULT_PDF_TEMPLATE));
  const [saved, setSaved] = useState<PdfTemplateSetari>(() => structuredClone(DEFAULT_PDF_TEMPLATE));
  const [items, setItems] = useState<TplItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [eImplicit, setEImplicit] = useState(true);
  const [versiune, setVersiune] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PdfTemplateSetari[]>([]);
  const [future, setFuture] = useState<PdfTemplateSetari[]>([]);
  const [dragEnabled, setDragEnabled] = useState(true);
  const [dragSelected, setDragSelected] = useState<DragTarget | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>("pagina");
  const [zoomMode, setZoomMode] = useState<"fit" | "pct">("fit");
  const [zoomPct, setZoomPct] = useState(100);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const [categorii, setCategorii] = useState<CategorieOpt[]>([]);
  const [categorieId, setCategorieId] = useState<string>("");
  const [previewTitle, setPreviewTitle] = useState("Grafic");
  const [previewDays, setPreviewDays] = useState<PreviewDay[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewFooter, setPreviewFooter] = useState({ medicSef: "Medic șef", asSef: "As. șef" });
  const [previewVars, setPreviewVars] = useState<PdfTemplateVars>({});
  const [tplMenuOpen, setTplMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const tplMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const [previewDraft, setPreviewDraft] = useState(draft);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dirty = !deepEqual(draft, saved);
  const busy = loading || saving;

  const now = useMemo(() => new Date(), []);
  const an = now.getFullYear();
  const luna = now.getMonth() + 1;
  const daysInMonth = new Date(an, luna, 0).getDate();

  /* ---- undo / redo ---- */
  const pushHistory = useCallback((prev: PdfTemplateSetari) => {
    setHistory((h) => [...h.slice(-29), structuredClone(prev)]);
    setFuture([]);
  }, []);

  const patch = useCallback(
    (fn: (d: PdfTemplateSetari) => void, record = true) => {
      setDraft((prev) => {
        if (record) pushHistory(prev);
        const next = structuredClone(prev);
        fn(next);
        return mergePdfTemplate(next);
      });
    },
    [pushHistory],
  );

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [structuredClone(draft), ...f].slice(0, 30));
      setDraft(structuredClone(prev));
      return h.slice(0, -1);
    });
  }

  function redo() {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, structuredClone(draft)].slice(-30));
      setDraft(structuredClone(next));
      return f.slice(1);
    });
  }

  /* ---- drag enabled ---- */
  useEffect(() => {
    function onResize() { setDragEnabled(window.innerWidth >= 900); }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ---- keyboard ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.key === "Escape") { setDragSelected(null); return; }
      if (!dragSelected || !dragEnabled) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (dragSelected.startsWith("caseta:")) {
          e.preventDefault();
          const i = Number(dragSelected.split(":")[1]);
          patch((d) => { d.casete_text.splice(i, 1); });
          setDragSelected(null);
        }
        return;
      }
      const step = e.shiftKey ? 5 : 1;
      const dx = (step / 297) * 100;
      const dy = (step / 210) * 100;
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const ddx = e.key === "ArrowLeft" ? -dx : e.key === "ArrowRight" ? dx : 0;
        const ddy = e.key === "ArrowUp" ? -dy : e.key === "ArrowDown" ? dy : 0;
        patch((d) => moveSelected(d, dragSelected, ddx, ddy));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragSelected, dragEnabled, draft]);

  /* ---- debounced preview ---- */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewDraft(draft), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [draft]);

  /* ---- beforeunload ---- */
  useEffect(() => {
    function onBefore(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  /* ---- close menus on outside click ---- */
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (tplMenuRef.current && !tplMenuRef.current.contains(e.target as Node))
        setTplMenuOpen(false);
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node))
        setMoreMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ---- load data ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tplRes, catRes] = await Promise.all([
          fetch("/api/setari/export-pdf"),
          fetch("/api/categorii"),
        ]);
        if (!tplRes.ok) throw new Error(await tplRes.text());
        const tpl = (await tplRes.json()) as {
          setari: PdfTemplateSetari;
          e_implicit: boolean;
          versiune: number;
          id?: string | null;
          items?: TplItem[];
        };
        if (cancelled) return;
        const merged = mergePdfTemplate(tpl.setari);
        setDraft(merged);
        setSaved(structuredClone(merged));
        setEImplicit(Boolean(tpl.e_implicit));
        setVersiune(tpl.versiune ?? 0);
        setItems(tpl.items ?? []);
        setActiveId(tpl.id ?? null);
        setHistory([]);
        setFuture([]);

        if (catRes.ok) {
          const cats = (await catRes.json()) as { items?: CategorieOpt[] };
          const list = cats.items ?? [];
          setCategorii(list);
          if (list[0]) setCategorieId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Încărcare eșuată");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  /* ---- load preview data ---- */
  useEffect(() => {
    if (!categorieId) return;
    let cancelled = false;
    async function loadPreview() {
      try {
        const [lunaRes, footerRes] = await Promise.all([
          fetch(
            `/api/luna?an=${an}&luna=${luna}&categorie=${encodeURIComponent(categorieId)}&foaie=1`,
          ),
          fetch("/api/grafic-footer"),
        ]);
        if (!lunaRes.ok) return;
        const data = (await lunaRes.json()) as {
          an: number;
          luna: number;
          angajati?: Array<{ id: string; nume: string }>;
          programari?: Array<{ angajatId: string; data: string; valoare: string | null }>;
          texte?: { titluPreview?: string; dayAbbrs?: string[] };
        };
        if (cancelled) return;

        const abbrs = data.texte?.dayAbbrs ?? ["D", "L", "Ma", "Mi", "J", "V", "S"];
        const days: PreviewDay[] = Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const wd = new Date(an, luna - 1, day).getDay();
          return { day, abbr: abbrs[wd] ?? "", weekend: wd === 0 || wd === 6 };
        });

        const byStaff = new Map<string, Map<string, string>>();
        for (const p of data.programari ?? []) {
          if (!byStaff.has(p.angajatId)) byStaff.set(p.angajatId, new Map());
          byStaff.get(p.angajatId)!.set(p.data, p.valoare ?? "");
        }
        const rows: PreviewRow[] = (data.angajati ?? []).map((a) => ({
          name: a.nume.toUpperCase(),
          cells: days.map((d) => {
            const key = `${an}-${String(luna).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
            return byStaff.get(a.id)?.get(key) ?? "";
          }),
          osd: "",
        }));

        setPreviewTitle(data.texte?.titluPreview ?? "Grafic");
        setPreviewDays(days);
        setPreviewRows(rows);

        if (footerRes.ok) {
          const fj = (await footerRes.json()) as {
            footer?: { medicSef?: string; asSef?: string };
          };
          if (fj.footer) {
            setPreviewFooter({
              medicSef: fj.footer.medicSef ?? "Medic șef",
              asSef: fj.footer.asSef ?? "As. șef",
            });
          }
        }

        const cat = categorii.find((c) => c.id === categorieId);
        const lunaNumeStr = new Date(an, luna - 1, 1).toLocaleDateString("ro-RO", { month: "long" });
        setPreviewVars({
          luna: lunaNumeStr,
          lunaNum: luna,
          an: String(an),
          categorie: cat?.nume ?? "",
          workspace: "",
        });
      } catch { /* keep */ }
    }
    void loadPreview();
    return () => { cancelled = true; };
  }, [categorieId, categorii, an, luna, daysInMonth]);

  /* ---- canvas selection → tab ---- */
  function onDragSelect(t: DragTarget | null) {
    setDragSelected(t);
    if (!t) return;
    if (t === "titlu" || t === "footer" || t.startsWith("caseta:")) setActiveTab("texte");
    else if (t === "tabel") setActiveTab("tabel");
  }

  /* ---- sample data fallback ---- */
  const previewSampleDays = useMemo(() => {
    if (previewDays.length > 0) return previewDays;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const wd = new Date(an, luna - 1, i + 1).getDay();
      return {
        day: i + 1,
        abbr: ["D", "L", "Ma", "Mi", "J", "V", "S"][wd],
        weekend: wd === 0 || wd === 6,
      };
    });
  }, [previewDays, daysInMonth, an, luna]);

  const previewSampleRows = useMemo(() => {
    if (previewRows.length > 0) return previewRows;
    return [
      {
        name: "EXEMPLU",
        cells: Array.from({ length: daysInMonth }, (_, i) =>
          i === 1 ? "07:00-15:00" : i === 2 ? "S1" : "",
        ),
        osd: "",
      },
    ];
  }, [previewRows, daysInMonth]);

  const cellsMatrix = useMemo(
    () => previewSampleRows.map((r) => r.cells),
    [previewSampleRows],
  );

  /* ------------------------------------------------------------------ */
  /*  API actions                                                        */
  /* ------------------------------------------------------------------ */

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/export-pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeId,
          setari: draft,
          nume: items.find((i) => i.id === activeId)?.nume,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Salvare eșuată");
      }
      const data = (await res.json()) as {
        setari: PdfTemplateSetari; versiune: number; e_implicit: boolean;
        id?: string; items?: TplItem[];
      };
      const merged = mergePdfTemplate(data.setari);
      setDraft(merged);
      setSaved(structuredClone(merged));
      setVersiune(data.versiune);
      setEImplicit(false);
      if (data.id) setActiveId(data.id);
      if (data.items) setItems(data.items);
      setHistory([]);
      setFuture([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(structuredClone(saved));
    setHistory([]);
    setFuture([]);
  }

  async function resetDefault() {
    if (!window.confirm("Resetezi template-ul la formatul inițial?")) return;
    setSaving(true);
    setError(null);
    try {
      if (!activeId) {
        const merged = mergePdfTemplate(DEFAULT_PDF_TEMPLATE);
        setDraft(merged);
        setSaved(structuredClone(merged));
        setEImplicit(true);
        return;
      }
      const res = await fetch("/api/setari/export-pdf/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId }),
      });
      if (!res.ok) throw new Error("Reset eșuat");
      const data = (await res.json()) as {
        setari: PdfTemplateSetari; e_implicit: boolean; versiune: number;
        items?: TplItem[];
      };
      const merged = mergePdfTemplate(data.setari);
      setDraft(merged);
      setSaved(structuredClone(merged));
      setEImplicit(Boolean(data.e_implicit));
      setVersiune(data.versiune);
      if (data.items) setItems(data.items);
      setHistory([]);
      setFuture([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset eșuat");
    } finally {
      setSaving(false);
    }
  }

  async function selectTemplate(id: string) {
    if (dirty && !window.confirm("Ai modificări nesalvate. Continui?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/setari/export-pdf?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Nu s-a putut încărca");
      const tpl = (await res.json()) as {
        setari: PdfTemplateSetari; versiune: number;
        id?: string | null; items?: TplItem[]; e_implicit: boolean;
      };
      const merged = mergePdfTemplate(tpl.setari);
      setDraft(merged);
      setSaved(structuredClone(merged));
      setActiveId(tpl.id ?? id);
      setVersiune(tpl.versiune);
      setEImplicit(Boolean(tpl.e_implicit));
      if (tpl.items) setItems(tpl.items);
      setHistory([]);
      setFuture([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare");
    } finally {
      setLoading(false);
    }
  }

  async function createTpl() {
    setSaving(true);
    try {
      const res = await fetch("/api/setari/export-pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", nume: "Nou" }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Creare eșuată");
      }
      const data = (await res.json()) as {
        item: TplItem; setari: PdfTemplateSetari; items: TplItem[];
      };
      setItems(data.items);
      setActiveId(data.item.id);
      const merged = mergePdfTemplate(data.setari);
      setDraft(merged);
      setSaved(structuredClone(merged));
      setEImplicit(false);
      setHistory([]);
      setFuture([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Creare eșuată");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateTpl() {
    if (!activeId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/setari/export-pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicate", id: activeId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Duplicare eșuată");
      }
      const data = (await res.json()) as {
        item: TplItem; setari: PdfTemplateSetari; items: TplItem[];
      };
      setItems(data.items);
      setActiveId(data.item.id);
      const merged = mergePdfTemplate(data.setari);
      setDraft(merged);
      setSaved(structuredClone(merged));
      setHistory([]);
      setFuture([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicare eșuată");
    } finally {
      setSaving(false);
    }
  }

  async function renameTpl() {
    if (!activeId) return;
    const cur = items.find((i) => i.id === activeId)?.nume ?? "";
    const nume = window.prompt("Nume template", cur)?.trim();
    if (!nume) return;
    setSaving(true);
    try {
      const res = await fetch("/api/setari/export-pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", id: activeId, nume }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Redenumire eșuată");
      }
      const data = (await res.json()) as { items: TplItem[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redenumire eșuată");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTpl() {
    if (!activeId) return;
    if (!window.confirm("Ștergi acest template?")) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/setari/export-pdf?id=${encodeURIComponent(activeId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? "Ștergere eșuată");
      }
      const data = (await res.json()) as { items: TplItem[] };
      setItems(data.items);
      if (data.items[0]) await selectTemplate(data.items[0].id);
      else {
        const merged = mergePdfTemplate(DEFAULT_PDF_TEMPLATE);
        setActiveId(null);
        setDraft(merged);
        setSaved(structuredClone(merged));
        setEImplicit(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ștergere eșuată");
    } finally {
      setSaving(false);
    }
  }

  async function setImplicit() {
    if (!activeId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/setari/export-pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_implicit", id: activeId }),
      });
      if (!res.ok) throw new Error("Eșuat");
      const data = (await res.json()) as { items: TplItem[] };
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eșuat");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    try {
      const { downloadGraficPdf } = await import("@/components/pdf/exportGraficPdf");
      const tplVars: PdfTemplateVars = { ...previewVars, lunaNum: luna, an };
      await downloadGraficPdf(
        {
          title: previewTitle,
          days: previewSampleDays,
          rows: previewSampleRows,
          footer: {
            medicSef: previewFooter.medicSef,
            asSef: previewFooter.asSef,
            delegatName: "",
            delegatLabel: "",
          },
          template: draft,
          templateVars: tplVars,
        },
        `probă-export-${an}-${String(luna).padStart(2, "0")}.pdf`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare la descărcare");
    }
  }

  /* ---- zoom ---- */
  function zoomIn() {
    if (zoomMode === "fit") { setZoomMode("pct"); setZoomPct(100); return; }
    setZoomPct((p) => Math.min(200, p + 10));
  }
  function zoomOut() {
    if (zoomMode === "fit") return;
    const next = zoomPct - 10;
    if (next < 30) { setZoomMode("fit"); return; }
    setZoomPct(next);
  }
  function zoomFit() { setZoomMode("fit"); }

  /* ---- active template name ---- */
  const activeName = activeId
    ? items.find((i) => i.id === activeId)?.nume ?? "Template"
    : "Format inițial";
  const activeIsImplicit = activeId
    ? items.find((i) => i.id === activeId)?.implicit ?? false
    : false;

  /* ================================================================== */
  /*  RENDER                                                             */
  /* ================================================================== */

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ============ TOOLBAR ============ */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
        {/* LEFT: template menu */}
        <div ref={tplMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setTplMenuOpen((o) => !o)}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            {activeIsImplicit && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />}
            <span className="max-w-[140px] truncate">{activeName}</span>
            <ChevronRight className="h-3 w-3 rotate-90 text-slate-400" />
          </button>
          {tplMenuOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { void selectTemplate(it.id); setTplMenuOpen(false); }}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50",
                    it.id === activeId ? "bg-sky-50 font-medium text-sky-800" : "text-slate-700",
                  ].join(" ")}
                >
                  {it.implicit && <Star className="h-3 w-3 fill-amber-400 text-amber-500" />}
                  <span className="truncate">{it.nume}</span>
                </button>
              ))}
              {items.length > 0 && <hr className="my-1 border-slate-100" />}
              <button type="button" onClick={() => { void createTpl(); setTplMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                Nou
              </button>
              <button type="button" disabled={!activeId} onClick={() => { void duplicateTpl(); setTplMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                Duplică
              </button>
              <button type="button" disabled={!activeId} onClick={() => { void renameTpl(); setTplMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                Redenumește
              </button>
              <button type="button" disabled={!activeId} onClick={() => { void setImplicit(); setTplMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                Setează implicit
              </button>
              <button type="button" disabled={!activeId || items.length <= 1}
                onClick={() => { void deleteTpl(); setTplMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-40">
                Șterge
              </button>
            </div>
          )}
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* CENTER: undo / redo + zoom + categorie */}
        <button type="button" disabled={history.length === 0} onClick={undo}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Undo (Cmd+Z)">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" disabled={future.length === 0} onClick={redo}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Redo (Cmd+Shift+Z)">
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button type="button" onClick={zoomOut} disabled={zoomMode === "fit"}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Zoom out">
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => { if (zoomMode === "fit") { setZoomMode("pct"); setZoomPct(100); } else zoomFit(); }}
          className="min-w-[52px] rounded px-1.5 py-1 text-center text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          {zoomMode === "fit" ? "Fit" : `${zoomPct}%`}
        </button>
        <button type="button" onClick={zoomIn}
          className="rounded p-1.5 text-slate-600 hover:bg-slate-100" title="Zoom in">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={zoomFit}
          className={[
            "rounded px-2 py-1 text-xs font-medium",
            zoomMode === "fit"
              ? "bg-sky-100 text-sky-700"
              : "text-slate-600 hover:bg-slate-100",
          ].join(" ")}
        >
          Potrivește
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {categorii.length > 0 && (
          <select
            value={categorieId}
            onChange={(e) => setCategorieId(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
          >
            {categorii.map((c) => (
              <option key={c.id} value={c.id}>{c.nume}</option>
            ))}
          </select>
        )}

        {/* spacer */}
        <div className="flex-1" />

        {/* RIGHT: status + more menu + save + download */}
        <span className={[
          "text-xs font-medium",
          dirty ? "text-orange-600" : "text-slate-500",
        ].join(" ")}>
          {dirty ? "Nesalvat" : "Salvat"}
        </span>

        {error && (
          <span className="max-w-[160px] truncate text-xs font-medium text-red-600" title={error}>
            {error}
          </span>
        )}

        <div ref={moreMenuRef} className="relative">
          <button type="button" onClick={() => setMoreMenuOpen((o) => !o)}
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {moreMenuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button type="button" disabled={!dirty}
                onClick={() => { discard(); setMoreMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                Renunță la modificări
              </button>
              <button type="button"
                onClick={() => { void resetDefault(); setMoreMenuOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50">
                Revino la formatul inițial
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={busy || !dirty}
          onClick={() => void save()}
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          Salvează
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => void downloadPdf()}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Descarcă PDF de probă
        </button>
      </div>

      {/* ============ BODY ============ */}
      <div className="flex min-h-0 flex-1">
        {/* ---- LEFT PANEL ---- */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-slate-200">
          {/* icon tab bar */}
          <div className="flex shrink-0 border-b border-slate-100">
            {TAB_IDS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={[
                    "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                    activeTab === tab
                      ? "border-b-2 border-sky-500 text-sky-700"
                      : "text-slate-500 hover:text-slate-700",
                  ].join(" ")}
                  title={TAB_LABELS[tab]}
                >
                  <Icon className="h-4 w-4" />
                  {TAB_LABELS[tab]}
                </button>
              );
            })}
          </div>
          {/* tab content */}
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {activeTab === "pagina" && (
              <TabPagina draft={draft} patch={patch} busy={busy} />
            )}
            {activeTab === "tabel" && (
              <TabTabel draft={draft} patch={patch} busy={busy} />
            )}
            {activeTab === "impartire" && (
              <TabImpartire
                draft={draft}
                patch={patch}
                busy={busy}
                daysInMonth={daysInMonth}
                cells={cellsMatrix}
              />
            )}
            {activeTab === "texte" && (
              <TabTexte draft={draft} patch={patch} busy={busy} />
            )}
          </div>
        </div>

        {/* ---- RIGHT: CANVAS AREA ---- */}
        <div className="flex min-w-0 flex-1 flex-col bg-slate-100">
          {/* canvas */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
            {loading ? (
              <p className="text-sm text-slate-500">Se încarcă…</p>
            ) : (
              <PdfDragPreview
                setari={previewDraft}
                onChange={(next) => setDraft(mergePdfTemplate(next))}
                onDragStart={() => pushHistory(draft)}
                onCommit={() => setPreviewDraft(draft)}
                title={previewTitle}
                days={previewSampleDays}
                rows={previewSampleRows}
                footer={previewFooter}
                vars={previewVars}
                selected={dragSelected}
                onSelect={onDragSelect}
                dragEnabled={dragEnabled}
                zoomMode={zoomMode}
                zoomPct={zoomPct}
                an={an}
                luna={luna}
                pageIndex={pageIndex}
                onPageIndexChange={setPageIndex}
                onPageCount={setPageCount}
              />
            )}
          </div>
          {/* page nav */}
          {pageCount > 1 && (
            <div className="flex shrink-0 items-center justify-center gap-2 border-t border-slate-200 bg-white py-1.5">
              <button
                type="button"
                disabled={pageIndex <= 0}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-slate-700 tabular-nums">
                {pageIndex + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
