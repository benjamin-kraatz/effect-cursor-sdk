# effect-cursor-sdk

[![npm](https://img.shields.io/npm/v/effect-cursor-sdk)](https://www.npmjs.com/package/effect-cursor-sdk) ![License MIT](https://img.shields.io/github/license/benjamin-kraatz/effect-cursor-sdk) ![CI](https://img.shields.io/github/actions/workflow/status/benjamin-kraatz/effect-cursor-sdk/ci.yml) ![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/benjamin-kraatz/effect-cursor-sdk?utm_source=oss&utm_medium=github&utm_campaign=benjamin-kraatz%2Feffect-cursor-sdk&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

Effect-native access to the new [Cursor SDK](https://cursor.com/docs/sdk/typescript).

`effect-cursor-sdk` wraps `@cursor/sdk` with Effect services, layers, scoped resource management, tagged errors, observability hooks, deterministic mocks, and ready-made runtimes. The upstream SDK remains the source of truth for Cursor-owned types; this package adds Effect ergonomics without creating a parallel model that can drift.

If you want to build with Cursor agents, and you are using Effect, this package is for you.

## Philosophy

- SDK-first: every public `@cursor/sdk` capability should be usable through this package.
- Effect-native: APIs return `Effect`, `Stream`, `Context.Service`, and `Layer` values.
- Type-preserving: SDK data types are re-exported instead of rebuilt.
- Resource-safe: scoped helpers make it easy to dispose agents correctly.
- Observable: SDK calls are wrapped in spans and metrics with secret redaction utilities.
- Testable: mock layers and fixtures let applications test Cursor workflows without network calls.

## Documentation

- [SDK coverage & compatibility](./docs/SDK_COVERAGE.md) — wrapper checklist, audit script, release alignment
- [Recipes](./docs/RECIPES.md) — short patterns (config-first agent, streaming, pagination, lifecycle, tests)
- [Release checklist](./docs/RELEASE_CHECKLIST.md) — gates, SDK bumps, Changesets

## Feature Coverage

| SDK capability                                                                   | Effect wrapper                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Agent.create`, `Agent.resume`, `Agent.prompt`                                   | `CursorAgentService`                           |
| `agent.send`, `reload`, `getUsage`, `close`, async dispose                       | `CursorAgentService`                           |
| `run.wait`, `stream`, `conversation`, `cancel`, status listeners / streams, support checks | `CursorRunService`                             |
| `agent.listArtifacts`, `downloadArtifact`                                        | `CursorArtifactService`                        |
| `Agent.list`, `get`, `getUsage`, `listRuns`, `getRun`, messages                  | `CursorInspectionService`                      |
| `Agent.archive`, `unarchive`, `delete`                                           | `CursorInspectionService`                      |
| `Cursor.me`, models, repositories                                                | `CursorInspectionService`                      |
| MCP servers, sub-agents, local/cloud options, model options                      | Defaults via `CursorConfig` / `loadCursorConfig`; merged into SDK `AgentOptions` at the boundary |
| Local run event helpers and platform helpers                                     | Re-exported from `@cursor/sdk`                 |

## Use cases

If you are new to the Cursor SDK, take a look at the [Cursor SDK Cookbook](https://github.com/cursor/cookbook). This cookbook provides some (cool!) examples of what you could do with the SDK.

`effect-cursor-sdk` even [uses itself](#automated-changeset-agent) to spin up a Cursor agent to create changesets for pull requests against `main`! 🤯

## Install

```bash
bun add effect-cursor-sdk effect @cursor/sdk
```

`effect` is a **peer dependency** (Effect v4). `@cursor/sdk` is bundled with this package, but installing it in your app keeps SDK-owned types and versions explicit when you import from `@cursor/sdk` alongside the wrapper.

### Requirements

- **Runtime:** Bun or Node.js (examples and CI use Bun; Node works for library consumers).
- **Effect:** `^4.0.0-beta` (see [Effect v4](https://effect.website/docs/introduction/overview) — still pre-release on the Effect side).
- **Cursor SDK:** `@cursor/sdk` `^1.0.x` (pinned in this repo; see [SDK coverage](./docs/SDK_COVERAGE.md) when upgrading).

### Configuration

`loadCursorConfig` reads optional environment variables through Effect’s `ConfigProvider` (by default, `process.env`):

| Variable | Purpose |
| --- | --- |
| `CURSOR_API_KEY` | API key for Cursor (stored as `Redacted` until merged into SDK options). |
| `CURSOR_MODEL` | Default model id (for example `composer-2`). |
| `CURSOR_LOCAL_CWD` | Default working directory for local agents. |

All fields are optional at load time; missing `CURSOR_API_KEY` logs a warning and later SDK calls fail with authentication errors unless you pass overrides. Per-call overrides still win when using `create`, `scoped`, `prompt`, and `resume`.

For offline tests and CI, use [`mockLayer`](#mocks-and-tests) or `makeMockRuntime` — no API key required.

For development in this repo:

```bash
bun install
bun run typecheck
bun run test
```

## Examples

The [`examples`](./examples) directory contains a guided learning path from a
minimal first script to production-style Effect composition:

| Example | What it demonstrates |
| --- | --- |
| [`quickstart`](./examples/quickstart) | First config-first local agent call with `loadCursorConfig`, `scoped`, and `collectText`. |
| [`cli`](./examples/cli) | A small terminal app with `liveRuntime`, offline `makeMockRuntime`, CLI overrides, and tagged error handling. |
| [`basic-agent-workflow`](./examples/basic-agent-workflow) | Scoped agents, run status listeners, streaming, capability checks, and artifact listing/downloads. |
| [`advanced-ops-dashboard`](./examples/advanced-ops-dashboard) | Inspection APIs, confirmation-gated lifecycle operations, parallel Effect composition, retries/timeouts, telemetry, redaction, and rich mocks. |

Run all example typechecks from the repo root:

```bash
bun run examples:typecheck
```

## Quick Start

Load environment defaults with `loadCursorConfig`, then create agents with `create` (and `scoped`, `prompt`, `resume` as needed). The API key stays in `Redacted` form until the merge step; `AgentOptions.apiKey` remains a plain string at the SDK boundary.

```ts
import {
  CursorAgentService,
  CursorRunService,
  loadCursorConfig,
  liveLayer,
} from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const agents = yield* CursorAgentService;
  const runs = yield* CursorRunService;

  const config = yield* loadCursorConfig;
  const agent = yield* agents.create(config, {
    // Override the given config optionally with custom values
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  const run = yield* agents.send(agent, "Explain this repository");
  const text = yield* runs.collectText(run);

  yield* agents.dispose(agent);
  return text;
}).pipe(Effect.provide(liveLayer));
```

Effect’s default `ConfigProvider` reads `process.env`, so you usually do not need to install a custom provider for this.

For advanced SDK-factory wiring in tests, you can still call `agentOptionsFromConfig` to merge config into plain `AgentOptions` before passing them to `CursorSdkFactory`.

## Scoped Agents

Prefer `scoped` when an agent should be disposed automatically:

```ts
import { CursorAgentService, loadCursorConfig, liveLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const agents = yield* CursorAgentService;
    const config = yield* loadCursorConfig;
    const agent = yield* agents.scoped(config, {
      model: { id: "composer-2" },
      local: { cwd: process.cwd() },
    });

    return yield* agents.send(agent, "Find risky code paths");
  }),
).pipe(Effect.provide(liveLayer));
```

## Resume an existing agent

Use `resume` with the agent id from a prior run or from `CursorInspectionService.listAgents`:

```ts
const config = yield* loadCursorConfig;
const agent = yield* agents.resume("bc_abc123", config, {
  local: { cwd: process.cwd() },
});
```

## Cloud Agents

Cloud options are merged as SDK overrides on top of loaded config:

```ts
const config = yield* loadCursorConfig;
const agent = yield* agents.create(config, {
  model: { id: "composer-2" },
  cloud: {
    repos: [
      { url: "https://github.com/your-org/your-repo", startingRef: "main" },
    ],
    autoCreatePR: true,
  },
});
```

## Streaming

`CursorRunService.streamEvents` preserves SDK event shapes and returns an Effect `Stream`.

```ts
import { Effect, Stream } from "effect";

const run = yield* agents.send(agent, "Refactor the auth module");

yield* runs.streamEvents(run).pipe(
  Stream.runForEach((event) => {
    if (event.type !== "assistant") {
      return Effect.void;
    }

    const text = event.message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return Effect.sync(() => console.log(text));
  }),
);
```

## Artifacts

List and download run outputs with `CursorArtifactService` after `send` completes. See the [Artifacts recipe](./docs/RECIPES.md#artifacts) for path resolution and download patterns.

## Inspection And Metadata

Use `CursorInspectionService` for agent/run listings, messages, lifecycle operations, account metadata, model discovery, and connected repositories.

```ts
const inspection = yield* CursorInspectionService;

const agents = yield* inspection.listAgents({ runtime: "cloud", includeArchived: true });
const models = yield* inspection.listModels();
const repos = yield* inspection.listRepositories();
```

## Integrate deeper with Effect

Because every Cursor call is an `Effect`, you compose it like the rest of your program: parallel requests, timeouts, retries, logging, and layers all work the same way.

This agent garden snapshot loads your catalog in parallel, adds a resilient boundary around the batch, logs a safe summary (counts and IDs only — never log API keys), then asks Cursor for a one-shot triage opinion via `prompt`:

```ts
import {
  CursorAgentService,
  CursorInspectionService,
  loadCursorConfig,
  liveLayer,
} from "effect-cursor-sdk";
import { Effect, Schedule } from "effect";

const agentGardenSnapshot = Effect.gen(function* () {
  const inspection = yield* CursorInspectionService;
  const agents = yield* CursorAgentService;
  const config = yield* loadCursorConfig;

  const catalog = yield* Effect.all(
    {
      cloud: inspection.listAgents({ runtime: "cloud", includeArchived: false }),
      models: inspection.listModels(),
      repos: inspection.listRepositories(),
    },
    { concurrency: "unbounded" },
  ).pipe(
    Effect.retry(
      Schedule.exponential("150 millis").pipe(Schedule.upTo({ times: 3 })),
    ),
    Effect.timeout("45 seconds"),
  );

  yield* Effect.logInfo("Cursor catalog loaded", {
    cloudAgents: catalog.cloud.items.length,
    models: catalog.models.length,
    repos: catalog.repos.length,
  });

  const triage = yield* agents.prompt(
    [
      "You are helping on-call. Here is non-secret inventory:",
      `- Cloud agents (ids): ${catalog.cloud.items.map((a) => a.agentId).join(", ") || "(none)"}`,
      `- Models (ids): ${catalog.models.map((m) => m.id).join(", ") || "(none)"}`,
      `- Repos (urls): ${catalog.repos.map((r) => r.url).join(", ") || "(none)"}`,
      "In two short sentences: what should we verify first before trusting automation here?",
    ].join("\n"),
    config,
    {
      model: { id: "composer-2" },
    },
  );

  return triage.result;
}).pipe(Effect.provide(liveLayer));
```

Swap `liveLayer` for `mockLayer({ ... })` in tests and the same program shape exercises your orchestration without the network.

## Errors

SDK failures are mapped into tagged errors such as `CursorAuthenticationError`, `CursorRateLimitError`, `CursorConfigurationError`, `CursorAgentBusyError`, `CursorNetworkError`, and `CursorUnsupportedOperationError`. The original SDK error is preserved as `cause`, with safe operation context and retryability where available.

```ts
const handled = program.pipe(
  Effect.catchTag("CursorRateLimitError", (error) =>
    Effect.logWarning(`Cursor rate limited request: ${error.message}`),
  ),
);
```

## Observability

Live service methods are wrapped with operation spans such as `cursor.agent.create`, `cursor.run.wait`, and `cursor.artifacts.download`. The package also exports metrics for operation starts, failures, and stream events, plus `redact` for safe metadata handling.

Never log API keys, MCP credentials, authorization headers, or prompt image data. The provided redaction helper treats those as sensitive by default.

> [!WARNING]
> The [redaction helper](./src/cursor-telemetry.ts#177) is a best-effort redactor for logs and attributes — not a cryptographic guarantee; do not rely on it for compliance redaction without review.

## Mocks And Tests

Use `mockLayer` for deterministic tests:

```ts
import { CursorAgentService, loadCursorConfig, mockLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const testProgram = Effect.gen(function* () {
  const agents = yield* CursorAgentService;
  const config = yield* loadCursorConfig;
  const agent = yield* agents.create(config, { model: { id: "composer-2" } });
  return yield* agents.send(agent, "Hello");
}).pipe(
  Effect.provide(
    mockLayer({
      result: { id: "run-1", status: "finished", result: "ok" },
    }),
  ),
);
```

## API Surface

The main exports are:

- **Recipes** — common compositions (prompt text, send + collect, pagination, lifecycle guards, artifacts) in [RECIPES.md](./docs/RECIPES.md)
- **Observability helpers** (`streamEventsTracked`, `collectTextTracked`, catalog retry/timeout presets, log summaries)
- `CursorAgentService` (`create`, `scoped`, `prompt`, `resume` with `loadCursorConfig`)
- `CursorRunService`
- `CursorArtifactService`
- `CursorInspectionService`
- `CursorSdkFactory` (low-level SDK adapter for tests and advanced overrides)
- `liveLayer`, `mockLayer`, `liveRuntime`, `makeMockRuntime`
- `CursorConfig`, `cursorConfig`, `agentOptionsFromConfig`, `loadCursorConfig`
- tagged Cursor error classes and `mapCursorError`
- SDK-owned types and utilities re-exported from `@cursor/sdk`

Use generated TypeScript declarations for exact signatures.

## Quality Gates

```bash
bun run typecheck
bun run sdk-audit
bun run lint
bun run format:check
bun run test
bun run test:coverage
bun run build
bun run lint:package
```

After a `@cursor/sdk` bump, if `sdk-audit` fails, review [docs/SDK_COVERAGE.md](./docs/SDK_COVERAGE.md) and refresh the baseline only when drift is intentional: `bun run sdk-audit:refresh`.

Coverage is measured with Vitest v8 coverage. The suite focuses on deterministic wrapper behavior; live SDK network paths should be validated separately with credentials and a disposable repository.

## Deprecations

See **[DEPRECATIONS.md](./DEPRECATIONS.md)** for the canonical list of deprecated APIs. Pair it with **[CHANGELOG.md](./CHANGELOG.md)** for release-by-release notes.

## Versioning and Publishing

Use conventional commits for readable history and changelog context:

```bash
feat: add cursor artifact helpers
fix: map cursor rate limit errors
docs: clarify runtime setup
```

User-facing changes should include a Changeset:

```bash
bun run changeset
```

### Automated Changeset Agent

This repository also includes a Cursor-powered changeset agent for pull requests against `main`. The workflow in `.github/workflows/changeset-agent.yml` runs `bun run changeset:agent`, starts a scoped local Cursor SDK agent with this package, asks it to inspect the PR diff, and commits a missing `.changeset/*.md` file back to the PR branch when release impact exists.

The job runs only for same-repository, non-draft PRs because it needs both the `CURSOR_API_KEY` repository secret and write access to the PR branch. Forked PRs should add changesets manually or be handled from a trusted maintainer checkout.

Other, optional environment variables are `CURSOR_MODEL` for the Cursor model id and `CHANGESET_BASE_REF` for the diff base. See [Changeset Agent](./docs/changeset-agent.md) for the full architecture, prompt contract, security model, and local usage.

On `main`, GitHub Actions uses Changesets to open a version PR when pending Changesets exist. After that PR is merged, the same workflow runs `bun run release` and publishes to NPM.

For local release preparation, apply pending Changesets and publish only after the package is approved for public release:

```bash
bun run version
bun run release
```

`bun run release` runs `verify:publish` (including `sdk-audit`) before publishing to NPM.
