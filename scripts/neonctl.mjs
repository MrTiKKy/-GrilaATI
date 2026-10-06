#!/usr/bin/env node
/** Wrapper: rulează neonctl din afara sandbox-ului (via node allowlist). */
import { spawnSync } from "child_process";
import { resolve } from "path";

const args = process.argv.slice(2);
const neonctl = resolve("node_modules/.bin/neonctl");
const r = spawnSync(neonctl, args, {
  stdio: "inherit",
  env: process.env,
  cwd: resolve("."),
});
process.exit(r.status ?? 1);
