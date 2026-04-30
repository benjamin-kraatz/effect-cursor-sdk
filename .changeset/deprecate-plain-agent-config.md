---
"effect-cursor-sdk": minor
---

Deprecate passing plain `AgentOptions` to `CursorAgentService` `create`, `resume`, `prompt`, and `scoped` in favor of `loadCursorConfig` with `createFromConfig`, `resumeFromConfig`, `promptFromConfig`, and `scopedFromConfig`. The old methods remain for compatibility. `CursorSdkFactory` agent entry points are documented as deprecated for application code. README and TSDoc now describe the config-based path as default and document the legacy pattern as deprecated.
