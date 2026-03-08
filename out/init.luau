-- Compiled with roblox-ts v3.0.0
local TS = _G[script]
local ReplicatedStorage = TS.import(script, TS.getModule(script, "@rbxts", "services")).ReplicatedStorage
-- ── Types ──
--* Status of an individual test case. 
--[[
	*
	 * Result of a single `it()` block.
	 * @field name Display name of the test case
	 * @field status Whether the test passed, failed, or was skipped
	 * @field duration Wall time in seconds
	 * @field error Human readable failure message (only present on fail)
	 * @field traceback Luau stack trace string (only present on fail)
	 
]]
--[[
	*
	 * Result of a single `describe()` block.
	 * @field name Display name of the suite
	 * @field file DataModel path to the test module
	 * @field tests Ordered list of individual test results within this suite
	 
]]
--[[
	*
	 * Top level result aggregated across all suites in a test run.
	 * @field totalTests Sum of all tests across all suites
	 * @field passed Count of tests with status "pass"
	 * @field failed Count of tests with status "fail"
	 * @field skipped Count of tests with status "skip"
	 * @field duration Total wall time in seconds
	 * @field suites Ordered list of suite results
	 
]]
-- ── Internal State ──
local currentSuite
local registeredSuites = {}
-- ── Public API: describe / it / hooks ──
--[[
	*
	 * Groups tests into a named suite. Can be nested.
	 * @param name Display name for this suite
	 * @param fn Function containing `it()` calls and optional hooks
	 * @example describe("MyTrait", () => { it("works", () => expect(1).toBe(1)); })
	 
]]
local function describe(name, fn)
	local suite = {
		name = name,
		tests = {},
		beforeAllHooks = {},
		afterAllHooks = {},
		beforeEachHooks = {},
		afterEachHooks = {},
	}
	local previousSuite = currentSuite
	currentSuite = suite
	fn()
	currentSuite = previousSuite
	if previousSuite == nil then
		table.insert(registeredSuites, suite)
	else
		for _, test in suite.tests do
			local _tests = previousSuite.tests
			local _arg0 = {
				name = `{suite.name} > {test.name}`,
				callback = test.callback,
			}
			table.insert(_tests, _arg0)
		end
		for _, hook in suite.beforeEachHooks do
			local _exp = previousSuite.beforeEachHooks
			table.insert(_exp, hook)
		end
		for _, hook in suite.afterEachHooks do
			local _exp = previousSuite.afterEachHooks
			table.insert(_exp, hook)
		end
		for _, hook in suite.beforeAllHooks do
			local _exp = previousSuite.beforeAllHooks
			table.insert(_exp, hook)
		end
		for _, hook in suite.afterAllHooks do
			local _exp = previousSuite.afterAllHooks
			table.insert(_exp, hook)
		end
	end
end
--[[
	*
	 * Defines a single test case. Must be called inside `describe()`.
	 * If the callback returns a Promise, the runner awaits it before recording pass/fail.
	 * @param name Display name for this test
	 * @param callback Test function. Throw or fail an `expect()` to mark failure.
	 * @example it("adds numbers", () => expect(1 + 1).toBe(2))
	 
]]
local function it(name, callback)
	local _arg0 = currentSuite ~= nil
	assert(_arg0, "it() must be called inside describe()")
	local _tests = currentSuite.tests
	local _arg0_1 = {
		name = name,
		callback = callback,
	}
	table.insert(_tests, _arg0_1)
end
--[[
	*
	 * Registers a hook that runs once before all tests in the current suite.
	 * @param callback Setup function
	 * @example beforeAll(() => { container = CreateTestContainer(); })
	 
]]
local function beforeAll(callback)
	local _arg0 = currentSuite ~= nil
	assert(_arg0, "beforeAll() must be called inside describe()")
	local _beforeAllHooks = currentSuite.beforeAllHooks
	local _callback = callback
	table.insert(_beforeAllHooks, _callback)
end
--[[
	*
	 * Registers a hook that runs once after all tests in the current suite.
	 * @param callback Teardown function
	 * @example afterAll(() => { container.Destroy(); })
	 
]]
local function afterAll(callback)
	local _arg0 = currentSuite ~= nil
	assert(_arg0, "afterAll() must be called inside describe()")
	local _afterAllHooks = currentSuite.afterAllHooks
	local _callback = callback
	table.insert(_afterAllHooks, _callback)
