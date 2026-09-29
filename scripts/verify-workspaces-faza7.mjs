/**
 * PAS 3 — verificări workspaces faza 7 pe copia Neon (.env.local).
 * Usage: node --env-file=.env.local scripts/verify-workspaces-faza7.mjs [baseUrl]
 *
 * Covers (a)–(h) din brief + cleanup pe copie. Nu atinge producția.
 */
import { spawnSync } from "child_process";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

const root = resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const ATI_WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const NICOLETA_EMAIL = "popanicol24@gmail.com";
const NICOLETA_PASSWORD = "nicoleta123";

const stamp = Date.now();
const TEST_EMAIL = `faza7-${stamp}@example.com`;
const TEST_PASSWORD = "TestParola12345!";
const NO_ACCOUNT_EMAIL = `faza7-nocont-${stamp}@example.com`;
const TEST_WS_NAME = "Test WS";

spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const sql = neon(process.env.DATABASE_URL);

let passed = 0;
let failed = 0;
const issues = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    issues.push(msg);
    console.error(`  ✗ ${msg}`);
  }
}

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookies = {};
  for (const h of raw) {
    const [pair] = h.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) {
      cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
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
  const newCookies = extractCookies(res);
  const merged = { ...cookies, ...newCookies };
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, data, cookies: merged, res };
}

async function checksums() {
  const rows = await sql`
    SELECT 'users' AS t, count(*)::int AS n,
      md5(coalesce(string_agg(id::text || '|' || email || '|' || activ::text, ',' ORDER BY id::text), '')) AS h
    FROM users
    UNION ALL
    SELECT 'workspaces', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || nume || '|' || created_by::text, ',' ORDER BY id::text), ''))
    FROM workspaces
    UNION ALL
    SELECT 'workspace_members', count(*)::int,
      md5(coalesce(string_agg(workspace_id::text || '|' || user_id::text || '|' || rol || '|' || poate_modifica_setari::text, ',' ORDER BY workspace_id::text, user_id::text), ''))
    FROM workspace_members
    UNION ALL
    SELECT 'categorii', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || nume || '|' || ordine::text, ',' ORDER BY id::text), ''))
    FROM categorii
    UNION ALL
    SELECT 'coduri', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || cod || '|' || ordine::text, ',' ORDER BY id::text), ''))
    FROM coduri
    UNION ALL
    SELECT 'angajati', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || nume, ',' ORDER BY id::text), ''))
    FROM angajati
    UNION ALL
    SELECT 'programari', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || workspace_id::text || '|' || data::text || '|' || coalesce(valoare,''), ',' ORDER BY id::text), ''))
    FROM programari
    UNION ALL
    SELECT 'ore_coduri', count(*)::int,
      md5(coalesce(string_agg(workspace_id::text || '|' || categorie_id::text || '|' || coalesce(cod_id::text,'') || '|' || ore_vineri::text, ',' ORDER BY workspace_id::text, categorie_id::text, cod_id::text), ''))
    FROM ore_coduri
    UNION ALL
    SELECT 'texte', count(*)::int,
      md5(coalesce(string_agg(workspace_id::text || '|' || cheie || '|' || valoare, ',' ORDER BY workspace_id::text, cheie), ''))
    FROM texte
    UNION ALL
    SELECT 'invitatii', count(*)::int,
      md5(coalesce(string_agg(id::text || '|' || status, ',' ORDER BY id::text), ''))
    FROM invitatii
  `;
  const map = {};
  for (const r of rows) map[r.t] = { n: Number(r.n), h: r.h };
  return map;
}

async function atiSlice() {
  const [ws, members, cats, codes, ore, ang, prog, texte, footer] =
    await Promise.all([
      sql`SELECT id::text, nume, created_by::text FROM workspaces WHERE id = ${ATI_WS}::uuid`,
      sql`SELECT user_id::text, rol, poate_modifica_setari FROM workspace_members WHERE workspace_id = ${ATI_WS}::uuid ORDER BY user_id`,
      sql`SELECT id::text, nume, titlu_grafic, ordine FROM categorii WHERE workspace_id = ${ATI_WS}::uuid ORDER BY ordine, id`,
      sql`SELECT id::text, cod, eticheta, ordine, sistem FROM coduri WHERE workspace_id = ${ATI_WS}::uuid ORDER BY ordine, id`,
      sql`SELECT count(*)::int AS n FROM ore_coduri WHERE workspace_id = ${ATI_WS}::uuid`,
      sql`SELECT count(*)::int AS n FROM angajati WHERE workspace_id = ${ATI_WS}::uuid`,
      sql`SELECT count(*)::int AS n FROM programari WHERE workspace_id = ${ATI_WS}::uuid`,
      sql`SELECT count(*)::int AS n FROM texte WHERE workspace_id = ${ATI_WS}::uuid`,
      sql`SELECT coalesce(string_agg(key || '=' || coalesce(value,''), ';' ORDER BY key), '') AS c FROM grafic_footer WHERE workspace_id = ${ATI_WS}::uuid`,
    ]);
  return JSON.stringify({
    ws,
    members,
    cats,
    codes,
    ore: ore[0]?.n,
    ang: ang[0]?.n,
    prog: prog[0]?.n,
    texte: texte[0]?.n,
    footer: footer[0]?.c ?? "",
  });
}

