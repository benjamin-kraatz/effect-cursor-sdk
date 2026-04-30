# Deprecations

This document lists deprecated `effect-cursor-sdk` APIs, what to use instead today, and how names are expected to change in the **next major** release. Deprecated APIs remain available until that major; follow [CHANGELOG.md](./CHANGELOG.md) and release notes when upgrading.

## Status definitions

| Status                 | Meaning                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| **Deprecated**         | Still supported; avoid in new code. May show IDE warnings via TSDoc `@deprecated`.                   |
| **Preferred now**      | Current recommended API; use with [`loadCursorConfig`](./README.md#quick-start) and related helpers. |
| **Planned next major** | Intended replacement names after deprecated overloads and `*FromConfig` suffixes are removed.        |

## Agent entry: plain `AgentOptions` vs config-first

Passing raw [`AgentOptions`](https://cursor.com/docs/sdk/typescript) (including a plain `apiKey` string) directly to `CursorAgentService` agent entry points is **deprecated**. Prefer loading `CursorConfig` with `loadCursorConfig` (exported from this package) and using the `*FromConfig` methods so secrets stay [`Redacted`](https://effect.website/docs/schema/redacted/) until merged for the SDK boundary.

### API mapping

| Deprecated (`CursorAgentService`) | Preferred now                                   | Planned next major (same signatures as “Preferred now”) |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `create(options)`                 | `createFromConfig(config, overrides?)`          | `create(config, overrides?)`                            |
| `resume(agentId, options?)`       | `resumeFromConfig(agentId, config, overrides?)` | `resume(agentId, config, overrides?)`                   |
| `prompt(message, options?)`       | `promptFromConfig(message, config, overrides?)` | `prompt(message, config, overrides?)`                   |
| `scoped(options)`                 | `scopedFromConfig(config, overrides?)`          | `scoped(config, overrides?)`                            |

The `*FromConfig` suffixes exist today to keep deprecated plain-`AgentOptions` entry points without breaking callers. After removal of the legacy forms, the shorter names above are the intended stable surface.

### Migrate `create`

**Before (deprecated):**

```ts
const agent =
  yield *
  agents.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });
```

**After (preferred):**

```ts
const config = yield * loadCursorConfig;
const agent =
  yield *
  agents.createFromConfig(config, {
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });
```

If you need full control over merging into SDK options, call `agentOptionsFromConfig(config, overrides)` and pass the result only through internal or transitional code paths; application code should still prefer `createFromConfig`.

### Migrate `prompt`

**Before (deprecated):**

```ts
const result =
  yield *
  agents.prompt("Summarize the README", {
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2" },
  });
```

**After (preferred):**

```ts
const config = yield * loadCursorConfig;
const result =
  yield *
  agents.promptFromConfig("Summarize the README", config, {
    model: { id: "composer-2" },
  });
```

## Other deprecations

`CursorSdkFactory` exposes raw SDK-style `create` / `resume` / `prompt` helpers for tests and advanced wiring; those are **deprecated for application code** in favor of `CursorAgentService` with the config-first flow above. See TSDoc on `CursorSdkFactory` in the published types.

## Where else this is documented

- [README.md](./README.md) — quick summary and link here.
- Package root ships this file next to `README.md` on npm (see `package.json` `files`).
- Per-symbol `@deprecated` tags on `CursorAgentService` and related exports in the TypeScript declarations.
