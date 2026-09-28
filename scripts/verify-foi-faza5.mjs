/**
 * PAS 3 — verificări foi faza 5 pe copia Neon.
 * Usage: node --env-file=.env.local scripts/verify-foi-faza5.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

function numeFoaieImplicit(foaie) {
  return `Sheet ${foaie}`;
}
function numeFoaie(foaie, nume) {
  const t = typeof nume === "string" ? nume.trim() : "";
  return t || numeFoaieImplicit(foaie);
}
function foaieFileSuffix(foaie, nume) {
  const custom = typeof nume === "string" ? nume.trim() : "";
  if (custom) {
    return (
      custom
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || `sheet${foaie}`
    );
  }
  if (foaie > 1) return `sheet${foaie}`;
  return "";
}

const root = resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:3055";
const WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";

spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const sql = neon(process.env.DATABASE_URL);
const report = {
  a: {},
  b: {},
  c: {},
  d: {},
  e: {},
  f: {},
  g: {},
  issues: [],
};

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

async function main() {
  // (a) schema + toate nume NULL pe foi existente (înainte de rename test)
  {
    const col = await sql`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='luna_foi' AND column_name='nume'
    `;
    report.a.column = col[0] || null;
    if (!col[0] || col[0].is_nullable !== "YES") {
      push("a: luna_foi.nume lipsește sau nu e nullable");
    }

    const chk = await sql`
      SELECT pg_get_constraintdef(c.oid) AS def
      FROM pg_constraint c
      JOIN pg_class r ON r.oid = c.conrelid
      JOIN pg_namespace n ON n.nspname='public' AND n.oid = r.relnamespace
      WHERE r.relname='luna_foi' AND c.conname='luna_foi_nume_len'
    `;
    report.a.check = chk[0]?.def || null;
    if (!chk[0]) push("a: lipsește CHECK luna_foi_nume_len");

    const beforeChecksum = existsSync(
      resolve(root, "migration-reports/foi-faza5-test-before/snapshot.json"),
    )
      ? JSON.parse(
          readFileSync(
            resolve(
              root,
              "migration-reports/foi-faza5-test-before/snapshot.json",
            ),
            "utf8",
          ),
        )
      : null;
    const afterChecksum = existsSync(
      resolve(root, "migration-reports/foi-faza5-test-after/snapshot.json"),
    )
      ? JSON.parse(
          readFileSync(
            resolve(
              root,
              "migration-reports/foi-faza5-test-after/snapshot.json",
            ),
            "utf8",
          ),
        )
      : null;
    if (beforeChecksum && afterChecksum) {
      const b = beforeChecksum.summaries?.luna_foi;
      const a = afterChecksum.summaries?.luna_foi;
      report.a.checksumMatch =
        b?.count === a?.count && b?.checksum === a?.checksum;
      if (!report.a.checksumMatch) {
        push("a: checksum luna_foi (coloane vechi) diferă before/after migrare");
      }
    } else {
      report.a.checksumMatch = "missing-reports";
    }

    // Reset any leftover test names from prior runs on sep Asistenți foaie 1
    // (only on known test labels) — then assert baseline NULLs for inventory months
  }

  const cats = await sql`
    SELECT id::text AS id, nume, post_vechi
    FROM categorii
    WHERE workspace_id=${WS}::uuid AND activ
    ORDER BY ordine ASC
  `;
  const asistent = cats.find((c) => /asisten/i.test(c.nume));
  const infirmiere = cats.find((c) => /infirm/i.test(c.nume));
  if (!asistent || !infirmiere) {
    push("lipsesc categoriile Asistenți/Infirmiere");
    throw new Error("categorii missing");
  }
  report.a.categorii = { asistent: asistent.id, infirmiere: infirmiere.id };

  // Ensure baseline: clear test renames on sep/aug/iul if any leftover
  await sql`
    UPDATE luna_foi SET nume = NULL
    WHERE workspace_id=${WS}::uuid
      AND an=2026 AND luna IN (7,8,9)
      AND nume IS NOT NULL
      AND (
        lower(btrim(nume)) LIKE 'test %'
        OR lower(btrim(nume)) = 'test gardă'
        OR lower(btrim(nume)) = 'test garda'
        OR lower(btrim(nume)) LIKE 'după%'
        OR lower(btrim(nume)) LIKE 'dupa%'
      )
  `;

  const nullCount = await sql`
    SELECT COUNT(*)::int AS n FROM luna_foi
    WHERE workspace_id=${WS}::uuid AND an=2026 AND luna IN (7,8,9) AND nume IS NOT NULL
  `;
  report.a.nonNullSepAugIul = nullCount[0]?.n ?? -1;
  if (report.a.nonNullSepAugIul !== 0) {
    push("a: foile sep/aug/iul ar trebui nume NULL înainte de teste rename");
  }

  const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
  if (!cookie) throw new Error("login failed");
  const H = { Cookie: cookie, "Content-Type": "application/json" };

  // (b) labels + export title identical for sep/aug/iul both cats
  {
    const months = [9, 8, 7];
    const labels = {};
    for (const luna of months) {
      for (const cat of [asistent, infirmiere]) {
        const key = `${cat.nume}-${luna}`;
        const lunaRes = await json(
          await fetch(
            `${BASE}/api/luna?an=2026&luna=${luna}&categorie=${cat.id}&foaie=1`,
            { headers: { Cookie: cookie } },
          ),
        );
        const items = lunaRes.foiItems || [];
        const expected = (lunaRes.foi || [1]).map((n) => ({
          foaie: n,
          label: numeFoaie(n, null),
        }));
        const ok = items.every(
          (it, i) =>
            it.foaie === expected[i]?.foaie &&
            it.label === expected[i]?.label &&
            (it.nume === null || it.nume === undefined),
        );
        labels[key] = {
          foi: lunaRes.foi,
          labels: items.map((i) => i.label),
          ok,
        };
        if (!ok) push(`b: labels ${key} nu match Sheet N`);

        // Archive title for foaie 1 without custom: no · Sheet
        const save = await fetch(`${BASE}/api/grafice`, {
          method: "POST",
          headers: H,
          body: JSON.stringify({
            an: 2026,
            luna,
            categorieId: cat.id,
            foaie: 1,
          }),
        });
        const saved = await json(save);
        const titlu = saved.item?.titlu || "";
        const snapTitle = saved.snapshot?.title || "";
        const hasSheetInTitlu = /·\s*Sheet\s+\d+/.test(titlu);
        const hasSheetInSnap = /·\s*Sheet\s+\d+/.test(snapTitle);
        labels[`${key}-export`] = {
          titlu,
          snapTitle,
          status: save.status,
          hasSheetInTitlu,
          hasSheetInSnap,
        };
        if (save.status !== 201) push(`b: export ${key} status ${save.status}`);
        if (hasSheetInTitlu || hasSheetInSnap) {
          push(`b: foaie 1 ${key} nu trebuie Sheet în titlu/snapshot`);
        }
        // cleanup archive created for check
        if (saved.item?.id) {
          await sql`DELETE FROM grafice_finale WHERE id=${saved.item.id}::uuid`;
        }
      }
    }
    report.b = labels;
  }

  // (f) archive BEFORE rename stays unchanged — capture first
  let archivedBefore = null;
  {
    const save = await fetch(`${BASE}/api/grafice`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
      }),
    });
    const saved = await json(save);
    archivedBefore = {
      id: saved.item?.id,
      titlu: saved.item?.titlu,
      snapTitle: saved.snapshot?.title,
    };
    report.f.before = archivedBefore;
    if (!archivedBefore.id) push("f: nu s-a putut arhiva înainte de rename");
  }

  // (c) rename Sheet 1 sep Asistenți → Test gardă
  {
    const patch = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: "Test gardă",
      }),
    });
    const body = await json(patch);
    report.c.rename = { status: patch.status, item: body.item };
    if (patch.status !== 200) push(`c: rename status ${patch.status}`);
    if (body.item?.label !== "Test gardă" || body.item?.nume !== "Test gardă") {
      push("c: label/nume așteptat Test gardă");
    }

    const lunaA = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    const lunaI = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${infirmiere.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.c.asistentiLabel = lunaA.foiItems?.[0]?.label;
    report.c.infirmiereLabel = lunaI.foiItems?.[0]?.label;
    if (lunaA.foiItems?.[0]?.label !== "Test gardă") {
      push("c: tab Asistenți nu arată Test gardă");
    }
    if (lunaI.foiItems?.[0]?.label !== "Sheet 1") {
      push("c: Infirmiere ar trebui Sheet 1 neschimbat");
    }

    const save = await fetch(`${BASE}/api/grafice`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
      }),
    });
    const saved = await json(save);
    report.c.export = {
      titlu: saved.item?.titlu,
      snapTitle: saved.snapshot?.title,
      fileSuffix: foaieFileSuffix(1, "Test gardă"),
    };
    if (!String(saved.item?.titlu || "").includes("Test gardă")) {
      push("c: titlu arhivă fără Test gardă");
    }
    if (!String(saved.snapshot?.title || "").includes("Test gardă")) {
      push("c: snapshot export fără Test gardă");
    }
    if (foaieFileSuffix(1, "Test gardă") !== "test-garda") {
      // NFD may strip ă → a
      const suf = foaieFileSuffix(1, "Test gardă");
      report.c.fileSuffix = suf;
      if (!suf.includes("test")) push(`c: file suffix unexpected: ${suf}`);
    }
    if (saved.item?.id) {
      await sql`DELETE FROM grafice_finale WHERE id=${saved.item.id}::uuid`;
    }

    const audit = await sql`
      SELECT action, detail
      FROM audit_log
      WHERE workspace_id=${WS}::uuid AND action='foaie_rename'
      ORDER BY created_at DESC LIMIT 1
    `;
    report.c.audit = audit[0] || null;
    if (!audit[0]) push("c: lipsește audit foaie_rename");

    // clear name → implicit
    const clear = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: null,
      }),
    });
    const cleared = await json(clear);
    report.c.clear = { status: clear.status, item: cleared.item };
    if (cleared.item?.label !== "Sheet 1" || cleared.item?.nume !== null) {
      push("c: după clear trebuie Sheet 1 / nume null");
    }
  }

  // (f) archived before rename unchanged
  if (archivedBefore?.id) {
    const row = await sql`
      SELECT titlu, snapshot->>'title' AS snap_title
      FROM grafice_finale WHERE id=${archivedBefore.id}::uuid
    `;
    report.f.after = row[0] || null;
    if (
      !row[0] ||
      row[0].titlu !== archivedBefore.titlu ||
      row[0].snap_title !== archivedBefore.snapTitle
    ) {
      push("f: arhiva înainte de rename s-a schimbat");
    } else {
      report.f.ok = true;
    }
    await sql`DELETE FROM grafice_finale WHERE id=${archivedBefore.id}::uuid`;
  }

  // (d) create sheet, rename, uniqueness 409, delete
  {
    const created = await fetch(`${BASE}/api/foi`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
      }),
    });
    const cBody = await json(created);
    const newFoaie = cBody.foaie;
    report.d.create = { status: created.status, foaie: newFoaie };
    if (created.status !== 200 && created.status !== 201) {
      push(`d: create status ${created.status}`);
    }
    if (cBody.foiItems?.find((i) => i.foaie === newFoaie)?.nume != null) {
      push("d: foaie nouă trebuie nume NULL");
    }

    const r1 = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: newFoaie,
        nume: "Gardă test",
      }),
    });
    report.d.rename = { status: r1.status, body: await json(r1) };
    if (r1.status !== 200) push(`d: rename status ${r1.status}`);

    // rename foaie 1 to same name (case diff) → 409
    const dup = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: "GARDĂ TEST",
      }),
    });
    const dupBody = await json(dup);
    report.d.dup = { status: dup.status, error: dupBody.error };
    if (dup.status !== 409) push(`d: duplicate expected 409 got ${dup.status}`);

    // cleanup: clear foaie 1 if somehow set, delete new foaie
    await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: null,
      }),
    });
    const del = await fetch(`${BASE}/api/foi`, {
      method: "DELETE",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: newFoaie,
        confirm: true,
      }),
    });
    report.d.delete = { status: del.status, body: await json(del) };
    if (del.status !== 200) push(`d: delete status ${del.status}`);
  }

  // (e) validation + viewer 403 + other workspace
  {
    const tooLong = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: "x".repeat(41),
      }),
    });
    report.e.tooLong = { status: tooLong.status, body: await json(tooLong) };
    if (tooLong.status !== 400) push(`e: >40 expected 400 got ${tooLong.status}`);

    const spaces = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: "   ",
      }),
    });
    report.e.spaces = { status: spaces.status, body: await json(spaces) };
    if (spaces.status !== 400) {
      push(`e: doar spații expected 400 got ${spaces.status}`);
    }

    const email = `foi-faza5-viewer-${Date.now()}@example.com`;
    const pass = "TestPass123!";
    const hash = await bcrypt.hash(pass, 10);
    const u = await sql`
      INSERT INTO users (email, password_hash, activ)
      VALUES (${email}, ${hash}, true) RETURNING id::text AS id
    `;
    await sql`
      INSERT INTO workspace_members (workspace_id, user_id, rol, poate_modifica_setari)
      VALUES (${WS}::uuid, ${u[0].id}::uuid, 'viewer', false)
    `;
    const { cookie: cViewer } = await login(email, pass);
    const viewerPatch = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: {
        Cookie: cViewer,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: asistent.id,
        foaie: 1,
        nume: "Viewer no",
      }),
    });
    report.e.viewer = { status: viewerPatch.status };
    if (viewerPatch.status !== 403) {
      push(`e: viewer expected 403 got ${viewerPatch.status}`);
    }
    await sql`DELETE FROM workspace_members WHERE user_id=${u[0].id}::uuid`;
    await sql`DELETE FROM users WHERE id=${u[0].id}::uuid`;

    const fakeCat = "00000000-0000-4000-8000-000000000099";
    const other = await fetch(`${BASE}/api/foi`, {
      method: "PATCH",
      headers: H,
      body: JSON.stringify({
        an: 2026,
        luna: 9,
        categorieId: fakeCat,
        foaie: 1,
        nume: "Alt WS",
      }),
    });
    report.e.otherWs = { status: other.status, body: await json(other) };
    if (other.status !== 404 && other.status !== 403) {
      push(`e: alt workspace expected 404/403 got ${other.status}`);
    }
  }

  // unit: numeFoaie exact
  {
    if (numeFoaie(1, null) !== "Sheet 1") push("unit: Sheet 1");
    if (numeFoaie(2, null) !== "Sheet 2") push("unit: Sheet 2");
    if (numeFoaie(1, "  X  ") !== "X") push("unit: custom trim");
  }

  report.g.build = "see npm run build";

  mkdirSync("migration-reports/foi-faza5-test-verify", { recursive: true });
  writeFileSync(
    "migration-reports/foi-faza5-test-verify/report.json",
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
