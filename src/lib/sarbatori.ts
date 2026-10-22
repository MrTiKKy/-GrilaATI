import { getDb } from "@/lib/db";
import { toDateString } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidSarbatoareDate(data: string): boolean {
  return DATE_RE.test(data);
}

/** Date YYYY-MM-DD de sărbătoare legală în [start, end). */
export async function listSarbatoriInRange(
  workspaceId: string,
  start: string,
  end: string,
): Promise<string[]> {
  const sql = getDb();
  const rows = await sql`
    SELECT data::text AS data
    FROM sarbatori_legale
    WHERE workspace_id = ${workspaceId}::uuid
      AND data >= ${start}::date
      AND data < ${end}::date
    ORDER BY data ASC
  `;
  return rows.map((r) => toDateString(r.data));
}

export async function setSarbatoareLegala(
  workspaceId: string,
  data: string,
  activ: boolean,
): Promise<boolean> {
  const sql = getDb();
  if (activ) {
    await sql`
      INSERT INTO sarbatori_legale (workspace_id, data)
      VALUES (${workspaceId}::uuid, ${data}::date)
      ON CONFLICT (workspace_id, data) DO NOTHING
    `;
    return true;
  }
  await sql`
    DELETE FROM sarbatori_legale
    WHERE workspace_id = ${workspaceId}::uuid
      AND data = ${data}::date
  `;
  return false;
}

export async function isSarbatoareLegala(
  workspaceId: string,
  data: string,
): Promise<boolean> {
  const sql = getDb();
  const rows = await sql`
    SELECT 1
    FROM sarbatori_legale
    WHERE workspace_id = ${workspaceId}::uuid
      AND data = ${data}::date
    LIMIT 1
  `;
  return rows.length > 0;
}
