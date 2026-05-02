# Next major migration (planned)

This mirrors [DEPRECATIONS.md](../DEPRECATIONS.md) at a high level. **No breaking release is scheduled in this document**; it only records the intended end state.

## Agent entry renames

| Current (0.2.x)                                 | Planned after removing deprecated overloads |
| ----------------------------------------------- | ------------------------------------------- |
| `createFromConfig(config, overrides?)`          | `create(config, overrides?)`                |
| `resumeFromConfig(agentId, config, overrides?)` | `resume(agentId, config, overrides?)`       |
| `promptFromConfig(message, config, overrides?)` | `prompt(message, config, overrides?)`       |
| `scopedFromConfig(config, overrides?)`          | `scoped(config, overrides?)`                |

Legacy methods that accept raw {@link AgentOptions} (plain `apiKey` string) will be removed; {@link loadCursorConfig} and the config-first signatures above become the only entry points.

## Application code actions before upgrading (when the major ships)

1. Replace `agents.create({ apiKey: … })` with `loadCursorConfig` + `createFromConfig` (or the renamed `create`).
2. Remove uses of deprecated {@link CursorSdkFactory} `create` / `resume` / `prompt` from application layers (keep for tests if needed).
3. Run tests with {@link mockLayer}; confirm `CursorSdkFactory` mocks still implement any new factory methods required by that major.

Watch [CHANGELOG.md](../CHANGELOG.md) and `DEPRECATIONS.md` for the actual major version and any codemods.
