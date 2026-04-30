# effect-cursor-sdk

## 0.2.1

### Patch Changes

- [#10](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/10) [`053d4f9`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/053d4f9bd4f5da15a7d342cebfb9b2680a7cf4eb) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Bump `@cursor/sdk` to `^1.0.10`, bump `oxfmt` to `^0.47.0`, and refresh `bun.lock`. Add `effect-cursor-sdk` as a workspace self-dependency so Bun resolves the package consistently.

- [`b0d50af`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/b0d50af5ced427a0cec43bbe0bf9a15da8911571) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Add root `DEPRECATIONS.md` as the canonical deprecation and next-major migration guide; link from the README and include the file in the published npm package. Extend `CursorAgentService` TSDoc with planned renames (`createFromConfig` → `create`, etc.).

## 0.2.0

### Minor Changes

- [#2](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/2) [`2cfd7eb`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/2cfd7ebc3133678f44c5047865c438d100304b58) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Deprecate passing plain `AgentOptions` to `CursorAgentService` `create`, `resume`, `prompt`, and `scoped` in favor of `loadCursorConfig` with `createFromConfig`, `resumeFromConfig`, `promptFromConfig`, and `scopedFromConfig`. The old methods remain for compatibility. `CursorSdkFactory` agent entry points are documented as deprecated for application code. README and TSDoc now describe the config-based path as default and document the legacy pattern as deprecated.

- [#8](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/8) [`9b160a7`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/9b160a7806d166c1274597304edabfd3623b015d) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Remove `CursorAgentService` config-suffixed helpers (`createFromConfig`, `resumeFromConfig`, `promptFromConfig`, `scopedFromConfig`). Use `loadCursorConfig` with `agentOptionsFromConfig` and pass the merged `AgentOptions` to `create`, `resume`, `prompt`, or `scoped` instead. Adjust `agentOptionsFromConfig` local/cwd merging, refresh README and TSDoc for the SDK-owned options boundary, and add the `examples/` learning path (quickstart, CLI, basic agent workflow, advanced ops dashboard) plus root `examples:*` scripts.
