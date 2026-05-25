# effect-cursor-sdk

## 0.3.4

### Patch Changes

- [#26](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/26) [`f0e8c83`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/f0e8c831cbfd1ffae11603fb5a4d5bbaed30f93a) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Bump `@cursor/sdk` to 1.0.13 and map the SDK's `AgentBusyError` to a new `CursorAgentBusyError` tagged error, re-exported through service interfaces and `cursor-types`.

## 0.3.3

### Patch Changes

- [#21](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/21) [`7542854`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/75428542652136c9f151c464a2656558b5f46682) Thanks [@cursor](https://github.com/apps/cursor)! - Strengthen regression tests for mock runs, `makeMockAssistantSdkMessage` defaults, and `streamStatusChanges` when status listener registration fails.

## 0.3.2

### Patch Changes

- [#1](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/1) [`91ec6dc`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/91ec6dcf164d56a95da4d52a0aed1b7c64d4db17) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Document the PR changeset agent workflow, fix the workflow commit guard to detect new untracked changeset files, and refresh README examples (streaming snippets, Effect integration).

## 0.3.1

### Patch Changes

- [#19](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/19) [`1357017`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/13570179bab921f2b81a089da354adc7f59eb6b4) Thanks [@cursor](https://github.com/apps/cursor)! - Add regression tests for missing API key config warnings, agent-options log summaries, status stream batching, and mock SDK factory error wiring.

- [#17](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/17) [`8f2bf13`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/8f2bf13621ea404426fda62a5a9c9037297b3b6f) Thanks [@cursor](https://github.com/apps/cursor)! - Add regression tests for telemetry instrumentation and stream event metrics.

## 0.3.0

### Minor Changes

- [#12](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/12) [`21d89ca`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/21d89ca042167ab626d18d4c9037f72f281e972f) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Add `cursor-observability` helpers (stream metrics, catalog retry/timeout defaults, safe summaries). Extend mocks and `cursor-run` wiring; warn when `CURSOR_API_KEY` is missing during config load. Bump `@cursor/sdk` to `^1.0.12`. Add `scripts/sdk-surface-audit.ts` with `sdk-audit` / `sdk-audit:refresh`, run it in CI and `verify:publish`. Ship `docs/` in the published package; add `RECIPES`, `RELEASE_CHECKLIST`, `SDK_COVERAGE`, and `MIGRATION_NEXT_MAJOR`. Refresh README (documentation index, exports, quality gates, release notes). Add a Cursor rule requiring Changesets on PRs to `main`; minor tooling/config updates (Vitest wiring, formatter ignore, gitignore).

## 0.2.1

### Patch Changes

- [#10](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/10) [`053d4f9`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/053d4f9bd4f5da15a7d342cebfb9b2680a7cf4eb) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Bump `@cursor/sdk` to `^1.0.10`, bump `oxfmt` to `^0.47.0`, and refresh `bun.lock`. Add `effect-cursor-sdk` as a workspace self-dependency so Bun resolves the package consistently.

- [`b0d50af`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/b0d50af5ced427a0cec43bbe0bf9a15da8911571) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Add root `DEPRECATIONS.md` as the canonical deprecation and next-major migration guide; link from the README and include the file in the published npm package. Extend `CursorAgentService` TSDoc with planned renames (`createFromConfig` → `create`, etc.).

## 0.2.0

### Minor Changes

- [#2](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/2) [`2cfd7eb`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/2cfd7ebc3133678f44c5047865c438d100304b58) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Deprecate passing plain `AgentOptions` to `CursorAgentService` `create`, `resume`, `prompt`, and `scoped` in favor of `loadCursorConfig` with `createFromConfig`, `resumeFromConfig`, `promptFromConfig`, and `scopedFromConfig`. The old methods remain for compatibility. `CursorSdkFactory` agent entry points are documented as deprecated for application code. README and TSDoc now describe the config-based path as default and document the legacy pattern as deprecated.

- [#8](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/8) [`9b160a7`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/9b160a7806d166c1274597304edabfd3623b015d) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Earlier iteration removed `*FromConfig` helpers in favor of `agentOptionsFromConfig` + plain `create` / `scoped` only. **That change was superseded** by [#2](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/2): the stable path is again `loadCursorConfig` with `createFromConfig`, `resumeFromConfig`, `promptFromConfig`, and `scopedFromConfig` (see current source and `DEPRECATIONS.md`). The same commit also adjusted `agentOptionsFromConfig` local/cwd merging, refreshed README and TSDoc, and added the `examples/` learning path plus root `examples:*` scripts.
