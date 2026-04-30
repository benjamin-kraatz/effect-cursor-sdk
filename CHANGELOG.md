# effect-cursor-sdk

## 0.2.0

### Minor Changes

- [#2](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/2) [`2cfd7eb`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/2cfd7ebc3133678f44c5047865c438d100304b58) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Deprecate passing plain `AgentOptions` to `CursorAgentService` `create`, `resume`, `prompt`, and `scoped` in favor of `loadCursorConfig` with `createFromConfig`, `resumeFromConfig`, `promptFromConfig`, and `scopedFromConfig`. The old methods remain for compatibility. `CursorSdkFactory` agent entry points are documented as deprecated for application code. README and TSDoc now describe the config-based path as default and document the legacy pattern as deprecated.

- [#8](https://github.com/benjamin-kraatz/effect-cursor-sdk/pull/8) [`9b160a7`](https://github.com/benjamin-kraatz/effect-cursor-sdk/commit/9b160a7806d166c1274597304edabfd3623b015d) Thanks [@benjamin-kraatz](https://github.com/benjamin-kraatz)! - Remove `CursorAgentService` config-suffixed helpers (`createFromConfig`, `resumeFromConfig`, `promptFromConfig`, `scopedFromConfig`). Use `loadCursorConfig` with `agentOptionsFromConfig` and pass the merged `AgentOptions` to `create`, `resume`, `prompt`, or `scoped` instead. Adjust `agentOptionsFromConfig` local/cwd merging, refresh README and TSDoc for the SDK-owned options boundary, and add the `examples/` learning path (quickstart, CLI, basic agent workflow, advanced ops dashboard) plus root `examples:*` scripts.