end
--[[
	*
	 * Registers a hook that runs before each test in the current suite.
	 * @param callback Setup function
	 * @example beforeEach(() => { state = freshState(); })
	 
]]
local function beforeEach(callback)
	local _arg0 = currentSuite ~= nil
	assert(_arg0, "beforeEach() must be called inside describe()")
	local _beforeEachHooks = currentSuite.beforeEachHooks
	local _callback = callback
	table.insert(_beforeEachHooks, _callback)
end
--[[
	*
	 * Registers a hook that runs after each test in the current suite.
	 * @param callback Teardown function
	 * @example afterEach(() => { cleanup(); })
	 
]]
local function afterEach(callback)
	local _arg0 = currentSuite ~= nil
	assert(_arg0, "afterEach() must be called inside describe()")
	local _afterEachHooks = currentSuite.afterEachHooks
	local _callback = callback
	table.insert(_afterEachHooks, _callback)
end
-- ── Matchers ──
local function deepEqual(a, b)
	if a == b then
		return true
	end
	local _a = a
	local _exp = typeof(_a)
	local _b = b
	if _exp ~= typeof(_b) then
		return false
	end
	local _a_1 = a
	if typeof(_a_1) ~= "table" then
		return false
	end
	local tableA = a
	local tableB = b
	for key, value in pairs(tableA) do
		if not deepEqual(value, tableB[key]) then
			return false
		end
	end
	for key in pairs(tableB) do
		if tableA[key] == nil then
			return false
		end
	end
	return true
end
local function formatValue(value)
	local _value = value
	if typeof(_value) == "string" then
		return `"{value}"`
	end
	local _value_1 = value
	if typeof(_value_1) == "table" then
		return tostring(value)
	end
	return tostring(value)
