---
"effect-cursor-sdk": minor
---

Remove deprecated plain-`AgentOptions` entry points on `CursorAgentService` and rename the config-first helpers:

- `createFromConfig` → `create`
- `resumeFromConfig` → `resume`
- `promptFromConfig` → `prompt`
- `scopedFromConfig` → `scoped`

Application code should load defaults with `loadCursorConfig`, then call the renamed methods with optional SDK overrides.

**Migration from 0.3.x:**

```ts
// Before
agents.createFromConfig(config, { model: { id: "composer-2" } });
agents.create({ apiKey: "...", model: { id: "composer-2" } }); // deprecated

// After
agents.create(config, { model: { id: "composer-2" } });
```

Removed migration docs (`docs/MIGRATION_NEXT_MAJOR.md`). `DEPRECATIONS.md` now states there are no active deprecations in this version.
