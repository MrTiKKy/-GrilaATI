/**
 * Template PDF per workspace.
 * „Format inițial” / fără rând în DB = layout origin/main (GraficAtiPdfLegacy).
 * DEFAULT_PDF_TEMPLATE documentează acele constante pentru UI / template personalizat.
 *
 * origin/main:
 * - A4 landscape; pad top 8 / bottom 10 / x 10 pt (≈2.82 / 3.53 / 3.53 mm)
 * - font GraficSerif; titlu bold 10; antet bold+italic; celule ~ proporționale cu rowH
 * - coloane zi egale (flex); tabel ÎNTINS pe pagină (tabel_compact=false)
 * - weekend #cfcfcf; border 1.1; name ~15%
 */

export type PdfOrientare = "landscape" | "portrait";
export type PdfAliniere = "left" | "center" | "right";
export type PdfCeluleLungi = "doua_randuri" | "micsoreaza" | "lateste";
/** Câte părți de tabel (1 = ca azi). */
export type PdfImpartireParti = 1 | 2 | 3;
export type PdfImpartireAsezare = "aceeasi_pagina" | "pagini_noi";
export type PdfOsdMod = "ultima" | "fiecare" | "ascunde";
export type PdfAntetStil = "clasic" | "detaliat";

export type PdfTemplateCaseta = {
  id: string;
  text: string;
  /** % din lățimea paginii (0–100) */
  x: number;
  /** % din înălțimea paginii (0–100) */
  y: number;
  /** % din lățimea paginii */
  latime: number;
  marime: number;
  bold: boolean;
  aliniere: PdfAliniere;
  afisat: boolean;
};

export type PdfTemplateImpartire = {
  /** 1 / 2 / 3 părți (preset) */
  parti: PdfImpartireParti;
  /** true = folosește taieturi[] în loc de preset */
  personalizat: boolean;
  /**
   * Zilele de tăiere (ultima zi inclusiv a fiecărei părți, fără ultima).
   * Ex. [14] → 1–14 | 15–sfârșit; [10, 20] → 1–10 | 11–20 | 21–sfârșit.
   */
  taieturi: number[];
  asezare: PdfImpartireAsezare;
  /** mm între părți (doar la aceeasi_pagina) */
  spatiu_mm: number;
  osd: PdfOsdMod;
  antet_stil: PdfAntetStil;
};

export type PdfTemplateSetari = {
  pagina: {
    orientare: PdfOrientare;
    /** mm */
    margini: { top: number; right: number; bottom: number; left: number };
    /** true = rânduri pe conținut; false = întins pe pagină (origin/main) */
    tabel_compact: boolean;
  };
  tabel: {
    scara: number;
    font_pt: number;
    inaltime_rand: number;
    latime_nume: number;
    latime_zi_min: number;
    latime_zi_max: number;
    celule_lungi: PdfCeluleLungi;
    culoare_weekend: string;
    grosime_linii: number;
    font_antet_bold: boolean;
    /** poziție pe pagină (%); implicite = layout clasic */
    x: number;
    y: number;
    latime: number;
  };
  impartire: PdfTemplateImpartire;
  titlu: {
    text: string;
    marime: number;
    aliniere: PdfAliniere;
    bold: boolean;
    afisat: boolean;
    x: number;
    y: number;
    latime: number;
  };
  casete_text: PdfTemplateCaseta[];
  footer: {
    afisat: boolean;
    marime: number;
    aliniere: PdfAliniere;
    x: number;
    y: number;
    latime: number;
  };
};

/** Preset-uri margini (mm). */
export const PDF_MARGIN_PRESETS = {
  mici: { top: 2, right: 2, bottom: 2, left: 2 },
  normale: { top: 2.82, right: 3.53, bottom: 3.53, left: 3.53 },
  mari: { top: 8, right: 8, bottom: 8, left: 8 },
} as const;

