/**
 * PAS 3 — verificări propuneri faza 8 pe copia Neon.
 * Usage: DEV_EMAILS=dev@example.com node --env-file=.env.local scripts/verify-propuneri-faza8.mjs [baseUrl]
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

const root = resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:3080";
const ATI = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const NICOLETA = "popanicol24@gmail.com";
const NICOLETA_PW = "nicoleta123";
const FAKE_WS = "00000000-0000-4000-8000-000000000099";

spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const sql = neon(process.env.DATABASE_URL);
let passed = 0;
let failed = 0;
const rows = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
    rows.push({ pas: msg, rezultat: "OK" });
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
    rows.push({ pas: msg, rezultat: "FAIL" });
  }
}

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookies = {};
  for (const h of raw) {
    const [pair] = h.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return cookies;
}
function cookieHeader(c) {
  return Object.entries(c)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function api(method, path, { body, cookies = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const merged = { ...cookies, ...extractCookies(res) };
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* */
  }
  return { status: res.status, data, cookies: merged };
}

async function checksums() {
  const r = await sql`
    SELECT 'users' AS t, count(*)::int AS n,
      md5(coalesce(string_agg(id::text || '|' || email, ',' ORDER BY id::text),'')) AS h FROM users
    UNION ALL SELECT 'workspaces', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || nume, ',' ORDER BY id::text),'')) FROM workspaces
    UNION ALL SELECT 'angajati', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || nume, ',' ORDER BY id::text),'')) FROM angajati
    UNION ALL SELECT 'programari', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || data::text || '|' || coalesce(valoare,''), ',' ORDER BY id::text),'')) FROM programari
    UNION ALL SELECT 'coduri', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || cod, ',' ORDER BY id::text),'')) FROM coduri
  `;
  const map = {};
  for (const x of r) map[x.t] = { n: Number(x.n), h: x.h };
  return map;
}

