import { readFileSync, existsSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { spawnSync } from "child_process";
import { resolve } from "path";

const root = resolve(import.meta.dirname, "..");

function loadEnv(path, { override = false } = {}) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    if (override || !(k in process.env)) process.env[k] = v;
  }
}
loadEnv(resolve(root, ".env"));
loadEnv(resolve(root, ".env.local"), { override: true });

const check = spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  encoding: "utf8",
});
process.stdout.write(check.stdout || "");
process.stderr.write(check.stderr || "");
if (check.status !== 0) process.exit(check.status ?? 1);

const sql = neon(process.env.DATABASE_URL);
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN ('workspaces', 'workspace_members')
`;
const cols = await sql`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'workspace_id'
  ORDER BY table_name
`;
const host = new URL(process.env.DATABASE_URL).host;
console.log({
  host,
  workspacesTables: tables.map((t) => t.table_name),
  workspaceIdColumns: cols.map((c) => `${c.table_name}.${c.column_name}`),
});
if (tables.length || cols.length) {
  console.error("STOP: branch încă are artefacte workspace");
  process.exit(2);
}
console.log("OK: baza nemigrată după reset");
