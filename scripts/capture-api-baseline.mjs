/**
 * Capturează răspunsuri API înainte/după migrare (necesită server + parolă).
 *
 * Usage:
 *   CAPTURE_PASSWORD='...' node scripts/capture-api-baseline.mjs before
 *   CAPTURE_PASSWORD='...' node scripts/capture-api-baseline.mjs after
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const BASE = process.env.CAPTURE_BASE || "http://127.0.0.1:3000";
const EMAIL = process.env.CAPTURE_EMAIL || "popanicol24@gmail.com";
const PASSWORD = process.env.CAPTURE_PASSWORD;
const label = process.argv[2] === "after" ? "after-api" : "before-api";

if (!PASSWORD) {
  console.error("Set CAPTURE_PASSWORD");
  process.exit(1);
}

const outDir = resolve(import.meta.dirname, `../migration-reports/${label}`);
mkdirSync(outDir, { recursive: true });

function cookieFrom(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length) {
    return raw.map((c) => c.split(";")[0]).join("; ");
  }
  const single = res.headers.get("set-cookie");
  if (!single) return "";
  return single.split(",").map((p) => p.split(";")[0].trim()).filter(Boolean).join("; ");
}

async function main() {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await loginRes.text();
  if (!loginRes.ok) {
    console.error("Login failed", loginRes.status, loginBody.slice(0, 200));
    process.exit(1);
  }
  const cookie = cookieFrom(loginRes);
  if (!cookie.includes("grila_session")) {
    console.error("No session cookie");
    process.exit(1);
  }

  const now = new Date();
  const months = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ an: d.getFullYear(), luna: d.getMonth() + 1 });
  }

  const tabs = ["asistenti", "infirmiere"];
  const index = [];

  async function get(path) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Cookie: cookie },
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

  async function save(name, path) {
    const result = await get(path);
    const file = `${name}.json`;
    writeFileSync(resolve(outDir, file), JSON.stringify(result, null, 2));
    index.push({ name, path, status: result.status });
    console.log(`${result.status} ${path} -> ${file}`);
    return result;
  }

  // Discover foils per month/tab from luna responses
  for (const { an, luna } of months) {
    for (const tab of tabs) {
      const first = await save(
        `luna_${an}_${String(luna).padStart(2, "0")}_${tab}_foaie1`,
        `/api/luna?an=${an}&luna=${luna}&tab=${tab}&foaie=1`,
      );
      const foi = Array.isArray(first.json?.foi) ? first.json.foi : [1];
      for (const foaie of foi) {
        if (Number(foaie) === 1) continue;
        await save(
          `luna_${an}_${String(luna).padStart(2, "0")}_${tab}_foaie${foaie}`,
          `/api/luna?an=${an}&luna=${luna}&tab=${tab}&foaie=${foaie}`,
        );
      }
    }
  }

  await save(`concedii_${now.getFullYear()}`, `/api/concedii?an=${now.getFullYear()}`);
  await save("grafice", "/api/grafice");
  await save("ore_osd", "/api/ore-osd");
  await save("grafic_footer", "/api/grafic-footer");

  writeFileSync(resolve(outDir, "_index.json"), JSON.stringify({ label, generatedAt: new Date().toISOString(), index }, null, 2));
  console.log(`Saved ${index.length} responses in migration-reports/${label}/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
