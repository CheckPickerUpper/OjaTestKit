/**
 * Invalidates Roblox's `require()` cache for a ModuleScript by replacing it
 * with a Clone. The clone is a new Instance so the next `require()` re-executes
 * the module body. Children (including nested ModuleScripts) are copied by
 * `Clone()`, so the entire subtree gets fresh identities.
 *
 * @param moduleScript The ModuleScript to invalidate
 * @returns The replacement clone — callers must `require()` this, not the original
 */
export function invalidateModuleCache(moduleScript: ModuleScript): ModuleScript {
	const originalParent = moduleScript.Parent;
	const clone = moduleScript.Clone();
	clone.Parent = originalParent;
	moduleScript.Destroy();
	return clone;
}

/**
 * Invalidates every top-level ModuleScript that is a direct child of the given folder.
 * Use this to bust the cache for an entire test output folder before requiring
 * any of its modules.
 *
 * @param testOutputFolder The Instance whose direct ModuleScript children should be invalidated
 */
export function invalidateAllModules(testOutputFolder: Instance): void {
	for (const child of testOutputFolder.GetChildren()) {
		if (child.IsA("ModuleScript")) {
			const clone = child.Clone();
			clone.Parent = testOutputFolder;
			child.Destroy();
		}
	}
}