export type PdfMarginPreset = keyof typeof PDF_MARGIN_PRESETS | "personalizat";

export function detectMarginPreset(
  m: PdfTemplateSetari["pagina"]["margini"],
): PdfMarginPreset {
  for (const key of ["mici", "normale", "mari"] as const) {
    const p = PDF_MARGIN_PRESETS[key];
    if (
      Math.abs(m.top - p.top) < 0.05 &&
      Math.abs(m.right - p.right) < 0.05 &&
      Math.abs(m.bottom - p.bottom) < 0.05 &&
      Math.abs(m.left - p.left) < 0.05
    ) {
      return key;
    }
  }
  return "personalizat";
}

/** Valorile UI pentru „format inițial” — aliniate la origin/main (layout legacy). */
export const DEFAULT_PDF_TEMPLATE: PdfTemplateSetari = {
  pagina: {
    orientare: "landscape",
    margini: { top: 2.82, right: 3.53, bottom: 3.53, left: 3.53 },
    tabel_compact: false,
  },
  tabel: {
    scara: 100,
    font_pt: 8,
    inaltime_rand: 14,
    latime_nume: 15,
    latime_zi_min: 11,
    latime_zi_max: 46,
    celule_lungi: "micsoreaza",
    culoare_weekend: "#cfcfcf",
    grosime_linii: 1.1,
    font_antet_bold: true,
    x: 0,
    y: 6,
    latime: 100,
  },
  impartire: {
    parti: 1,
    personalizat: false,
    taieturi: [],
    asezare: "aceeasi_pagina",
    spatiu_mm: 4,
    osd: "ultima",
    antet_stil: "clasic",
  },
  titlu: {
    text: "",
    marime: 10,
    aliniere: "center",
    bold: true,
    afisat: true,
    x: 0,
    y: 0,
    latime: 100,
  },
  casete_text: [],
  footer: {
    afisat: true,
    marime: 8.5,
    aliniere: "left",
    x: 0,
    y: 92,
    latime: 100,
  },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ALINIERS: PdfAliniere[] = ["left", "center", "right"];
const CELULE: PdfCeluleLungi[] = ["doua_randuri", "micsoreaza", "lateste"];
const ASEZARI: PdfImpartireAsezare[] = ["aceeasi_pagina", "pagini_noi"];
const OSD_MODURI: PdfOsdMod[] = ["ultima", "fiecare", "ascunde"];
const ANTET_STILURI: PdfAntetStil[] = ["clasic", "detaliat"];

function clampNum(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asStr(v: unknown, fallback: string, maxLen: number): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, maxLen);
}

function asAliniere(v: unknown, fallback: PdfAliniere): PdfAliniere {
  return ALINIERS.includes(v as PdfAliniere) ? (v as PdfAliniere) : fallback;
}

function mergeCaseta(
  raw: unknown,
  fallbackId: string,
): PdfTemplateCaseta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = asStr(o.id, fallbackId, 40).trim() || fallbackId;
  const text = asStr(o.text, "", 200);
  return {
    id,
    text,
    x: clampNum(o.x, 0, 100, 5),
    y: clampNum(o.y, 0, 100, 85),
    latime: clampNum(o.latime, 5, 100, 25),
    marime: clampNum(o.marime, 5, 24, 9),
    bold: asBool(o.bold, false),
    aliniere: asAliniere(o.aliniere, "left"),
    afisat: asBool(o.afisat, true),
  };
}

