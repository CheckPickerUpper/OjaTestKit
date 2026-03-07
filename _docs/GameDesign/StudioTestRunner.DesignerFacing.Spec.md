# Studio Test Runner — Designer-Facing Spec

> Living document. Last updated: 2026-03-07
> Status: **Draft — 13 decided, 0 open**

---

## What Is the Studio Test Runner?

A testing toolkit that executes TypeScript tests inside a real Roblox Studio instance and reports results to the terminal. Tests are written in the same `describe`/`it`/`expect` style as today's Jest tests, compiled to Lua by roblox-ts, synced into Studio via Rojo, and executed with full engine access — real `Vector3`, real services, real Instance hierarchy. Results flow back through the existing `rbx-studio-mcp` HTTP bridge and render as formatted pass/fail output in the developer's terminal. This eliminates the 1000+ lines of JavaScript polyfills that fake Roblox types in the current Jest setup.

### Decided
- **Framework:** Custom test framework written in roblox-ts (not raw Luau). ~200 lines of TypeScript providing describe/it/expect. Compiles to Lua and syncs into Studio like any other game module. Zero external dependencies.
- **Transport:** Reuse the existing `rbx-studio-mcp` HTTP bridge. Add `run_tests` as another command in the existing CommandDispatcher. One plugin, one port (9900), one process.
- **Migration:** Full replacement. All tests eventually run in Studio. One test runner, one truth, zero polyfills. Jest is phased out.
- **MCP integration:** Both terminal (`pnpm test:studio`) and MCP tool (`run_studio_tests`). Same underlying runner, two entry points. Claude Code can trigger tests inline.
- **File extension:** `.studio.ts` during migration period. Once Jest is fully replaced, drop the `.studio` suffix and use a standard extension (`.test.ts` or similar).
- **Test tree location:** Alongside source code. Tests compile into the same Rojo tree as their source (e.g., `ReplicatedStorage/TS/Content/Traits/Defcon1/_Tests_/Defcon1.studio`).
- **Discovery:** CLI-driven. The CLI resolves which files match the path pattern, maps them to DataModel paths, and tells Studio exactly which modules to run. Studio doesn't walk the tree.
- **Dual-run:** No. Studio tests and Jest tests are fundamentally separate files. Migration means rewriting `.unit.ts` → `.studio.ts` and deleting the old file.
- **Compilation:** Dedicated build step. `pnpm compile:tests` runs rbxtsc with a test-specific tsconfig that outputs to a test-specific directory.
- **Async:** Promise-aware. If `it()` callback returns a Promise, the runner awaits it. Synchronous tests work as-is. No special syntax needed.
- **Isolation:** Auto-sandbox for Instance cleanup. Framework provides a temporary Folder per suite that's destroyed after. Level 1 tests (DI containers) don't use it. Level 2 tests (real DataModel) parent Instances into the sandbox for automatic cleanup.
- **Watch mode:** Yes, as its own command (`pnpm test:studio:watch`). Watches compiled output, re-triggers Studio execution on change.

---

## Developer Journey

### 1. Writing a Test

The developer writes a test file next to the code it tests, using the same `describe`/`it`/`expect` pattern they already know. The test imports real game modules — traits, scalars, effects, services — with no mock setup required.

```
Content/Traits/Defcon1/
  ├── Defcon1.Trait.ts
  └── _Tests_/
      └── Defcon1.studio.ts    ← runs in real Studio
```

`.studio.ts` during migration (while Jest coexists). Once Jest is fully replaced, the `.studio` suffix drops to a standard extension. Studio tests and Jest tests are separate files — no dual-running.

### 2. Running Tests

The developer runs a terminal command. The runner compiles tests, tells Studio to execute them, and streams results back.

```
pnpm test:studio                          # Run all Studio tests
pnpm test:studio Content/Traits           # Run tests matching a path pattern
pnpm test:studio --watch                  # Re-run on file change
```

CLI communicates through the existing MCP bridge (port 9900). Studio must be open with the plugin active. CLI detects "no Studio connected" and gives a clear error message.

### 3. Reading Results

Results appear in the terminal with the same visual structure as Jest — suite names, individual test pass/fail, durations, error messages with stack traces, and a summary line.

