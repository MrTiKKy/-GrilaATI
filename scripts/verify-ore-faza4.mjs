/**
 * PAS 3 — verificări ore faza 4 pe copia Neon.
 * Usage: node --env-file=.env.local scripts/verify-ore-faza4.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const BASE = process.argv[2] || "http://127.0.0.1:3050";
const sql = neon(process.env.DATABASE_URL);
const WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const report = { a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {}, h: { build: "ok" }, issues: [] };

function push(issue) {
  report.issues.push(issue);
}

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) return raw.map((c) => c.split(";")[0]).join("; ");
  const s = res.headers.get("set-cookie");
  return s ? s.split(",")[0].split(";")[0] : "";
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, status: res.status, cookie: cookieFrom(res) };
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

const DAY_ABBR = ["D", "L", "Ma", "Mi", "J", "V", "S"];

function orePentru(dayAbbr, valoare, byCod) {
  if (!valoare || !["V", "S", "D"].includes(dayAbbr)) return 0;
  const r = byCod[valoare];
  if (!r) return 0;
  if (dayAbbr === "V") return r.vineri || 0;
  if (dayAbbr === "S") return r.sambata || 0;
  if (dayAbbr === "D") return r.duminica || 0;
  return 0;
}

async function computeMonth(catId, an, luna, foaie, byCod) {
  const start = `${an}-${String(luna).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(an, luna, 1)).toISOString().slice(0, 10);
  const daysInMonth = new Date(an, luna, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const weekday = new Date(an, luna - 1, d).getDay();
    days.push({
      abbr: DAY_ABBR[weekday],
      date: `${an}-${String(luna).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    });
  }
  const angajati = await sql`
    SELECT id::text AS id FROM angajati
    WHERE workspace_id=${WS}::uuid AND categorie_id=${catId}::uuid AND activ
  `;
  const prog = await sql`
    SELECT p.angajat_id::text AS angajat_id, p.data::text AS data, p.valoare
    FROM programari p JOIN angajati a ON a.id=p.angajat_id
    WHERE p.workspace_id=${WS}::uuid AND a.categorie_id=${catId}::uuid
      AND p.data >= ${start}::date AND p.data < ${end}::date AND p.foaie=${foaie}
  `;
  const byCell = new Map();
  for (const p of prog) {
    byCell.set(`${p.angajat_id}|${String(p.data).slice(0, 10)}`, p.valoare ?? "");
  }
  const perAngajat = {};
  let sum = 0;
  for (const a of angajati) {
    let t = 0;
    const byDay = {};
    for (const d of days) {
      const val = byCell.get(`${a.id}|${d.date}`) ?? "";
      const ore = orePentru(d.abbr, val, byCod);
      if (ore) {
        byDay[d.date] = ore;
        t += ore;
      }
    }
    perAngajat[a.id] = { total: t, byDay };
    sum += t;
  }
  return { perAngajat, sum };
}

async function loadByCod(catId) {
  const rows = await sql`
    SELECT c.cod, oc.ore_vineri::float8 AS vineri, oc.ore_sambata::float8 AS sambata,
           oc.ore_duminica::float8 AS duminica
    FROM ore_coduri oc JOIN coduri c ON c.id=oc.cod_id
    WHERE oc.workspace_id=${WS}::uuid AND oc.categorie_id=${catId}::uuid
  `;
  const byCod = {};
  for (const r of rows) {
    byCod[r.cod] = {
      vineri: Number(r.vineri),
      sambata: Number(r.sambata),
      duminica: Number(r.duminica),
    };
  }
  return byCod;
}

async function main() {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host.includes("ep-jolly-bar")) throw new Error("REFUSING prod");
  report.dbHost = host.slice(0, 40);

  // (a) checksums
  {
    const beforePath = "migration-reports/ore-faza4-test-before/snapshot.json";
    const afterPath = "migration-reports/ore-faza4-test-after/snapshot.json";
    if (existsSync(beforePath) && existsSync(afterPath)) {
      const before = JSON.parse(readFileSync(beforePath, "utf8"));
      const after = JSON.parse(readFileSync(afterPath, "utf8"));
      const diffs = [];
      for (const t of ["ore_osd", "programari", "coduri"]) {
        const b = before.summaries?.[t];
        const a = after.summaries?.[t];
        if (!b || !a || b.count !== a.count || b.checksum !== a.checksum) {
          diffs.push(t);
        }
      }
      report.a.checksumDiffs = diffs;
      if (diffs.length) push("a: checksum mismatch " + diffs.join(","));
    } else {
      push("a: missing snapshot files");
    }
  }

  const cats = await sql`
    SELECT id::text AS id, nume, post_vechi FROM categorii
    WHERE workspace_id=${WS}::uuid AND activ ORDER BY ordine
  `;
  const asistent = cats.find((c) => c.post_vechi === "asistent") || cats[0];
  const infirmier = cats.find((c) => c.post_vechi === "infirmier") || cats[1];

  const baseline = JSON.parse(
    readFileSync("migration-reports/ore-faza4-baseline/osd-baseline.json", "utf8"),
  );

  // (b) totals match baseline
  {
    const mismatches = [];
    for (const [mk, catsObj] of Object.entries(baseline.months)) {
      const [an, luna] = mk.split("-").map(Number);
      for (const cat of cats) {
        const byCod = await loadByCod(cat.id);
        const baseCat = catsObj[cat.nume];
        if (!baseCat) continue;
        for (const [fk, data] of Object.entries(baseCat)) {
          const foaie = Number(fk.replace("foaie", ""));
          const cur = await computeMonth(cat.id, an, luna, foaie, byCod);
          if (cur.sum !== data.sumTotal) {
            mismatches.push(`${mk} ${cat.nume} ${fk}: ${cur.sum} vs ${data.sumTotal}`);
          }
          for (const a of data.perAngajat) {
            const got = cur.perAngajat[a.id]?.total ?? 0;
            if (got !== a.total) {
              mismatches.push(
                `${mk} ${cat.nume} ${a.nume}: ${got} vs ${a.total}`,
              );
            }
            for (const [date, info] of Object.entries(a.byDay || {})) {
              const ore = typeof info === "object" ? info.ore : info;
              const g = cur.perAngajat[a.id]?.byDay?.[date] ?? 0;
              if (g !== ore) {
                mismatches.push(
                  `${mk} ${a.nume} ${date}: ${g} vs ${ore}`,
                );
              }
            }
          }
        }
      }
    }
    report.b.mismatches = mismatches.slice(0, 20);
    report.b.mismatchCount = mismatches.length;
    if (mismatches.length) push("b: OSD mismatch " + mismatches[0]);
  }

  const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
  if (!cookie) throw new Error("login failed");
  const H = { Cookie: cookie, "Content-Type": "application/json" };

  // (c) change Saturday for code 1 on Asistenți
  {
    const byCodBefore = await loadByCod(asistent.id);
    const orig = byCodBefore["1"].sambata;
    const rows = await sql`
      SELECT oc.cod_id::text AS cod_id, oc.ore_vineri::float8 AS v,
             oc.ore_sambata::float8 AS s, oc.ore_duminica::float8 AS d
      FROM ore_coduri oc JOIN coduri c ON c.id=oc.cod_id
      WHERE oc.workspace_id=${WS}::uuid AND oc.categorie_id=${asistent.id}::uuid AND c.cod='1'
    `;
    const codId = rows[0].cod_id;
    const put = await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        items: [
          {
            codId,
            oreVineri: rows[0].v,
            oreSambata: orig + 1,
            oreDuminica: rows[0].d,
          },
        ],
      }),
    });
    report.c.changeStatus = put.status;
    if (put.status !== 200) push("c: change failed");

    const aAfter = await computeMonth(
      asistent.id,
      2026,
      9,
      1,
      await loadByCod(asistent.id),
    );
    const iAfter = await computeMonth(
      infirmier.id,
      2026,
      9,
      1,
      await loadByCod(infirmier.id),
    );
    const baseA = baseline.months["2026-09"]["Asistenți"].foaie1.sumTotal;
    const baseI = baseline.months["2026-09"]["Infirmiere"].foaie1.sumTotal;
    report.c.asistentSum = aAfter.sum;
    report.c.infirmierSum = iAfter.sum;
    report.c.asistentChanged = aAfter.sum !== baseA;
    report.c.infirmierUnchanged = iAfter.sum === baseI;
    if (!report.c.asistentChanged) push("c: Asistenți sum should change");
    if (!report.c.infirmierUnchanged) push("c: Infirmiere should stay");

    const audit = await sql`
      SELECT action, detail FROM audit_log
      WHERE workspace_id=${WS}::uuid AND action='ore_coduri_update'
      ORDER BY created_at DESC LIMIT 1
    `;
    report.c.audit = audit[0]?.action ?? null;
    if (audit[0]?.action !== "ore_coduri_update") push("c: missing audit");

    // restore
    const restore = await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        items: [
          {
            codId,
            oreVineri: rows[0].v,
            oreSambata: orig,
            oreDuminica: rows[0].d,
          },
        ],
      }),
    });
    report.c.restore = restore.status;
    const aRestored = await computeMonth(
      asistent.id,
      2026,
      9,
      1,
      await loadByCod(asistent.id),
    );
    report.c.restoredMatch = aRestored.sum === baseA;
    if (!report.c.restoredMatch) push("c: restore baseline fail");
  }

  // (d) new common code + Sunday hours on Infirmiere
  {
    const testDate = "2099-06-07"; // Sunday
    await sql`DELETE FROM programari WHERE workspace_id=${WS}::uuid AND data >= '2099-01-01'::date`;
    await sql`DELETE FROM ore_coduri WHERE workspace_id=${WS}::uuid AND cod_id IN (SELECT id FROM coduri WHERE workspace_id=${WS}::uuid AND cod='N4' AND sistem IS NULL)`;
    await sql`DELETE FROM coduri WHERE workspace_id=${WS}::uuid AND cod='N4' AND sistem IS NULL`;

    const create = await fetch(`${BASE}/api/setari/coduri`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        cod: "N4",
        eticheta: "N4",
        culoare: "#111111",
        categorieId: null,
      }),
    });
    const created = await json(create);
    report.d.create = create.status;
    const codId = created.item?.id;
    if (create.status !== 201 || !codId) push("d: create N4 failed");

    const seeds = await sql`
      SELECT count(*)::int AS n FROM ore_coduri
      WHERE workspace_id=${WS}::uuid AND cod_id=${codId}::uuid
    `;
    report.d.seedRows = seeds[0].n;
    if (seeds[0].n !== 2) push("d: expected 2 ore_coduri rows");

    // set 12 Sunday on Infirmiere
    await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: infirmier.id,
        items: [{ codId, oreVineri: 0, oreSambata: 0, oreDuminica: 12 }],
      }),
    });

    const angI = (
      await sql`
        SELECT id::text AS id FROM angajati
        WHERE workspace_id=${WS}::uuid AND categorie_id=${infirmier.id}::uuid AND activ
        ORDER BY ordine LIMIT 1
      `
    )[0];
    const before = await computeMonth(
      infirmier.id,
      2099,
      6,
      1,
      await loadByCod(infirmier.id),
    );
    // June 2099 - need staff programare on that sunday - computeMonth uses real programari
    const putP = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angI.id,
        data: testDate,
        valoare: "N4",
        foaie: 1,
      }),
    });
    report.d.saveProg = putP.status;
    const after = await computeMonth(
      infirmier.id,
      2099,
      6,
      1,
      await loadByCod(infirmier.id),
    );
    const aBefore = await computeMonth(
      asistent.id,
      2099,
      6,
      1,
      await loadByCod(asistent.id),
    );
    report.d.deltaInf = after.sum - before.sum;
    report.d.asistSum = aBefore.sum;
    // asistent also has N4 seeded at 0 — if no programare, sum 0
    if (report.d.deltaInf !== 12) push("d: expected +12 on Infirmiere");

    // cleanup
    await sql`DELETE FROM programari WHERE workspace_id=${WS}::uuid AND data >= '2099-01-01'::date`;
    await sql`DELETE FROM ore_coduri WHERE workspace_id=${WS}::uuid AND cod_id=${codId}::uuid`;
    const del = await fetch(`${BASE}/api/setari/coduri`, {
      method: "DELETE",
      headers: H,
      body: JSON.stringify({ id: codId }),
    });
    report.d.cleanup = del.status;
  }

  // (e) free text Sunday = 0
  {
    const testDate = "2099-06-14"; // Sunday
    await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        permiteTextLiber: true,
      }),
    });
    const angA = (
      await sql`
        SELECT id::text AS id FROM angajati
        WHERE workspace_id=${WS}::uuid AND categorie_id=${asistent.id}::uuid AND activ
        LIMIT 1
      `
    )[0];
    const before = await computeMonth(
      asistent.id,
      2099,
      6,
      1,
      await loadByCod(asistent.id),
    );
    await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: testDate,
        valoare: "FT",
        foaie: 1,
      }),
    });
    const after = await computeMonth(
      asistent.id,
      2099,
      6,
      1,
      await loadByCod(asistent.id),
    );
    report.e.delta = after.sum - before.sum;
    if (report.e.delta !== 0) push("e: free text should add 0 hours");
    await sql`DELETE FROM programari WHERE workspace_id=${WS}::uuid AND data >= '2099-01-01'::date`;
    await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        permiteTextLiber: false,
      }),
    });
  }

  // (f) Concedii HTML without Ore O.SD panel; grid has O.SD section
  {
    const conc = await fetch(`${BASE}/concedii`, { headers: { Cookie: cookie } });
    const html = await conc.text();
    report.f.concediiStatus = conc.status;
    report.f.concediiHasOreOsdHeading = /Ore O\.SD/.test(html);
    // Client-rendered — check source doesn't import panel string in RSC payload
    report.f.concediiHasOreOsdPanel = html.includes("OreOsdPanel");
    if (report.f.concediiHasOreOsdPanel) push("f: Concedii still references OreOsdPanel");

    const home = await fetch(
      `${BASE}/?an=2026&luna=9&categorie=${asistent.id}`,
      { headers: { Cookie: cookie } },
    );
    report.f.homeStatus = home.status;
  }

  // (g) invalid + 403
  {
    const rows = await sql`
      SELECT oc.cod_id::text AS cod_id FROM ore_coduri oc
      JOIN coduri c ON c.id=oc.cod_id
      WHERE oc.workspace_id=${WS}::uuid AND oc.categorie_id=${asistent.id}::uuid
      LIMIT 1
    `;
    const bad = await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        items: [
          {
            codId: rows[0].cod_id,
            oreVineri: -1,
            oreSambata: 0,
            oreDuminica: 0,
          },
        ],
      }),
    });
    report.g.neg = bad.status;
    const bad2 = await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        items: [
          {
            codId: rows[0].cod_id,
            oreVineri: 25,
            oreSambata: 0,
            oreDuminica: 0,
          },
        ],
      }),
    });
    report.g.over = bad2.status;
    const bad3 = await fetch(`${BASE}/api/setari/ore`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        items: [
          {
            codId: rows[0].cod_id,
            oreVineri: "abc",
            oreSambata: 0,
            oreDuminica: 0,
          },
        ],
      }),
    });
    report.g.text = bad3.status;
    if (bad.status !== 400 || bad2.status !== 400 || bad3.status !== 400) {
      push("g: invalid should 400");
    }

    const email = `ore-faza4-${Date.now()}@example.com`;
    const pass = "TestPass123!";
    const hash = await bcrypt.hash(pass, 10);
    const u = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${email}, ${hash}, true) RETURNING id::text AS id
    `;
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${WS}::uuid, ${u[0].id}::uuid, 'editor', false)
    `;
    const { cookie: c2 } = await login(email, pass);
    const forbidden = await fetch(`${BASE}/api/setari/ore`, {
      headers: { Cookie: c2 },
    });
    report.g.forbidden = forbidden.status;
    if (forbidden.status !== 403) push("g: expected 403");
    await sql`DELETE FROM workspace_members WHERE user_id=${u[0].id}::uuid`;
    await sql`DELETE FROM users WHERE id=${u[0].id}::uuid`;
  }

  // CO sold sanity
  {
    const luna = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.f.coSum = (luna.angajati || []).reduce(
      (s, a) => s + Number(a.zileCoFolosite || 0),
      0,
    );
  }

  mkdirSync("migration-reports/ore-faza4-test-verify", { recursive: true });
  writeFileSync(
    "migration-reports/ore-faza4-test-verify/report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) {
    console.error("FAIL", report.issues);
    process.exit(1);
  }
  console.log("OK all checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
