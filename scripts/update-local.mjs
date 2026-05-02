#!/usr/bin/env node
// Pull latest dashboard code, install deps, and stop the running server so
// Termux:Boot (or your manual `pnpm run start:local`) restarts it with the
// new build.
//
// Usage (on the tablet/boat device, in Termux):
//   pnpm run update
//
// Tolerant of:
//   - pkill returning non-zero when no process is running
//   - being run when there's nothing new to pull

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function run(cmd, args, { allowFailure = false } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd: repoRoot });
    child.on("exit", (code) => {
      if (code !== 0 && !allowFailure) {
        console.error(`\n✗ ${cmd} ${args.join(" ")} failed (exit ${code}).`);
        process.exit(code ?? 1);
      }
      resolve(code ?? 0);
    });
    child.on("error", (err) => {
      if (!allowFailure) {
        console.error(`\n✗ Failed to run ${cmd}: ${err.message}`);
        process.exit(1);
      }
      resolve(1);
    });
  });
}

async function main() {
  console.log("\n[1/3] git pull…");
  await run("git", ["pull", "--ff-only"]);

  console.log("\n[2/3] pnpm install…");
  await run("pnpm", ["install"]);

  console.log("\n[3/3] Stopping running server (if any)…");
  // pkill exits 1 when no process matches — that's fine.
  const code = await run("pkill", ["-f", "start-local"], { allowFailure: true });
  if (code === 0) {
    console.log("    ✓ Server stopped. Termux:Boot will restart it on next boot,");
    console.log("      or run `pnpm run start:local` (or :fast) to start it now.");
  } else {
    console.log("    (no running server to stop — start it with `pnpm run start:local`)");
  }

  console.log("\n✓ Update complete.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
