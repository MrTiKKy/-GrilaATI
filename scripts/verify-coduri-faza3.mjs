/**
 * PAS 3 — verificări coduri faza 3 pe copia Neon (.env.local).
 * Usage: node --env-file=.env.local scripts/verify-coduri-faza3.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const BASE = process.argv[2] || "http://127.0.0.1:3040";
const sql = neon(process.env.DATABASE_URL);
const WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const report = {
  a: {},
  b: {},
  c: {},
  d: {},
  e: {},
  f: {},
  g: {},
  h: { build: "see npm run build" },
  issues: [],
};

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

function push(issue) {
  report.issues.push(issue);
}

async function json(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function main() {
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host.includes("ep-jolly-bar")) {
    throw new Error("REFUSING: DATABASE_URL points to production");
  }
  report.dbHost = host.slice(0, 40);

  // (a) checksums + every distinct programari.valoare has coduri row
  {
    const beforePath =
      "migration-reports/coduri-faza3-test-before/snapshot.json";
    const afterPath = "migration-reports/coduri-faza3-test-after/snapshot.json";
    if (existsSync(beforePath) && existsSync(afterPath)) {
      const before = JSON.parse(readFileSync(beforePath, "utf8"));
      const after = JSON.parse(readFileSync(afterPath, "utf8"));
      const diffs = [];
      for (const t of Object.keys(before.summaries || {})) {
        const b = before.summaries[t];
        const a = after.summaries[t];
        if (!a || b.count !== a.count || b.checksum !== a.checksum) {
          diffs.push(t);
        }
      }
      report.a.checksumDiffs = diffs;
      if (diffs.length) push("a: checksum mismatch " + diffs.join(","));
    } else {
      report.a.snapshotFiles = "missing — using live programari checksum only";
    }

    const missing = await sql`
      SELECT DISTINCT p.valoare
      FROM programari p
      WHERE p.workspace_id = ${WS}::uuid
        AND p.valoare IS NOT NULL
        AND p.valoare <> ''
        AND NOT EXISTS (
          SELECT 1 FROM coduri c
          WHERE c.workspace_id = p.workspace_id
            AND c.cod = p.valoare
        )
      ORDER BY 1
    `;
    report.a.missingCoduri = missing.map((r) => r.valoare);
    if (missing.length) push("a: programari fără coduri: " + missing.map((r) => r.valoare).join(","));

    const prog = await sql`
      SELECT COUNT(*)::int AS n,
             md5(string_agg(id::text || '|' || coalesce(valoare,''), ',' ORDER BY id)) AS chk
      FROM programari
      WHERE workspace_id = ${WS}::uuid
    `;
    report.a.programari = prog[0];
  }

  const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
  if (!cookie) throw new Error("login failed");
  const H = { Cookie: cookie, "Content-Type": "application/json" };

  const cats = await sql`
    SELECT id::text AS id, nume, post_vechi, permite_text_liber
    FROM categorii
    WHERE workspace_id = ${WS}::uuid AND activ = true
    ORDER BY ordine
  `;
  const asistent = cats.find((c) => c.post_vechi === "asistent") || cats[0];
  const infirmier = cats.find((c) => c.post_vechi === "infirmier") || cats[1];
  report.b.categorii = cats.map((c) => ({ id: c.id, nume: c.nume }));

  // (b) baseline: same 9 codes on both categories, same colors/labels/comportament
  {
    const ra = await fetch(
      `${BASE}/api/coduri?categorie=${asistent.id}`,
      { headers: { Cookie: cookie } },
    );
    const ri = await fetch(
      `${BASE}/api/coduri?categorie=${infirmier.id}`,
      { headers: { Cookie: cookie } },
    );
    const da = await json(ra);
    const di = await json(ri);
    const codesA = (da.items || []).map((c) => c.cod).join(",");
    const codesI = (di.items || []).map((c) => c.cod).join(",");
    report.b.codesAsistenti = codesA;
    report.b.codesInfirmiere = codesI;
    report.b.sameCodes = codesA === codesI;
    if (codesA !== "-,1,2,1/3,2*,L,CO,CM,CIC" && codesA !== codesI) {
      // order from ordine ASC — seed order
    }
    const expected = ["-", "1", "2", "1/3", "2*", "L", "CO", "CM", "CIC"];
    if (JSON.stringify((da.items || []).map((c) => c.cod)) !== JSON.stringify(expected)) {
      push("b: coduri Asistenți nu match seed order: " + codesA);
    }
    if (codesA !== codesI) push("b: coduri diferite pe categorii");

    // O.SD sample: luna route for sep 2026 both categories
    async function osdSum(catId, an, luna) {
      const res = await fetch(
        `${BASE}/api/luna?an=${an}&luna=${luna}&categorie=${catId}&foaie=1`,
        { headers: { Cookie: cookie } },
      );
      const body = await json(res);
      const staff = body.angajati || body.staff || [];
      const prog = body.programari || [];
      return {
        status: res.status,
        angajati: staff.length,
        programari: prog.length,
        coSum: staff.reduce((s, a) => s + Number(a.zileCoFolosite || 0), 0),
      };
    }
    report.b.sepA = await osdSum(asistent.id, 2026, 9);
    report.b.sepI = await osdSum(infirmier.id, 2026, 9);
    report.b.augA = await osdSum(asistent.id, 2026, 8);
    report.b.iulA = await osdSum(asistent.id, 2026, 7);
    if (report.b.sepA.status !== 200) push("b: luna sep asistent fail");
    if (report.b.sepI.status !== 200) push("b: luna sep infirmier fail");
  }

  // Pick a real angajat for write tests
  const angA = (
    await sql`
      SELECT id::text AS id FROM angajati
      WHERE workspace_id = ${WS}::uuid AND categorie_id = ${asistent.id}::uuid AND activ
      ORDER BY ordine LIMIT 1
    `
  )[0];
  const angI = (
    await sql`
      SELECT id::text AS id FROM angajati
      WHERE workspace_id = ${WS}::uuid AND categorie_id = ${infirmier.id}::uuid AND activ
      ORDER BY ordine LIMIT 1
    `
  )[0];
  const testDate = "2099-01-15"; // far future — isolated cleanup

  // (c) new common N + specific only Infirmiere
  let commonNId = null;
  let specificXId = null;
  {
    // cleanup leftovers
    await sql`DELETE FROM programari WHERE workspace_id = ${WS}::uuid AND data = ${testDate}::date`;
    await sql`DELETE FROM coduri WHERE workspace_id = ${WS}::uuid AND cod IN ('N','X','ZZ') AND sistem IS NULL`;

    const createN = await fetch(`${BASE}/api/setari/coduri`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        cod: "N",
        eticheta: "Cod N",
        culoare: "#E11D48",
        categorieId: null,
      }),
    });
    const nBody = await json(createN);
    report.c.createN = createN.status;
    commonNId = nBody.item?.id;
    if (createN.status !== 201) push("c: create N failed " + JSON.stringify(nBody));

    const ra = await json(
      await fetch(`${BASE}/api/coduri?categorie=${asistent.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    const ri = await json(
      await fetch(`${BASE}/api/coduri?categorie=${infirmier.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    report.c.nOnAsistent = (ra.items || []).some((c) => c.cod === "N");
    report.c.nOnInfirmier = (ri.items || []).some((c) => c.cod === "N");
    if (!report.c.nOnAsistent || !report.c.nOnInfirmier) push("c: N missing from popup");

    const putN = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: testDate,
        valoare: "N",
        foaie: 1,
      }),
    });
    report.c.saveN = putN.status;
    if (putN.status !== 200) push("c: save N failed");

    const createX = await fetch(`${BASE}/api/setari/coduri`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        cod: "X",
        eticheta: "Doar Inf",
        culoare: "#2563EB",
        categorieId: infirmier.id,
      }),
    });
    const xBody = await json(createX);
    report.c.createX = createX.status;
    specificXId = xBody.item?.id;
    if (createX.status !== 201) push("c: create X failed");

    const ra2 = await json(
      await fetch(`${BASE}/api/coduri?categorie=${asistent.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    const ri2 = await json(
      await fetch(`${BASE}/api/coduri?categorie=${infirmier.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    report.c.xOnAsistent = (ra2.items || []).some((c) => c.cod === "X");
    report.c.xOnInfirmier = (ri2.items || []).some((c) => c.cod === "X");
    if (report.c.xOnAsistent) push("c: X should not appear on Asistenți");
    if (!report.c.xOnInfirmier) push("c: X missing on Infirmiere");

    const rejectX = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: testDate,
        valoare: "X",
        foaie: 1,
      }),
    });
    report.c.rejectXOnAsistent = rejectX.status;
    if (rejectX.status !== 400) push("c: API should reject X on Asistenți");

    const saveX = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angI.id,
        data: testDate,
        valoare: "X",
        foaie: 1,
      }),
    });
    report.c.saveX = saveX.status;
    if (saveX.status !== 200) push("c: save X on Infirmiere failed");

    // deactivate N
    const deact = await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ id: commonNId, activ: false }),
    });
    report.c.deactivateN = deact.status;
    const ra3 = await json(
      await fetch(`${BASE}/api/coduri?categorie=${asistent.id}`, {
        headers: { Cookie: cookie },
      }),
    );
    report.c.nGoneFromPopup = !(ra3.items || []).some((c) => c.cod === "N");
    report.c.nStillInCuloareMap = Boolean(ra3.culoareByCod?.N);
    if (!report.c.nGoneFromPopup) push("c: N still in popup after deactivate");

    // reject new cell with deactivated N
    const rejectN = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: "2099-01-16",
        valoare: "N",
        foaie: 1,
      }),
    });
    report.c.rejectDeactivatedN = rejectN.status;
    if (rejectN.status !== 400) push("c: deactivated N should be rejected");

    // cleanup c
    await sql`DELETE FROM programari WHERE workspace_id = ${WS}::uuid AND data >= '2099-01-01'::date`;
    if (specificXId) {
      await fetch(`${BASE}/api/setari/coduri`, {
        method: "DELETE",
        headers: H,
        body: JSON.stringify({ id: specificXId }),
      });
    }
    // reactivate then delete N (unused after cleanup)
    await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ id: commonNId, activ: true }),
    });
    const delN = await fetch(`${BASE}/api/setari/coduri`, {
      method: "DELETE",
      headers: H,
      body: JSON.stringify({ id: commonNId }),
    });
    report.c.cleanupDelN = delN.status;
    if (delN.status !== 200) {
      await sql`DELETE FROM coduri WHERE workspace_id = ${WS}::uuid AND cod IN ('N','X') AND sistem IS NULL`;
    }
  }

  // (d) free text
  {
    await sql`
      UPDATE categorii SET permite_text_liber = false
      WHERE workspace_id = ${WS}::uuid AND id = ${asistent.id}::uuid
    `;
    const off = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: testDate,
        valoare: "FT",
        foaie: 1,
      }),
    });
    report.d.rejectWhenOff = off.status;
    if (off.status !== 400) push("d: free text should reject when off");

    const toggle = await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        permiteTextLiber: true,
      }),
    });
    report.d.toggleOn = toggle.status;

    // baseline CO + OSD before free text
    const beforeLuna = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    const coBefore = (beforeLuna.angajati || []).find(
      (a) => a.id === angA.id,
    )?.zileCoFolosite;

    const on = await fetch(`${BASE}/api/programari`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        angajatId: angA.id,
        data: testDate,
        valoare: "FT",
        foaie: 1,
      }),
    });
    report.d.saveWhenOn = on.status;
    if (on.status !== 200) push("d: free text save failed");

    const afterLuna = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    const coAfter = (afterLuna.angajati || []).find(
      (a) => a.id === angA.id,
    )?.zileCoFolosite;
    report.d.coUnchanged = coBefore === coAfter;
    if (coBefore !== coAfter) push("d: CO changed after free text");

    // cleanup
    await sql`DELETE FROM programari WHERE workspace_id = ${WS}::uuid AND data >= '2099-01-01'::date`;
    await fetch(`${BASE}/api/setari/coduri`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        categorieId: asistent.id,
        permiteTextLiber: false,
      }),
    });
  }

  // (e) sistem CO/CM/CIC — only color editable
  {
    const all = await json(
      await fetch(`${BASE}/api/setari/coduri`, { headers: { Cookie: cookie } }),
    );
    const co = (all.items || []).find((c) => c.sistem === "CO");
    if (!co) {
      push("e: CO sistem missing");
    } else {
      const origColor = co.culoare;
      const rename = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: co.id, eticheta: "Concediu" }),
      });
      report.e.renameRejected = rename.status;
      if (rename.status !== 403) push("e: rename CO should 403");

      const deact = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: co.id, activ: false }),
      });
      report.e.deactRejected = deact.status;
      if (deact.status !== 403) push("e: deact CO should 403");

      const del = await fetch(`${BASE}/api/setari/coduri`, {
        method: "DELETE",
        headers: H,
        body: JSON.stringify({ id: co.id }),
      });
      report.e.deleteRejected = del.status;
      if (del.status !== 403) push("e: delete CO should 403");

      const color = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: co.id, culoare: "#E11D48" }),
      });
      report.e.colorOk = color.status;
      const back = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: co.id, culoare: origColor }),
      });
      report.e.colorRestored = back.status;
      if (color.status !== 200 || back.status !== 200) push("e: color change failed");
    }
  }

  // (f) used code cannot delete / change value; label/color ok
  {
    const usedVal = (
      await sql`
        SELECT valoare FROM programari
        WHERE workspace_id = ${WS}::uuid AND valoare IS NOT NULL AND valoare <> ''
          AND valoare NOT IN ('CO','CM','CIC')
        LIMIT 1
      `
    )[0]?.valoare;
    const all = await json(
      await fetch(`${BASE}/api/setari/coduri`, { headers: { Cookie: cookie } }),
    );
    const used = (all.items || []).find(
      (c) => c.cod === usedVal && !c.sistem,
    );
    report.f.usedCod = usedVal;
    if (!used) {
      report.f.skip = "no non-system used code found";
    } else {
      const del = await fetch(`${BASE}/api/setari/coduri`, {
        method: "DELETE",
        headers: H,
        body: JSON.stringify({ id: used.id }),
      });
      report.f.deleteRejected = del.status;
      if (del.status !== 409) push("f: delete used should 409");

      const renameCod = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: used.id, cod: "ZZ" }),
      });
      report.f.codChangeRejected = renameCod.status;
      if (renameCod.status !== 409) push("f: change used cod should 409");

      const label = await fetch(`${BASE}/api/setari/coduri`, {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ id: used.id, eticheta: used.eticheta }),
      });
      report.f.labelOk = label.status;
      if (label.status !== 200) push("f: label update failed");
    }
  }

  // (g) without poate_modifica_setari → 403
  {
    const email = `coduri-faza3-${Date.now()}@example.com`;
    const pass = "TestPass123!";
    const hash = await bcrypt.hash(pass, 10);
    const u = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${email}, ${hash}, true)
      RETURNING id::text AS id
    `;
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${WS}::uuid, ${u[0].id}::uuid, 'editor', false)
    `;
    const { cookie: c2 } = await login(email, pass);
    const res = await fetch(`${BASE}/api/setari/coduri`, {
      headers: { Cookie: c2 },
    });
    report.g.status = res.status;
    if (res.status !== 403) push("g: expected 403 got " + res.status);

    // cleanup test user
    await sql`DELETE FROM workspace_members WHERE user_id = ${u[0].id}::uuid`;
    await sql`DELETE FROM users WHERE id = ${u[0].id}::uuid`;
  }

  // final cleanup safety
  await sql`DELETE FROM programari WHERE workspace_id = ${WS}::uuid AND data >= '2099-01-01'::date`;
  await sql`DELETE FROM coduri WHERE workspace_id = ${WS}::uuid AND cod IN ('N','X','ZZ','FT') AND sistem IS NULL`;
  await sql`
    UPDATE categorii SET permite_text_liber = false
    WHERE workspace_id = ${WS}::uuid
  `;

  mkdirSync("migration-reports/coduri-faza3-test-verify", { recursive: true });
  writeFileSync(
    "migration-reports/coduri-faza3-test-verify/report.json",
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
