# Studio Test Runner: Task List

> Updated: 2026-03-10
> Dependency graph: `_docs/Plans/StudioTestRunner.DependencyGraph.md`
> Design spec: `_docs/GameDesign/StudioTestRunner.DesignerFacing.Spec.md`

## Key Decision: No Mocks in Studio Tests

The MCP plugin dispatches `run_tests` on demand via long-poll; by the time tests execute, the DataModel is fully loaded and all services are initialized. Studio tests run inside the real Roblox runtime, so AssetProvider, CollectionService, WorldStateProvider, replication routers, and cue systems are all live. No noop stubs needed.

The `_tests/` factory layer (`GameplaySetContainerFactory`, `TestCoreServices`, etc.) exists solely because Jest runs in Node where Roblox APIs don't exist. When migrating `.unit.ts` to `.studio.ts`, delete the mock indirection and wire up real providers directly; the game has already booted by the time the plugin receives the command.

## Phase 1: Test Framework (roblox-ts)
> Blocked by: nothing

- [x] **1.1** Define result types (SuiteResult, TestResult, TestStatus)
- [x] **1.2** Implement `describe`, `it`, `expect` with all matchers
- [x] **1.3** Add auto-sandbox isolation
- [x] **1.4** Add Promise-aware `it()`
- [x] **1.5** Add `tag()` API for semantic suite tagging
- [x] **1.6** Add missing matchers (toMatchObject, toHaveProperty, toSatisfy, toStartWith, toEndWith, toBeA, toHaveTag, toHaveAttribute)

## Phase 2: Test Compilation Config
> Blocked by: nothing (parallel with Phase 1)

- [x] **2.1** Create `tsconfig.studio-tests.json`
- [x] **2.2** Add `pnpm compile:tests` script
- [x] **2.3** Verify Rojo picks up compiled test output

## Phase 3: Plugin run_tests Command (Luau)
> Blocked by: Phase 1, Phase 2

- [x] **3.1** Create TestRunner module in the plugin
- [x] **3.2** Add `run_tests` to CommandDispatcher
- [x] **3.3** Manual integration test

## Phase 4: MCP Server run_tests Tool (Rust)
> Blocked by: Phase 3

- [x] **4.1** Add `RunTestsParameters` struct
- [x] **4.2** Add `run_tests` tool to MCP server

## Phase 5: CLI Runner + Reporter
> Blocked by: Phase 4

- [x] **5.1** Bridge client and terminal reporter (Rust)
- [x] **5.2** `oja-test` CLI bin in `@ojagamez/oja-test-kit`
- [x] **5.3** Spinner while waiting for Studio response
- [x] **5.4** `--tag` CLI flag for tag-based filtering
- [x] **5.5** `--filter` CLI flag for path-based filtering

## Phase 6: Polish + Watch Mode
> Blocked by: Phase 5

- [ ] **6.1** oja-test config file support (NRO-103)
- [ ] **6.2** Streaming per-suite results from plugin (NRO-104)
- [ ] **6.3** Diff output for toEqual failures (NRO-105)
- [ ] **6.4** File watcher + `--watch` flag
- [ ] **6.5** Migrate remaining unit tests to studio tests

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 | 6 | **DONE** |
| 2 | 3 | **DONE** |
| 3 | 3 | **DONE** |
| 4 | 2 | **DONE** |
| 5 | 5 | **DONE** |
| 6 | 5 | **TODO** |

### Milestones
* After Phase 2: Tests compile and appear in Studio DataModel
* After Phase 3: Tests run inside Studio and produce JSON results
* After Phase 5: `pnpm test:studio` gives formatted terminal output with filtering
* After Phase 6: `pnpm test:studio --watch` for live dev loop

## Gotchas

### init.luau vs index.luau (Rojo naming conflict)

rbxtsc compiles `src/index.ts` to `out/init.luau`. Rojo treats `init.luau` as a directory entry point, making the `out/` folder a ModuleScript with no children. Consumer imports resolve to `TS.import(..., "out", "index")`, calling `WaitForChild("index")` which yields forever.

Fix: build script runs `mv out/init.luau out/index.luau` and `sed` to rewrite `script` references to `script.Parent`. Without `init.luau`, Rojo treats `out/` as a Folder and syncs `index.luau` as a child.

### Plugin command timeout

`require()` in Luau yields when the target calls `WaitForChild()`. Main.server.luau wraps dispatch in `task.spawn()` with a 30-second timeout. If execution stalls, `task.cancel()` kills the thread and returns an error.

### Bridge timeout

Bridge dispatch timeout is 90 seconds. Keep this longer than the plugin's `COMMAND_TIMEOUT` so the bridge gets an error response instead of silently dropping the channel.

### TestRunner must await Promises

`RunSuites()` returns a Promise. TestRunner.luau detects Promises via `typeof(result.andThen) == "function"` and calls `:await()`. Without this, the runner tries to iterate Promise internals.

### Luau require cache

Luau caches `require()` per ModuleScript instance. TestRunner clones each test module before requiring, bypassing the cache. But dependencies of the test (like oja-test-kit modules) are NOT cloned, so their cache persists. If a dependency fails once, it stays broken until Studio restart.

### pnpm hard links and Rojo file watching

pnpm uses hard links from a content-addressable store. Rojo's file watcher may not detect hard link changes after rebuilding a dependency. Disconnect and reconnect Rojo if changes aren't picked up.

### node_modules neutralization

OjaTestKit's postinstall script writes `return nil` to `node_modules/init.luau` when installed as a dependency. This prevents Rojo from creating a `node_modules` Folder inside the package that would cause `TS.getModule` to find an empty scope and error.

## Work Log

- **2026-03-09** Phases 1-5 confirmed complete. CLI consolidated into `@ojagamez/oja-test-kit` as `oja-test` bin.
- **2026-03-10** E2E pipeline validated. Documented gotchas from integration debugging. Key fixes: init-to-index rename, task.spawn async execution, Promise detection, serve subcommand, 90s bridge timeout.
- **2026-03-10** NRO-102 (spinner), NRO-106 (tag filtering), NRO-107 (matchers) completed. Defcon1 trait test passing 6/6 in Studio. Plugin timeout reduced to 30s.
