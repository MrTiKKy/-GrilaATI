/**
 * B0: inspectează schema + checksum pe coloanele existente (doar SELECT).
 * Usage: node --env-file=.env.local scripts/inspect-db-before.mjs
 */
import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

async function assertBranch() {
  const { spawnSync } = await import("child_process");
  const r = spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
    cwd: resolve(import.meta.dirname, ".."),
    encoding: "utf8",
  });
  process.stdout.write(r.stdout || "");
  process.stderr.write(r.stderr || "");
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const TABLES = [
  "users",
  "angajati",
  "programari",
  "luna_foi",
  "grafice_finale",
  "ore_osd",
  "grafic_footer",
  "audit_log",
];

async function main() {
  await assertBranch();
  const sql = neon(process.env.DATABASE_URL);

  const columns = await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${TABLES})
    ORDER BY table_name, ordinal_position
  `;

  const constraints = await sql`
    SELECT c.conrelid::regclass::text AS table_name,
           c.conname,
           c.contype,
           pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = ANY(${TABLES})
    ORDER BY 1, 2
  `;

  const indexes = await sql`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY(${TABLES})
    ORDER BY tablename, indexname
  `;

  // workspace columns already?
  const wsCols = columns.filter((c) => c.column_name === "workspace_id" || c.column_name === "user_id");

  const admin = await sql`
    SELECT id::text AS id, email, activ
    FROM users
    WHERE email = 'popanicol24@gmail.com'
    LIMIT 1
  `;

  const summaries = {};
  for (const table of TABLES) {
    const cols = columns.filter((c) => c.table_name === table).map((c) => c.column_name);
    if (cols.length === 0) {
      summaries[table] = { exists: false };
      continue;
    }
    // Prefer PK-like order keys
    const orderCandidates = [
      "id",
      "angajat_id",
      "created_at",
      "an",
      "luna",
      "post",
      "foaie",
      "data",
      "zi",
      "schimb",
      "key",
      "ordine",
      "nume",
      "email",
    ];
    const orderCols = orderCandidates.filter((c) => cols.includes(c));
    if (orderCols.length === 0) orderCols.push(cols[0]);

    const orderSql = orderCols.map((c) => `"${c}"`).join(", ");
    const countRows = await sql.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
    const count = countRows[0]?.n ?? 0;

    // md5 over stable concat of all existing columns, ordered
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const hashRows = await sql.query(`
      SELECT md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY ${orderSql}), '')) AS checksum
      FROM (SELECT ${colList} FROM ${table}) t
    `);

    summaries[table] = {
      exists: true,
      columns: cols,
      orderBy: orderCols,
      count,
      checksum: hashRows[0]?.checksum ?? null,
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: "branch (.env.local)",
    adminUser: admin[0] ?? null,
    workspaceColumnsAlreadyPresent: wsCols.map((c) => ({
      table: c.table_name,
      column: c.column_name,
      type: c.data_type,
    })),
    columns,
    constraints,
    indexes,
    summaries,
  };

  const outDir = resolve(import.meta.dirname, "../migration-reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, "before.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log("admin:", admin[0] ? `${admin[0].email} id=${admin[0].id}` : "MISSING");
  console.log(
    "workspace/user cols already:",
    wsCols.length ? wsCols.map((c) => `${c.table_name}.${c.column_name}`).join(", ") : "none",
  );
  for (const [t, s] of Object.entries(summaries)) {
    if (!s.exists) {
      console.log(`  ${t}: MISSING`);
      continue;
    }
    console.log(`  ${t}: count=${s.count} checksum=${s.checksum}`);
  }

  if (!admin[0]) {
    console.error("STOP: users.id pentru popanicol24@gmail.com nu există");
    process.exit(2);
  }
  if (wsCols.some((c) => c.column_name === "workspace_id")) {
    console.error("STOP: workspace_id există deja pe branch — nu continua migrarea orbește");
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