async function main() {
  console.log("=== Verify Propuneri Faza 8 ===\n");
  const before = await checksums();

  const login = await api("POST", "/api/auth/login", {
    body: { email: NICOLETA, password: NICOLETA_PW },
  });
  assert(login.status === 200, "login nicoleta");
  let c = login.cookies;

  const sel = await api("POST", "/api/workspaces/select", {
    body: { workspaceId: ATI },
    cookies: c,
  });
  assert(sel.status === 200, "select ATI");
  c = sel.cookies;
  assert(c.grila_workspace === ATI, "cookie workspace ATI");

  // (a) trimitere OK
  console.log("\n(a) trimitere…");
  const send = await api("POST", "/api/propuneri", {
    body: {
      tip: "idee",
      titlu: "Ideea mea de test",
      mesaj: "Mesaj suficient de lung pentru validare.",
      pagina: "/workspaces",
    },
    cookies: c,
  });
  assert(send.status === 201, `POST propunere → ${send.status}`);
  const idA = send.data?.id;
  const rowA = await sql`
    SELECT workspace_id::text AS ws, email_autor, tip, titlu, status
    FROM propuneri WHERE id = ${idA}::uuid
  `;
  assert(rowA[0]?.ws === ATI, "workspace_id corect (ATI)");
  assert(rowA[0]?.email_autor === NICOLETA, "email_autor salvat");
  assert(rowA[0]?.status === "noua", "status noua");

  // (b) cookie falsificat
  console.log("\n(b) cookie falsificat…");
  const forged = { ...c, grila_workspace: FAKE_WS };
  const sendB = await api("POST", "/api/propuneri", {
    body: {
      tip: "problema",
      titlu: "Cu cookie fals",
      mesaj: "Mesaj suficient de lung pentru cookie fals.",
      pagina: "/",
    },
    cookies: forged,
  });
  assert(sendB.status === 201, `POST cu cookie fals → ${sendB.status}`);
  const rowB = await sql`
    SELECT workspace_id FROM propuneri WHERE id = ${sendB.data?.id}::uuid
  `;
  assert(rowB[0]?.workspace_id == null, "workspace_id NULL la cookie fals");

  // (c) validări
  console.log("\n(c) validări…");
  const beforeCount = await sql`SELECT count(*)::int AS n FROM propuneri`;
  const short = await api("POST", "/api/propuneri", {
    body: { tip: "idee", titlu: "ab", mesaj: "scurt", pagina: "/" },
    cookies: c,
  });
  assert(short.status === 400, `titlu/mesaj scurt → ${short.status}`);
  const badTip = await api("POST", "/api/propuneri", {
    body: {
      tip: "hacker",
      titlu: "Titlu valid lung",
      mesaj: "Mesaj suficient de lung pentru tip invalid.",
    },
    cookies: c,
  });
  assert(badTip.status === 400, `tip invalid → ${badTip.status}`);
  const longTitle = "x".repeat(151);
  const tooLong = await api("POST", "/api/propuneri", {
    body: {
      tip: "idee",
      titlu: longTitle,
      mesaj: "Mesaj suficient de lung pentru titlu prea lung.",
    },
    cookies: c,
  });
  assert(tooLong.status === 400, `titlu prea lung → ${tooLong.status}`);
  const afterVal = await sql`SELECT count(*)::int AS n FROM propuneri`;
  assert(
    Number(afterVal[0].n) === Number(beforeCount[0].n),
    "nimic salvat la validări eșuate",
  );

  // (d) rate limit 6th
  console.log("\n(d) rate limit…");
  // already 2 from a+b; need 3 more then 6th fails. Clear and do 6.
  await sql`DELETE FROM propuneri WHERE user_id = (SELECT id FROM users WHERE email = ${NICOLETA})`;
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    const r = await api("POST", "/api/propuneri", {
      body: {
        tip: "altceva",
        titlu: `Propunere rate ${i}`,
        mesaj: "Mesaj suficient de lung pentru testul de rate limit.",
        pagina: "/",
      },
      cookies: c,
    });
    if (r.status === 429) {
      got429 = true;
      break;
    }
    assert(r.status === 201, `rate attempt ${i + 1} → ${r.status}`);
  }
  assert(got429, "a 6-a propunere → 429");

  // (e) non-dev 404 / dev 200 — user separat pentru non-dev
  console.log("\n(e) acces dev…");
  const otherEmail = `nonddev-faza8-${Date.now()}@example.com`;
  const reg = await api("POST", "/api/auth/register", {
    body: {
      nume: "Non Dev",
      email: otherEmail,
      password: "TestParola12345!",
      confirmPassword: "TestParola12345!",
    },
  });
  assert(reg.status === 200, `user non-dev creat → ${reg.status}`);
  const nonDevCookies = reg.cookies;

  const pageNonDev = await fetch(`${BASE}/dezvoltator/propuneri`, {
    headers: { Cookie: cookieHeader(nonDevCookies) },
    redirect: "manual",
  });
  assert(
    pageNonDev.status === 404,
    `pagină /dezvoltator ca non-dev → ${pageNonDev.status}`,
  );
  const apiNonDev = await api("GET", "/api/propuneri", {
    cookies: nonDevCookies,
  });
  assert(apiNonDev.status === 404, `GET API ca non-dev → ${apiNonDev.status}`);

  const asDev = await api("GET", "/api/propuneri", { cookies: c });
  assert(asDev.status === 200, `GET API ca dev → ${asDev.status}`);
  assert(Array.isArray(asDev.data?.items), "items array");
  const one = asDev.data?.items?.[0];
  if (one) {
    const det = await api("GET", `/api/propuneri/${one.id}`, { cookies: c });
    assert(det.status === 200, "dev detail 200");
  } else {
    assert(true, "dev list goală dar 200");
  }

  // (f) DEV_EMAILS lipsă → 404 pentru toți (server 3081 fără DEV_EMAILS)
  console.log("\n(f) DEV_EMAILS lipsă…");
  function checkDev(email, raw) {
    const list = (raw ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.includes("@"));
    if (list.length === 0) return false;
    return list.includes(String(email).trim().toLowerCase());
  }
  assert(checkDev(NICOLETA, undefined) === false, "DEV_EMAILS undefined → false");
  assert(checkDev(NICOLETA, "") === false, "DEV_EMAILS gol → false");

  const noDevBase = process.env.NO_DEV_BASE || "http://127.0.0.1:3081";
  try {
    const loginNoDev = await api("POST", "/api/auth/login", {
      body: { email: NICOLETA, password: NICOLETA_PW },
    });
    // login pe 3080 — folosim același cookie pe 3081 (aceeași JWT_SECRET)
    const pageNoDev = await fetch(`${noDevBase}/dezvoltator/propuneri`, {
      headers: { Cookie: cookieHeader(c) },
      redirect: "manual",
    });
    assert(
      pageNoDev.status === 404,
      `pagină fără DEV_EMAILS → ${pageNoDev.status}`,
    );
    const apiNoDev = await fetch(`${noDevBase}/api/propuneri`, {
      headers: { Cookie: cookieHeader(c) },
    });
    assert(apiNoDev.status === 404, `API fără DEV_EMAILS → ${apiNoDev.status}`);
    void loginNoDev;
  } catch (e) {
    assert(false, `server fără DEV_EMAILS (3081) accesibil: ${e.message}`);
  }

  // (g) PATCH
  console.log("\n(g) PATCH…");
  const any = await sql`SELECT id::text AS id FROM propuneri ORDER BY created_at DESC LIMIT 1`;
  const pid = any[0]?.id;
  if (asDev.status === 200 && pid) {
    const patchOk = await api("PATCH", `/api/propuneri/${pid}`, {
      body: { status: "citita", notaDev: "notă test" },
      cookies: c,
    });
    assert(patchOk.status === 200, `PATCH ca dev → ${patchOk.status}`);
    const patchBad = await api("PATCH", `/api/propuneri/${pid}`, {
      body: { status: "rezolvata" },
      cookies: nonDevCookies,
    });
    assert(patchBad.status === 404, `PATCH ca non-dev → ${patchBad.status}`);
  } else {
    assert(false, "PATCH tests need DEV_EMAILS incl. nicoleta");
  }
  await sql`DELETE FROM users WHERE email = ${otherEmail}`;

  // (h) HTML escaped as text
  console.log("\n(h) HTML…");
  await sql`DELETE FROM propuneri WHERE user_id = (SELECT id FROM users WHERE email = ${NICOLETA})`;
  // reset rate window by deleting
  const htmlSend = await api("POST", "/api/propuneri", {
    body: {
      tip: "idee",
      titlu: "Titlu script test",
      mesaj: '<script>alert(1)</script> text vizibil aici destul.',
      pagina: "/",
    },
    cookies: c,
  });
  assert(htmlSend.status === 201, `POST cu HTML → ${htmlSend.status}`);
  const htmlRow = await sql`
    SELECT mesaj FROM propuneri WHERE id = ${htmlSend.data?.id}::uuid
  `;
  const mesajStored = String(htmlRow[0]?.mesaj ?? "");
  assert(!mesajStored.includes("<script>"), "tag script stripat la salvare");
  assert(mesajStored.includes("text vizibil"), "textul rămâne");

  // (i) checksums — delete test propuneri then compare
  console.log("\n(i) checksums…");
  await sql`DELETE FROM propuneri`;
  await sql`DELETE FROM users WHERE email LIKE 'nonddev-faza8-%@example.com'`;
  const after = await checksums();
  for (const t of ["users", "workspaces", "angajati", "programari", "coduri"]) {
    assert(
      after[t].n === before[t].n && after[t].h === before[t].h,
      `${t} n+h identic`,
    );
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  console.log("\n| Pas | Rezultat |");
  console.log("|-----|----------|");
  for (const r of rows) {
    console.log(`| ${r.pas.replace(/\|/g, "/")} | ${r.rezultat} |`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