end
local function createMatchers(actual, negated)
	local function check(condition, message)
		local shouldPass = if negated then not condition else condition
		if not shouldPass then
			error(message, 3)
		end
	end
	local matchers = {
		toBe = function(self, expected)
			check(actual == expected, `Expected {formatValue(expected)}, got {formatValue(actual)}`)
		end,
		toEqual = function(self, expected)
			check(deepEqual(actual, expected), `Expected deep equal to {formatValue(expected)}, got {formatValue(actual)}`)
		end,
		toBeDefined = function(self)
			check(actual ~= nil, `Expected value to be defined, got undefined`)
		end,
		toBeUndefined = function(self)
			check(actual == nil, `Expected undefined, got {formatValue(actual)}`)
		end,
		toBeTruthy = function(self)
			check(not not (actual ~= 0 and actual == actual and actual ~= "" and actual), `Expected truthy, got {formatValue(actual)}`)
		end,
		toBeFalsy = function(self)
			check(not (actual ~= 0 and actual == actual and actual ~= "" and actual), `Expected falsy, got {formatValue(actual)}`)
		end,
		toBeGreaterThan = function(self, n)
			check(actual > n, `Expected {formatValue(actual)} > {n}`)
		end,
		toBeLessThan = function(self, n)
			check(actual < n, `Expected {formatValue(actual)} < {n}`)
		end,
		toContain = function(self, item)
			local _actual = actual
			if typeof(_actual) == "table" then
				local arr = actual
				local found = false
				for _, element in arr do
					if element == item then
						found = true
						break
					end
				end
				check(found, `Expected array to contain {formatValue(item)}`)
			else
				local _actual_1 = actual
				check(false, `toContain() requires an array, got {typeof(_actual_1)}`)
			end
		end,
		toHaveLength = function(self, n)
			local _actual = actual
			if typeof(_actual) == "table" then
				local arr = actual
				check(#arr == n, `Expected length {n}, got {#arr}`)
			else
				local _actual_1 = actual
				if typeof(_actual_1) == "string" then
					local str = actual
					check(#str == n, `Expected length {n}, got {#str}`)
				else
					local _actual_2 = actual
					check(false, `toHaveLength() requires array or string, got {typeof(_actual_2)}`)
				end
			end
		end,
		toThrow = function(self)
			local _actual = actual
			if typeof(_actual) ~= "function" then
				check(false, `toThrow() requires a function`)
				return nil
			end
			local success = pcall(actual)
			check(not success, `Expected function to throw, but it did not`)
		end,
		toApprox = function(self, expected, precision)
			local _condition = precision
			if _condition == nil then
				_condition = 0.001
			end
			local tolerance = _condition
			local diff = math.abs(actual - expected)
			check(diff <= tolerance, `Expected ~{expected} (tolerance {tolerance}), got {actual} (diff {diff})`)
		end,
		["not"] = nil,
	}
	if not negated then
		matchers["not"] = createMatchers(actual, true)
	end
	return matchers
end
--[[
	*
	 * Begins an assertion chain on a value.
	 * @param actual The value to assert against
	 * @returns Chainable matcher object supporting `.not` negation
	 * @example expect(scalar.GetValue()).toBe(1.35)
	 
]]
local function expect(actual)
	return createMatchers(actual, false)
end
-- ── Runner ──
local runHooks = TS.async(function(hooks)
	for _, hook in hooks do
		local result = hook()
		if TS.Promise.is(result) then
			TS.await(result)
		end
	end
end)
local runSingleTest = TS.async(function(entry)
	local startTime = os.clock()
	local success, errorMessage = pcall(function()
		local result = entry.callback()
		if TS.Promise.is(result) then
			local promiseResult = result
			local promiseError
			promiseResult:andThen(function() end, function(rejection)
				promiseError = rejection
			end)
			promiseResult:await()
			if promiseError ~= nil then
				error(tostring(promiseError))
			end
		end
	end)
	local duration = os.clock() - startTime
	if success then
		return {
			name = entry.name,
			status = "pass",
			duration = duration,
		}
	end
	local errorString = tostring(errorMessage)
	return {
		name = entry.name,
		status = "fail",
		duration = duration,
		error = errorString,
		traceback = debug.traceback(nil, 2),
	}
end)
--[[
	*
	 * Executes all registered suites and returns structured results.
	 * Clears the registry after execution so each `require()` runs fresh.
	 * @param file DataModel path for reporting (e.g., `Content/Traits/Defcon1/_Tests_/Defcon1.studio`)
	 * @returns SuiteResult for each registered describe block
	 * @example RunSuites("Content/Traits/Defcon1/_Tests_/Defcon1.studio")
	 
]]
local RunSuites = TS.async(function(file)
	local suites = registeredSuites
	registeredSuites = {}
	local results = {}
	for _, suite in suites do
		local sandbox = Instance.new("Folder")
		sandbox.Name = `__TestSandbox_{suite.name}`
		sandbox.Parent = ReplicatedStorage
		local testResults = {}
		TS.try(function()
			TS.await(runHooks(suite.beforeAllHooks))
			for _1, testEntry in suite.tests do
				TS.await(runHooks(suite.beforeEachHooks))
				local testResult = TS.await(runSingleTest(testEntry))
				table.insert(testResults, testResult)
				TS.await(runHooks(suite.afterEachHooks))
			end
			TS.await(runHooks(suite.afterAllHooks))
		end, function(hookError)
			local _arg0 = {
				name = "[hook error]",
				status = "fail",
				duration = 0,
				error = tostring(hookError),
				traceback = debug.traceback(nil, 2),
			}
			table.insert(testResults, _arg0)
		end, function()
			sandbox:Destroy()
		end)
		local _arg0 = {
			name = suite.name,
			file = file,
			tests = testResults,
		}
		table.insert(results, _arg0)
	end
	return results
end)
--[[
	*
	 * Returns the current sandbox Folder for the active suite.
	 * Tests that create Instances should parent them here for automatic cleanup.
	 * @returns The sandbox Folder, or undefined if called outside a test
	 * @example const folder = GetSandbox(); part.Parent = folder;
	 
]]
local function GetSandbox()
	if currentSuite == nil then
		return nil
	end
	local name = `__TestSandbox_{currentSuite.name}`
	return ReplicatedStorage:FindFirstChild(name)
end
return {
	describe = describe,
	it = it,
	beforeAll = beforeAll,
	afterAll = afterAll,
	beforeEach = beforeEach,
	afterEach = afterEach,
	expect = expect,
	RunSuites = RunSuites,
	GetSandbox = GetSandbox,
}