```
PASS  Content/Traits/Defcon1
  DEFCON 1 Trait
    ✓ has correct ID (1ms)
    ✓ grants both bonuses when Health.Low tag is present (3ms)
    ✗ toggles when health crosses low threshold (2ms)
      Expected: 1.35
      Received: 1

Tests: 11 passed, 1 failed, 12 total
Time:  0.847s
```

Both terminal and MCP. `pnpm test:studio` for manual runs. `run_studio_tests` MCP tool for Claude Code inline execution.

### 4. Migration Path

Existing Jest tests that only use pure logic (scalars, effects, tags) could migrate to Studio tests to drop the polyfill dependency. Tests that genuinely benefit from Node.js speed (no Roblox types at all) stay in Jest.

Full replacement. All tests migrate to Studio over time. Jest is phased out — no two-tier maintenance burden. When you type `pnpm test`, it means Studio.

---

## Test Framework

The test framework provides `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` inside Studio. Tests are TypeScript, compiled to Lua, and execute in the Luau VM with full engine access.

### API Surface

| Function | Purpose |
|----------|---------|
| `describe(name, fn)` | Group tests into a named suite |
| `it(name, fn)` | Define a single test case |
| `expect(value)` | Begin an assertion chain |
| `beforeEach(fn)` / `afterEach(fn)` | Per-test setup/teardown |
| `beforeAll(fn)` / `afterAll(fn)` | Per-suite setup/teardown |

### Matchers

| Matcher | Purpose |
|---------|---------|
| `.toBe(expected)` | Strict equality |
| `.toEqual(expected)` | Deep equality |
| `.toBeDefined()` / `.toBeUndefined()` | Nil checks |
| `.toBeTruthy()` / `.toBeFalsy()` | Truthiness |
| `.toBeGreaterThan(n)` / `.toBeLessThan(n)` | Numeric comparison |
| `.toContain(item)` | Array/set membership |
| `.toHaveLength(n)` | Array/string length |
| `.toThrow()` | Error assertion |
| `.not` | Negate any matcher |
| `.toApprox(n, precision?)` | Floating point comparison (custom, matches existing Jest matcher) |

Custom test framework authored in roblox-ts (~200 lines). Compiles to Lua alongside game code. Zero external dependencies — no jest-roblox, no testez. Lives in the game's source tree as an infrastructure module (e.g., `Infrastructure/TestFramework/`).

Promise-aware. If `it()` callback returns a Promise, the runner awaits it before marking pass/fail. No special syntax — just return a Promise from your test function.

### Test Isolation

Each test suite (each `describe` block at root level) should run in a clean state.

Two levels of isolation:
- **Level 1 (unit):** Tests create their own DI containers via factory functions. Containers are local variables — garbage collected when the test ends. No DataModel involvement. Same pattern as current Jest tests, minus the polyfills.
- **Level 2 (integration/E2E):** Framework provides an auto-sandbox Folder per suite. Tests that create Instances (spawn NPCs, create Parts) parent them into the sandbox. After the suite completes, the sandbox is destroyed — all children gone automatically.

---

## Test Discovery

The runner needs to find which ModuleScripts are test files and which aren't.

CLI-driven discovery. The CLI resolves which `.studio.ts` files match the user's path pattern (e.g., `Content/Traits/**`), maps source paths to DataModel paths using the Rojo tree, and sends those exact ModuleScript paths to Studio. Studio requires and runs what it's told — no tree walking.

---

## Test Compilation

Test files must compile from TypeScript to Lua and sync into Studio via Rojo. Currently, test files are excluded from `tsconfig.json` and only compile under Jest's `ts-jest` transformer.

Dedicated build step. `pnpm compile:tests` runs rbxtsc with a test-specific tsconfig (`tsconfig.studio-tests.json`). Test compilation is isolated from game compilation — test build errors can't break the game build.

Compiled tests land alongside their source in the Rojo tree: `ReplicatedStorage/TS/Content/Traits/Defcon1/_Tests_/Defcon1.studio`. Mirrors the source folder structure exactly.

---

## Communication Pipeline

```
Terminal CLI
  → [trigger mechanism] →
    Studio Plugin receives "run tests" command
      → Discovers test ModuleScripts
      → Executes each through the test framework
      → Collects structured results (JSON)
  ← HTTP POST results back ←
Terminal CLI formats and prints results
```

