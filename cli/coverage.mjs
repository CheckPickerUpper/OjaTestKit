#!/usr/bin/env node

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, relative, basename, dirname } from "node:path";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const WHITE = "\x1b[37m";
const BG_GREEN = "\x1b[42m";
const BG_RED = "\x1b[41m";
const BG_YELLOW = "\x1b[43m";
const BLACK = "\x1b[30m";

function walkTestDirs(dir, config, results = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = join(dir, entry.name);
    if (config.ignoreDirs.includes(entry.name)) continue;

    if (entry.name === config.testDirName) {
      results.push(fullPath);
    } else {
      walkTestDirs(fullPath, config, results);
    }
  }

  return results;
}

function getTestFiles(testsDir) {
  try {
    return readdirSync(testsDir).filter((f) => f.endsWith(".ts"));
  } catch {
    return [];
  }
}

function getModuleName(testsDir, srcRoot) {
  const moduleDir = dirname(testsDir);
  return relative(srcRoot, moduleDir);
}

function categorizeTests(files, studioPattern) {
  const studio = files.filter((f) => f.endsWith(studioPattern));
  const unit = files.filter((f) => f.endsWith(".unit.ts"));
  const integration = files.filter((f) => f.endsWith(".integration.ts"));
  const e2e = files.filter((f) => f.endsWith(".e2e.ts"));
  const other = files.filter(
    (f) =>
      !f.endsWith(studioPattern) &&
      !f.endsWith(".unit.ts") &&
      !f.endsWith(".integration.ts") &&
      !f.endsWith(".e2e.ts"),
  );
  return { studio, unit, integration, e2e, other };
}

function buildCoverageData(srcRoot, config) {
  const testDirs = walkTestDirs(srcRoot, config);
  const modules = [];

  for (const testsDir of testDirs) {
    const files = getTestFiles(testsDir);
    if (files.length === 0) continue;

    const modulePath = getModuleName(testsDir, srcRoot);
    const categories = categorizeTests(files, config.studioPattern);

    modules.push({
      path: modulePath,
      hasStudio: categories.studio.length > 0,
      studioFiles: categories.studio,
      unitFiles: categories.unit,
      integrationFiles: categories.integration,
      e2eFiles: categories.e2e,
      otherFiles: categories.other,
      totalFiles: files.length,
    });
  }

  modules.sort((a, b) => a.path.localeCompare(b.path));

  const covered = modules.filter((m) => m.hasStudio).length;
  const total = modules.length;
  const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;

  return { modules, covered, total, percentage };
}

function renderProgressBar(percentage, width = 30) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);

  let color = RED;
  if (percentage >= 80) color = GREEN;
  else if (percentage >= 50) color = YELLOW;

  return `${color}${bar}${RESET} ${BOLD}${percentage}%${RESET}`;
}

