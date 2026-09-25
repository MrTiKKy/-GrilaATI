import { spawn } from "child_process";
import { resolve } from "path";

const port = process.argv[2] || "3002";
const child = spawn(
  process.execPath,
  [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", port],
  {
    cwd: resolve("."),
    stdio: "inherit",
    env: process.env,
  },
);
child.on("exit", (code) => process.exit(code ?? 1));