Reuses the existing `rbx-studio-mcp` HTTP bridge on port 9900. `run_tests` is added as another command in the existing CommandDispatcher. One plugin, one port, one process.

### Result Wire Format

```json
{
  "totalTests": 47,
  "passed": 45,
  "failed": 2,
  "skipped": 0,
  "duration": 0.847,
  "suites": [
    {
      "name": "DEFCON 1 Trait",
      "file": "Content/Traits/Defcon1/_Tests_/Defcon1.studio",
      "tests": [
        { "name": "has correct ID", "status": "pass", "duration": 0.001 },
        { "name": "grants bonuses at low HP", "status": "fail", "duration": 0.003,
          "error": "Expected 1.35, got 1",
          "traceback": "Defcon1.studio:42" }
      ]
    }
  ]
}
```

---

## CLI Reporter

A Node.js process that receives structured JSON results and formats them for the terminal.

| Feature | Description |
|---------|-------------|
| **Color output** | Green for pass, red for fail, yellow for skip |
| **Summary line** | `Tests: N passed, N failed, N total` |
| **Duration** | Per-test and total wall time |
| **Error details** | Expected vs received, Luau stack trace |
| **Exit code** | 0 if all pass, 1 if any fail |
| **Filter echo** | Shows which pattern was used: `Pattern: Content/Traits/**` |

Yes. `pnpm test:studio:watch` watches compiled output and re-triggers Studio execution on change. Separate command from `pnpm test:studio`.

---

## What's Not Built Yet

| Gap | What's Needed |
|-----|---------------|
| Luau test framework | `describe`/`it`/`expect` implementation that runs in Studio and collects structured results |
| Test discovery | Mechanism to find test ModuleScripts in the DataModel |
| `run_tests` command | Either an MCP tool or direct HTTP endpoint that triggers test execution |
| Luau test runner | Orchestrator that discovers tests, runs them through the framework, collects results |
| CLI reporter | Node.js process that receives JSON results and prints formatted terminal output |
| Test compilation config | tsconfig + Rojo mapping that gets `.studio.ts` files into Studio |
| Studio plugin extension | Either extend `rbx-studio-mcp` plugin or create a dedicated test plugin |
| `pnpm test:studio` script | Entry point that orchestrates: compile → trigger → receive → report |

---

## External Prerequisites

None — this feature is fully self-contained. It builds on the existing `rbx-studio-mcp` infrastructure and standard Roblox Studio + Rojo toolchain.

---

## Big Design Decisions Still Open

1. ~~**Custom framework vs jest-roblox?**~~ → Custom roblox-ts framework, ~200 lines, zero dependencies.
2. ~~**Shared transport or standalone?**~~ → Reuse `rbx-studio-mcp` HTTP bridge, add `run_tests` command.
3. ~~**Test file convention?**~~ → `.studio.ts` during migration. CLI-driven discovery by path pattern.
4. ~~**Where do compiled tests live?**~~ → Alongside source in ReplicatedStorage, mirroring folder structure.
5. ~~**Two-tier testing or full replacement?**~~ → Full replacement. Jest phased out.
6. ~~**MCP integration?**~~ → Both terminal + MCP tool.
7. ~~**Async test support?**~~ → Promise-aware. Runner awaits returned Promises automatically.
8. ~~**Watch mode?**~~ → Yes, as `pnpm test:studio:watch`. Separate command.

---

## Developer Reference

| What | Where |
|------|-------|
| Current Jest config | `jest.config.js` |
| Current polyfills | `_tests/setup/roblox-types.ts`, `roblox-globals.ts`, `rbxts-polyfills.ts` |
| MCP bridge (Rust) | `~/dev/ai-lab/MCP's/rbx-studio-mcp/src/` |
| MCP plugin (Luau) | `~/dev/ai-lab/MCP's/rbx-studio-mcp/plugin/src/` |
| MCP spec + tasks | `_docs/Plans/StudioMCP.DependencyGraph.md`, `StudioMCP.Tasks.md` |
| roblox-ts runtime | `include/RuntimeLib.lua` |
| Rojo build tree | `build.project.json` |
| jest-roblox archive | `_reference/ninja-revival-archive-lua/DevPackages/_Index/jsdotlua_jest-*` |
| Testing architecture | `_docs/Architecture/Testing/Testing.Architecture.md` |
| Test factories | `_tests/factories/` |
