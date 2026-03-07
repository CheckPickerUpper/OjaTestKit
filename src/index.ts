import { ReplicatedStorage } from "@rbxts/services";

// ── Types ──

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

// ── Internal State ──

type TestCallback = () => void | Promise<unknown>;
type HookCallback = () => void | Promise<unknown>;

interface TestEntry {
	name: string;
	callback: TestCallback;
}

interface SuiteEntry {
	name: string;
	tests: TestEntry[];
	beforeAllHooks: HookCallback[];
	afterAllHooks: HookCallback[];
	beforeEachHooks: HookCallback[];
	afterEachHooks: HookCallback[];
}

let currentSuite: SuiteEntry | undefined;
let registeredSuites: SuiteEntry[] = [];

// ── Public API: describe / it / hooks ──

/**
 * Groups tests into a named suite. Can be nested.
 * @param name Display name for this suite
 * @param fn Function containing `it()` calls and optional hooks
 * @example describe("MyTrait", () => { it("works", () => expect(1).toBe(1)); })
 */
export function describe(name: string, fn: () => void): void {
	const suite: SuiteEntry = {
		name,
		tests: [],
		beforeAllHooks: [],
		afterAllHooks: [],
		beforeEachHooks: [],
		afterEachHooks: [],
	};

	const previousSuite = currentSuite;
	currentSuite = suite;
	fn();
	currentSuite = previousSuite;

	if (previousSuite === undefined) {
		registeredSuites.push(suite);
	} else {
		for (const test of suite.tests) {
			previousSuite.tests.push({
				name: `${suite.name} > ${test.name}`,
				callback: test.callback,
			});
		}
		for (const hook of suite.beforeEachHooks) previousSuite.beforeEachHooks.push(hook);
		for (const hook of suite.afterEachHooks) previousSuite.afterEachHooks.push(hook);
		for (const hook of suite.beforeAllHooks) previousSuite.beforeAllHooks.push(hook);
		for (const hook of suite.afterAllHooks) previousSuite.afterAllHooks.push(hook);
	}
}

/**
 * Defines a single test case. Must be called inside `describe()`.
 * If the callback returns a Promise, the runner awaits it before recording pass/fail.
 * @param name Display name for this test
 * @param callback Test function. Throw or fail an `expect()` to mark failure.
 * @example it("adds numbers", () => expect(1 + 1).toBe(2))
 */
export function it(name: string, callback: TestCallback): void {
	assert(currentSuite !== undefined, "it() must be called inside describe()");
	currentSuite.tests.push({ name, callback });
}

/**
 * Registers a hook that runs once before all tests in the current suite.
 * @param callback Setup function
 * @example beforeAll(() => { container = CreateTestContainer(); })
 */
export function beforeAll(callback: HookCallback): void {
	assert(currentSuite !== undefined, "beforeAll() must be called inside describe()");
	currentSuite.beforeAllHooks.push(callback);
}

/**
 * Registers a hook that runs once after all tests in the current suite.
 * @param callback Teardown function
 * @example afterAll(() => { container.Destroy(); })
 */
export function afterAll(callback: HookCallback): void {
	assert(currentSuite !== undefined, "afterAll() must be called inside describe()");
	currentSuite.afterAllHooks.push(callback);
}

/**
 * Registers a hook that runs before each test in the current suite.
 * @param callback Setup function
 * @example beforeEach(() => { state = freshState(); })
 */
export function beforeEach(callback: HookCallback): void {
	assert(currentSuite !== undefined, "beforeEach() must be called inside describe()");
	currentSuite.beforeEachHooks.push(callback);
}

/**
 * Registers a hook that runs after each test in the current suite.
 * @param callback Teardown function
 * @example afterEach(() => { cleanup(); })
 */
export function afterEach(callback: HookCallback): void {
	assert(currentSuite !== undefined, "afterEach() must be called inside describe()");
	currentSuite.afterEachHooks.push(callback);
}

// ── Matchers ──

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

function deepEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeOf(a) !== typeOf(b)) return false;
	if (typeOf(a) !== "table") return false;

	const tableA = a as Record<string, unknown>;
	const tableB = b as Record<string, unknown>;

	for (const [key, value] of pairs(tableA)) {
		if (!deepEqual(value, tableB[key as string])) return false;
	}
	for (const [key] of pairs(tableB)) {
		if (tableA[key as string] === undefined) return false;
	}
	return true;
}

function formatValue(value: unknown): string {
	if (typeOf(value) === "string") return `"${value}"`;
	if (typeOf(value) === "table") return tostring(value);
	return tostring(value);
}

