/**
 * B3 (b)+(c): izolarea workspace-urilor pe branch.
 * Usage: node --env-file=.env.local scripts/verify-workspace-isolation.mjs
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const root = resolve(import.meta.dirname, "..");
const BASE = process.env.CAPTURE_BASE || "http://127.0.0.1:3003";

spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  stdio: "inherit",
});

const sql = neon(process.env.DATABASE_URL);
const TEST_EMAIL = "workspace-test@example.com";
const TEST_PASS = "testpass123";
const NO_WS_EMAIL = "no-workspace@example.com";
const NO_WS_PASS = "testpass123";

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return single
    .split(",")
    .map((p) => p.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  return { status: res.status, cookie: cookieFrom(res), text };
}

async function get(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json };
}

// Seed test user + Test workspace
const hash = await bcrypt.hash(TEST_PASS, 12);
await sql`
  INSERT INTO users (email, password_hash, activ)
  VALUES (${TEST_EMAIL}, ${hash}, true)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, activ = true
`;
const testUser = (
  await sql`SELECT id::text AS id FROM users WHERE email = ${TEST_EMAIL}`
)[0];

const noWsHash = await bcrypt.hash(NO_WS_PASS, 12);
await sql`
  INSERT INTO users (email, password_hash, activ)
  VALUES (${NO_WS_EMAIL}, ${noWsHash}, true)
  ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, activ = true
`;

let testWs = (
  await sql`
    SELECT id::text AS id FROM workspaces
    WHERE nume = 'Test' AND created_by = ${testUser.id}::uuid
    LIMIT 1
  `
)[0];
if (!testWs) {
  const inserted = await sql`
    INSERT INTO workspaces (nume, created_by)
    VALUES ('Test', ${testUser.id}::uuid)
    RETURNING id::text AS id
  `;
  testWs = inserted[0];
}
await sql`
  INSERT INTO workspace_members (workspace_id, user_id, rol)
  VALUES (${testWs.id}::uuid, ${testUser.id}::uuid, 'admin')
  ON CONFLICT DO NOTHING
`;

const ati = (
  await sql`SELECT id::text AS id FROM workspaces WHERE nume = 'ATI Brăila' LIMIT 1`
)[0];
const atiAngajat = (
  await sql`
    SELECT id::text AS id FROM angajati
    WHERE workspace_id = ${ati.id}::uuid AND activ = true
    LIMIT 1
  `
)[0];
const atiGrafic = (
  await sql`
    SELECT id::text AS id FROM grafice_finale
    WHERE workspace_id = ${ati.id}::uuid
    LIMIT 1
  `
)[0];

console.log("Test workspace", testWs.id);
console.log("ATI angajat sample", atiAngajat?.id);
console.log("ATI grafic sample", atiGrafic?.id);

const results = {};

// (b) test user empty views
const loginTest = await login(TEST_EMAIL, TEST_PASS);
results.loginTest = loginTest.status;
const cookie = loginTest.cookie;
const luna = await get("/api/luna?an=2026&luna=9&tab=asistenti&foaie=1", cookie);
const grafice = await get("/api/grafice", cookie);
const footer = await get("/api/grafic-footer", cookie);
const ore = await get("/api/ore-osd", cookie);

results.b_luna_empty =
  luna.status === 200 &&
  Array.isArray(luna.json?.angajati) &&
  luna.json.angajati.length === 0 &&
  Array.isArray(luna.json?.programari) &&
  luna.json.programari.length === 0;
results.b_grafice_empty =
  grafice.status === 200 && Array.isArray(grafice.json?.items) && grafice.json.items.length === 0;
results.b_footer_empty =
  footer.status === 200 &&
  footer.json?.footer &&
  !footer.json.footer.delegatName &&
  !footer.json.footer.medicSef &&
  !footer.json.footer.asSef;
results.b_ore_defaults =
  ore.status === 200 &&
  Array.isArray(ore.json?.items) &&
  ore.json.items.length > 0;

// Cross-workspace 404
if (atiAngajat) {
  const patch = await fetch(`${BASE}/api/angajati/${atiAngajat.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ nume: "HACK" }),
  });
  results.b_angajat_404 = patch.status === 404;
}
if (atiGrafic) {
  const g = await get(`/api/grafice/${atiGrafic.id}`, cookie);
  results.b_grafic_404 = g.status === 404;
}

// foaie create on test should work; trying to touch ATI data via programari
if (atiAngajat) {
  const prog = await fetch(`${BASE}/api/programari`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({
      angajatId: atiAngajat.id,
      data: "2026-09-01",
      valoare: "L",
      foaie: 1,
    }),
  });
  results.b_programare_404 = prog.status === 404;
}

// (c) user without workspace
const loginNo = await login(NO_WS_EMAIL, NO_WS_PASS);
results.c_login = loginNo.status;
const noCookie = loginNo.cookie;
const noLuna = await get("/api/luna?an=2026&luna=9&tab=asistenti", noCookie);
results.c_403 =
  noLuna.status === 403 &&
  /Nu faci parte din niciun workspace/i.test(String(noLuna.json?.error ?? ""));

console.log(JSON.stringify(results, null, 2));
const ok =
  results.b_luna_empty &&
  results.b_grafice_empty &&
  results.b_footer_empty &&
  results.b_ore_defaults &&
  results.b_angajat_404 !== false &&
  results.b_grafic_404 !== false &&
  results.b_programare_404 !== false &&
  results.c_403;

if (!ok) {
  console.error("FAIL isolation checks");
  process.exit(1);
}
console.log("OK isolation (b)+(c)");
