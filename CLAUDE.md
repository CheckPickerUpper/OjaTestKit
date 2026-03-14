# OjaTestKit

## Publishing

This is a private scoped npm package (`@ojagamez/oja-test-kit`). After pushing changes:

1. Build first: `rbxtsc --type package` (compiles `src/` → `out/`)
2. Bump version in `package.json`
3. Publish: `npm publish`

Only `out/` and `cli/` are shipped (see `files` in package.json). Source TypeScript is NOT included — always build before publishing.
