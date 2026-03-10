#!/usr/bin/env node

import { execSync, spawn, spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { resolve, join } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--");
const tagFlagIndex = args.indexOf("--tag");
const tagFlag = tagFlagIndex >= 0 ? args[tagFlagIndex + 1] : undefined;
const flagValues = new Set(tagFlag !== undefined ? [tagFlag] : []);
const filterFlag = args.find((a) => !a.startsWith("-") && !flagValues.has(a));
const projectRoot = process.cwd();
const BRIDGE_PORT = 9900;

const STUDIO_TESTS_TSCONFIG = "tsconfig.studio-tests.json";
const DEFAULT_TSCONFIG_CONTENT = JSON.stringify(
  {
    extends: "./tsconfig-base.json",
    compilerOptions: {
      rootDir: "src",
      outDir: "out",
      incremental: true,
      tsBuildInfoFile: "out/tsconfig.studio-tests.tsbuildinfo",
    },
    include: ["src/**/_Tests_/**/*.studio.ts"],
  },
  null,
  2,
);

function ensureTsconfig() {
  const tsconfigPath = resolve(projectRoot, STUDIO_TESTS_TSCONFIG);
  if (existsSync(tsconfigPath)) return;

  const basePath = resolve(projectRoot, "tsconfig-base.json");
  if (!existsSync(basePath)) {
    console.error("No tsconfig-base.json found; cannot generate studio test tsconfig.");
    process.exit(1);
  }

  console.log(`Creating ${STUDIO_TESTS_TSCONFIG}...`);
  writeFileSync(tsconfigPath, DEFAULT_TSCONFIG_CONTENT + "\n");
}

function findRojoProject() {
  const candidates = ["build.project.json", "default.project.json"];
  for (const name of candidates) {
    if (existsSync(resolve(projectRoot, name))) return name;
  }
  return null;
}

function compile() {
  const rojoProject = findRojoProject();
  const rojoFlag = rojoProject ? ` --rojo ${rojoProject}` : "";
  const cmd = `rbxtsc --project ${STUDIO_TESTS_TSCONFIG}${rojoFlag}`;

  console.log(`Compiling: ${cmd}`);
  const result = spawnSync(cmd, { shell: true, stdio: "inherit", cwd: projectRoot });
  if (result.status !== 0) {
    console.error("Compilation failed.");
    process.exit(1);
  }
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBridge() {
  if (await isPortOpen(BRIDGE_PORT)) return null;

  console.log("Bridge not running, starting rbx-studio-bridge...");
  const bridgeProcess = spawn("rbx-studio-bridge", ["--port", String(BRIDGE_PORT)], {
    stdio: "ignore",
    detached: true,
    cwd: projectRoot,
  });
  bridgeProcess.unref();

  for (let attempt = 0; attempt < 20; attempt++) {
    await sleep(250);
    if (await isPortOpen(BRIDGE_PORT)) {
      console.log("Bridge ready on port " + BRIDGE_PORT);
      return bridgeProcess;
    }
  }

  console.error("Bridge failed to start within 5 seconds.");
  bridgeProcess.kill();
  process.exit(1);
}

function runTests() {
  const filterArgs = filterFlag ? ` --filter ${filterFlag}` : "";
  const tagArgs = tagFlag ? ` --tag ${tagFlag}` : "";
  const cmd = `oja-test-runner${filterArgs}${tagArgs}`;

  const result = spawnSync(cmd, { shell: true, stdio: "inherit", cwd: projectRoot });
  process.exit(result.status ?? 1);
}

ensureTsconfig();
compile();
const bridgeProcess = await ensureBridge();
runTests();
