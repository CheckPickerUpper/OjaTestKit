/** Status of an individual test case. */
export type TestStatus = "pass" | "fail" | "skip";
/**
 * Result of a single `it()` block.
 * @field name Display name of the test case
 * @field status Whether the test passed, failed, or was skipped
 * @field duration Wall time in seconds
 * @field error Human readable failure message (only present on fail)
 * @field traceback Luau stack trace string (only present on fail)
 */
export interface TestResult {
    name: string;
    status: TestStatus;
    duration: number;
    error?: string;
    traceback?: string;
}
/**
 * Result of a single `describe()` block.
 * @field name Display name of the suite
 * @field file DataModel path to the test module
 * @field tests Ordered list of individual test results within this suite
 */
export interface SuiteResult {
    name: string;
    file: string;
    tests: TestResult[];
}
/**
 * Top level result aggregated across all suites in a test run.
 * @field totalTests Sum of all tests across all suites
 * @field passed Count of tests with status "pass"
 * @field failed Count of tests with status "fail"
 * @field skipped Count of tests with status "skip"
 * @field duration Total wall time in seconds
 * @field suites Ordered list of suite results
 */
export interface TestRunResult {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    suites: SuiteResult[];
}
type TestCallback = () => void | Promise<unknown>;
type HookCallback = () => void | Promise<unknown>;
/**
 * Groups tests into a named suite. Can be nested.
 * @param name Display name for this suite
 * @param fn Function containing `it()` calls and optional hooks
 * @example describe("MyTrait", () => { it("works", () => expect(1).toBe(1)); })
 */
export declare function describe(name: string, fn: () => void): void;
/**
 * Defines a single test case. Must be called inside `describe()`.
 * If the callback returns a Promise, the runner awaits it before recording pass/fail.
 * @param name Display name for this test
 * @param callback Test function. Throw or fail an `expect()` to mark failure.
 * @example it("adds numbers", () => expect(1 + 1).toBe(2))
 */
export declare function it(name: string, callback: TestCallback): void;
/**
 * Registers a hook that runs once before all tests in the current suite.
 * @param callback Setup function
 * @example beforeAll(() => { container = CreateTestContainer(); })
 */
export declare function beforeAll(callback: HookCallback): void;
/**
 * Registers a hook that runs once after all tests in the current suite.
 * @param callback Teardown function
 * @example afterAll(() => { container.Destroy(); })
 */
export declare function afterAll(callback: HookCallback): void;
/**
 * Registers a hook that runs before each test in the current suite.
 * @param callback Setup function
 * @example beforeEach(() => { state = freshState(); })
 */
export declare function beforeEach(callback: HookCallback): void;
/**
 * Registers a hook that runs after each test in the current suite.
 * @param callback Teardown function
 * @example afterEach(() => { cleanup(); })
 */
export declare function afterEach(callback: HookCallback): void;
interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(n: number): void;
    toBeLessThan(n: number): void;
    toContain(item: unknown): void;
    toHaveLength(n: number): void;
    toThrow(): void;
    toApprox(expected: number, precision?: number): void;
    not: Matchers;
}
/**
 * Begins an assertion chain on a value.
 * @param actual The value to assert against
 * @returns Chainable matcher object supporting `.not` negation
 * @example expect(scalar.GetValue()).toBe(1.35)
 */
export declare function expect(actual: unknown): Matchers;
/**
 * Executes all registered suites and returns structured results.
 * Clears the registry after execution so each `require()` runs fresh.
 * @param file DataModel path for reporting (e.g., `Content/Traits/Defcon1/_Tests_/Defcon1.studio`)
 * @returns SuiteResult for each registered describe block
 * @example RunSuites("Content/Traits/Defcon1/_Tests_/Defcon1.studio")
 */
export declare function RunSuites(file: string): Promise<SuiteResult[]>;
/**
 * Returns the current sandbox Folder for the active suite.
 * Tests that create Instances should parent them here for automatic cleanup.
 * @returns The sandbox Folder, or undefined if called outside a test
 * @example const folder = GetSandbox(); part.Parent = folder;
 */
export declare function GetSandbox(): Folder | undefined;
export {};