function createMatchers(actual: unknown, negated: boolean): Matchers {
	function check(condition: boolean, message: string): void {
		const shouldPass = negated ? !condition : condition;
		if (!shouldPass) {
			error(message, 3);
		}
	}

	const matchers: Matchers = {
		toBe(expected: unknown) {
			check(actual === expected, `Expected ${formatValue(expected)}, got ${formatValue(actual)}`);
		},

		toEqual(expected: unknown) {
			check(deepEqual(actual, expected), `Expected deep equal to ${formatValue(expected)}, got ${formatValue(actual)}`);
		},

		toBeDefined() {
			check(actual !== undefined, `Expected value to be defined, got undefined`);
		},

		toBeUndefined() {
			check(actual === undefined, `Expected undefined, got ${formatValue(actual)}`);
		},

		toBeTruthy() {
			check(!!actual, `Expected truthy, got ${formatValue(actual)}`);
		},

		toBeFalsy() {
			check(!actual, `Expected falsy, got ${formatValue(actual)}`);
		},

		toBeGreaterThan(n: number) {
			check((actual as number) > n, `Expected ${formatValue(actual)} > ${n}`);
		},

		toBeLessThan(n: number) {
			check((actual as number) < n, `Expected ${formatValue(actual)} < ${n}`);
		},

		toContain(item: unknown) {
			if (typeOf(actual) === "table") {
				const arr = actual as defined[];
				let found = false;
				for (const element of arr) {
					if (element === item) {
						found = true;
						break;
					}
				}
				check(found, `Expected array to contain ${formatValue(item)}`);
			} else {
				check(false, `toContain() requires an array, got ${typeOf(actual)}`);
			}
		},

		toHaveLength(n: number) {
			if (typeOf(actual) === "table") {
				const arr = actual as defined[];
				check(arr.size() === n, `Expected length ${n}, got ${arr.size()}`);
			} else if (typeOf(actual) === "string") {
				const str = actual as string;
				check(str.size() === n, `Expected length ${n}, got ${str.size()}`);
			} else {
				check(false, `toHaveLength() requires array or string, got ${typeOf(actual)}`);
			}
		},

		toThrow() {
			if (typeOf(actual) !== "function") {
				check(false, `toThrow() requires a function`);
				return;
			}
			const [success] = pcall(actual as () => void);
			check(!success, `Expected function to throw, but it did not`);
		},

		toApprox(expected: number, precision?: number) {
			const tolerance = precision ?? 0.001;
			const diff = math.abs((actual as number) - expected);
			check(diff <= tolerance, `Expected ~${expected} (tolerance ${tolerance}), got ${actual} (diff ${diff})`);
		},

		not: undefined as unknown as Matchers,
	};

	if (!negated) {
		matchers.not = createMatchers(actual, true);
	}

	return matchers;
}

/**
 * Begins an assertion chain on a value.
 * @param actual The value to assert against
 * @returns Chainable matcher object supporting `.not` negation
 * @example expect(scalar.GetValue()).toBe(1.35)
 */
export function expect(actual: unknown): Matchers {
	return createMatchers(actual, false);
}

// ── Runner ──

async function runHooks(hooks: HookCallback[]): Promise<void> {
	for (const hook of hooks) {
		const result = hook();
		if (Promise.is(result)) {
			await (result as Promise<unknown>);
		}
	}
}

async function runSingleTest(entry: TestEntry): Promise<TestResult> {
	const startTime = os.clock();

	const [success, errorMessage] = pcall(() => {
		const result = entry.callback();
		if (Promise.is(result)) {
			const promiseResult = result as Promise<unknown>;
			let promiseError: unknown;

			promiseResult.then(
				() => {},
				(rejection: unknown) => {
					promiseError = rejection;
				},
			);

			promiseResult.await();

			if (promiseError !== undefined) {
				error(tostring(promiseError));
			}
		}
	});

	const duration = os.clock() - startTime;

	if (success) {
		return { name: entry.name, status: "pass", duration };
	}

	const errorString = tostring(errorMessage);
	return {
		name: entry.name,
		status: "fail",
		duration,
		error: errorString,
		traceback: debug.traceback(undefined, 2),
	};
}

/**
 * Executes all registered suites and returns structured results.
 * Clears the registry after execution so each `require()` runs fresh.
 * @param file DataModel path for reporting (e.g., `Content/Traits/Defcon1/_Tests_/Defcon1.studio`)
 * @returns SuiteResult for each registered describe block
 * @example RunSuites("Content/Traits/Defcon1/_Tests_/Defcon1.studio")
 */
export async function RunSuites(file: string): Promise<SuiteResult[]> {
	const suites = registeredSuites;
	registeredSuites = [];

	const results: SuiteResult[] = [];

	for (const suite of suites) {
		const sandbox = new Instance("Folder");
		sandbox.Name = `__TestSandbox_${suite.name}`;
		sandbox.Parent = ReplicatedStorage;

		const testResults: TestResult[] = [];

		try {
			await runHooks(suite.beforeAllHooks);

			for (const testEntry of suite.tests) {
				await runHooks(suite.beforeEachHooks);
				const testResult = await runSingleTest(testEntry);
				testResults.push(testResult);
				await runHooks(suite.afterEachHooks);
			}

			await runHooks(suite.afterAllHooks);
		} catch (hookError) {
			testResults.push({
				name: "[hook error]",
				status: "fail",
				duration: 0,
				error: tostring(hookError),
				traceback: debug.traceback(undefined, 2),
			});
		} finally {
			sandbox.Destroy();
		}

		results.push({ name: suite.name, file, tests: testResults });
	}

	return results;
}

/**
 * Returns the current sandbox Folder for the active suite.
 * Tests that create Instances should parent them here for automatic cleanup.
 * @returns The sandbox Folder, or undefined if called outside a test
 * @example const folder = GetSandbox(); part.Parent = folder;
 */
export function GetSandbox(): Folder | undefined {
	if (currentSuite === undefined) return undefined;
	const name = `__TestSandbox_${currentSuite.name}`;
	return ReplicatedStorage.FindFirstChild(name) as Folder | undefined;
}
