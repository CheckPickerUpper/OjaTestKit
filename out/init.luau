-- Compiled with roblox-ts v3.0.0
local TS = _G[script]
local exports = {}
exports.expect = TS.import(script, script, "matchers").expect
local _registry = TS.import(script, script, "registry")
exports.describe = _registry.describe
exports.it = _registry.it
exports.beforeAll = _registry.beforeAll
exports.afterAll = _registry.afterAll
exports.beforeEach = _registry.beforeEach
exports.afterEach = _registry.afterEach
exports.tag = _registry.tag
exports.clearRegistry = _registry.clearRegistry
local _runner = TS.import(script, script, "runner")
exports.RunSuites = _runner.RunSuites
exports.GetSandbox = _runner.GetSandbox
exports.invalidateDescendantModules = TS.import(script, script, "dependencyCacheInvalidation").invalidateDescendantModules
return exports
