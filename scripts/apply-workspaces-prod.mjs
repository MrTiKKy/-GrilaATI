/**
 * Aplică sql/add_workspaces.sql într-o singură tranzacție WebSocket (Pool/Client).
 *
 * Usage:
 *   node scripts/apply-workspaces-prod.mjs --target=test
 *   node scripts/apply-workspaces-prod.mjs --target=test --simulate-mismatch
 *   CONFIRM=APLICA node scripts/apply-workspaces-prod.mjs --target=prod
 *
 * NU modifica check-db-target.mjs / run-add-workspaces.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import { Pool, neonConfig } from "@neondatabase/serverless";

const root = resolve(import.meta.dirname, "..");
const PROD_HOST =
  "ep-jolly-bar-b1vzyyjj-pooler.c-5.eu-central-1.aws.neon.tech";

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
const NEW_COLS = new Set(["workspace_id", "user_id"]);
const TENANT_TABLES = [
  "angajati",
  "programari",
  "luna_foi",
  "grafice_finale",
  "ore_osd",
  "grafic_footer",
];

if (typeof WebSocket === "undefined") {
  const ws = await import("ws");
  neonConfig.webSocketConstructor = ws.default;
}

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

function parseArgs(argv) {
  let target = null;
  let simulateMismatch = false;
  for (const a of argv) {
    if (a.startsWith("--target=")) target = a.slice("--target=".length);
    else if (a === "--simulate-mismatch") simulateMismatch = true;
  }
  return { target, simulateMismatch };
}

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function stripBeginCommit(sqlText) {
  // Elimină BEGIN/COMMIT doar la nivel de statement (nu în DO $$)
  return sqlText
    .replace(/^\s*BEGIN\s*;\s*/im, "")
    .replace(/\s*COMMIT\s*;\s*$/im, "")
    .trim();
}

function orderColsFor(table, columns) {
  const candidates = [
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
  const found = candidates.filter((c) => columns.includes(c));
  return found.length ? found : [columns[0]];
}

async function tableColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return rows.map((r) => r.column_name);
}

async function checksumTable(client, table, columns) {
  const oldCols = columns.filter((c) => !NEW_COLS.has(c));
  const orderBy = orderColsFor(table, oldCols);
  const orderSql = orderBy.map((c) => `"${c}"`).join(", ");
  const colList = oldCols.map((c) => `"${c}"`).join(", ");
  const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  const hashRes = await client.query(`
    SELECT md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY ${orderSql}), '')) AS checksum
    FROM (SELECT ${colList} FROM ${table}) t
  `);
  return {
    count: countRes.rows[0]?.n ?? 0,
    checksum: hashRes.rows[0]?.checksum ?? null,
    columns: oldCols,
    orderBy,
  };
}

async function exportAngajati(client) {
  const { rows } = await client.query(`
    SELECT id::text AS id, post, ordine, nume, activ
    FROM angajati
    ORDER BY post ASC, ordine ASC, nume ASC, id ASC
  `);
  return rows;
}

async function exportProgramari(client) {
  const { rows } = await client.query(`
    SELECT angajat_id::text AS angajat_id, data::text AS data, foaie, valoare, ciorna, culoare
    FROM programari
    ORDER BY angajat_id ASC, data ASC, foaie ASC
  `);
  return rows;
}

async function collectSnapshot(client) {
  const summaries = {};
  for (const table of TABLES) {
    const cols = await tableColumns(client, table);
    if (!cols.length) {
      summaries[table] = { exists: false };
      continue;
    }
    summaries[table] = {
      exists: true,
      ...(await checksumTable(client, table, cols)),
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    summaries,
    angajatiOrdered: await exportAngajati(client),
    programariOrdered: await exportProgramari(client),
  };
}

function compareSnapshots(before, after, { forceMismatch = false } = {}) {
  const diffs = [];
  if (forceMismatch) {
    diffs.push({
      kind: "simulate-mismatch",
      detail: "forțat de --simulate-mismatch",
    });
  }
  for (const table of TABLES) {
    const b = before.summaries[table];
    const a = after.summaries[table];
    if (!b?.exists || !a?.exists) {
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        diffs.push({ kind: "table", table, before: b, after: a });
      }
      continue;
    }
    if (b.count !== a.count || b.checksum !== a.checksum) {
      diffs.push({
        kind: "checksum",
        table,
        before: { count: b.count, checksum: b.checksum },
        after: { count: a.count, checksum: a.checksum },
      });
    }
  }
  const angJson = JSON.stringify(before.angajatiOrdered);
  const angJson2 = JSON.stringify(after.angajatiOrdered);
  if (angJson !== angJson2) {
    diffs.push({
      kind: "export",
      name: "angajatiOrdered",
      beforeLen: before.angajatiOrdered.length,
      afterLen: after.angajatiOrdered.length,
    });
  }
  const progJson = JSON.stringify(before.programariOrdered);
  const progJson2 = JSON.stringify(after.programariOrdered);
  if (progJson !== progJson2) {
    diffs.push({
      kind: "export",
      name: "programariOrdered",
      beforeLen: before.programariOrdered.length,
      afterLen: after.programariOrdered.length,
    });
  }
  return diffs;
}

