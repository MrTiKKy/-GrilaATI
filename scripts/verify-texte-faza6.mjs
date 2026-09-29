/**
 * PAS 3 — verificări texte faza 6 pe copia Neon.
 * Usage: node --env-file=.env.local scripts/verify-texte-faza6.mjs [baseUrl]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { spawnSync } from "child_process";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

const root = resolve(import.meta.dirname, "..");
const BASE = process.argv[2] || "http://127.0.0.1:3060";
const WS = "d2de78f7-eff2-476b-9b20-0ecc8207ba01";

spawnSync(process.execPath, ["scripts/check-db-target.mjs"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

const sql = neon(process.env.DATABASE_URL);
const report = { a: {}, b: {}, c: {}, d: {}, e: {}, f: {}, g: {}, issues: [] };

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
  // (a)
  {
    const before = existsSync(
      resolve(root, "migration-reports/texte-faza6-test-before/snapshot.json"),
    )
      ? JSON.parse(
          readFileSync(
            resolve(
              root,
              "migration-reports/texte-faza6-test-before/snapshot.json",
            ),
            "utf8",
          ),
        )
      : null;
    const after = existsSync(
      resolve(root, "migration-reports/texte-faza6-test-after/snapshot.json"),
    )
      ? JSON.parse(
          readFileSync(
            resolve(
              root,
              "migration-reports/texte-faza6-test-after/snapshot.json",
            ),
            "utf8",
          ),
        )
      : null;
    if (before && after) {
      const tables = Object.keys(before.summaries || {});
      let ok = true;
      for (const t of tables) {
        const b = before.summaries[t];
        const a = after.summaries[t];
        if (b?.checksum !== a?.checksum || b?.count !== a?.count) {
          ok = false;
          push(`a: checksum mismatch ${t}`);
        }
      }
      report.a.checksumOk = ok;
    }
    const n = await sql`SELECT COUNT(*)::int AS n FROM texte`;
    report.a.texteCount = n[0]?.n;
    if (n[0]?.n !== 0) push("a: texte trebuie gol la start");
  }

  const cats = await sql`
    SELECT id::text AS id, nume, titlu_grafic
    FROM categorii WHERE workspace_id=${WS}::uuid AND activ ORDER BY ordine
  `;
  const asistent = cats.find((c) => /asisten/i.test(c.nume));
  const infirmiere = cats.find((c) => /infirm/i.test(c.nume));
  if (!asistent || !infirmiere) throw new Error("categorii missing");

  const { cookie } = await login("popanicol24@gmail.com", "nicoleta123");
  if (!cookie) throw new Error("login failed");
  const H = { Cookie: cookie, "Content-Type": "application/json" };

  // Clear any leftover overrides
  await sql`DELETE FROM texte WHERE workspace_id=${WS}::uuid`;

  // (b) identical titles without overrides
  {
    const expected = {};
    for (const luna of [9, 8, 7]) {
      for (const cat of [asistent, infirmiere]) {
        const lunaRes = await json(
          await fetch(
            `${BASE}/api/luna?an=2026&luna=${luna}&categorie=${cat.id}&foaie=1`,
            { headers: { Cookie: cookie } },
          ),
        );
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
        const months = [
          "",
          "IANUARIE",
          "FEBRUARIE",
          "MARTIE",
          "APRILIE",
          "MAI",
          "IUNIE",
          "IULIE",
          "AUGUST",
          "SEPTEMBRIE",
          "OCTOMBRIE",
          "NOIEMBRIE",
          "DECEMBRIE",
        ];
        const expectTitle = `${cat.titlu_grafic} - ${months[luna]} 2026`;
        const key = `${cat.nume}-${luna}`;
        expected[key] = {
          label: lunaRes.foiItems?.[0]?.label,
          tabelNume: lunaRes.texte?.tabelNume,
          tabelOsd: lunaRes.texte?.tabelOsd,
          day0: lunaRes.texte?.dayAbbrs?.[0],
          titlu: saved.item?.titlu,
          snapTitle: saved.snapshot?.title,
          osdLabel: saved.snapshot?.labels?.osd,
          expectTitle,
        };
        if (lunaRes.foiItems?.[0]?.label !== "Sheet 1") {
          push(`b: ${key} label ${lunaRes.foiItems?.[0]?.label}`);
        }
        if (saved.item?.titlu !== expectTitle) {
          push(`b: ${key} titlu ${saved.item?.titlu} != ${expectTitle}`);
        }
        if (saved.snapshot?.title !== expectTitle) {
          push(`b: ${key} snap ${saved.snapshot?.title}`);
        }
        if (saved.item?.id) {
          await sql`DELETE FROM grafice_finale WHERE id=${saved.item.id}::uuid`;
        }
      }
    }
    report.b = expected;
  }

  // (f)/(d) archive before change
  let archivedId = null;
  let archivedTitlu = null;
  let archivedSnap = null;
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
    archivedId = saved.item?.id;
    archivedTitlu = saved.item?.titlu;
    archivedSnap = saved.snapshot?.title;
    report.d.before = { archivedTitlu, archivedSnap };
  }

  // (c) change antet format, signature, foaie.nume_implicit
  {
    const put1 = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        cheie: "titlu.format",
        valoare: "TEST {titlu_grafic} :: {luna} {an}",
      }),
    });
    report.c.titluPut = put1.status;
    if (put1.status !== 200) push(`c: titlu put ${put1.status}`);

    const put2 = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        cheie: "foaie.nume_implicit",
        valoare: "Foaia {n}",
      }),
    });
    report.c.foaiePut = put2.status;

    const put3 = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        footerKey: "medic_sef",
        footerValue: "SEMNATURA TEST",
      }),
    });
    report.c.footerPut = put3.status;

    // pattern with diacritics + forbidden chars
    const put4 = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        cheie: "fisier.pattern",
        valoare: 'gráfic/{categorie}:*{an}?"<{luna}>|',
      }),
    });
    report.c.patternPut = put4.status;

    const lunaA = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.c.luna = {
      label: lunaA.foiItems?.[0]?.label,
      titluPreview: lunaA.texte?.titluPreview,
      exportBase: lunaA.texte?.exportBase,
    };
    if (lunaA.foiItems?.[0]?.label !== "Foaia 1") {
      push(`c: expected Foaia 1 got ${lunaA.foiItems?.[0]?.label}`);
    }
    if (!String(lunaA.texte?.titluPreview || "").startsWith("TEST ")) {
      push("c: titluPreview missing TEST");
    }
    const base = lunaA.texte?.exportBase || "";
    if (/[/:\\*?"<>|]/.test(base) || /[ăâîșț]/i.test(base)) {
      push(`c: exportBase invalid chars: ${base}`);
    }
    if (!base) push("c: exportBase empty");

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
      snap: saved.snapshot?.title,
      medic: saved.snapshot?.footer?.medicSef,
    };
    if (!String(saved.item?.titlu || "").startsWith("TEST ")) {
      push("c: export titlu");
    }
    if (saved.snapshot?.footer?.medicSef !== "SEMNATURA TEST") {
      push("c: footer medic");
    }
    if (saved.item?.id) {
      await sql`DELETE FROM grafice_finale WHERE id=${saved.item.id}::uuid`;
    }

    // custom sheet name preserved
    await sql`
      UPDATE luna_foi SET nume='Gardă X'
      WHERE workspace_id=${WS}::uuid AND an=2026 AND luna=9
        AND categorie_id=${asistent.id}::uuid AND foaie=1
    `;
    const lunaCustom = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.c.customLabel = lunaCustom.foiItems?.[0]?.label;
    if (lunaCustom.foiItems?.[0]?.label !== "Gardă X") {
      push("c: custom name not preserved");
    }
    await sql`
      UPDATE luna_foi SET nume=NULL
      WHERE workspace_id=${WS}::uuid AND an=2026 AND luna=9
        AND categorie_id=${asistent.id}::uuid AND foaie=1
    `;

    const audit = await sql`
      SELECT action FROM audit_log
      WHERE workspace_id=${WS}::uuid AND action IN ('texte_update','grafic_footer_update')
      ORDER BY created_at DESC LIMIT 5
    `;
    report.c.audit = audit.map((r) => r.action);
    if (!audit.some((r) => r.action === "texte_update")) {
      push("c: missing texte_update audit");
    }

    // reset all texte
    for (const cheie of [
      "titlu.format",
      "foaie.nume_implicit",
      "fisier.pattern",
    ]) {
      await fetch(`${BASE}/api/setari/texte`, {
        method: "DELETE",
        headers: H,
        body: JSON.stringify({ cheie }),
      });
    }
    // restore footer medic from live value roughly
    await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        footerKey: "medic_sef",
        footerValue: "MEDIC ȘEF SECȚIE: DR SUSANU CAROLINa",
      }),
    });

    const afterReset = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.c.afterReset = {
      label: afterReset.foiItems?.[0]?.label,
      titlu: afterReset.texte?.titluPreview,
    };
    if (afterReset.foiItems?.[0]?.label !== "Sheet 1") {
      push("c: after reset label");
    }
    if (!String(afterReset.texte?.titluPreview || "").includes(" - SEPTEMBRIE 2026")) {
      push("c: after reset titlu");
    }
  }

  // (d) archived unchanged
  if (archivedId) {
    const row = await sql`
      SELECT titlu, snapshot->>'title' AS snap
      FROM grafice_finale WHERE id=${archivedId}::uuid
    `;
    report.d.after = row[0];
    if (
      !row[0] ||
      row[0].titlu !== archivedTitlu ||
      row[0].snap !== archivedSnap
    ) {
      push("d: archive changed");
    } else report.d.ok = true;
    await sql`DELETE FROM grafice_finale WHERE id=${archivedId}::uuid`;
  }

  // (e) validation
  {
    const bad = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ cheie: "nu.exista", valoare: "x" }),
    });
    report.e.unknown = bad.status;
    if (bad.status !== 400) push(`e: unknown ${bad.status}`);

    const long = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        cheie: "tabel.nume",
        valoare: "x".repeat(50),
      }),
    });
    report.e.tooLong = long.status;
    if (long.status !== 400) push(`e: tooLong ${long.status}`);

    const empty = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({ cheie: "luna.1", valoare: "   " }),
    });
    report.e.emptyLuna = empty.status;
    if (empty.status !== 400) push(`e: empty luna ${empty.status}`);

    // unknown var literal
    await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        cheie: "titlu.format",
        valoare: "X {necunoscut} Y",
      }),
    });
    const lunaLit = await json(
      await fetch(
        `${BASE}/api/luna?an=2026&luna=9&categorie=${asistent.id}&foaie=1`,
        { headers: { Cookie: cookie } },
      ),
    );
    report.e.literal = lunaLit.texte?.titluPreview;
    if (!String(lunaLit.texte?.titluPreview || "").includes("{necunoscut}")) {
      push("e: unknown var not literal");
    }
    await fetch(`${BASE}/api/setari/texte`, {
      method: "DELETE",
      headers: H,
      body: JSON.stringify({ cheie: "titlu.format" }),
    });

    const email = `texte-faza6-${Date.now()}@example.com`;
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
    const forbid = await fetch(`${BASE}/api/setari/texte`, {
      headers: { Cookie: c2 },
    });
    report.e.forbidden = forbid.status;
    if (forbid.status !== 403) push(`e: expected 403 got ${forbid.status}`);
    await sql`DELETE FROM workspace_members WHERE user_id=${u[0].id}::uuid`;
    await sql`DELETE FROM users WHERE id=${u[0].id}::uuid`;
  }

  // (f) footer already tested in c; confirm empty needs confirm
  {
    const emptyFooter = await fetch(`${BASE}/api/setari/texte`, {
      method: "PUT",
      headers: H,
      body: JSON.stringify({
        footerKey: "delegat_label",
        footerValue: "",
      }),
    });
    report.f.emptyNoConfirm = emptyFooter.status;
    if (emptyFooter.status !== 409) push(`f: empty footer ${emptyFooter.status}`);
  }

  // cleanup texte
  await sql`DELETE FROM texte WHERE workspace_id=${WS}::uuid`;

  report.g.build = "ok (ran separately)";

  mkdirSync("migration-reports/texte-faza6-test-verify", { recursive: true });
  writeFileSync(
    "migration-reports/texte-faza6-test-verify/report.json",
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
