/**
 * Verificări PAS 5 pe copia Neon (server local + .env.local).
 * Usage: node --env-file=.env.local scripts/verify-setari-faza1.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const BASE = process.argv[2] || "http://127.0.0.1:3020";
const sql = neon(process.env.DATABASE_URL);
const WS_ID = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const TEST_EMAIL = "setari-test-editor@example.com";
const TEST_PASS = "test-editor-123";
const report = { a: {}, b: {}, c: {}, issues: [] };

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
  return { res, cookie: cookieFrom(res), body: await res.text() };
}

function hasSetariLink(html) {
  return html.includes('href="/setari"') && html.includes("Setări");
}

async function main() {
  // (a) Nicoleta
  {
    const { res, cookie, body } = await login(
      "popanicol24@gmail.com",
      "nicoleta123",
    );
    report.a.login = res.status;
    if (!res.ok) throw new Error(`Nicoleta login failed ${body}`);

    const home = await fetch(`${BASE}/`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const homeHtml = await home.text();
    report.a.homeStatus = home.status;
    report.a.hasSetariLink = hasSetariLink(homeHtml);

    const setari = await fetch(`${BASE}/setari`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    report.a.setariStatus = setari.status;
    report.a.setariRedirect = setari.headers.get("location");

    const get1 = await fetch(`${BASE}/api/setari/general`, {
      headers: { Cookie: cookie },
    });
    const g1 = await get1.json();
    report.a.getGeneral = { status: get1.status, ...g1 };

    const putTmp = await fetch(`${BASE}/api/setari/general`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ nume: "ATI Brăila TEST" }),
    });
    const pt = await putTmp.json();
    report.a.rename = { status: putTmp.status, nume: pt.nume };

    const putBack = await fetch(`${BASE}/api/setari/general`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ nume: "ATI Brăila" }),
    });
    const pb = await putBack.json();
    report.a.renameBack = { status: putBack.status, nume: pb.nume };

    const dbNume = await sql`
      SELECT nume FROM workspaces WHERE id = ${WS_ID}::uuid
    `;
    report.a.dbNume = dbNume[0]?.nume;

    if (!report.a.hasSetariLink) report.issues.push("a: missing Setări link");
    if (report.a.setariStatus !== 200) report.issues.push("a: /setari not 200");
    if (
      report.a.rename.status !== 200 ||
      report.a.rename.nume !== "ATI Brăila TEST"
    ) {
      report.issues.push("a: rename failed");
    }
    if (
      report.a.renameBack.status !== 200 ||
      report.a.dbNume !== "ATI Brăila"
    ) {
      report.issues.push("a: rename back failed");
    }
  }

  // (b) test editor
  {
    await sql`
      DELETE FROM workspace_members
      WHERE user_id IN (SELECT id FROM users WHERE email = ${TEST_EMAIL})
    `;
    await sql`DELETE FROM users WHERE email = ${TEST_EMAIL}`;

    const hash = await bcrypt.hash(TEST_PASS, 12);
    const inserted = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${TEST_EMAIL}, ${hash}, true)
      RETURNING id::text AS id
    `;
    const testUserId = inserted[0].id;
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${WS_ID}::uuid, ${testUserId}::uuid, ${"editor"}, false)
    `;

    const { res, cookie } = await login(TEST_EMAIL, TEST_PASS);
    report.b.login = res.status;
    if (!res.ok) throw new Error("test user login failed");

    const home = await fetch(`${BASE}/`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const homeHtml = await home.text();
    report.b.hasSetariLinkFalse = hasSetariLink(homeHtml);

    const setari = await fetch(`${BASE}/setari`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    report.b.setariStatusFalse = setari.status;
    report.b.setariLocFalse = setari.headers.get("location");

    const put403 = await fetch(`${BASE}/api/setari/general`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ nume: "HACK" }),
    });
    const put403Body = await put403.json();
    report.b.putForbidden = {
      status: put403.status,
      error: put403Body.error,
    };

    await sql`
      UPDATE workspace_members
      SET poate_modifica_setari = true
      WHERE user_id = ${testUserId}::uuid AND workspace_id = ${WS_ID}::uuid
    `;

    const home2 = await fetch(`${BASE}/`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    report.b.hasSetariLinkTrue = hasSetariLink(await home2.text());

    const setari2 = await fetch(`${BASE}/setari`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    report.b.setariStatusTrue = setari2.status;

    const putOk = await fetch(`${BASE}/api/setari/general`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ nume: "ATI Brăila" }),
    });
    const putOkBody = await putOk.json();
    report.b.putAllowed = {
      status: putOk.status,
      nume: putOkBody.nume,
      isOwner: putOkBody.isOwner,
    };

    await sql`DELETE FROM workspace_members WHERE user_id = ${testUserId}::uuid`;
    await sql`DELETE FROM users WHERE id = ${testUserId}::uuid`;
    const left = await sql`
      SELECT COUNT(*)::int AS n FROM users WHERE email = ${TEST_EMAIL}
    `;
    report.b.deleted = left[0].n === 0;

    if (report.b.hasSetariLinkFalse) {
      report.issues.push("b: link visible when flag false");
    }
    const loc = report.b.setariLocFalse || "";
    const redirectedHome =
      (report.b.setariStatusFalse === 307 ||
        report.b.setariStatusFalse === 302) &&
      (loc === "/" || loc.endsWith("/") || /\/\/[^/]+\/?$/.test(loc));
    if (!redirectedHome) {
      report.issues.push(
        `b: expected redirect /setari→/, got ${report.b.setariStatusFalse} loc=${loc}`,
      );
    }
    if (report.b.putForbidden.status !== 403) {
      report.issues.push("b: expected PUT 403");
    }
    if (
      report.b.putForbidden.error !==
      "Nu ai permisiunea să modifici setările"
    ) {
      report.issues.push(`b: unexpected 403 message: ${report.b.putForbidden.error}`);
    }
    if (!report.b.hasSetariLinkTrue) {
      report.issues.push("b: link missing when flag true");
    }
    if (report.b.setariStatusTrue !== 200) {
      report.issues.push("b: /setari not 200 when flag true");
    }
    if (report.b.putAllowed.status !== 200) {
      report.issues.push("b: PUT not allowed when flag true");
    }
    if (!report.b.deleted) report.issues.push("b: test user not deleted");
  }

  // (c) regressions
  {
    const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
    const now = new Date();
    const an = now.getFullYear();
    const luna = now.getMonth() + 1;
    const checks = {};
    for (const path of [
      `/api/luna?an=${an}&luna=${luna}&tab=asistenti&foaie=1`,
      `/api/concedii?an=${an}`,
      `/api/grafice`,
      `/api/ore-osd`,
      `/api/grafic-footer`,
    ]) {
      const r = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
      checks[path] = r.status;
      if (r.status !== 200) report.issues.push(`c: ${path} -> ${r.status}`);
    }
    const istoric = await fetch(`${BASE}/istoric`, {
      headers: { Cookie: cookie },
    });
    checks["/istoric"] = istoric.status;
    if (istoric.status !== 200) {
      report.issues.push(`c: /istoric ${istoric.status}`);
    }
    report.c.api = checks;

    const before = JSON.parse(
      readFileSync(
        "migration-reports/setari-faza1-test-before/snapshot.json",
        "utf8",
      ),
    );
    const after = JSON.parse(
      readFileSync(
        "migration-reports/setari-faza1-test-after/snapshot.json",
        "utf8",
      ),
    );
    const checksumDiffs = [];
    for (const t of Object.keys(before.summaries)) {
      const b = before.summaries[t];
      const a = after.summaries[t];
      if (b.count !== a.count || b.checksum !== a.checksum) {
        checksumDiffs.push({
          t,
          before: { count: b.count, checksum: b.checksum },
          after: { count: a.count, checksum: a.checksum },
        });
      }
    }
    report.c.checksumDiffs = checksumDiffs;
    if (checksumDiffs.length) {
      report.issues.push("c: checksum mismatch after migration");
    }

    const liveAng = await sql`
      SELECT id::text AS id, post, ordine, nume, activ
      FROM angajati
      ORDER BY post, ordine, nume, id
    `;
    const liveProg = await sql`
      SELECT angajat_id::text AS angajat_id, data::text AS data, foaie, valoare, ciorna, culoare
      FROM programari
      ORDER BY angajat_id, data, foaie
    `;
    report.c.angajatiMatchAfter =
      JSON.stringify(liveAng) === JSON.stringify(after.angajatiOrdered);
    report.c.programariMatchAfter =
      JSON.stringify(liveProg) === JSON.stringify(after.programariOrdered);
    if (!report.c.angajatiMatchAfter) {
      report.issues.push("c: angajati changed after tests");
    }
    if (!report.c.programariMatchAfter) {
      report.issues.push("c: programari changed after tests");
    }
  }

  const outDir = resolve("migration-reports/setari-faza1-test-verify");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exit(1);
  console.log("PAS 5 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
