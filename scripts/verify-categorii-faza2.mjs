/**
 * PAS 3 — verificări categorii faza 2 pe copia Neon.
 * Usage: node --env-file=.env.local scripts/verify-categorii-faza2.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const BASE = process.argv[2] || "http://127.0.0.1:3030";
const sql = neon(process.env.DATABASE_URL);
const WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";
const report = { a: {}, b: {}, c: {}, d: {}, e: {}, issues: [] };

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

async function main() {
  // (a) checksums old cols + order
  {
    const before = JSON.parse(
      readFileSync(
        "migration-reports/categorii-faza2-test-before/snapshot.json",
        "utf8",
      ),
    );
    const after = JSON.parse(
      readFileSync(
        "migration-reports/categorii-faza2-test-after/snapshot.json",
        "utf8",
      ),
    );
    const diffs = [];
    for (const t of Object.keys(before.summaries)) {
      const b = before.summaries[t];
      const a = after.summaries[t];
      if (b.count !== a.count || b.checksum !== a.checksum) {
        diffs.push(t);
      }
    }
    report.a.checksumDiffs = diffs;
    if (diffs.length) push("a: checksum mismatch " + diffs.join(","));

    const angMatch =
      JSON.stringify(before.angajatiOrdered) ===
      JSON.stringify(after.angajatiOrdered);
    const progMatch =
      JSON.stringify(before.programariOrdered) ===
      JSON.stringify(after.programariOrdered);
    report.a.angajatiOrderedMatch = angMatch;
    report.a.programariOrderedMatch = progMatch;
    if (!angMatch) push("a: angajati order/content changed");
    if (!progMatch) push("a: programari order/content changed");

    const cats = await sql`
      SELECT id::text, nume, post_vechi, ordine
      FROM categorii WHERE workspace_id = ${WS}::uuid ORDER BY ordine
    `;
    report.a.categorii = cats;
  }

  const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
  if (!cookie) throw new Error("login failed");

  const catsRes = await fetch(`${BASE}/api/categorii`, {
    headers: { Cookie: cookie },
  });
  const catsBody = await catsRes.json();
  const cats = catsBody.items || [];
  const asistent = cats.find((c) => /Asisten/i.test(c.nume));
  const infirmiere = cats.find((c) => /Infirm/i.test(c.nume));
  if (!asistent || !infirmiere) push("missing seeded categories");

  // order per tab vs before export
  {
    const beforeAng = JSON.parse(
      readFileSync(
        "migration-reports/categorii-faza2-test-before/angajati.json",
        "utf8",
      ),
    );
    for (const [label, post, cat] of [
      ["asistenti", "asistent", asistent],
      ["infirmiere", "infirmier", infirmiere],
    ]) {
      if (!cat) continue;
      const expected = beforeAng
        .filter((a) => a.activ && a.post === post)
        .sort((a, b) => a.ordine - b.ordine || a.nume.localeCompare(b.nume))
        .map((a) => ({ id: a.id, nume: a.nume, ordine: a.ordine }));
      const luna = await (
        await fetch(
          `${BASE}/api/luna?an=2026&luna=9&categorie=${cat.id}&foaie=1`,
          { headers: { Cookie: cookie } },
        )
      ).json();
      const live = (luna.angajati || []).map((a) => ({
        id: a.id,
        nume: a.nume,
        ordine: a.ordine,
      }));
      const ok = JSON.stringify(expected) === JSON.stringify(live);
      report.a[`order_${label}`] = { ok, expected: expected.length, live: live.length };
      if (!ok) push(`a: order mismatch ${label}`);
    }
  }

  // (b) 3 months + titles + export text
  {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ an: d.getFullYear(), luna: d.getMonth() + 1 });
    }
    const beforeProg = JSON.parse(
      readFileSync(
        "migration-reports/categorii-faza2-test-before/programari.json",
        "utf8",
      ),
    );
    const beforeAng = JSON.parse(
      readFileSync(
        "migration-reports/categorii-faza2-test-before/angajati.json",
        "utf8",
      ),
    );
    const monthChecks = [];
    for (const { an, luna } of months) {
      for (const [post, cat, titlePart] of [
        ["asistent", asistent, "GRAFIC ASISTENTI ATI II"],
        ["infirmier", infirmiere, "GRAFIC INFIRMIERE ATI"],
      ]) {
        if (!cat) continue;
        const lunaRes = await fetch(
          `${BASE}/api/luna?an=${an}&luna=${luna}&categorie=${cat.id}&foaie=1`,
          { headers: { Cookie: cookie } },
        );
        const data = await lunaRes.json();
        const activeIds = new Set(
          beforeAng.filter((a) => a.activ && a.post === post).map((a) => a.id),
        );
        const prefix = `${an}-${String(luna).padStart(2, "0")}`;
        const expectedProg = beforeProg
          .filter(
            (p) =>
              p.data.startsWith(prefix) &&
              activeIds.has(p.angajat_id) &&
              Number(p.foaie) === 1,
          )
          .map((p) => `${p.angajat_id}|${p.data}|${p.valoare ?? ""}`)
          .sort();
        const liveProg = (data.programari || [])
          .map((p) => `${p.angajatId}|${p.data}|${p.valoare ?? ""}`)
          .sort();
        const grafic = await fetch(`${BASE}/api/grafice`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: cookie,
          },
          body: JSON.stringify({
            an,
            luna,
            categorieId: cat.id,
            foaie: 1,
          }),
        });
        const gBody = await grafic.json();
        const title = gBody.snapshot?.title || "";
        const titleOk = title.includes(titlePart);
        const progOk = JSON.stringify(expectedProg) === JSON.stringify(liveProg);
        // cleanup archive entry created for test
        if (gBody.item?.id) {
          await fetch(`${BASE}/api/grafice/${gBody.item.id}`, {
            method: "DELETE",
            headers: { Cookie: cookie },
          }).catch(() => {});
        }
        monthChecks.push({
          an,
          luna,
          post,
          status: lunaRes.status,
          progOk,
          titleOk,
          title,
          expectedProg: expectedProg.length,
          liveProg: liveProg.length,
        });
        if (!progOk) push(`b: prog mismatch ${post} ${an}-${luna}`);
        if (!titleOk) push(`b: title mismatch ${post} ${an}-${luna}: ${title}`);
      }
    }
    report.b.months = monthChecks;
  }

  // (c) create Test category lifecycle
  {
    const create = await fetch(`${BASE}/api/setari/categorii`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        nume: "Test",
        titluGrafic: "S.C.J.U. BRAILA - GRAFIC TEST",
      }),
    });
    const created = await create.json();
    const testId = created.item?.id;
    report.c.create = { status: create.status, id: testId };
    if (!testId) {
      push("c: create failed");
    } else {
      const ang = await fetch(`${BASE}/api/angajati`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          nume: "TEST CAT",
          categorieId: testId,
          zileCoAn: 0,
        }),
      });
      const angBody = await ang.json();
      const angId = angBody.angajat?.id;
      report.c.angajat = { status: ang.status, id: angId };

      if (angId) {
        await fetch(`${BASE}/api/programari`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: cookie },
          body: JSON.stringify({
            angajatId: angId,
            data: "2026-09-15",
            valoare: "1",
            foaie: 1,
          }),
        });
      }

      const rename = await fetch(`${BASE}/api/setari/categorii`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          id: testId,
          nume: "Test Redenumit",
          titluGrafic: "S.C.J.U. BRAILA - GRAFIC TEST REN",
        }),
      });
      report.c.rename = rename.status;

      const all = await (
        await fetch(`${BASE}/api/setari/categorii`, {
          headers: { Cookie: cookie },
        })
      ).json();
      const ids = (all.items || []).map((c) => c.id);
      // move test to front
      const reordered = [testId, ...ids.filter((id) => id !== testId)];
      const ord = await fetch(`${BASE}/api/setari/categorii`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ ordineIds: reordered }),
      });
      report.c.ordine = ord.status;

      const deact = await fetch(`${BASE}/api/setari/categorii`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ id: testId, activ: false }),
      });
      report.c.deactivate = deact.status;
      const active = await (
        await fetch(`${BASE}/api/categorii`, { headers: { Cookie: cookie } })
      ).json();
      report.c.goneFromTabs = !(active.items || []).some((c) => c.id === testId);
      if (!report.c.goneFromTabs) push("c: deactivated still in tabs");

      // data remains
      const still = await sql`
        SELECT COUNT(*)::int AS n FROM angajati WHERE id = ${angId}::uuid
      `;
      report.c.dataRemains = still[0].n === 1;

      // cleanup: delete programari, angajat soft?, then delete categorie
      if (angId) {
        await sql`
          DELETE FROM programari WHERE angajat_id = ${angId}::uuid
        `;
        await sql`
          DELETE FROM angajati WHERE id = ${angId}::uuid
        `;
      }
      const del = await fetch(`${BASE}/api/setari/categorii`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ id: testId }),
      });
      report.c.delete = del.status;
      if (del.status !== 200) push("c: delete failed " + del.status);
    }
  }

  // (d) legacy tab redirect resolution
  {
    const res = await fetch(
      `${BASE}/api/luna?an=2026&luna=9&tab=infirmiere&foaie=1`,
      { headers: { Cookie: cookie } },
    );
    const data = await res.json();
    report.d = {
      status: res.status,
      categorieId: data.categorieId,
      matchesInfirmiere: data.categorieId === infirmiere?.id,
      angCount: (data.angajati || []).length,
    };
    if (!report.d.matchesInfirmiere) push("d: tab=infirmiere not Infirmiere");
  }

  // (e) 403 without settings permission
  {
    const email = "cat-test-nosetari@example.com";
    const pass = "test-nosetari-123";
    await sql`DELETE FROM workspace_members WHERE user_id IN (SELECT id FROM users WHERE email = ${email})`;
    await sql`DELETE FROM users WHERE email = ${email}`;
    const hash = await bcrypt.hash(pass, 12);
    const u = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${email}, ${hash}, true)
      RETURNING id::text AS id
    `;
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${WS}::uuid, ${u[0].id}::uuid, ${"editor"}, false)
    `;
    const { cookie: c2 } = await login(email, pass);
    const r = await fetch(`${BASE}/api/setari/categorii`, {
      headers: { Cookie: c2 },
    });
    const body = await r.json();
    report.e = { status: r.status, error: body.error };
    if (r.status !== 403) push("e: expected 403");
    await sql`DELETE FROM workspace_members WHERE user_id = ${u[0].id}::uuid`;
    await sql`DELETE FROM users WHERE id = ${u[0].id}::uuid`;
  }

  const outDir = resolve("migration-reports/categorii-faza2-test-verify");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) {
    console.error("FAILED", report.issues);
    process.exit(1);
  }
  console.log("PAS 3 OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