function mergeImpartire(raw: unknown): PdfTemplateImpartire {
  const d = DEFAULT_PDF_TEMPLATE.impartire;
  const o =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const partiRaw = clampNum(o.parti, 1, 3, d.parti);
  const parti = (partiRaw === 2 || partiRaw === 3 ? partiRaw : 1) as PdfImpartireParti;
  const asezare = ASEZARI.includes(o.asezare as PdfImpartireAsezare)
    ? (o.asezare as PdfImpartireAsezare)
    : d.asezare;
  const osd = OSD_MODURI.includes(o.osd as PdfOsdMod)
    ? (o.osd as PdfOsdMod)
    : d.osd;
  const antet_stil = ANTET_STILURI.includes(o.antet_stil as PdfAntetStil)
    ? (o.antet_stil as PdfAntetStil)
    : d.antet_stil;
  const taieturiRaw = Array.isArray(o.taieturi) ? o.taieturi : [];
  const taieturi: number[] = [];
  for (const t of taieturiRaw) {
    const n = clampNum(t, 1, 31, 0);
    if (n >= 1 && !taieturi.includes(n)) taieturi.push(n);
  }
  taieturi.sort((a, b) => a - b);
  return {
    parti,
    personalizat: asBool(o.personalizat, d.personalizat),
    taieturi: taieturi.slice(0, 2),
    asezare,
    spatiu_mm: clampNum(o.spatiu_mm, 0, 30, d.spatiu_mm),
    osd,
    antet_stil,
  };
}

/**
 * Completează câmpurile lipsă din default; validează limite.
 * Nu aruncă — returnează setări sigure. Pentru API: folosește parsePdfTemplateStrict.
 */
export function mergePdfTemplate(raw: unknown): PdfTemplateSetari {
  const d = DEFAULT_PDF_TEMPLATE;
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const paginaIn =
    src.pagina && typeof src.pagina === "object"
      ? (src.pagina as Record<string, unknown>)
      : {};
  const marginiIn =
    paginaIn.margini && typeof paginaIn.margini === "object"
      ? (paginaIn.margini as Record<string, unknown>)
      : {};
  const tabelIn =
    src.tabel && typeof src.tabel === "object"
      ? (src.tabel as Record<string, unknown>)
      : {};
  const titluIn =
    src.titlu && typeof src.titlu === "object"
      ? (src.titlu as Record<string, unknown>)
      : {};
  const footerIn =
    src.footer && typeof src.footer === "object"
      ? (src.footer as Record<string, unknown>)
      : {};

  const orientare: PdfOrientare =
    paginaIn.orientare === "portrait" ? "portrait" : "landscape";

  const celule = CELULE.includes(tabelIn.celule_lungi as PdfCeluleLungi)
    ? (tabelIn.celule_lungi as PdfCeluleLungi)
    : d.tabel.celule_lungi;

  let culoare = asStr(
    tabelIn.culoare_weekend,
    d.tabel.culoare_weekend,
    7,
  ).toLowerCase();
  if (!HEX_RE.test(culoare)) culoare = d.tabel.culoare_weekend;

  const caseteRaw = Array.isArray(src.casete_text) ? src.casete_text : [];
  const casete_text: PdfTemplateCaseta[] = [];
  for (let i = 0; i < Math.min(6, caseteRaw.length); i++) {
    const c = mergeCaseta(caseteRaw[i], `caseta-${i + 1}`);
    if (c) casete_text.push(c);
  }

  return {
    pagina: {
      orientare,
      margini: {
        top: clampNum(marginiIn.top, 0, 40, d.pagina.margini.top),
        right: clampNum(marginiIn.right, 0, 40, d.pagina.margini.right),
        bottom: clampNum(marginiIn.bottom, 0, 40, d.pagina.margini.bottom),
        left: clampNum(marginiIn.left, 0, 40, d.pagina.margini.left),
      },
      tabel_compact: asBool(paginaIn.tabel_compact, d.pagina.tabel_compact),
    },
    tabel: {
      scara: clampNum(tabelIn.scara, 60, 120, d.tabel.scara),
      font_pt: clampNum(tabelIn.font_pt, 5, 14, d.tabel.font_pt),
      inaltime_rand: clampNum(tabelIn.inaltime_rand, 8, 36, d.tabel.inaltime_rand),
      latime_nume: clampNum(tabelIn.latime_nume, 8, 35, d.tabel.latime_nume),
      latime_zi_min: clampNum(tabelIn.latime_zi_min, 6, 40, d.tabel.latime_zi_min),
      latime_zi_max: clampNum(tabelIn.latime_zi_max, 10, 80, d.tabel.latime_zi_max),
      celule_lungi: celule,
      culoare_weekend: culoare,
      grosime_linii: clampNum(tabelIn.grosime_linii, 0.4, 3, d.tabel.grosime_linii),
      font_antet_bold: asBool(tabelIn.font_antet_bold, d.tabel.font_antet_bold),
      x: clampNum(tabelIn.x, 0, 100, d.tabel.x),
      y: clampNum(tabelIn.y, 0, 100, d.tabel.y),
      latime: clampNum(tabelIn.latime, 20, 100, d.tabel.latime),
    },
    impartire: mergeImpartire(src.impartire),
    titlu: {
      text: asStr(titluIn.text, d.titlu.text, 300),
      marime: clampNum(titluIn.marime, 6, 28, d.titlu.marime),
      aliniere: asAliniere(titluIn.aliniere, d.titlu.aliniere),
      bold: asBool(titluIn.bold, d.titlu.bold),
      afisat: asBool(titluIn.afisat, d.titlu.afisat),
      x: clampNum(titluIn.x, 0, 100, d.titlu.x),
      y: clampNum(titluIn.y, 0, 100, d.titlu.y),
      latime: clampNum(titluIn.latime, 10, 100, d.titlu.latime),
    },
    casete_text,
    footer: {
      afisat: asBool(footerIn.afisat, d.footer.afisat),
      marime: clampNum(footerIn.marime, 5, 18, d.footer.marime),
      aliniere: asAliniere(footerIn.aliniere, d.footer.aliniere),
      x: clampNum(footerIn.x, 0, 100, d.footer.x),
      y: clampNum(footerIn.y, 0, 100, d.footer.y),
      latime: clampNum(footerIn.latime, 10, 100, d.footer.latime),
    },
  };
}

