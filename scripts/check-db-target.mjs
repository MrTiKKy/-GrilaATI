/**
 * Confirmă că DATABASE_URL din .env.local NU e baza principală (.env).
 * Afișează doar host-ul (fără parolă). Exit 1 dacă host-urile coincid.
 *
 * Usage: node --env-file=.env.local scripts/check-db-target.mjs
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function hostOf(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.host || null;
  } catch {
    return null;
  }
}

const root = resolve(import.meta.dirname, "..");
const mainEnv = loadEnvFile(resolve(root, ".env"));
const localEnv = loadEnvFile(resolve(root, ".env.local"));

const mainHost = hostOf(mainEnv.DATABASE_URL);
const localHost = hostOf(localEnv.DATABASE_URL ?? process.env.DATABASE_URL);

if (!localHost) {
  console.error("DATABASE_URL lipsește din .env.local");
  process.exit(1);
}
if (!mainHost) {
  console.error("DATABASE_URL lipsește din .env (referință principală)");
  process.exit(1);
}

console.log(`DB target (.env.local): ${localHost}`);
console.log(`DB main   (.env):       ${mainHost}`);

if (localHost === mainHost) {
  console.error(
    "REFUZAT: host-ul din .env.local e identic cu baza principală. Folosește branch-ul Neon.",
  );
  process.exit(1);
}

console.log("OK: host diferit de baza principală — scrierile pot continua pe branch.");