function renderTerminal(data) {
  const { modules, covered, total, percentage } = data;

  console.log();
  console.log(`${BOLD}${CYAN}  Studio Test Coverage${RESET}`);
  console.log(`${DIM}  ${"─".repeat(50)}${RESET}`);
  console.log();
  console.log(`  ${renderProgressBar(percentage)}`);
  console.log(`  ${GREEN}${covered} covered${RESET} ${DIM}/${RESET} ${total} modules with tests`);
  console.log();

  const covered_modules = modules.filter((m) => m.hasStudio);
  const uncovered_modules = modules.filter((m) => !m.hasStudio);

  if (covered_modules.length > 0) {
    console.log(`  ${GREEN}${BOLD}Covered${RESET}`);
    for (const mod of covered_modules) {
      const studioCount = mod.studioFiles.length;
      const badge = `${BG_GREEN}${BLACK} ${studioCount} studio ${RESET}`;
      const extras = [];
      if (mod.unitFiles.length > 0) extras.push(`${mod.unitFiles.length} unit`);
      if (mod.integrationFiles.length > 0) extras.push(`${mod.integrationFiles.length} integration`);
      if (mod.e2eFiles.length > 0) extras.push(`${mod.e2eFiles.length} e2e`);
      const extraStr = extras.length > 0 ? `  ${DIM}+ ${extras.join(", ")}${RESET}` : "";
      console.log(`  ${GREEN}\u2713${RESET} ${mod.path}  ${badge}${extraStr}`);
    }
    console.log();
  }

  if (uncovered_modules.length > 0) {
    console.log(`  ${RED}${BOLD}Not covered${RESET}`);
    for (const mod of uncovered_modules) {
      const extras = [];
      if (mod.unitFiles.length > 0) extras.push(`${YELLOW}${mod.unitFiles.length} unit${RESET}`);
      if (mod.integrationFiles.length > 0)
        extras.push(`${YELLOW}${mod.integrationFiles.length} integration${RESET}`);
      if (mod.e2eFiles.length > 0) extras.push(`${YELLOW}${mod.e2eFiles.length} e2e${RESET}`);
      const extraStr = extras.length > 0 ? `  ${DIM}(has ${RESET}${extras.join(", ")}${DIM})${RESET}` : "";
      console.log(`  ${RED}\u2717${RESET} ${mod.path}${extraStr}`);
    }
    console.log();
  }

  console.log(`${DIM}  ${"─".repeat(50)}${RESET}`);

  const unitOnly = uncovered_modules.filter((m) => m.unitFiles.length > 0);
  if (unitOnly.length > 0) {
    console.log(
      `  ${YELLOW}${unitOnly.length} modules${RESET} have unit tests that could be ported to studio tests`,
    );
  }
  console.log();
}