/** Validare API: respinge tipuri greșite majore; merge + clamp pe rest. */
export function parsePdfTemplateStrict(
  raw: unknown,
): { ok: true; setari: PdfTemplateSetari } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, setari: structuredClone(DEFAULT_PDF_TEMPLATE) };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "setari trebuie să fie un obiect" };
  }
  const o = raw as Record<string, unknown>;
  if (o.casete_text !== undefined && !Array.isArray(o.casete_text)) {
    return { ok: false, error: "casete_text trebuie să fie o listă" };
  }
  if (Array.isArray(o.casete_text) && o.casete_text.length > 6) {
    return { ok: false, error: "Maxim 6 casete text" };
  }
  if (o.tabel && typeof o.tabel === "object") {
    const t = o.tabel as Record<string, unknown>;
    if (
      t.celule_lungi !== undefined &&
      !CELULE.includes(t.celule_lungi as PdfCeluleLungi)
    ) {
      return {
        ok: false,
        error: "celule_lungi invalid (doua_randuri | micsoreaza | lateste)",
      };
    }
    if (
      t.culoare_weekend !== undefined &&
      (typeof t.culoare_weekend !== "string" ||
        !HEX_RE.test(t.culoare_weekend))
    ) {
      return { ok: false, error: "culoare_weekend trebuie #RRGGBB" };
    }
  }
  return { ok: true, setari: mergePdfTemplate(raw) };
}

export type PdfTemplateVars = {
  luna?: string;
  /** 1–12, pentru antet detaliat (date) */
  lunaNum?: number;
  an?: string | number;
  categorie?: string;
  workspace?: string;
};

