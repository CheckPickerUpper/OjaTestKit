# Studio Test Runner: Task List

> Generated: 2026-03-07
> Dependency graph: `_docs/Plans/StudioTestRunner.DependencyGraph.md`
> Design spec: `_docs/GameDesign/StudioTestRunner.DesignerFacing.Spec.md`

## Phase 1: Test Framework (roblox-ts)
> Blocked by: nothing

- [ ] **1.1** Define result types (SuiteResult, TestResult, TestStatus) `[Slice 1]`
  * File: `src/Shared/ReplicatedStorage/Infrastructure/TestFramework/TestFramework.Types.ts`
  * Wire format types matching the JSON spec: `{ totalTests, passed, failed, skipped, duration, suites: SuiteResult[] }`. Each `SuiteResult` has `name`, `file`, `tests: TestResult[]`. Each `TestResult` has `name`, `status: "pass" | "fail" | "skip"`, `duration`, optional `error` and `traceback`.

- [ ] **1.2** Implement `describe`, `it`, `expect` with all matchers `[Slice 1]`
  * File: `src/Shared/ReplicatedStorage/Infrastructure/TestFramework/TestFramework.ts`
  * Around 200 lines of roblox-ts. `describe(name, fn)` registers a suite. `it(name, fn)` registers a test case. `expect(value)` returns a chainable matcher object. Matchers: `toBe`, `toEqual` (deep), `toBeDefined`, `toBeUndefined`, `toBeTruthy`, `toBeFalsy`, `toBeGreaterThan`, `toBeLessThan`, `toContain`, `toHaveLength`, `toThrow`, `toApprox(n, precision?)`. All matchers support `.not` negation.
  * `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks.
  * Export a `RunSuite()` function that executes all registered tests and returns `SuiteResult`.

- [ ] **1.3** Add auto-sandbox isolation `[Slice 1]`
  * File: same as 1.2
  * Each root `describe` block gets a temporary `Folder` parented to `ReplicatedStorage`. Tests can parent Instances into `sandbox`. After the suite completes (pass or fail), the sandbox Folder is `Destroy()`d. Level 1 tests that use DI containers can ignore the sandbox entirely.

- [ ] **1.4** Add Promise-aware `it()` `[Slice 1]`
  * File: same as 1.2
  * If the callback passed to `it()` returns a Promise, the runner awaits it before recording pass/fail. Uses `@rbxts/promise` (already a transitive dependency). Synchronous callbacks work as-is with no change.

## Phase 2: Test Compilation Config
> Blocked by: nothing (parallel with Phase 1)

- [ ] **2.1** Create `tsconfig.studio-tests.json` `[Slice 1]`
  * File: `tsconfig.studio-tests.json` (project root)
  * Extends `tsconfig-base.json`. Sets `rootDir: "src"`, `outDir: "out"`. Includes `src/**/_Tests_/**/*.studio.ts` and `src/**/Infrastructure/TestFramework/**/*.ts`. Excludes everything the main tsconfig excludes EXCEPT `_Tests_` directories. Uses the same path aliases from `tsconfig-base.json`.

- [ ] **2.2** Add `pnpm compile:tests` script `[Slice 1]`
  * File: `package.json` (add script)
  * Script: `"compile:tests": "rbxtsc --project tsconfig.studio-tests.json --rojo build.project.json"`
  * Test compilation is isolated from game compilation. Test build errors cannot break the game build.

- [ ] **2.3** Verify Rojo picks up compiled test output `[Slice 1]`
  * No file changes. Manual verification step.
  * Run `pnpm compile:tests`, then check that `out/Shared/ReplicatedStorage/Infrastructure/TestFramework/` contains compiled `.lua` files. Confirm Rojo syncs them into Studio at `ReplicatedStorage/TS/Infrastructure/TestFramework/`.

## Phase 3: Plugin run_tests Command (Luau)
> Blocked by: Phase 1, Phase 2

- [ ] **3.1** Create TestRunner module in the plugin `[Slice 2]`
  * File: `~/dev/ai-lab/MCP's/rbx-studio-mcp/plugin/src/TestRunner.luau`
  * Receives an array of DataModel paths (strings like `"ReplicatedStorage.TS.Content.Traits.Defcon1._Tests_.Defcon1.studio"`). For each path: resolves the ModuleScript via `InstanceResolver`, `require()`s it (triggering the test framework's `describe`/`it` registration), calls `RunSuite()`, collects the `SuiteResult`. Aggregates all suite results into the top-level wire format JSON. Returns the JSON string.

- [ ] **3.2** Add `run_tests` to CommandDispatcher `[Slice 2]`
  * File: `~/dev/ai-lab/MCP's/rbx-studio-mcp/plugin/src/CommandDispatcher.luau`
  * Add `elseif toolName == "run_tests" then return TestRunner.runTests(commandArguments)` to the dispatch chain. The `commandArguments` shape: `{ paths: string[] }` where each path is a dot-separated DataModel path.

- [ ] **3.3** Manual integration test `[Slice 2]`
  * No file changes. Manual verification step.
  * Write a minimal `.studio.ts` test (e.g., `Defcon1.studio.ts`), compile it, sync into Studio, then trigger `run_tests` via the MCP bridge. Confirm the JSON response matches the wire format spec.

## Phase 4: MCP Server run_tests Tool (Rust)
> Blocked by: Phase 3

- [ ] **4.1** Add `RunTestsParameters` struct `[Slice 3]`
  * File: `~/dev/ai-lab/MCP's/rbx-studio-mcp/src/mcp_parameters.rs` (or a new `mcp_parameters_test.rs`)
  * Struct with one field: `paths: Vec<String>`. Each string is a DataModel path to a test ModuleScript. Derives `Deserialize` + `schemars::JsonSchema`. Follows the same pattern as `EchoParameters`, `GetChildrenParameters`, etc.

- [ ] **4.2** Add `run_studio_tests` tool to MCP server `[Slice 3]`
  * File: `~/dev/ai-lab/MCP's/rbx-studio-mcp/src/mcp_server.rs`
  * Add a `#[tool]` method `run_studio_tests` that takes `RunTestsParameters`, calls `self.dispatch_to_plugin("run_tests", json!({ "paths": parameters.paths }))`. Follows the exact same pattern as `echo`, `get_children`, etc. Tool description: "Execute Studio test suites and return structured results."

## Phase 5: CLI Runner + Reporter (Node.js)
> Blocked by: Phase 4

- [ ] **5.1** Source path to DataModel path mapper `[Slice 3]`
  * File: `scripts/studio-test-runner/path-mapper.mts`
  * Takes a source path pattern (e.g., `Content/Traits`) and resolves matching `.studio.ts` files via glob. Maps each source path to a DataModel path using the Rojo tree structure: `src/Shared/ReplicatedStorage/Content/Traits/Defcon1/_Tests_/Defcon1.studio.ts` becomes `ReplicatedStorage.TS.Content.Traits.Defcon1._Tests_.Defcon1.studio`. References `build.project.json` mappings.

- [ ] **5.2** HTTP client for MCP bridge `[Slice 3]`
  * File: `scripts/studio-test-runner/bridge-client.mts`
  * Sends the `run_tests` command to the MCP server. Two approaches: (a) call the MCP tool via the MCP protocol, or (b) POST directly to a new `/run-tests` HTTP endpoint. Option (b) is simpler for a standalone CLI. The client sends `{ paths: string[] }` and receives the JSON wire format result. Handles connection errors ("Studio not connected") with a clear message.

- [ ] **5.3** Terminal reporter with colors `[Slice 3]`
  * File: `scripts/studio-test-runner/reporter.mts`
  * Takes the JSON wire format and prints Jest-style output. Green for pass, red for fail, yellow for skip. Shows suite names indented, individual test names with checkmarks/crosses and durations. Error details show expected vs received + Luau stack trace. Summary line: `Tests: N passed, N failed, N total`. Duration line: `Time: 0.847s`. Filter echo: `Pattern: Content/Traits/**`. Exit code 0 if all pass, 1 if any fail.

- [ ] **5.4** CLI entry point + `pnpm test:studio` script `[Slice 3]`
  * File: `scripts/studio-test-runner/index.mts`
  * Parses CLI args: optional path pattern (default: all), `--watch` flag. Orchestrates: (1) run `pnpm compile:tests`, (2) glob for `.studio.ts` files matching pattern, (3) map to DataModel paths, (4) send to bridge, (5) format and print results, (6) exit with appropriate code.
  * File: `package.json` (add scripts)
  * `"test:studio": "tsx scripts/studio-test-runner/index.mts"`, `"test:studio:watch": "tsx scripts/studio-test-runner/index.mts --watch"`

## Phase 6: Watch Mode + Migration
> Blocked by: Phase 5

- [ ] **6.1** Add file watcher to CLI `[Slice 4]`
  * File: `scripts/studio-test-runner/watcher.mts`
  * Uses chokidar (or `fs.watch`) to watch `out/Shared/ReplicatedStorage/**/*.lua` for changes. On change, re-triggers the test execution pipeline (skip compile since watching compiled output). Debounce 300ms to avoid rapid re-runs.

- [ ] **6.2** Wire `--watch` flag in CLI entry point `[Slice 4]`
  * File: `scripts/studio-test-runner/index.mts` (modify)
  * When `--watch` is passed: run tests once, then start the watcher. On each change, re-run the path mapping + bridge client + reporter cycle. Clear terminal between runs.

- [ ] **6.3** Migrate Defcon1 trait test as proof of concept `[Slice 4]`
  * File: `src/Shared/ReplicatedStorage/Content/Traits/Defcon1/_Tests_/Defcon1.studio.ts` (new)
  * Rewrite `Defcon1.unit.ts` as `Defcon1.studio.ts` using the new framework's `describe`/`it`/`expect`. Same test logic, same DI container factory, but imports from `Infrastructure/TestFramework` instead of Jest globals. This proves the full migration path works end to end.

---

## Summary

| Phase | Tasks | Type | Effort |
|-------|-------|------|--------|
| 1 | 4 | Build | Medium (core framework, ~200 lines TS) |
| 2 | 3 | Config | Small (tsconfig + script + verify) |
| 3 | 3 | Build + Integrate | Medium (Luau runner + dispatcher integration) |
| 4 | 2 | Build + Integrate | Small (one Rust struct + one tool method) |
| 5 | 4 | Build | Medium (Node.js CLI, ~150 lines across 4 files) |
| 6 | 3 | Build | Small (watcher + one migration) |
| **Total** | **19** | | |

### Playable Milestones
* After Phase 2: Tests compile and appear in Studio DataModel
* After Phase 3: Tests run inside Studio and produce JSON results
* After Phase 5: `pnpm test:studio` gives formatted terminal output
* After Phase 6: `pnpm test:studio:watch` for live dev loop

## Work Log

Append-only. Timestamped entries added as tasks are completed.