async function cleanup(testUserId, testWsId, extraEmails) {
  console.log("\n(h) Cleanup pe copie…");
  if (testWsId) {
    await sql`DELETE FROM ore_coduri WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM ore_osd WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM programari WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM angajati WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM luna_foi WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM grafice_finale WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM grafic_footer WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM texte WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM coduri WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM categorii WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM invitatii WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM workspace_members WHERE workspace_id = ${testWsId}::uuid`;
    await sql`DELETE FROM workspaces WHERE id = ${testWsId}::uuid`;
  }
  await sql`DELETE FROM invitatii WHERE email = ANY(${extraEmails})`;
  const emails = extraEmails.filter(Boolean);
  if (emails.length) {
    await sql`DELETE FROM workspace_members WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${emails}))`;
    await sql`DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE email = ANY(${emails}))`;
    await sql`DELETE FROM users WHERE email = ANY(${emails})`;
  }
  if (testUserId) {
    await sql`DELETE FROM audit_log WHERE user_id = ${testUserId}::uuid`;
  }
  assert(true, "cleanup executat");
}

async function main() {
  console.log("=== Verify Workspaces Faza 7 ===");
  console.log(`BASE=${BASE}\n`);

  // Schema checks
  console.log("(schema) invitatii + users.nume…");
  const schema = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'invitatii'
    ORDER BY ordinal_position
  `;
  assert(schema.length >= 9, `invitatii are ${schema.length} coloane`);
  const numeCol = await sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'nume'
  `;
  assert(!!numeCol[0], "users.nume există");

  const beforeCs = await checksums();
  const beforeAti = await atiSlice();
  console.log(
    "  baseline ATI:",
    JSON.parse(beforeAti).members.length,
    "membri,",
    JSON.parse(beforeAti).codes.length,
    "coduri",
  );

  // (a) checksums pe tabele existente (pre-test) — salvate pentru după cleanup
  console.log("\n(a) Baseline checksums salvate");
  assert(beforeCs.workspaces.n >= 1, `workspaces n=${beforeCs.workspaces.n}`);
  assert(beforeCs.texte !== undefined, "texte în checksums");

  // (b) Nicoleta login → workspaces → ATI
  console.log("\n(b) Nicoleta login → /workspaces → ATI…");
  const loginN = await api("POST", "/api/auth/login", {
    body: { email: NICOLETA_EMAIL, password: NICOLETA_PASSWORD },
  });
  assert(loginN.status === 200, `login nicoleta → ${loginN.status}`);
  assert(!!loginN.cookies.grila_session, "grila_session setat");
  let nCookies = loginN.cookies;

  const wsList = await api("GET", "/api/workspaces", { cookies: nCookies });
  assert(wsList.status === 200, "GET /api/workspaces 200");
  const atiCard = wsList.data?.items?.find((w) => w.id === ATI_WS);
  assert(!!atiCard, "card ATI Brăila prezent");
  assert(atiCard?.isOwner === true, "nicoleta owner");
  assert(atiCard?.rol === "admin", "rol admin");
  assert(atiCard?.poateModificaSetari === true, "poate modifica setări");
  assert(
    Number(atiCard?.memberCount) >= 1,
    `participanți=${atiCard?.memberCount}`,
  );

  const selAti = await api("POST", "/api/workspaces/select", {
    body: { workspaceId: ATI_WS },
    cookies: nCookies,
  });
  assert(selAti.status === 200, "select ATI 200");
  nCookies = selAti.cookies;
  assert(nCookies.grila_workspace === ATI_WS, "cookie workspace = ATI");

  const angApi = await api("GET", "/api/luna?an=2026&luna=9", {
    cookies: nCookies,
  });
  assert(angApi.status === 200, `GET luna ATI → ${angApi.status}`);
  const catsApi = await api("GET", "/api/setari/categorii", {
    cookies: nCookies,
  });
  assert(catsApi.status === 200, `GET categorii ATI → ${catsApi.status}`);

  // (c) Cont nou — validări parolă + email existent + cont valid
  console.log("\n(c) Cont nou — validări…");
  const shortPw = await api("POST", "/api/auth/register", {
    body: {
      nume: "X",
      email: `short-${stamp}@example.com`,
      password: "scurt123",
      confirmPassword: "scurt123",
    },
  });
  assert(shortPw.status === 400, `parolă scurtă respinsă (${shortPw.status})`);

  const commonPw = await api("POST", "/api/auth/register", {
    body: {
      nume: "X",
      email: `common-${stamp}@example.com`,
      password: "password123",
      confirmPassword: "password123",
    },
  });
  assert(
    commonPw.status === 400,
    `parolă comună respinsă (${commonPw.status})`,
  );

  const emailInPw = await api("POST", "/api/auth/register", {
    body: {
      nume: "X",
      email: `bob-${stamp}@example.com`,
      password: `bob-${stamp}-parola1`,
      confirmPassword: `bob-${stamp}-parola1`,
    },
  });
  assert(
    emailInPw.status === 400,
    `parolă cu email respinsă (${emailInPw.status})`,
  );

  const dup = await api("POST", "/api/auth/register", {
    body: {
      nume: "Nico",
      email: NICOLETA_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    },
  });
  assert(dup.status === 200, `email existent → 200 neutru (${dup.status})`);
  assert(
    !dup.cookies.grila_session || dup.cookies.grila_session === nCookies.grila_session,
    "email existent nu setează sesiune nouă (sau păstrează absența)",
  );
  // fără cookie nou pe răspunsul de register for duplicate
  const dupHasSession = Object.prototype.hasOwnProperty.call(
    extractCookies(dup.res),
    "grila_session",
  );
  assert(!dupHasSession, "email existent: fără Set-Cookie sesiune");

  const reg = await api("POST", "/api/auth/register", {
    body: {
      nume: "Test Faza7",
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    },
  });
  assert(reg.status === 200, `register valid → ${reg.status}`);
  assert(!!reg.cookies.grila_session, "auto-login după register");
  let tCookies = reg.cookies;

  const emptyWs = await api("GET", "/api/workspaces", { cookies: tCookies });
  assert(emptyWs.data?.items?.length === 0, "user nou: 0 workspace-uri");
  const emptyInv = await api("GET", "/api/invitatii", { cookies: tCookies });
  assert(emptyInv.data?.items?.length === 0, "user nou: 0 invitații");

  const testUserRows = await sql`
    SELECT id::text AS id FROM users WHERE email = ${TEST_EMAIL} LIMIT 1
  `;
  const testUserId = testUserRows[0]?.id;
  assert(!!testUserId, "user de test în DB");

  // (d) Creează Test WS + seed; ATI neatins; izolare
  console.log("\n(d) Creează Test WS + seed + izolare…");
  const create = await api("POST", "/api/workspaces", {
    body: { nume: TEST_WS_NAME },
    cookies: tCookies,
  });
  assert(create.status === 201, `create WS → ${create.status}`);
  const testWsId = create.data?.id;
  assert(!!testWsId, `testWsId=${testWsId}`);
  tCookies = create.cookies;
  assert(tCookies.grila_workspace === testWsId, "cookie = Test WS");

  const seedCat = await sql`
    SELECT nume, titlu_grafic FROM categorii WHERE workspace_id = ${testWsId}::uuid
  `;
  assert(seedCat.length === 1, "1 categorie seed");
  assert(seedCat[0]?.nume === "Categoria 1", "nume Categoria 1");
  assert(seedCat[0]?.titlu_grafic === TEST_WS_NAME, "titlu_grafic = nume WS");

  const seedCodes = await sql`
    SELECT cod, sistem FROM coduri WHERE workspace_id = ${testWsId}::uuid ORDER BY ordine
  `;
  assert(seedCodes.length === 9, `9 coduri seed (got ${seedCodes.length})`);
  assert(
    seedCodes.some((c) => c.sistem === "CO") &&
      seedCodes.some((c) => c.sistem === "CM") &&
      seedCodes.some((c) => c.sistem === "CIC"),
    "CO/CM/CIC sistem prezente",
  );

  const seedOre = await sql`
    SELECT ore_vineri, ore_sambata, ore_duminica FROM ore_coduri
    WHERE workspace_id = ${testWsId}::uuid
  `;
  assert(seedOre.length === 9, `ore_coduri rows=${seedOre.length}`);
  assert(
    seedOre.every(
      (r) =>
        Number(r.ore_vineri) === 0 &&
        Number(r.ore_sambata) === 0 &&
        Number(r.ore_duminica) === 0,
    ),
    "ore_coduri toate 0",
  );

  const seedTexte = await sql`
    SELECT count(*)::int AS n FROM texte WHERE workspace_id = ${testWsId}::uuid
  `;
  assert(seedTexte[0]?.n === 0, "fără texte seed");

  const seedAng = await sql`
    SELECT count(*)::int AS n FROM angajati WHERE workspace_id = ${testWsId}::uuid
  `;
  assert(seedAng[0]?.n === 0, "fără angajați");

  const afterCreateAti = await atiSlice();
  assert(afterCreateAti === beforeAti, "ATI Brăila identic după create Test WS");

  // User nou nu vede ATI
  const atiAsNew = await api("POST", "/api/workspaces/select", {
    body: { workspaceId: ATI_WS },
    cookies: tCookies,
  });
  assert(
    atiAsNew.status === 403 || atiAsNew.status === 404,
    `select ATI ca user nou → ${atiAsNew.status}`,
  );

  // Re-select Test WS (select ATI may have failed without changing cookie)
  tCookies = (
    await api("POST", "/api/workspaces/select", {
      body: { workspaceId: testWsId },
      cookies: tCookies,
    })
  ).cookies;

  // Force cookie to ATI and hit API — should 403 (not member)
  const forged = {
    ...tCookies,
    grila_workspace: ATI_WS,
  };
  const leak = await api("GET", "/api/setari/categorii", { cookies: forged });
  assert(
    leak.status === 403 || leak.status === 404,
    `API ATI cu cookie forțat → ${leak.status}`,
  );

  // (e) Invitație viewer → refuz → accept → 403 write → scoate
  console.log("\n(e) Invitații accept/refuz + scoatere…");

  // Restore owner cookies on Test WS
  tCookies = (
    await api("POST", "/api/workspaces/select", {
      body: { workspaceId: testWsId },
      cookies: tCookies,
    })
  ).cookies;

  const inv1 = await api("POST", "/api/setari/membri/invitatii", {
    body: { email: NICOLETA_EMAIL, rol: "viewer" },
    cookies: tCookies,
  });
  assert(inv1.status === 201, `invită nicoleta viewer → ${inv1.status}`);
  const inv1Id = inv1.data?.id;

  const nInv = await api("GET", "/api/invitatii", { cookies: nCookies });
  assert(
    !!nInv.data?.items?.find((i) => i.id === inv1Id),
    "nicoleta vede invitația",
  );

  const refuse = await api("POST", `/api/invitatii/${inv1Id}/refuse`, {
    body: {},
    cookies: nCookies,
  });
  assert(refuse.status === 200, `refuz → ${refuse.status}`);

  const nInv2 = await api("GET", "/api/invitatii", { cookies: nCookies });
  assert(
    !nInv2.data?.items?.find((i) => i.id === inv1Id),
    "după refuz dispare",
  );

  const inv2 = await api("POST", "/api/setari/membri/invitatii", {
    body: { email: NICOLETA_EMAIL, rol: "viewer" },
    cookies: tCookies,
  });
  assert(inv2.status === 201, `a doua invitație → ${inv2.status}`);
  const inv2Id = inv2.data?.id;

  const accept = await api("POST", `/api/invitatii/${inv2Id}/accept`, {
    body: {},
    cookies: nCookies,
  });
  assert(accept.status === 200, `accept → ${accept.status}`);

  const nWs = await api("GET", "/api/workspaces", { cookies: nCookies });
  const testCard = nWs.data?.items?.find((w) => w.id === testWsId);
  assert(!!testCard, "nicoleta vede Test WS");
  assert(testCard?.rol === "viewer", "rol viewer");

  const nOnTest = await api("POST", "/api/workspaces/select", {
    body: { workspaceId: testWsId },
    cookies: nCookies,
  });
  nCookies = nOnTest.cookies;

  const writeAsViewer = await api("POST", "/api/setari/categorii", {
    body: { nume: "Hack", titluGrafic: "Hack" },
    cookies: nCookies,
  });
  assert(
    writeAsViewer.status === 403,
    `viewer write → ${writeAsViewer.status}`,
  );

  // Owner scoate nicoleta
  const members = await api("GET", "/api/setari/membri", { cookies: tCookies });
  const nicoletaMember = members.data?.items?.find(
    (m) => m.email === NICOLETA_EMAIL,
  );
  if (nicoletaMember) {
    const remove = await api("DELETE", "/api/setari/membri", {
      body: { userId: nicoletaMember.userId },
      cookies: tCookies,
    });
    assert(remove.status === 200, `scoate membru → ${remove.status}`);

    // Cookie încă pe Test WS → acces pierdut
    const afterKick = await api("GET", "/api/setari/categorii", {
      cookies: nCookies,
    });
    assert(
      afterKick.status === 403 || afterKick.status === 404,
      `după scoatere API → ${afterKick.status}`,
    );
  } else {
    assert(false, "nicoleta în lista de membri");
  }

  // Put nicoleta back on ATI
  nCookies = (
    await api("POST", "/api/workspaces/select", {
      body: { workspaceId: ATI_WS },
      cookies: { grila_session: nCookies.grila_session },
    })
  ).cookies;

  // (f) Invitație către email fără cont + duplicat + anulare
  console.log("\n(f) Invitație fără cont / duplicat / anulare…");
  const invNo = await api("POST", "/api/setari/membri/invitatii", {
    body: { email: NO_ACCOUNT_EMAIL, rol: "editor" },
    cookies: tCookies,
  });
  assert(invNo.status === 201, `invită email fără cont → ${invNo.status}`);
  const invNoId = invNo.data?.id;

  const dupInv = await api("POST", "/api/setari/membri/invitatii", {
    body: { email: NO_ACCOUNT_EMAIL, rol: "viewer" },
    cookies: tCookies,
  });
  assert(dupInv.status === 409, `duplicat invitație → ${dupInv.status}`);

  const laterReg = await api("POST", "/api/auth/register", {
    body: {
      nume: "Later",
      email: NO_ACCOUNT_EMAIL,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    },
  });
  assert(laterReg.status === 200, "cont ulterior creat");
  const laterCookies = laterReg.cookies;
  const laterInv = await api("GET", "/api/invitatii", {
    cookies: laterCookies,
  });
  assert(
    !!laterInv.data?.items?.find((i) => i.id === invNoId),
    "cont ulterior vede invitația",
  );

  const cancel = await api("DELETE", "/api/setari/membri/invitatii", {
    body: { id: invNoId },
    cookies: tCookies,
  });
  assert(cancel.status === 200, `anulare → ${cancel.status}`);
  const laterInv2 = await api("GET", "/api/invitatii", {
    cookies: laterCookies,
  });
  assert(
    !laterInv2.data?.items?.find((i) => i.id === invNoId),
    "după anulare dispare la invitat",
  );

  // (g) Rate limit login (5 / 15 min) — folosim email inventat ca să nu blocăm nicoleta
  console.log("\n(g) Rate limit…");
  const rlEmail = `ratelimit-${stamp}@example.com`;
  let got429 = false;
  for (let i = 0; i < 7; i++) {
    const r = await api("POST", "/api/auth/login", {
      body: { email: rlEmail, password: "wrong-password-xx" },
    });
    if (r.status === 429) {
      got429 = true;
      break;
    }
  }
  assert(got429, "login rate limit 429 după ~5 eșecuri");

  // Cleanup
  await cleanup(testUserId, testWsId, [TEST_EMAIL, NO_ACCOUNT_EMAIL]);

  const afterCs = await checksums();
  const afterAti = await atiSlice();

  console.log("\n(a') Checksums după cleanup vs baseline…");
  for (const t of [
    "workspaces",
    "workspace_members",
    "categorii",
    "coduri",
    "angajati",
    "programari",
    "ore_coduri",
    "texte",
  ]) {
    assert(
      afterCs[t].n === beforeCs[t].n && afterCs[t].h === beforeCs[t].h,
      `${t} n+h identic (${afterCs[t].n})`,
    );
  }
  // users: poate avea +0 dacă cleanup OK; invitatii ar trebui 0 pending de test
  assert(afterAti === beforeAti, "ATI Brăila identic după cleanup");
  assert(afterCs.invitatii.n === beforeCs.invitatii.n, "invitatii count restaurat");

  // users count: baseline may differ if leftover users; compare ATI-related users only
  const usersNow = await sql`SELECT count(*)::int AS n FROM users`;
  assert(
    Number(usersNow[0].n) === beforeCs.users.n,
    `users count restaurat (${usersNow[0].n} vs ${beforeCs.users.n})`,
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (issues.length) {
    console.log("Issues:");
    for (const i of issues) console.log(" -", i);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
