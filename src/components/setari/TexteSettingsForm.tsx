"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GRAFIC_FOOTER_FIELDS,
  type GraficFooterKey,
  type GraficFooterTexts,
} from "@/lib/graficFooter";
import {
  TEXTE_SECTIONS,
  formatTexte,
  type TexteKeyDef,
  type TexteSectionId,
} from "@/lib/texteRegistry";

type RegistryItem = TexteKeyDef;

type LoadResponse = {
  sections: typeof TEXTE_SECTIONS;
  registry: RegistryItem[];
  texte: Record<string, string>;
  overrides: Record<string, string>;
  footer: GraficFooterTexts;
  footerFields: typeof GRAFIC_FOOTER_FIELDS;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Eroare ${res.status}`;
  } catch {
    return `Eroare ${res.status}`;
  }
}

export function TexteSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryItem[]>([]);
  const [texte, setTexte] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [footer, setFooter] = useState<GraficFooterTexts | null>(null);
  const [footerDrafts, setFooterDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setari/texte");
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as LoadResponse;
      setRegistry(data.registry);
      setTexte(data.texte);
      setOverrides(data.overrides);
      setDrafts({ ...data.texte });
      setFooter(data.footer);
      setFooterDrafts({
        delegat_name: data.footer.delegatName,
        delegat_label: data.footer.delegatLabel,
        medic_sef: data.footer.medicSef,
        as_sef: data.footer.asSef,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Încărcare eșuată");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bySection = useMemo(() => {
    const map = new Map<TexteSectionId, RegistryItem[]>();
    for (const s of TEXTE_SECTIONS) map.set(s.id, []);
    for (const item of registry) {
      map.get(item.section)?.push(item);
    }
    return map;
  }, [registry]);

  const now = new Date();
  const previewAn = now.getFullYear();
  const previewLuna = now.getMonth() + 1;
  const previewLunaNume =
    drafts[`luna.${previewLuna}`] ?? texte[`luna.${previewLuna}`] ?? "";
  const titluPreview = formatTexte(
    drafts["titlu.format"] ?? texte["titlu.format"] ?? "",
    {
      titlu_grafic: "S.C.J.U. BRAILA - GRAFIC ASISTENTI ATI II",
      luna: previewLunaNume,
      an: previewAn,
    },
  );
  const foaiePreview = formatTexte(
    drafts["foaie.nume_implicit"] ?? texte["foaie.nume_implicit"] ?? "",
    { n: 1 },
  );

  async function saveKey(cheie: string) {
    setSavingKey(cheie);
    setError(null);
    try {
      const res = await fetch("/api/setari/texte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cheie, valoare: drafts[cheie] ?? "" }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        texte: Record<string, string>;
        overrides: Record<string, string>;
      };
      setTexte(data.texte);
      setOverrides(data.overrides);
      setDrafts((d) => ({ ...d, [cheie]: data.texte[cheie] }));
      setStatus("Salvat");
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare eșuată");
    } finally {
      setSavingKey(null);
    }
  }

  async function resetKey(cheie: string) {
    setSavingKey(cheie);
    setError(null);
    try {
      const res = await fetch("/api/setari/texte", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cheie }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        texte: Record<string, string>;
        overrides: Record<string, string>;
      };
      setTexte(data.texte);
      setOverrides(data.overrides);
      setDrafts((d) => ({ ...d, [cheie]: data.texte[cheie] }));
      setStatus("Resetat");
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset eșuat");
    } finally {
      setSavingKey(null);
    }
  }

  async function resetSection(section: TexteSectionId) {
    if (
      !window.confirm(
        "Resetezi toate textele din această secțiune la valorile implicite?",
      )
    ) {
      return;
    }
    setSavingKey(`section:${section}`);
    setError(null);
    try {
      const res = await fetch("/api/setari/texte", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        texte: Record<string, string>;
        overrides: Record<string, string>;
      };
      setTexte(data.texte);
      setOverrides(data.overrides);
      setDrafts({ ...data.texte });
      setStatus("Secțiune resetată");
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset eșuat");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveFooter(key: GraficFooterKey) {
    const value = (footerDrafts[key] ?? "").trim();
    if (value.length === 0) {
      const ok = window.confirm(
        "Câmpul e gol — numele/eticheta dispare din export. Continui?",
      );
      if (!ok) return;
    }
    setSavingKey(`footer:${key}`);
    setError(null);
    try {
      const res = await fetch("/api/setari/texte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          footerKey: key,
          footerValue: value,
          confirmEmpty: value.length === 0,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { footer: GraficFooterTexts };
      setFooter(data.footer);
      setFooterDrafts({
        delegat_name: data.footer.delegatName,
        delegat_label: data.footer.delegatLabel,
        medic_sef: data.footer.medicSef,
        as_sef: data.footer.asSef,
      });
      setStatus("Footer salvat");
      window.setTimeout(() => setStatus(null), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvare footer eșuată");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Se încarcă…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Texte</h1>
        <p className="mt-1 text-sm text-slate-500">
          Titluri, antete, export și nume foi. Lipsa unei valori = textul
          implicit din aplicație. Resetează șterge doar override-ul.
        </p>
        {(error || status) && (
          <p
            className={`mt-2 text-sm ${error ? "text-rose-600" : "text-emerald-700"}`}
          >
            {error ?? status}
          </p>
        )}
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div>
            <span className="font-medium text-slate-700">Previzualizare titlu: </span>
            {titluPreview || "—"}
          </div>
          <div className="mt-1">
            <span className="font-medium text-slate-700">Nume foaie: </span>
            {foaiePreview || "—"}
          </div>
        </div>
      </div>

      {TEXTE_SECTIONS.map((section) => {
        const items = bySection.get(section.id) ?? [];
        if (!items.length) return null;
        const isCalendar = section.id === "calendar";
        return (
          <section
            key={section.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">
                {section.label}
              </h2>
              <button
                type="button"
                disabled={savingKey === `section:${section.id}`}
                onClick={() => void resetSection(section.id)}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Resetează secțiunea
              </button>
            </div>

            {isCalendar ? (
              <div className="space-y-4">
                <CalendarGroup
                  title="Luni"
                  items={items.filter((i) => i.cheie.startsWith("luna.") && !i.cheie.startsWith("luna_scurta."))}
                  drafts={drafts}
                  overrides={overrides}
                  savingKey={savingKey}
                  onChange={(k, v) => setDrafts((d) => ({ ...d, [k]: v }))}
                  onSave={saveKey}
                  onReset={resetKey}
                />
                <CalendarGroup
                  title="Luni scurte (Excel)"
                  items={items.filter((i) => i.cheie.startsWith("luna_scurta."))}
                  drafts={drafts}
                  overrides={overrides}
                  savingKey={savingKey}
                  onChange={(k, v) => setDrafts((d) => ({ ...d, [k]: v }))}
                  onSave={saveKey}
                  onReset={resetKey}
                />
                <CalendarGroup
                  title="Zile"
                  items={items.filter((i) => i.cheie.startsWith("zi."))}
                  drafts={drafts}
                  overrides={overrides}
                  savingKey={savingKey}
                  onChange={(k, v) => setDrafts((d) => ({ ...d, [k]: v }))}
                  onSave={saveKey}
                  onReset={resetKey}
                />
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <TexteField
                    key={item.cheie}
                    item={item}
                    value={drafts[item.cheie] ?? ""}
                    modified={item.cheie in overrides}
                    saving={savingKey === item.cheie}
                    onChange={(v) =>
                      setDrafts((d) => ({ ...d, [item.cheie]: v }))
                    }
                    onSave={() => void saveKey(item.cheie)}
                    onReset={() => void resetKey(item.cheie)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-800">Footer grafic</h2>
        <p className="mt-1 text-xs text-slate-500">
          Valorile apar în export PDF/Excel/DOCX. Fără resetare automată —
          golirea cere confirmare.
        </p>
        <div className="mt-4 space-y-3">
          {GRAFIC_FOOTER_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                {f.label}
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={footerDrafts[f.key] ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setFooterDrafts((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
                <button
                  type="button"
                  disabled={savingKey === `footer:${f.key}`}
                  onClick={() => void saveFooter(f.key)}
                  className="rounded-xl bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  Salvează
                </button>
              </div>
            </div>
          ))}
        </div>
        {footer && (
          <p className="mt-3 text-[11px] text-slate-400">
            Valorile curente din grilă/export: {footer.delegatName || "—"} /{" "}
            {footer.delegatLabel || "—"}
          </p>
        )}
      </section>
    </div>
  );
}

function TexteField({
  item,
  value,
  modified,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  item: RegistryItem;
  value: string;
  modified: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const Input = item.long ? "textarea" : "input";
  return (
    <div className="space-y-1.5 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-700">{item.label}</label>
        {modified && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-800 uppercase">
            modificat
          </span>
        )}
      </div>
      <Input
        value={value}
        maxLength={item.maxLen}
        rows={item.long ? 2 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
      />
      {item.variabile.length > 0 && (
        <p className="text-[11px] text-slate-400">
          Variabile: {item.variabile.map((v) => `{${v}}`).join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-lg bg-sky-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          Salvează
        </button>
        <button
          type="button"
          disabled={saving || !modified}
          onClick={onReset}
          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          Resetează
        </button>
      </div>
    </div>
  );
}

function CalendarGroup({
  title,
  items,
  drafts,
  overrides,
  savingKey,
  onChange,
  onSave,
  onReset,
}: {
  title: string;
  items: RegistryItem[];
  drafts: Record<string, string>;
  overrides: Record<string, string>;
  savingKey: string | null;
  onChange: (k: string, v: string) => void;
  onSave: (k: string) => void;
  onReset: (k: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((item) => {
          const modified = item.cheie in overrides;
          return (
            <div
              key={item.cheie}
              className="grid grid-cols-[7rem_1fr_auto_auto] items-center gap-2"
            >
              <span className="truncate text-xs text-slate-600">
                {item.label}
                {modified ? " *" : ""}
              </span>
              <input
                value={drafts[item.cheie] ?? ""}
                maxLength={item.maxLen}
                onChange={(e) => onChange(item.cheie, e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-sky-400"
              />
              <button
                type="button"
                disabled={savingKey === item.cheie}
                onClick={() => void onSave(item.cheie)}
                className="rounded-lg bg-sky-700 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
              >
                Salvează
              </button>
              <button
                type="button"
                disabled={savingKey === item.cheie || !modified}
                onClick={() => void onReset(item.cheie)}
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 disabled:opacity-40"
              >
                Reset
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
