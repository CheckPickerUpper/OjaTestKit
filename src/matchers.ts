import { CollectionService } from "@rbxts/services";

/**
 * Chainable assertion interface returned by `expect()`.
 * All matchers support `.not` for negation.
 * @field not Negated version of the same matchers
 */
export interface Matchers {
	toBe(expected: unknown): void;
	toEqual(expected: unknown): void;
	toBeDefined(): void;
	toBeUndefined(): void;
	toBeTruthy(): void;
	toBeFalsy(): void;
	toBeGreaterThan(n: number): void;
	toBeLessThan(n: number): void;
	toBeGreaterThanOrEqual(n: number): void;
	toBeLessThanOrEqual(n: number): void;
	toBeNaN(): void;
	toContain(item: unknown): void;
	toHaveLength(n: number): void;
	toThrow(): void;
	toThrowMatching(substring: string): void;
	toApprox(expected: number, precision?: number): void;
	toMatchObject(subset: object): void;
	toHaveProperty(key: string, value?: unknown): void;
	toSatisfy(predicate: (value: unknown) => boolean): void;
	toStartWith(prefix: string): void;
	toEndWith(suffix: string): void;
	toBeA(className: string): void;
	toHaveTag(tagName: string): void;
	toHaveAttribute(name: string, value?: unknown): void;
	not: Matchers;
}

/**
 * Recursive structural equality check for tables/primitives.
 * @param a First value
 * @param b Second value
 * @returns True if both values are structurally identical
 */
export function deepEqual(a: unknown, b: unknown): boolean {
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

function subsetMatch(actual: unknown, subset: unknown): boolean {
	if (typeOf(actual) !== "table" || typeOf(subset) !== "table") return false;
	const actualRecord = actual as Record<string, unknown>;
	const subsetRecord = subset as Record<string, unknown>;
	for (const [key, expected] of pairs(subsetRecord)) {
		const actualValue = actualRecord[key as string];
		if (typeOf(expected) === "table" && typeOf(actualValue) === "table") {
			if (!subsetMatch(actualValue, expected)) return false;
		} else if (actualValue !== expected) {
			return false;
		}
	}
	return true;
}

/**
 * Converts a value to a human-readable string for error messages.
 * @param value Any Luau value
 * @returns Quoted strings, tostring() for everything else
 */
export function formatValue(value: unknown): string {
	if (typeOf(value) === "string") return `"${value}"`;
	if (typeOf(value) === "table") return tostring(value);
	return tostring(value);
}

/**
 * Builds the matcher object for a given value and negation state.
 * @param actual The value under test
 * @param negated Whether `.not` was used
 * @returns A Matchers object with all assertion methods
 * @example createMatchers(42, false).toBe(42)
 */
export function createMatchers(actual: unknown, negated: boolean): Matchers {
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

		toBeGreaterThanOrEqual(n: number) {
			check((actual as number) >= n, `Expected ${formatValue(actual)} >= ${n}`);
		},

		toBeLessThanOrEqual(n: number) {
			check((actual as number) <= n, `Expected ${formatValue(actual)} <= ${n}`);
		},

		toBeNaN() {
			check(actual !== actual, `Expected NaN, got ${formatValue(actual)}`);
		},

		toContain(item: unknown) {
			if (typeOf(actual) === "string") {
				const haystack = actual as string;
				const needle = item as string;
				check(haystack.find(needle)[0] !== undefined, `Expected "${haystack}" to contain "${needle}"`);
			} else if (typeOf(actual) === "table") {
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
				check(false, `toContain() requires a string or array, got ${typeOf(actual)}`);
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

		toThrowMatching(substring: string) {
			if (typeOf(actual) !== "function") {
				check(false, `toThrowMatching() requires a function`);
				return;
			}
			const [success, errorMessage] = pcall(actual as () => void);
			if (success) {
				check(false, `Expected function to throw matching "${substring}", but it did not throw`);
				return;
			}
			const errorString = tostring(errorMessage);
			check(
				errorString.find(substring)[0] !== undefined,
				`Expected throw matching "${substring}", got "${errorString}"`,
			);
		},

		toApprox(expected: number, precision?: number) {
			const tolerance = precision ?? 0.001;
			const diff = math.abs((actual as number) - expected);
			check(diff <= tolerance, `Expected ~${expected} (tolerance ${tolerance}), got ${actual} (diff ${diff})`);
		},

		toMatchObject(subset: object) {
			check(
				subsetMatch(actual, subset),
				`Expected object to match subset ${formatValue(subset)}, got ${formatValue(actual)}`,
			);
		},

		toHaveProperty(key: string, value?: unknown) {
			if (typeOf(actual) !== "table") {
				check(false, `toHaveProperty() requires a table, got ${typeOf(actual)}`);
				return;
			}
			const obj = actual as Record<string, unknown>;
			const hasKey = obj[key] !== undefined;
			if (value !== undefined) {
				check(
					hasKey && deepEqual(obj[key], value),
					`Expected property "${key}" to equal ${formatValue(value)}, got ${formatValue(obj[key])}`,
				);
			} else {
				check(hasKey, `Expected object to have property "${key}"`);
			}
		},

		toSatisfy(predicate: (value: unknown) => boolean) {
			check(predicate(actual), `Value ${formatValue(actual)} did not satisfy predicate`);
		},

		toStartWith(prefix: string) {
			const str = actual as string;
			check(
				str.sub(1, prefix.size()) === prefix,
				`Expected "${str}" to start with "${prefix}"`,
			);
		},

		toEndWith(suffix: string) {
			const str = actual as string;
			check(
				str.sub(-suffix.size()) === suffix,
				`Expected "${str}" to end with "${suffix}"`,
			);
		},

		toBeA(className: string) {
			if (typeOf(actual) !== "Instance") {
				check(false, `toBeA() requires an Instance, got ${typeOf(actual)}`);
				return;
			}
			const instance = actual as Instance;
			check(instance.IsA(className as keyof Instances), `Expected Instance of type "${className}", got "${instance.ClassName}"`);
		},

		toHaveTag(tagName: string) {
			if (typeOf(actual) !== "Instance") {
				check(false, `toHaveTag() requires an Instance, got ${typeOf(actual)}`);
				return;
			}
			check(CollectionService.HasTag(actual as Instance, tagName), `Expected Instance to have tag "${tagName}"`);
		},

		toHaveAttribute(name: string, value?: unknown) {
			if (typeOf(actual) !== "Instance") {
				check(false, `toHaveAttribute() requires an Instance, got ${typeOf(actual)}`);
				return;
			}
			const instance = actual as Instance;
			const attrValue = instance.GetAttribute(name);
			if (value !== undefined) {
				check(
					attrValue === value,
					`Expected attribute "${name}" to equal ${formatValue(value)}, got ${formatValue(attrValue)}`,
				);
			} else {
				check(attrValue !== undefined, `Expected Instance to have attribute "${name}"`);
			}
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
