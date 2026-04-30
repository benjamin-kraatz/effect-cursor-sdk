---
"effect-cursor-sdk": minor
---

Remove `CursorAgentService` config-suffixed helpers (`createFromConfig`, `resumeFromConfig`, `promptFromConfig`, `scopedFromConfig`). Use `loadCursorConfig` with `agentOptionsFromConfig` and pass the merged `AgentOptions` to `create`, `resume`, `prompt`, or `scoped` instead. Adjust `agentOptionsFromConfig` local/cwd merging, refresh README and TSDoc for the SDK-owned options boundary, and add the `examples/` learning path (quickstart, CLI, basic agent workflow, advanced ops dashboard) plus root `examples:*` scripts.
