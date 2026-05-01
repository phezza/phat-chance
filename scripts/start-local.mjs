#!/usr/bin/env node
// Build navdash + start the api-server on a single port for local boat-side use.
// Usage:
//   node scripts/start-local.mjs            # builds and serves on PORT (default 3000)
//   PORT=8080 node scripts/start-local.mjs  # custom port
//   SKIP_BUILD=1 node scripts/start-local.mjs  # skip rebuild (faster restart)

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const PORT = process.env.PORT ?? "3000";
const SKIP_BUILD = process.env.SKIP_BUILD === "1";

const navdashDist = path.join(repoRoot, "artifacts", "navdash", "dist", "public");
const apiServerDir = path.join(repoRoot, "artifacts", "api-server");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: false, ...opts });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    child.on("error", reject);
  });
}

function getLanIPs() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] ?? []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

async function main() {
  const buildId = process.env.BUILD_ID ?? String(Date.now());
  if (!SKIP_BUILD) {
    console.log(`\n[1/3] Building navdash UI (build ${buildId})...`);
    await run("pnpm", ["--filter", "@workspace/navdash", "run", "build"], {
      cwd: repoRoot,
      // PORT is required by vite.config.ts at load time but unused for `vite build`.
      env: { ...process.env, BASE_PATH: "/", NODE_ENV: "production", PORT: PORT, BUILD_ID: buildId },
    });

    console.log("\n[2/3] Building api-server...");
    await run("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: "production" },
    });
  } else {
    console.log("[skip] SKIP_BUILD=1, using existing build output");
  }

  if (!fs.existsSync(navdashDist)) {
    console.error(`\nERROR: navdash build output not found at ${navdashDist}`);
    console.error("Try running again without SKIP_BUILD=1.");
    process.exit(1);
  }

  // Stamp the service worker with the same build ID baked into the JS bundle
  // so PWA clients pick up the new build instead of serving stale cached code.
  const swPath = path.join(navdashDist, "sw.js");
  if (fs.existsSync(swPath)) {
    const original = fs.readFileSync(swPath, "utf8");
    const stamped = original.replace(/__BUILD_ID__/g, buildId);
    if (stamped !== original) {
      fs.writeFileSync(swPath, stamped);
      console.log(`[sw] Stamped service worker with build ID ${buildId}`);
    } else {
      console.log(`[sw] No __BUILD_ID__ placeholder found in sw.js (already stamped or template missing)`);
    }
  } else {
    console.warn(`[sw] WARNING: sw.js not found at ${swPath} — PWA cache will not refresh!`);
  }

  console.log(`\n[3/3] Starting Phat Chance on port ${PORT}...`);
  const ips = getLanIPs();
  console.log("\n========================================================");
  console.log("  Phat Chance is running. Open from any device on this WiFi:");
  console.log(`    http://localhost:${PORT}`);
  for (const ip of ips) console.log(`    http://${ip}:${PORT}`);
  console.log("========================================================\n");

  await run("node", ["--enable-source-maps", "./dist/index.mjs"], {
    cwd: apiServerDir,
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT,
      STATIC_DIR: navdashDist,
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
