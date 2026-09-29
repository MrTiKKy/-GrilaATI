import { getDb } from "@/lib/db";
import {
  formatTexte,
  getTexteKeyDef,
  sanitizeFisierBase,
  texteDefaults,
  type TexteKeyDef,
} from "@/lib/texteRegistry";

export {
  TEXTE_REGISTRY,
  TEXTE_SECTIONS,
  formatTexte,
  getTexteKeyDef,
  isTexteCheie,
  parseTexteValoare,
  sanitizeFisierBase,
  texteDefaults,
  type TexteKeyDef,
  type TexteSectionId,
} from "@/lib/texteRegistry";

export type TexteMap = Record<string, string>;

/** Implicite + override din DB. */
export async function getTexte(workspaceId: string): Promise<TexteMap> {
  const out = texteDefaults();
  const sql = getDb();
  const rows = await sql`
    SELECT cheie, valoare
    FROM texte
    WHERE workspace_id = ${workspaceId}::uuid
  `;
  for (const row of rows) {
    const cheie = String(row.cheie ?? "");
    if (!getTexteKeyDef(cheie)) continue;
    out[cheie] = String(row.valoare ?? "");
  }
  return out;
}

export function formatCheie(
  texte: TexteMap,
  cheie: string,
  variabile: Record<string, string | number | null | undefined> = {},
): string {
  const template = texte[cheie] ?? getTexteKeyDef(cheie)?.implicit ?? "";
  return formatTexte(template, variabile);
}

export function lunaNume(texte: TexteMap, luna: number): string {
  const key = `luna.${luna}`;
  return texte[key] ?? getTexteKeyDef(key)?.implicit ?? String(luna);
}

export function lunaScurta(texte: TexteMap, luna: number): string {
  const key = `luna_scurta.${luna}`;
  return texte[key] ?? getTexteKeyDef(key)?.implicit ?? "Grafic";
}

export function ziAbbr(texte: TexteMap, weekday: number): string {
  const key = `zi.${weekday}`;
  return texte[key] ?? getTexteKeyDef(key)?.implicit ?? "";
}

export function dayAbbrList(texte: TexteMap): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => ziAbbr(texte, i));
}

export function buildTitluGrafic(
  texte: TexteMap,
  titluGrafic: string,
  an: number,
  luna: number,
): string {
  return formatCheie(texte, "titlu.format", {
    titlu_grafic: titluGrafic,
    luna: lunaNume(texte, luna),
    an,
  });
}

export function numeFoaieFromTexte(
  texte: TexteMap,
  foaie: number,
  nume: string | null | undefined,
): string {
  const t = typeof nume === "string" ? nume.trim() : "";
  if (t) return t;
  return formatCheie(texte, "foaie.nume_implicit", { n: foaie });
}

export function foaieFileSuffixFromTexte(
  texte: TexteMap,
  foaie: number,
  nume: string | null | undefined,
): string {
  const custom = typeof nume === "string" ? nume.trim() : "";
  if (custom) {
    return (
      sanitizeFisierBase(custom).slice(0, 40) ||
      formatCheie(texte, "foaie.fisier_suffix", { n: foaie })
    );
  }
  if (foaie > 1) {
    return sanitizeFisierBase(
      formatCheie(texte, "foaie.fisier_suffix", { n: foaie }),
    );
  }
  return "";
}

export function foaieTitleSuffixFromTexte(
  texte: TexteMap,
  foaie: number,
  nume: string | null | undefined,
): string | null {
  const custom = typeof nume === "string" ? nume.trim() : "";
  if (custom) return custom;
  if (foaie > 1) return numeFoaieFromTexte(texte, foaie, null);
  return null;
}

/**
 * Nume fișier fără extensie: pattern curățat + optional suffix foaie.
 * Dacă pattern-ul curățat e gol → implicitul curățat.
 */
export function buildExportBaseName(
  texte: TexteMap,
  an: number,
  luna: number,
  categorieNume: string,
  foaieSuffix = "",
): string {
  const categorie = categorieNume
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "categorie";

  const formatted = formatCheie(texte, "fisier.pattern", {
    categorie,
    an,
    luna: String(luna).padStart(2, "0"),
  });
  let base = sanitizeFisierBase(formatted);
  if (!base) {
    base = sanitizeFisierBase(
      formatTexte(getTexteKeyDef("fisier.pattern")!.implicit, {
        categorie,
        an,
        luna: String(luna).padStart(2, "0"),
      }),
    );
  }
  if (!base) base = `grafic-${categorie}-${an}-${String(luna).padStart(2, "0")}`;
  const mid = foaieSuffix ? `${base}-${foaieSuffix}` : base;
  return mid;
}

export async function upsertTexte(
  workspaceId: string,
  cheie: string,
  valoare: string,
  updatedBy: string | null,
): Promise<{ before: string | null; after: string }> {
  const sql = getDb();
  const prev = await sql`
    SELECT valoare FROM texte
    WHERE workspace_id = ${workspaceId}::uuid AND cheie = ${cheie}
    LIMIT 1
  `;
  const before = prev[0] ? String(prev[0].valoare) : null;
  await sql`
    INSERT INTO texte (workspace_id, cheie, valoare, updated_at, updated_by)
    VALUES (
      ${workspaceId}::uuid,
      ${cheie},
      ${valoare},
      now(),
      ${updatedBy}::uuid
    )
    ON CONFLICT (workspace_id, cheie)
    DO UPDATE SET
      valoare = EXCLUDED.valoare,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by
  `;
  return { before, after: valoare };
}

export async function resetTexte(
  workspaceId: string,
  cheie: string,
): Promise<{ before: string | null }> {
  const sql = getDb();
  const prev = await sql`
    SELECT valoare FROM texte
    WHERE workspace_id = ${workspaceId}::uuid AND cheie = ${cheie}
    LIMIT 1
  `;
  const before = prev[0] ? String(prev[0].valoare) : null;
  if (before !== null) {
    await sql`
      DELETE FROM texte
      WHERE workspace_id = ${workspaceId}::uuid AND cheie = ${cheie}
    `;
  }
  return { before };
}

export async function resetTexteSection(
  workspaceId: string,
  section: string,
): Promise<string[]> {
  const keys = (await import("@/lib/texteRegistry")).TEXTE_REGISTRY.filter(
    (d) => d.section === section,
  ).map((d) => d.cheie);
  const reset: string[] = [];
  for (const cheie of keys) {
    const { before } = await resetTexte(workspaceId, cheie);
    if (before !== null) reset.push(cheie);
  }
  return reset;
}

export async function listTexteOverrides(
  workspaceId: string,
): Promise<Record<string, string>> {
  const sql = getDb();
  const rows = await sql`
    SELECT cheie, valoare FROM texte
    WHERE workspace_id = ${workspaceId}::uuid
  `;
  const out: Record<string, string> = {};
  for (const row of rows) {
    const cheie = String(row.cheie ?? "");
    if (!getTexteKeyDef(cheie)) continue;
    out[cheie] = String(row.valoare ?? "");
  }
  return out;
}