async function postMigrationChecks(client) {
  const issues = [];
  for (const table of TENANT_TABLES) {
    const { rows } = await client.query(
      `SELECT COUNT(*)::int AS n FROM ${table} WHERE workspace_id IS NULL`,
    );
    const n = rows[0]?.n ?? -1;
    if (n !== 0) issues.push(`${table}: ${n} rows with workspace_id NULL`);
  }
  const ws = await client.query(
    `SELECT COUNT(*)::int AS n FROM workspaces WHERE nume = 'ATI Brăila'`,
  );
  if ((ws.rows[0]?.n ?? 0) !== 1) {
    issues.push(`workspaces ATI Brăila count=${ws.rows[0]?.n}`);
  }
  const mem = await client.query(`
    SELECT COUNT(*)::int AS n
    FROM workspace_members m
    INNER JOIN workspaces w ON w.id = m.workspace_id
    INNER JOIN users u ON u.id = m.user_id
    WHERE w.nume = 'ATI Brăila'
      AND u.email = 'popanicol24@gmail.com'
      AND m.rol = 'admin'
  `);
  if ((mem.rows[0]?.n ?? 0) !== 1) {
    issues.push(`admin membership count=${mem.rows[0]?.n}`);
  }
  return issues;
}

function saveDir(target, phase) {
  const dir = resolve(root, "migration-reports", `${target}-${phase}-sql`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function main() {
  const { target, simulateMismatch } = parseArgs(process.argv.slice(2));
  if (target !== "test" && target !== "prod") {
    console.error("Usage: --target=test|prod [--simulate-mismatch]");
    process.exit(1);
  }

  loadEnv(resolve(root, ".env"));
  loadEnv(resolve(root, ".env.local"), { override: true });

  let databaseUrl;
  if (target === "test") {
    const check = spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
      cwd: root,
      encoding: "utf8",
    });
    process.stdout.write(check.stdout || "");
    process.stderr.write(check.stderr || "");
    if (check.status !== 0) process.exit(check.status ?? 1);
    // Re-load: check-db-target doesn't set env; .env.local already loaded with override
    databaseUrl = process.env.DATABASE_URL;
    const h = hostOf(databaseUrl);
    if (!h || h === PROD_HOST) {
      console.error("REFUZAT: --target=test nu poate folosi hostul de producție");
      process.exit(1);
    }
  } else {
    // prod: only .env DATABASE_URL
    loadEnv(resolve(root, ".env"), { override: true });
    databaseUrl = process.env.DATABASE_URL;
    const h = hostOf(databaseUrl);
    if (h !== PROD_HOST) {
      console.error(
        `REFUZAT: --target=prod necesită host ${PROD_HOST}, am ${h}`,
      );
      process.exit(1);
    }
    if (process.env.CONFIRM !== "APLICA") {
      console.error("REFUZAT: setează CONFIRM=APLICA pentru --target=prod");
      process.exit(1);
    }
  }

  console.log(`Target=${target} host=${hostOf(databaseUrl)}`);

  const sqlPath = resolve(root, "sql/add_workspaces.sql");
  const migrationSql = stripBeginCommit(readFileSync(sqlPath, "utf8"));

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  const t0 = Date.now();
  let outcome = "unknown";

  try {
    // (a) BEFORE — outside transaction
    console.log("Snapshot before (SELECT only)…");
    const before = await collectSnapshot(client);
    const beforeDir = saveDir(target, "before");
    writeFileSync(
      resolve(beforeDir, "snapshot.json"),
      JSON.stringify(before, null, 2),
    );
    writeFileSync(
      resolve(beforeDir, "angajati.json"),
      JSON.stringify(before.angajatiOrdered, null, 2),
    );
    writeFileSync(
      resolve(beforeDir, "programari.json"),
      JSON.stringify(before.programariOrdered, null, 2),
    );
    console.log(`Saved ${beforeDir}`);

    // (b)+(c)+(d)
    console.log("BEGIN transaction…");
    await client.query("BEGIN");
    try {
      await client.query(migrationSql);

      const afterInTx = await collectSnapshot(client);
      let diffs = compareSnapshots(before, afterInTx, {
        forceMismatch: simulateMismatch,
      });
      const issues = await postMigrationChecks(client);
      for (const issue of issues) {
        diffs.push({ kind: "post-check", detail: issue });
      }

      if (diffs.length) {
        console.error("VERIFICARE EȘUATĂ — ROLLBACK");
        console.error(JSON.stringify(diffs, null, 2));
        await client.query("ROLLBACK");
        outcome = "rollback";
        const afterDir = saveDir(target, "after");
        writeFileSync(
          resolve(afterDir, "snapshot.json"),
          JSON.stringify(afterInTx, null, 2),
        );
        writeFileSync(
          resolve(afterDir, "diffs.json"),
          JSON.stringify(diffs, null, 2),
        );
        writeFileSync(
          resolve(afterDir, "outcome.json"),
          JSON.stringify(
            { outcome, simulateMismatch, durationMs: Date.now() - t0 },
            null,
            2,
          ),
        );
      } else {
        await client.query("COMMIT");
        outcome = "commit";
        console.log("COMMIT ok");
        const afterDir = saveDir(target, "after");
        writeFileSync(
          resolve(afterDir, "snapshot.json"),
          JSON.stringify(afterInTx, null, 2),
        );
        writeFileSync(
          resolve(afterDir, "angajati.json"),
          JSON.stringify(afterInTx.angajatiOrdered, null, 2),
        );
        writeFileSync(
          resolve(afterDir, "programari.json"),
          JSON.stringify(afterInTx.programariOrdered, null, 2),
        );
        writeFileSync(
          resolve(afterDir, "outcome.json"),
          JSON.stringify(
            { outcome, simulateMismatch, durationMs: Date.now() - t0 },
            null,
            2,
          ),
        );
      }
    } catch (err) {
      console.error("EROARE în tranzacție — ROLLBACK", err);
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      outcome = "rollback-error";
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }

  const durationMs = Date.now() - t0;
  console.log(`Outcome=${outcome} durationMs=${durationMs}`);
  if (outcome !== "commit" && !simulateMismatch) process.exit(1);
  if (simulateMismatch && outcome !== "rollback") process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
