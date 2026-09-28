import { getDb } from "@/lib/db";

export type CategorieDto = {
  id: string;
  nume: string;
  titluGrafic: string;
  ordine: number;
  activ: boolean;
  /** Doar pentru date migrates / compat; null la categorii noi */
  postVechi: string | null;
};

const MONTH_NAMES_RO = [
  "IANUARIE",
  "FEBRUARIE",
  "MARTIE",
  "APRILIE",
  "MAI",
  "IUNIE",
  "IULIE",
  "AUGUST",
  "SEPTEMBRIE",
  "OCTOMBRIE",
  "NOIEMBRIE",
  "DECEMBRIE",
] as const;

/** Mapare URL vechi ?tab= → post_vechi (doar redirect). */
export function postVechiFromTabParam(
  v: string | null | undefined,
): string | null {
  if (!v) return null;
  if (v === "infirmiere" || v === "infirmier") return "infirmier";
  if (v === "asistenti" || v === "asistent") return "asistent";
  return null;
}

export function buildGraficTitleFromCategorie(
  titluGrafic: string,
  an: number,
  luna: number,
): string {
  const name = MONTH_NAMES_RO[luna - 1] ?? String(luna);
  return `${titluGrafic} - ${name} ${an}`;
}

export function slugifyCategorieNume(nume: string): string {
  const base = nume
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "categorie";
}

export function graficExportFileNameForCategorie(
  an: number,
  luna: number,
  nume: string,
  format: string,
  suffix = "",
): string {
  const kind = slugifyCategorieNume(nume);
  const base = `grafic-${kind}-${an}-${String(luna).padStart(2, "0")}`;
  const mid = suffix ? `${base}-${suffix}` : base;
  return `${mid}.${format}`;
}

/** Guess slug from archived title (best-effort for old grafice). */
export function categorieSlugFromGraficTitle(title: string): string {
  if (/INFIRMIERE/i.test(title)) return "infirmiere";
  if (/ASISTENTI/i.test(title)) return "asistenti";
  const m = title.match(/GRAFIC\s+(.+?)\s+-\s+[A-ZĂÂÎȘȚ]/i);
  if (m?.[1]) return slugifyCategorieNume(m[1]);
  return "categorie";
}

function mapRow(row: Record<string, unknown>): CategorieDto {
  const postVechiRaw = row.post_vechi;
  return {
    id: String(row.id),
    nume: String(row.nume ?? ""),
    titluGrafic: String(row.titlu_grafic ?? ""),
    ordine: Number(row.ordine),
    activ: Boolean(row.activ),
    postVechi:
      postVechiRaw === null || postVechiRaw === undefined
        ? null
        : String(postVechiRaw),
  };
}

export async function listCategorii(
  workspaceId: string,
  opts?: { onlyActive?: boolean },
): Promise<CategorieDto[]> {
  const sql = getDb();
  const onlyActive = opts?.onlyActive ?? false;
  const rows = onlyActive
    ? await sql`
        SELECT id::text AS id, nume, titlu_grafic, ordine, activ, post_vechi
        FROM categorii
        WHERE workspace_id = ${workspaceId}::uuid AND activ = true
        ORDER BY ordine ASC, nume ASC
      `
    : await sql`
        SELECT id::text AS id, nume, titlu_grafic, ordine, activ, post_vechi
        FROM categorii
        WHERE workspace_id = ${workspaceId}::uuid
        ORDER BY ordine ASC, nume ASC
      `;
  return rows.map((r) => mapRow(r as Record<string, unknown>));
}

export async function getCategorie(
  workspaceId: string,
  categorieId: string,
): Promise<CategorieDto | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT id::text AS id, nume, titlu_grafic, ordine, activ, post_vechi
    FROM categorii
    WHERE workspace_id = ${workspaceId}::uuid
      AND id = ${categorieId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapRow(row as Record<string, unknown>) : null;
}

export async function resolveCategorieId(
  workspaceId: string,
  opts: {
    categorieId?: string | null;
    tabParam?: string | null;
  },
): Promise<CategorieDto | null> {
  if (opts.categorieId) {
    const c = await getCategorie(workspaceId, opts.categorieId);
    if (c) return c;
  }
  const postVechi = postVechiFromTabParam(opts.tabParam);
  if (postVechi) {
    const sql = getDb();
    const rows = await sql`
      SELECT id::text AS id, nume, titlu_grafic, ordine, activ, post_vechi
      FROM categorii
      WHERE workspace_id = ${workspaceId}::uuid
        AND post_vechi = ${postVechi}
      LIMIT 1
    `;
    if (rows[0]) return mapRow(rows[0] as Record<string, unknown>);
  }
  const active = await listCategorii(workspaceId, { onlyActive: true });
  return active[0] ?? null;
}

/** Defaults ore O.SD pentru o categorie nouă (template asistent istoric). */
export const ORE_OSD_SEED_TEMPLATE: Array<{
  zi: "V" | "S" | "D";
  schimb: "1" | "1/3" | "2";
  ore: number;
}> = [
  { zi: "V", schimb: "1/3", ore: 7 },
  { zi: "S", schimb: "1", ore: 8 },
  { zi: "S", schimb: "1/3", ore: 18 },
  { zi: "S", schimb: "2", ore: 6 },
  { zi: "D", schimb: "1", ore: 8 },
  { zi: "D", schimb: "1/3", ore: 11 },
  { zi: "D", schimb: "2", ore: 6 },
];

export async function seedOreOsdForCategorie(
  workspaceId: string,
  categorieId: string,
  postVechi: string | null,
): Promise<void> {
  const sql = getDb();
  for (const cell of ORE_OSD_SEED_TEMPLATE) {
    await sql`
      INSERT INTO ore_osd (workspace_id, categorie_id, post, zi, schimb, ore, updated_at)
      VALUES (
        ${workspaceId}::uuid,
        ${categorieId}::uuid,
        ${postVechi},
        ${cell.zi},
        ${cell.schimb},
        ${cell.ore},
        now()
      )
      ON CONFLICT (workspace_id, categorie_id, zi, schimb) DO NOTHING
    `;
  }
}
