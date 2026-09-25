/**
 * Compară checksum pe coloanele vechi: before.json vs branch actual vs (opțional) main.
 * Usage: node --env-file=.env.local scripts/verify-checksums.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { neon } from "@neondatabase/serverless";
import { readFileSync as readFs } from "fs";

const root = resolve(import.meta.dirname, "..");
spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

const NEW_COLS = new Set(["workspace_id", "user_id"]);
const before = JSON.parse(
  readFileSync(resolve(root, "migration-reports/before.json"), "utf8"),
);

function loadEnv(path) {
  const out = {};
  for (const line of readFs(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

async function checksumTable(sql, table, oldColumns, orderBy) {
  const cols = oldColumns.filter((c) => !NEW_COLS.has(c));
  const orderCols = orderBy.filter((c) => cols.includes(c));
  if (orderCols.length === 0) orderCols.push(cols[0]);
  const orderSql = orderCols.map((c) => `"${c}"`).join(", ");
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const countRows = await sql.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  const hashRows = await sql.query(`
    SELECT md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY ${orderSql}), '')) AS checksum
    FROM (SELECT ${colList} FROM ${table}) t
  `);
  return {
    count: countRows[0]?.n ?? 0,
    checksum: hashRows[0]?.checksum ?? null,
    columns: cols,
  };
}

async function compareAgainst(label, databaseUrl) {
  const sql = neon(databaseUrl);
  const report = {};
  let ok = true;
  for (const [table, prev] of Object.entries(before.summaries)) {
    if (!prev.exists) continue;
    const cur = await checksumTable(sql, table, prev.columns, prev.orderBy);
    const match =
      cur.count === prev.count && cur.checksum === prev.checksum;
    report[table] = {
      match,
      before: { count: prev.count, checksum: prev.checksum },
      after: { count: cur.count, checksum: cur.checksum },
    };
    if (!match) ok = false;
    console.log(
      `${label} ${table}: ${match ? "OK" : "DIFF"} count ${prev.count}->${cur.count} checksum ${prev.checksum}->${cur.checksum}`,
    );
  }
  return { ok, report };
}

const local = loadEnv(resolve(root, ".env.local"));
const main = loadEnv(resolve(root, ".env"));

console.log("--- Branch (.env.local) vs before.json ---");
const branch = await compareAgainst("branch", local.DATABASE_URL);

console.log("--- Main (.env) vs before.json (doar SELECT) ---");
const mainCmp = await compareAgainst("main", main.DATABASE_URL);

const out = {
  generatedAt: new Date().toISOString(),
  branchOk: branch.ok,
  mainOk: mainCmp.ok,
  branch: branch.report,
  main: mainCmp.report,
  workspaceAti: (
    await neon(local.DATABASE_URL)`
      SELECT id::text AS id, nume FROM workspaces WHERE nume = 'ATI Brăila' LIMIT 1
    `
  )[0],
};
import { writeFileSync, mkdirSync } from "fs";
mkdirSync(resolve(root, "migration-reports"), { recursive: true });
writeFileSync(
  resolve(root, "migration-reports/checksum-verify.json"),
  JSON.stringify(out, null, 2),
);
console.log("Wrote migration-reports/checksum-verify.json");
if (!branch.ok) {
  console.error("FAIL: branch checksums diferă de before.json");
  process.exit(1);
}
if (!mainCmp.ok) {
  console.warn(
    "WARN: main diferă de before.json (posibil din cause de ensureLunaFoi pe branch înainte de migrare)",
  );
}
console.log("OK branch checksums pe coloanele vechi.");
