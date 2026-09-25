import { getDb } from "@/lib/db";
import {
  footerFromDbRows,
  GRAFIC_FOOTER_DEFAULTS,
  type GraficFooterTexts,
} from "@/lib/graficFooter";

export async function loadGraficFooter(
  workspaceId: string,
): Promise<GraficFooterTexts> {
  try {
    const sql = getDb();
    const rows = await sql`
      SELECT key, value FROM grafic_footer
      WHERE workspace_id = ${workspaceId}::uuid
    `;
    return footerFromDbRows(
      rows.map((r) => ({
        key: String(r.key),
        value: String(r.value ?? ""),
      })),
    );
  } catch (error) {
    console.error("loadGraficFooter", error);
    return { ...GRAFIC_FOOTER_DEFAULTS };
  }
}
