# Studio Test Runner: Dependency Graph

> Generated: 2026-03-07
> Source: `_docs/GameDesign/StudioTestRunner.DesignerFacing.Spec.md`

## Visual Graph

```
Phase 1 (Framework) ──┐
                      ├──► Phase 3 (Plugin) ──► Phase 4 (Rust MCP) ──► Phase 5 (CLI) ──► Phase 6 (Watch)
Phase 2 (Compile)  ───┘
```

## Phase Dependencies (strict)

| Phase | Name | Type | Blocked By | Unblocks |
|-------|------|------|------------|----------|
| 0 | External Prerequisites | n/a | nothing | n/a |
| 1 | Test Framework (roblox-ts) | Build | nothing | 3 |
| 2 | Test Compilation Config | Config | nothing | 3 |
| 3 | Plugin: run_tests Command | Build + Integrate | 1, 2 | 4 |
| 4 | MCP Server: run_tests Tool | Build + Integrate | 3 | 5 |
| 5 | CLI Runner + Reporter | Build | 4 | 6 |
| 6 | Watch Mode + Migration | Build | 5 | done |

## Phase 0: External Prerequisites

None. This feature is fully self-contained. It builds on the existing `rbx-studio-mcp` infrastructure (port 9900) and the standard Roblox Studio + Rojo toolchain.

## Critical Path

```
Phase 1 → Phase 3 → Phase 4 → Phase 5 → Phase 6
```

5 phases on the critical path. Phase 2 runs in parallel with Phase 1.

## Parallel Opportunities

| Parallel Group | Phases | Reason |
|----------------|--------|--------|
| Foundation | 1 + 2 | Framework code and tsconfig are independent of each other |
| After Slice 2 | Phase 4 can start while Phase 3 is being manually tested | Plugin command is testable standalone via curl |

## What Already Exists (Integration, Not Build)

| Shared System | What Test Runner Needs | Effort |
|---------------|------------------------|--------|
| `rbx-studio-mcp` HTTP bridge | Add `run_tests` tool via existing `dispatch_to_plugin` pattern | Integrate |
| `rbx-studio-mcp` Luau plugin | Add `run_tests` case to `CommandDispatcher.dispatch()` | Integrate |
| `rbx-studio-mcp` HTTP routes | No changes. Reuses `/request` + `/response` as-is | Zero |
| `build.project.json` Rojo tree | Tests compile alongside source. Rojo already maps `out/Shared/ReplicatedStorage` to `ReplicatedStorage/TS` | Zero |
| `tsconfig-base.json` path aliases | Studio tests use the same `@Traits/*`, `@Scalars/*`, etc. | Zero |
| `_tests/factories/` DI factories | Studio tests import `CreateTestContainersWithGameplaySet()` directly. They compile as game modules in Studio. | Zero |
| `include/RuntimeLib.lua` | `TS.import` resolution for compiled test modules | Zero |

## Milestone Markers

| After Phase | You Can... |
|-------------|-----------|
| 1 | Write `.studio.ts` files using `describe`/`it`/`expect` that type-check |
| 2 | Compile tests via `pnpm compile:tests` and see them in the Rojo tree |
| 3 | Trigger test execution from curl/HTTP and see JSON results in Studio output |
| 4 | Trigger tests via MCP tool (`run_studio_tests`) from Claude Code |
| 5 | Run `pnpm test:studio` and see formatted pass/fail in terminal |
| 6 | Run `pnpm test:studio:watch` for live re-execution on file changes |

---

## Vertical Slices

### Slice 1: Framework + Compilation (tasks 1.1 through 1.4, 2.1 through 2.3)
**What it proves:** A `.studio.ts` test file compiles to Lua, syncs into Studio via Rojo, and the test framework (`describe`/`it`/`expect`) can be required by another module.
**You can verify by:** Open Studio, navigate to `ReplicatedStorage/TS/Infrastructure/TestFramework`, confirm the compiled module exists. Manually `require()` it from Studio command bar.
**Layers touched:** TypeScript source > rbxtsc compilation > Rojo sync > Studio DataModel

### Slice 2: Plugin Execution (tasks 3.1 through 3.3)
**What it proves:** The full in-Studio test execution pipeline works. Plugin receives `run_tests` command, requires test modules, runs them through the framework, returns structured JSON.
**You can verify by:** With Studio open and MCP bridge running, send a `run_tests` command via curl to `localhost:9900`. Inspect the JSON response for suite/test structure.
**Layers touched:** Studio plugin > CommandDispatcher > TestRunner (Luau) > TestFramework > JSON results > HTTP POST

### Slice 3: MCP Tool + CLI Reporter (tasks 4.1 through 4.2, 5.1 through 5.4)
**What it proves:** The complete terminal-to-Studio-to-terminal loop. Developer runs `pnpm test:studio`, tests execute in Studio, results appear formatted in the terminal with pass/fail colors.
**You can verify by:** Run `pnpm test:studio Content/Traits/Defcon1` from terminal. See formatted output with green checkmarks, durations, and summary line.
**Layers touched:** Node.js CLI > HTTP > Rust MCP > HTTP > Studio Plugin > Framework > JSON > Rust > Node.js > Terminal

### Slice 4: Watch Mode + Migration (tasks 6.1 through 6.3)
**What it proves:** Live development loop works. Edit a test, save, see results auto-update in terminal. First Jest test migrated to Studio test.
**You can verify by:** Run `pnpm test:studio:watch`, edit a `.studio.ts` file, save, confirm terminal re-runs within seconds.
**Layers touched:** chokidar file watcher > compile > CLI trigger > full pipeline