export function applyPdfTemplateVars(
  text: string,
  vars: PdfTemplateVars,
): string {
  return text
    .replace(/\{luna\}/gi, String(vars.luna ?? ""))
    .replace(/\{an\}/gi, String(vars.an ?? ""))
    .replace(/\{categorie\}/gi, String(vars.categorie ?? ""))
    .replace(/\{workspace\}/gi, String(vars.workspace ?? ""));
}

/** mm → pt (1 inch = 25.4 mm = 72 pt) */
export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function a4SizePt(orientare: PdfOrientare): { w: number; h: number } {
  return orientare === "portrait"
    ? { w: 595, h: 842 }
    : { w: 842, h: 595 };
}

export const PDF_TEMPLATE_MAX_PER_WORKSPACE = 10;

export type PdfTemplateMeta = {
  id: string;
  nume: string;
  implicit: boolean;
  versiune: number;
  updatedAt: string;
};

export type PdfTemplateLoaded = PdfTemplateMeta & {
  setari: PdfTemplateSetari;
  /** true = zero rânduri în DB (format origin/main) */
  e_implicit: boolean;
};

export async function listPdfTemplates(
  workspaceId: string,
): Promise<PdfTemplateMeta[]> {
  const { getDb } = await import("@/lib/db");
  const sql = getDb();
  const rows = await sql`
    SELECT id::text, nume, implicit, versiune, updated_at
    FROM export_template
    WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
    ORDER BY implicit DESC, nume ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    nume: String(r.nume),
    implicit: Boolean(r.implicit),
    versiune: Number(r.versiune) || 1,
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at ?? ""),
  }));
}

/** Template-ul folosit la export: id explicit, altfel implicitul, altfel DEFAULT legacy. */
export async function loadPdfTemplateForWorkspace(
  workspaceId: string,
  templateId?: string | null,
): Promise<PdfTemplateLoaded> {
  const { getDb } = await import("@/lib/db");
  const sql = getDb();

  if (templateId) {
    const rows = await sql`
      SELECT id::text, setari, versiune, nume, implicit, updated_at
      FROM export_template
      WHERE workspace_id = ${workspaceId}::uuid
        AND tip = 'pdf'
        AND id = ${templateId}::uuid
      LIMIT 1
    `;
    if (rows.length > 0) {
      const r = rows[0];
      return {
        id: String(r.id),
        nume: String(r.nume),
        implicit: Boolean(r.implicit),
        versiune: Number(r.versiune) || 1,
        updatedAt:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at ?? ""),
        setari: mergePdfTemplate(r.setari),
        e_implicit: false,
      };
    }
  }

  const rows = await sql`
    SELECT id::text, setari, versiune, nume, implicit, updated_at
    FROM export_template
    WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf' AND implicit = true
    LIMIT 1
  `;
  if (rows.length === 0) {
    // fallback: orice template, altfel default
    const any = await sql`
      SELECT id::text, setari, versiune, nume, implicit, updated_at
      FROM export_template
      WHERE workspace_id = ${workspaceId}::uuid AND tip = 'pdf'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (any.length === 0) {
      return {
        id: "",
        nume: "Implicit",
        implicit: true,
        versiune: 0,
        updatedAt: "",
        setari: structuredClone(DEFAULT_PDF_TEMPLATE),
        e_implicit: true,
      };
    }
    const r = any[0];
    return {
      id: String(r.id),
      nume: String(r.nume),
      implicit: Boolean(r.implicit),
      versiune: Number(r.versiune) || 1,
      updatedAt:
        r.updated_at instanceof Date
          ? r.updated_at.toISOString()
          : String(r.updated_at ?? ""),
      setari: mergePdfTemplate(r.setari),
      e_implicit: false,
    };
  }
  const r = rows[0];
  return {
    id: String(r.id),
    nume: String(r.nume),
    implicit: Boolean(r.implicit),
    versiune: Number(r.versiune) || 1,
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : String(r.updated_at ?? ""),
    setari: mergePdfTemplate(r.setari),
    e_implicit: false,
  };
}

