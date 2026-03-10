import { ReplicatedStorage } from "@rbxts/services";
import type { TestResult, SuiteResult } from "./types";
import { type HookCallback, type TestEntry, getAndClearSuites, getCurrentSuite } from "./registry";

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
 * @param file DataModel path for reporting
 * @returns SuiteResult for each registered describe block
 * @example RunSuites("Content/Traits/Defcon1/_Tests_/Defcon1.studio")
 */
export async function RunSuites(file: string): Promise<SuiteResult[]> {
	const suites = getAndClearSuites();
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

		results.push({ name: suite.name, file, tags: suite.tags, tests: testResults });
	}

	return results;
}

/**
 * Returns the current sandbox Folder for the active suite.
 * Tests that create Instances should parent them here for automatic cleanup.
 * @returns The sandbox Folder, or undefined if called outside a test
 * @example GetSandbox()
 */
export function GetSandbox(): Folder | undefined {
	const suite = getCurrentSuite();
	if (suite === undefined) return undefined;
	const name = `__TestSandbox_${suite.name}`;
	return ReplicatedStorage.FindFirstChild(name) as Folder | undefined;
}
