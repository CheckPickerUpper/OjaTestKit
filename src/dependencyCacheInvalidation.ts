/**
 * Invalidates Roblox's `require()` cache for all ModuleScripts under a
 * container by cloning each one in-place and destroying the original.
 * Clones are new Instances so subsequent `require()` calls re-execute
 * the module body.
 *
 * Handles nested ModuleScripts: if a parent ModuleScript is cloned, its
 * children come along via `Clone()` and the originals are destroyed.
 * Already-destroyed descendants are skipped.
 *
 * @param sourceContainer The root Instance (e.g. ReplicatedStorage.TS) whose
 *   descendant ModuleScripts should be invalidated before a test run
 */
export function invalidateDescendantModules(sourceContainer: Instance): void {
	const descendantModules = sourceContainer
		.GetDescendants()
		.filter((descendant): descendant is ModuleScript => descendant.IsA("ModuleScript"));

	for (const moduleScript of descendantModules) {
		if (moduleScript.Parent === undefined) continue;
		const originalParent = moduleScript.Parent;
		const clone = moduleScript.Clone();
		clone.Parent = originalParent;
		moduleScript.Destroy();
	}
}
