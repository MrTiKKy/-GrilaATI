import { getDb } from "@/lib/db";
import { CELL_TEXT_MAX, parseCellText } from "@/lib/cellText";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodDto = {
  id: string;
  workspaceId: string;
  categorieId: string | null;
  cod: string;
  eticheta: string;
  culoare: string; // hex e.g. #111111
  ordine: number;
  activ: boolean;
  sistem: "CO" | "CM" | "CIC" | null;
  comportamentVechi: string | null;
  createdAt: string;
};

/** Slim version for the popup / client */
export type CodOption = {
  id: string;
  cod: string;
  eticheta: string;
  culoare: string;
  sistem: "CO" | "CM" | "CIC" | null;
  comportamentVechi: string | null;
};

// ---------------------------------------------------------------------------
// Seeded (default) codes — used as reference only
// ---------------------------------------------------------------------------

export const SEEDED_CODES = [
  { ordine: 1, cod: "-", eticheta: "-", sistem: null, comportamentVechi: "-" },
  { ordine: 2, cod: "1", eticheta: "1", sistem: null, comportamentVechi: "1" },
  { ordine: 3, cod: "2", eticheta: "2", sistem: null, comportamentVechi: "2" },
  { ordine: 4, cod: "1/3", eticheta: "1/3", sistem: null, comportamentVechi: "1/3" },
  { ordine: 5, cod: "2*", eticheta: "2*", sistem: null, comportamentVechi: "2*" },
  { ordine: 6, cod: "L", eticheta: "L", sistem: null, comportamentVechi: "L" },
  { ordine: 7, cod: "CO", eticheta: "CO", sistem: "CO" as const, comportamentVechi: "CO" },
  { ordine: 8, cod: "CM", eticheta: "CM", sistem: "CM" as const, comportamentVechi: "CM" },
  { ordine: 9, cod: "CIC", eticheta: "CIC", sistem: "CIC" as const, comportamentVechi: "CIC" },
] as const;

// ---------------------------------------------------------------------------
// System‐code helpers
// ---------------------------------------------------------------------------

export function isSistem(cod: CodDto | CodOption): boolean {
  return cod.sistem === "CO" || cod.sistem === "CM" || cod.sistem === "CIC";
}

export function isSistemValue(v: string | null): v is "CO" | "CM" | "CIC" {
  return v === "CO" || v === "CM" || v === "CIC";
}

// ---------------------------------------------------------------------------
// Free‐text validation  (trim, max CELL_TEXT_MAX, charset)
// ---------------------------------------------------------------------------

export function validateFreeText(raw: string): string | null {
  const parsed = parseCellText(raw);
  if (parsed === null) return null;
  if (parsed === "") return null;
  return parsed;
}

/** Cheia `coduri.cod` — max CELL_TEXT_MAX (CHECK DB), același charset ca eticheta. */
export function validateCodKey(raw: string): string | null {
  return parseCellText(raw);
}

// ---------------------------------------------------------------------------
// Resolve display color
// Manual cell color (non-black) wins over code color.
// ---------------------------------------------------------------------------

export function resolveDisplayColor(
  codCuloare: string | null | undefined,
  manualCuloare: string | null | undefined,
): string {
  if (manualCuloare && manualCuloare !== "#111111" && manualCuloare !== "black") {
    return manualCuloare;
  }
  return codCuloare ?? "#111111";
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): CodDto {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    categorieId: row.categorie_id ? String(row.categorie_id) : null,
    cod: String(row.cod),
    eticheta: String(row.eticheta),
    culoare: String(row.culoare ?? "#111111"),
    ordine: Number(row.ordine),
    activ: Boolean(row.activ),
    sistem: isSistemValue(row.sistem as string | null)
      ? (row.sistem as "CO" | "CM" | "CIC")
      : null,
    comportamentVechi: row.comportament_vechi
      ? String(row.comportament_vechi)
      : null,
    createdAt: String(row.created_at ?? ""),
  };
}

function toOption(c: CodDto): CodOption {
  return {
    id: c.id,
    cod: c.cod,
    eticheta: c.eticheta,
    culoare: c.culoare,
    sistem: c.sistem,
    comportamentVechi: c.comportamentVechi,
  };
}

/**
 * Common + category‐specific codes for a given category, sorted by ordine.
 * Popup uses onlyActive=true; ore/culori pe celule vechi folosesc și inactive.
 */
