/** Callback signature for test bodies. May return a Promise for async tests. */
export type TestCallback = () => void | Promise<unknown>;

/** Callback signature for lifecycle hooks. May return a Promise for async setup/teardown. */
export type HookCallback = () => void | Promise<unknown>;

/**
 * Internal representation of a single `it()` registration.
 * @field name Display name
 * @field callback The test function to execute
 */
export interface TestEntry {
	name: string;
	callback: TestCallback;
}

/**
 * Internal representation of a `describe()` block and its hooks.
 * @field name Display name
 * @field tags Semantic tags for filtering (e.g. "trait", "epic")
 * @field tests Registered test cases
 * @field beforeAllHooks Run once before all tests
 * @field afterAllHooks Run once after all tests
 * @field beforeEachHooks Run before each test
 * @field afterEachHooks Run after each test
 */
export interface SuiteEntry {
	name: string;
	tags: string[];
	tests: TestEntry[];
	beforeAllHooks: HookCallback[];
	afterAllHooks: HookCallback[];
	beforeEachHooks: HookCallback[];
	afterEachHooks: HookCallback[];
}

let currentSuite: SuiteEntry | undefined;
let registeredSuites: SuiteEntry[] = [];

/**
 * Returns the suite currently being defined (inside a `describe()` call), or undefined.
 * @returns The active SuiteEntry, or undefined if outside a describe block
 */
export function getCurrentSuite(): SuiteEntry | undefined {
	return currentSuite;
}

/**
 * Returns all registered suites and clears the registry for the next run.
 * @returns Array of SuiteEntry objects collected since the last call
 */
export function getAndClearSuites(): SuiteEntry[] {
	const suites = registeredSuites;
	registeredSuites = [];
	return suites;
}

/**
 * Groups tests into a named suite. Can be nested.
 * @param name Display name for this suite
 * @param fn Function containing `it()` calls and optional hooks
 * @example describe("MyTrait", () => { it("works", () => expect(1).toBe(1)); })
 */
export function describe(name: string, fn: () => void): void {
	const suite: SuiteEntry = {
		name,
		tags: [],
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
 * @param name Display name for this test
 * @param callback Test function; throw or fail an `expect()` to mark failure
 * @example it("adds numbers", () => expect(1 + 1).toBe(2))
 */
export function it(name: string, callback: TestCallback): void {
	assert(currentSuite !== undefined, "it() must be called inside describe()");
	currentSuite.tests.push({ name, callback });
}

/**
 * Runs once before all tests in the current suite.
 * @param callback Setup function
 * @example beforeAll(() => { container = CreateTestContainer(); })
 */
export function beforeAll(callback: HookCallback): void {
	assert(currentSuite !== undefined, "beforeAll() must be called inside describe()");
	currentSuite.beforeAllHooks.push(callback);
}

/**
 * Runs once after all tests in the current suite.
 * @param callback Teardown function
 * @example afterAll(() => { container.Destroy(); })
 */
export function afterAll(callback: HookCallback): void {
	assert(currentSuite !== undefined, "afterAll() must be called inside describe()");
	currentSuite.afterAllHooks.push(callback);
}

/**
 * Runs before each test in the current suite.
 * @param callback Setup function
 * @example beforeEach(() => { state = freshState(); })
 */
export function beforeEach(callback: HookCallback): void {
	assert(currentSuite !== undefined, "beforeEach() must be called inside describe()");
	currentSuite.beforeEachHooks.push(callback);
}

/**
 * Runs after each test in the current suite.
 * @param callback Teardown function
 * @example afterEach(() => { cleanup(); })
 */
export function afterEach(callback: HookCallback): void {
	assert(currentSuite !== undefined, "afterEach() must be called inside describe()");
	currentSuite.afterEachHooks.push(callback);
}

/**
 * Attaches semantic tags to the current suite for CLI filtering via `--tag`.
 * Call inside `describe()` at the top of the block.
 * @param tags One or more tag strings (e.g. "trait", "epic", "network")
 * @example tag("trait", "epic")
 */
export function tag(...tags: string[]): void {
	assert(currentSuite !== undefined, "tag() must be called inside describe()");
	for (const label of tags) {
		currentSuite.tags.push(label);
	}
}

/**
 * Wipes the suite registry without returning anything.
 * Call before `require(testModule)` to discard stale registrations
 * left behind by a previously-errored module that never reached RunSuites.
 */
export function clearRegistry(): void {
	registeredSuites = [];
	currentSuite = undefined;
}
