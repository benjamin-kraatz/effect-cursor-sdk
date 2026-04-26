# effect-cursor-sdk

Effect-native access to the unreleased Cursor Cloud Agents TypeScript SDK.

`effect-cursor-sdk` wraps `@cursor/february` with Effect services, layers, scoped resource management, tagged errors, observability hooks, deterministic mocks, and ready-made runtimes. The upstream SDK remains the source of truth for Cursor-owned types; this package adds Effect ergonomics without creating a parallel model that can drift.

> The underlying Cursor SDK is not officially announced yet. Keep this repository private and do not publish this package until Cursor's release status changes.

## Philosophy

- SDK-first: every public `@cursor/february` capability should be usable through this package.
- Effect-native: APIs return `Effect`, `Stream`, `Context.Service`, and `Layer` values.
- Type-preserving: SDK data types are re-exported instead of rebuilt.
- Resource-safe: scoped helpers make it easy to dispose agents correctly.
- Observable: SDK calls are wrapped in spans and metrics with secret redaction utilities.
- Testable: mock layers and fixtures let applications test Cursor workflows without network calls.

## Feature Coverage

| SDK capability                                                                   | Effect wrapper                                 |
| -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `Agent.create`, `Agent.resume`, `Agent.prompt`                                   | `CursorAgentService`                           |
| `agent.send`, `reload`, `close`, async dispose                                   | `CursorAgentService`                           |
| `run.wait`, `stream`, `conversation`, `cancel`, status listeners, support checks | `CursorRunService`                             |
| `agent.listArtifacts`, `downloadArtifact`                                        | `CursorArtifactService`                        |
| `Agent.list`, `get`, `listRuns`, `getRun`, messages                              | `CursorInspectionService`                      |
| `Agent.archive`, `unarchive`, `delete`                                           | `CursorInspectionService`                      |
| `Cursor.me`, models, repositories                                                | `CursorInspectionService`                      |
| MCP servers, sub-agents, local/cloud options, model options                      | SDK-owned `AgentOptions` and re-exported types |
| Local run event helpers and platform helpers                                     | Re-exported from `@cursor/february`            |

## Install

```bash
bun add effect-cursor-sdk effect
```

This package declares `effect` as a peer dependency and currently uses Effect v4 beta APIs.

For development in this repo:

```bash
bun install
bun run typecheck
bun run test
```

## Quick Start

```ts
import { CursorAgentService, CursorRunService, liveLayer } from "effect-cursor-sdk";
import { Effect, Stream } from "effect";

const program = Effect.gen(function* () {
  const agents = yield* CursorAgentService;
  const runs = yield* CursorRunService;

  const agent = yield* agents.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2" },
    local: { cwd: process.cwd() },
  });

  const run = yield* agents.send(agent, "Explain this repository");
  const text = yield* runs.collectText(run);

  yield* agents.dispose(agent);
  return text;
}).pipe(Effect.provide(liveLayer));
```

## Scoped Agents

Prefer `scoped` when an agent should be disposed automatically:

```ts
import { CursorAgentService, liveLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const agents = yield* CursorAgentService;
    const agent = yield* agents.scoped({
      model: { id: "composer-2" },
      local: { cwd: process.cwd() },
    });

    return yield* agents.send(agent, "Find risky code paths");
  }),
).pipe(Effect.provide(liveLayer));
```

## Cloud Agents

Cloud options are passed through as SDK `AgentOptions`:

```ts
const agent =
  yield *
  agents.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: "composer-2" },
    cloud: {
      repos: [{ url: "https://github.com/your-org/your-repo", startingRef: "main" }],
      autoCreatePR: true,
    },
  });
```

## Streaming

`CursorRunService.streamEvents` preserves SDK event shapes and returns an Effect `Stream`.

```ts
const run = yield * agents.send(agent, "Refactor the auth module");

yield *
  runs
    .streamEvents(run)
    .pipe(
      Stream.runForEach((event) =>
        event.type === "assistant"
          ? Effect.sync(() => console.log(event.message.content))
          : Effect.void,
      ),
    );
```

## Inspection And Metadata

Use `CursorInspectionService` for agent/run listings, messages, lifecycle operations, account metadata, model discovery, and connected repositories.

```ts
const inspection = yield * CursorInspectionService;

const agents = yield * inspection.listAgents({ runtime: "cloud", includeArchived: true });
const models = yield * inspection.listModels();
const repos = yield * inspection.listRepositories();
```

## Errors

SDK failures are mapped into tagged errors such as `CursorAuthenticationError`, `CursorRateLimitError`, `CursorConfigurationError`, `CursorNetworkError`, and `CursorUnsupportedOperationError`. The original SDK error is preserved as `cause`, with safe operation context and retryability where available.

```ts
program.pipe(
  Effect.catchTag("CursorRateLimitError", (error) =>
    Effect.logWarning(`Cursor rate limited request: ${error.message}`),
  ),
);
```

## Observability

Live service methods are wrapped with operation spans such as `cursor.agent.create`, `cursor.run.wait`, and `cursor.artifacts.download`. The package also exports metrics for operation starts, failures, and stream events, plus `redact` for safe metadata handling.

Never log API keys, MCP credentials, authorization headers, or prompt image data. The provided redaction helper treats those as sensitive by default.

## Mocks And Tests

Use `mockLayer` for deterministic tests:

```ts
import { CursorAgentService, mockLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const testProgram = Effect.gen(function* () {
  const agents = yield* CursorAgentService;
  const agent = yield* agents.create({ model: { id: "composer-2" } });
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

- `CursorAgentService`
- `CursorRunService`
- `CursorArtifactService`
- `CursorInspectionService`
- `CursorSdkFactory`
- `liveLayer`, `mockLayer`, `liveRuntime`, `makeMockRuntime`
- `CursorConfig`, `cursorConfig`, `agentOptionsFromConfig`, `loadCursorConfig`
- tagged Cursor error classes and `mapCursorError`
- SDK-owned types and utilities re-exported from `@cursor/february`

Use generated TypeScript declarations for exact signatures.

## Quality Gates

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run test:coverage
bun run build
bun run lint:package
```

Coverage is measured with Vitest v8 coverage. The suite focuses on deterministic wrapper behavior; live SDK network paths should be validated separately with credentials and a disposable repository.

## License And Publishing

The repository currently contains a `LICENSE` file, but the Cursor SDK dependency is private alpha software. Do not publish this package or make the repository public until the upstream SDK is officially released and licensing/publishing terms are confirmed.