export async function listCoduriForCategorie(
  workspaceId: string,
  categorieId: string,
  opts?: { onlyActive?: boolean },
): Promise<CodDto[]> {
  const sql = getDb();
  const onlyActive = opts?.onlyActive !== false;
  const rows = onlyActive
    ? await sql`
        SELECT
          id::text AS id, workspace_id::text AS workspace_id,
          categorie_id::text AS categorie_id,
          cod, eticheta, culoare, ordine, activ, sistem,
          comportament_vechi, created_at
        FROM coduri
        WHERE workspace_id = ${workspaceId}::uuid
          AND activ = true
          AND (categorie_id IS NULL OR categorie_id = ${categorieId}::uuid)
        ORDER BY ordine ASC, cod ASC
      `
    : await sql`
        SELECT
          id::text AS id, workspace_id::text AS workspace_id,
          categorie_id::text AS categorie_id,
          cod, eticheta, culoare, ordine, activ, sistem,
          comportament_vechi, created_at
        FROM coduri
        WHERE workspace_id = ${workspaceId}::uuid
          AND (categorie_id IS NULL OR categorie_id = ${categorieId}::uuid)
        ORDER BY ordine ASC, cod ASC
      `;
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

/** All codes for a workspace (incl. inactive) — for settings page */
export async function listAllCoduri(workspaceId: string): Promise<CodDto[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      id::text AS id, workspace_id::text AS workspace_id,
      categorie_id::text AS categorie_id,
      cod, eticheta, culoare, ordine, activ, sistem,
      comportament_vechi, created_at
    FROM coduri
    WHERE workspace_id = ${workspaceId}::uuid
    ORDER BY ordine ASC, cod ASC
  `;
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

/** Lookup a single code by id */
export async function getCodById(
  workspaceId: string,
  id: string,
): Promise<CodDto | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT
      id::text AS id, workspace_id::text AS workspace_id,
      categorie_id::text AS categorie_id,
      cod, eticheta, culoare, ordine, activ, sistem,
      comportament_vechi, created_at
    FROM coduri
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${id}::uuid
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

/** Check if a cod value is used in any programari for this workspace */
export async function isCodUsedInProgramari(
  workspaceId: string,
  cod: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1
    FROM programari
    WHERE workspace_id = ${workspaceId}::uuid
      AND valoare = ${cod}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Duplicate if: same scope, OR common↔specific pair with same text.
 * Specific↔specific pe categorii diferite e permis.
 */
export async function isDuplicateCod(
  workspaceId: string,
  cod: string,
  categorieId: string | null,
  excludeId?: string,
): Promise<boolean> {
  const sql = getDb();
  const exclude = excludeId ?? null;

  if (categorieId) {
    const rows = await sql`
      SELECT 1 FROM coduri
      WHERE workspace_id = ${workspaceId}::uuid
        AND cod = ${cod}
        AND (categorie_id IS NULL OR categorie_id = ${categorieId}::uuid)
        AND (${exclude}::uuid IS NULL OR id != ${exclude}::uuid)
      LIMIT 1
    `;
    return rows.length > 0;
  }

  // Comun: nu poate exista nicăieri în workspace (nici pe categorii)
  const rows = await sql`
    SELECT 1 FROM coduri
    WHERE workspace_id = ${workspaceId}::uuid
      AND cod = ${cod}
      AND (${exclude}::uuid IS NULL OR id != ${exclude}::uuid)
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Build a map from cod → comportament_vechi for weekendOre lookup */
export function buildComportamentMap(
  codes: Array<Pick<CodOption, "cod" | "comportamentVechi"> | CodDto>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of codes) {
    if (c.comportamentVechi) {
      map[c.cod] = c.comportamentVechi;
    }
  }
  return map;
}

export const comportamentMapFromCoduri = buildComportamentMap;

/**
 * Validează valoarea unei programări noi:
 * cod activ (comun sau pe categorie) sau text liber dacă e permis.
 * Returnează mesaj de eroare sau null.
 */
export async function validateProgramareValoare(
  workspaceId: string,
  categorieId: string,
  valoareRaw: string,
): Promise<string | null> {
  const valoare = valoareRaw.trim();
  if (!valoare) return "Cod invalid";
  if (valoare.length > CELL_TEXT_MAX) {
    return `Maxim ${CELL_TEXT_MAX} caractere`;
  }

  const sql = getDb();
  // Preferă match pe categorie specifică față de comun (NULLS LAST)
  const match = await sql`
    SELECT activ
    FROM coduri
    WHERE workspace_id = ${workspaceId}::uuid
      AND cod = ${valoare}
      AND (categorie_id IS NULL OR categorie_id = ${categorieId}::uuid)
    ORDER BY categorie_id NULLS LAST
    LIMIT 1
  `;

  if (match[0]) {
    if (!match[0].activ) return "Codul este dezactivat";
    return null;
  }

  const catRows = await sql`
    SELECT permite_text_liber
    FROM categorii
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${categorieId}::uuid
    LIMIT 1
  `;
  if (!catRows[0]) return "Categorie negăsită";
  if (!catRows[0].permite_text_liber) {
    return "Cod invalid pentru această categorie";
  }
  if (validateFreeText(valoare) !== valoare) {
    return `Text liber invalid (max ${CELL_TEXT_MAX} caractere, fără spații la capete; litere/cifre/: - / * . ,)`;
  }
  return null;
}

export { toOption };
