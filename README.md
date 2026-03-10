# @ojagamez/oja-test-kit

Test framework for roblox-ts projects. Runs `describe`/`it`/`expect` inside Roblox Studio with structured JSON output.

Tests execute in the real Roblox runtime — real services, real DataModel, no mocks.

## Setup

```bash
pnpm add @ojagamez/oja-test-kit
```

The postinstall script downloads the `rbx-studio-mcp` bridge binary via `gh release download`. Requires the `gh` CLI with access to the `CheckPickerUpper/ai-lab` repo.

### Prerequisites

- Roblox Studio open with Rojo connected
- The StudioMCP plugin installed (`StudioMCP.rbxm` in Studio's Plugins folder)
- `gh` CLI authenticated

## Usage

### Running tests

```bash
npx oja-test                     # run all tests
npx oja-test --filter Defcon1    # run tests matching path
npx oja-test --tag trait         # run only suites tagged "trait"
```

On first run, `oja-test` generates `tsconfig.studio-tests.json` if it doesn't exist. It compiles tests with `rbxtsc`, starts the bridge if needed, dispatches `run_tests` to Studio, and prints colored results.

### Writing tests

Create test files in `_Tests_` folders with the `.studio.ts` extension:

```
src/Shared/ReplicatedStorage/Content/Traits/Defcon1/_Tests_/Defcon1.studio.ts
```

```typescript
import { describe, it, expect, tag, RunSuites } from "@ojagamez/oja-test-kit";

describe("DEFCON 1 Trait", () => {
    tag("trait", "epic");

    describe("definition", () => {
        it("has correct ID", () => {
            expect(Defcon1Trait.ID).toBe("Defcon1");
        });

        it("has correct rarity", () => {
            expect(Defcon1Trait.Rarity).toBe("Epic");
        });
    });
});

export = RunSuites("Shared/ReplicatedStorage/Content/Traits/Defcon1/_Tests_/Defcon1.studio");
```

The `RunSuites` call at the bottom executes all registered suites and returns structured results. The string argument is the DataModel path used for reporting.

### Lifecycle hooks

```typescript
describe("with setup", () => {
    beforeAll(() => { /* once before all tests */ });
    afterAll(() => { /* once after all tests */ });
    beforeEach(() => { /* before each test */ });
    afterEach(() => { /* after each test */ });

    it("runs with hooks", () => { /* ... */ });
});
```

### Sandbox isolation

Each `describe` block gets a temporary Folder in ReplicatedStorage. Use `GetSandbox()` to parent test Instances there — they're automatically cleaned up after the suite finishes.

```typescript
import { GetSandbox } from "@ojagamez/oja-test-kit";

it("creates a part", () => {
    const sandbox = GetSandbox()!;
    const part = new Instance("Part");
    part.Parent = sandbox;
    expect(part.Parent).toBe(sandbox);
});
```

### Async tests

Return a Promise from `it()` for async tests:

```typescript
it("waits for something", () => {
    return new Promise((resolve) => {
        task.delay(0.1, () => resolve());
    });
});
```

### Tags

Tag suites for CLI filtering:

```typescript
describe("my suite", () => {
    tag("network", "integration");
    it("does something", () => { /* ... */ });
});
```

```bash
npx oja-test --tag network
```

## Matchers

All matchers support `.not` negation: `expect(value).not.toBe(42)`

| Matcher | Description |
|---------|-------------|
| `toBe(expected)` | Strict equality (`===`) |
| `toEqual(expected)` | Deep structural equality |
| `toBeDefined()` | Not `undefined` |
| `toBeUndefined()` | Is `undefined` |
| `toBeTruthy()` | Truthy value |
| `toBeFalsy()` | Falsy value |
| `toBeGreaterThan(n)` | `actual > n` |
| `toBeLessThan(n)` | `actual < n` |
| `toBeGreaterThanOrEqual(n)` | `actual >= n` |
| `toBeLessThanOrEqual(n)` | `actual <= n` |
| `toBeNaN()` | Is NaN |
| `toContain(item)` | Array contains item, or string contains substring |
| `toHaveLength(n)` | Array or string length |
| `toThrow()` | Function throws |
| `toThrowMatching(substring)` | Function throws error containing substring |
| `toApprox(expected, precision?)` | Within tolerance (default 0.001) |
| `toMatchObject(subset)` | Object contains all keys/values from subset |
| `toHaveProperty(key, value?)` | Object has property, optionally with value |
| `toSatisfy(predicate)` | Custom predicate returns true |
| `toStartWith(prefix)` | String starts with prefix |
| `toEndWith(suffix)` | String ends with suffix |
| `toBeA(className)` | Instance:IsA(className) |
| `toHaveTag(tagName)` | Instance has CollectionService tag |
| `toHaveAttribute(name, value?)` | Instance has attribute, optionally with value |

## API

### Test registration

| Export | Description |
|--------|-------------|
| `describe(name, fn)` | Group tests into a named suite |
| `it(name, fn)` | Define a single test case |
| `expect(value)` | Begin assertion chain |
| `tag(...tags)` | Attach tags to current suite |
| `beforeAll(fn)` | Run once before all tests in suite |
| `afterAll(fn)` | Run once after all tests in suite |
| `beforeEach(fn)` | Run before each test |
| `afterEach(fn)` | Run after each test |
| `RunSuites(file)` | Execute all registered suites, return results |
| `GetSandbox()` | Get the current suite's sandbox Folder |

### Types

| Type | Description |
|------|-------------|
| `TestStatus` | `"pass" \| "fail" \| "skip"` |
| `TestResult` | Individual test outcome with name, status, duration, error |
| `SuiteResult` | Suite outcome with name, file, tags, tests |
| `TestRunResult` | Aggregated run with totals and suite list |
| `Matchers` | Chainable assertion interface |

## Architecture

```
Consumer project (NRO)
  └── pnpm test:studio
        └── oja-test (Node CLI)
              ├── rbxtsc --project tsconfig.studio-tests.json
              ├── rbx-studio-bridge (HTTP bridge on port 9900)
              └── oja-test-runner (Rust CLI)
                    └── POST /command { tool: "run_tests" }
                          └── StudioMCP Plugin (Luau)
                                └── TestRunner.luau
                                      └── require(clone of test module)
                                            └── RunSuites() → JSON
```

## Project structure

```
OjaTestKit/
├── src/
│   ├── index.ts       # Public exports
│   ├── types.ts       # Wire format types
│   ├── matchers.ts    # expect() and all matchers
│   ├── registry.ts    # describe/it/tag registration
│   └── runner.ts      # RunSuites execution engine
├── cli/
│   ├── oja-test.mjs   # Node CLI entry point
│   └── install-mcp.sh # Postinstall binary download
├── out/               # Compiled Luau output
└── package.json
```
