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
 * @field tags Semantic tags attached via `tag()` for CLI filtering
 * @field tests Ordered list of individual test results within this suite
 */
export interface SuiteResult {
	name: string;
	file: string;
	tags: string[];
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