function renderHTML(data, outputPath) {
  const { modules, covered, total, percentage } = data;

  let barColor = "#ef4444";
  if (percentage >= 80) barColor = "#16a34a";
  else if (percentage >= 50) barColor = "#f59e0b";

  const coveredRows = modules
    .filter((m) => m.hasStudio)
    .map((mod) => {
      const badges = [];
      badges.push(`<span class="badge studio">${mod.studioFiles.length} studio</span>`);
      if (mod.unitFiles.length > 0)
        badges.push(`<span class="badge unit">${mod.unitFiles.length} unit</span>`);
      if (mod.integrationFiles.length > 0)
        badges.push(`<span class="badge integration">${mod.integrationFiles.length} integration</span>`);
      if (mod.e2eFiles.length > 0)
        badges.push(`<span class="badge e2e">${mod.e2eFiles.length} e2e</span>`);
      return `<tr class="covered"><td class="icon">&#10003;</td><td class="path">${mod.path}</td><td class="badges">${badges.join(" ")}</td></tr>`;
    })
    .join("\n");

  const uncoveredRows = modules
    .filter((m) => !m.hasStudio)
    .map((mod) => {
      const badges = [];
      if (mod.unitFiles.length > 0)
        badges.push(`<span class="badge unit">${mod.unitFiles.length} unit</span>`);
      if (mod.integrationFiles.length > 0)
        badges.push(`<span class="badge integration">${mod.integrationFiles.length} integration</span>`);
      if (mod.e2eFiles.length > 0)
        badges.push(`<span class="badge e2e">${mod.e2eFiles.length} e2e</span>`);
      return `<tr class="uncovered"><td class="icon">&#10007;</td><td class="path">${mod.path}</td><td class="badges">${badges.join(" ")}</td></tr>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Studio Test Coverage</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 2rem; }
  .container { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 1.5rem; color: #fafafa; }
  .summary { background: #171717; border: 1px solid #262626; border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem; }
  .stats { display: flex; gap: 2rem; align-items: center; margin-bottom: 1rem; }
  .stat-number { font-size: 2.5rem; font-weight: 700; color: ${barColor}; }
  .stat-label { font-size: 0.875rem; color: #a3a3a3; }
  .stat-detail { font-size: 1rem; color: #d4d4d4; }
  .progress-track { width: 100%; height: 8px; background: #262626; border-radius: 4px; overflow: hidden; }
  .progress-fill { height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.3s; }
  .section { margin-bottom: 1.5rem; }
  .section-title { font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; padding-left: 0.5rem; }
  .section-title.covered-title { color: #16a34a; }
  .section-title.uncovered-title { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #1a1a1a; }
  tr:hover { background: #171717; }
  td { padding: 0.625rem 0.5rem; vertical-align: middle; }
  .icon { width: 2rem; text-align: center; font-size: 1rem; }
  .covered .icon { color: #16a34a; }
  .uncovered .icon { color: #ef4444; }
  .path { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8125rem; color: #d4d4d4; }
  .badges { text-align: right; white-space: nowrap; }
  .badge { display: inline-block; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 500; margin-left: 0.25rem; }
  .badge.studio { background: #052e16; color: #4ade80; border: 1px solid #16a34a; }
  .badge.unit { background: #1e1b4b; color: #a5b4fc; border: 1px solid #4f46e5; }
  .badge.integration { background: #451a03; color: #fdba74; border: 1px solid #ea580c; }
  .badge.e2e { background: #3b0764; color: #d8b4fe; border: 1px solid #9333ea; }
  .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #262626; font-size: 0.75rem; color: #525252; }
</style>
</head>
<body>
<div class="container">
  <h1>Studio Test Coverage</h1>
  <div class="summary">
    <div class="stats">
      <div>
        <div class="stat-number">${percentage}%</div>
        <div class="stat-label">coverage</div>
      </div>
      <div>
        <div class="stat-detail"><strong>${covered}</strong> of <strong>${total}</strong> modules have studio tests</div>
        <div class="stat-detail" style="color: #737373; margin-top: 0.25rem;">${total - covered} modules remaining</div>
      </div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width: ${percentage}%"></div>
    </div>
  </div>

  ${
    coveredRows
      ? `<div class="section">
    <div class="section-title covered-title">Covered</div>
    <table>${coveredRows}</table>
  </div>`
      : ""
  }

  ${
    uncoveredRows
      ? `<div class="section">
    <div class="section-title uncovered-title">Not Covered</div>
    <table>${uncoveredRows}</table>
  </div>`
      : ""
  }

  <div class="footer">Generated ${new Date().toISOString().split("T")[0]} by @ojagamez/oja-test-kit</div>
</div>
</body>
</html>`;

  writeFileSync(outputPath, html);
}

const DEFAULTS = {
  scanRoots: ["src"],
  testDirName: "_Tests_",
  studioPattern: ".studio.ts",
  ignoreDirs: ["node_modules", "out", ".git", "dist"],
};

function loadConfig() {
  const configPath = join(process.cwd(), "oja-test.config.json");
  if (!existsSync(configPath)) return DEFAULTS;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(raw);
    return { ...DEFAULTS, ...userConfig.coverage };
  } catch {
    console.error(`Failed to parse oja-test.config.json`);
    return DEFAULTS;
  }
}

const config = loadConfig();

const args = process.argv.slice(2);
const htmlFlag = args.includes("--html");
const htmlPath = htmlFlag
  ? args[args.indexOf("--html") + 1] || "coverage.html"
  : null;

const roots = config.scanRoots.map((r) => join(process.cwd(), r));
const validRoots = roots.filter((r) => existsSync(r));

if (validRoots.length === 0) {
  console.error(`No scan roots found. Checked: ${config.scanRoots.join(", ")}`);
  process.exit(1);
}

let allModules = [];
for (const root of validRoots) {
  const data = buildCoverageData(root, config);
  allModules.push(...data.modules);
}

allModules.sort((a, b) => a.path.localeCompare(b.path));
const covered = allModules.filter((m) => m.hasStudio).length;
const total = allModules.length;
const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;
const data = { modules: allModules, covered, total, percentage };

renderTerminal(data);

if (htmlPath) {
  const outputPath = join(process.cwd(), htmlPath);
  renderHTML(data, outputPath);
  console.log(`  ${CYAN}HTML report:${RESET} ${outputPath}`);
  console.log();
}
