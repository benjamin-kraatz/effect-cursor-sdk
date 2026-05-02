# Release checklist

Use this before publishing or tagging a release candidate.

## Automated gates

From the repository root:

```bash
bun install
bun run typecheck
bun run sdk-audit
bun run lint
bun run format:check
bun run test
bun run test:coverage
bun run build
bun run lint:package
bun run examples:typecheck
```

`verify:publish` runs a subset: typecheck, `sdk-audit`, lint, test, build, publint.

## SDK bump

When updating `@cursor/sdk` in root `package.json`:

1. `bun install`
2. `bun run sdk-audit` — if it fails, inspect new exports (`docs/SDK_COVERAGE.md`, `src/cursor-types.ts`, `CursorSdkFactory`, mocks).
3. Align example apps: each `examples/*/package.json` should use the same `@cursor/sdk` range as the library (see peer/dependency policy in `docs/SDK_COVERAGE.md`).
4. Refresh `docs/SDK_COVERAGE.md` checklist table if wrappers changed.
5. Optionally run `bun run sdk-audit:refresh` **only after** confirming drift is handled, then commit `scripts/sdk-export-baseline.json`.

## Changesets and changelog

- Add a [Changeset](https://github.com/changesets/changesets) for user-facing changes: `bun run changeset`
- User-facing narrative also belongs in `CHANGELOG.md` when cutting a release (via Changesets or manual edit per repo practice).

## Docs

- Link new features from [README.md](../README.md).
- Update [RECIPES.md](./RECIPES.md) when adding important usage patterns

## Credentials note

Live Cursor paths are not exercised in CI. After releasing, smoke-test with a disposable API key if you changed agent or networking code.
