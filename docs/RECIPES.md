# Recipes

Short patterns for common tasks. Each corresponds to an [`examples/`](../examples) app where a fuller program is useful.

**Design note:** This package intentionally keeps the public API centered on the four Effect services (`CursorAgentService`, `CursorRunService`, `CursorArtifactService`, `CursorInspectionService`) plus config, observability, and mocks. Common compositions live here as copy-paste recipes so you always see which service owns each step.

## Config-first agent (preferred)

Use {@link loadCursorConfig} with {@link CursorAgentService.scopedFromConfig} or `createFromConfig`:

```ts
import { CursorAgentService, loadCursorConfig, liveLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const agent = yield* agents.scopedFromConfig(config, {
      local: { cwd: process.cwd() },
    });
    return yield* agents.send(agent, "Summarize the repo");
  }),
).pipe(Effect.provide(liveLayer));
```

Equivalent merge style (also common in examples):

```ts
import { agentOptionsFromConfig } from "effect-cursor-sdk";

const agent = yield* agents.scoped(agentOptionsFromConfig(config, { local: { cwd: process.cwd() } }));
```

## One-shot text from a prompt

Use {@link CursorAgentService.promptFromConfig} and read `result` (default to empty string if absent):

```ts
import { CursorAgentService, liveLayer, loadCursorConfig } from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const config = yield* loadCursorConfig;
  const agents = yield* CursorAgentService;
  const out = yield* agents.promptFromConfig("Hello", config, { model: { id: "composer-2" } });
  return out.result ?? "";
}).pipe(Effect.provide(liveLayer));
```

## Send and collect assistant text

Call {@link CursorAgentService.send}, then {@link CursorRunService.collectText} on the returned run:

```ts
import { CursorAgentService, CursorRunService, loadCursorConfig, liveLayer } from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const agent = yield* agents.scopedFromConfig(config, { local: { cwd: process.cwd() } });
    const run = yield* agents.send(agent, "Explain Effect layers");
    return yield* runs.collectText(run);
  }),
).pipe(Effect.provide(liveLayer));
```

## Streaming with metrics

Use {@link streamEventsTracked} or {@link collectTextTracked} with {@link CursorRunService.streamEvents}:

```ts
import {
  collectTextTracked,
  CursorAgentService,
  CursorRunService,
  loadCursorConfig,
  liveLayer,
} from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.scoped(
  Effect.gen(function* () {
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const config = yield* loadCursorConfig;
    const agent = yield* agents.scopedFromConfig(config, { local: { cwd: process.cwd() } });
    const run = yield* agents.send(agent, "Hi");
    return yield* collectTextTracked(run, (r) => runs.streamEvents(r));
  }),
).pipe(Effect.provide(liveLayer));
```

## Status as a stream

{@link CursorRunService.streamStatusChanges}:

```ts
runs.streamStatusChanges(run).pipe(Stream.take(3), Stream.runCollect);
```

## Resilient catalog fetch

Reuse {@link cursorCatalogRetrySchedule} and {@link cursorCatalogLoadTimeout}:

```ts
import {
  cursorCatalogLoadTimeout,
  cursorCatalogRetrySchedule,
  CursorInspectionService,
  liveLayer,
} from "effect-cursor-sdk";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const inspection = yield* CursorInspectionService;
  return yield* Effect.all(
    {
      agents: inspection.listAgents({ runtime: "cloud" }),
      models: inspection.listModels(),
    },
    { concurrency: "unbounded" },
  ).pipe(Effect.retry(cursorCatalogRetrySchedule), Effect.timeout(cursorCatalogLoadTimeout));
}).pipe(Effect.provide(liveLayer));
```

## Paginated lists

`listAgents` / `listRuns` return `nextCursor`. Loop until `nextCursor` is absent (with a `maxPages` guard):

```ts
import { CursorInspectionService, liveLayer } from "effect-cursor-sdk";
import type { ListAgentsOptions, ListRunsOptions, Run, SDKAgentInfo } from "effect-cursor-sdk";
import { Effect } from "effect";

const listAgentsAllPages = (base?: ListAgentsOptions, maxPages = 100) =>
  Effect.gen(function* () {
    const inspection = yield* CursorInspectionService;
    const out: SDKAgentInfo[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const res = yield* inspection.listAgents({ ...base, cursor } as ListAgentsOptions);
      out.push(...res.items);
      cursor = res.nextCursor;
      if (cursor === undefined || res.items.length === 0) break;
    }
    return out;
  });

const listRunsAllPages = (agentId: string, base?: ListRunsOptions, maxPages = 100) =>
  Effect.gen(function* () {
    const inspection = yield* CursorInspectionService;
    const out: Run[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const res = yield* inspection.listRuns(agentId, { ...base, cursor } as ListRunsOptions);
      out.push(...res.items);
      cursor = res.nextCursor;
      if (cursor === undefined || res.items.length === 0) break;
    }
    return out;
  });

// …then e.g. listAgentsAllPages({ runtime: "cloud" }).pipe(Effect.provide(liveLayer));
```

## Lifecycle mutations (archive / unarchive / delete)

Require operators to type an exact phrase before calling {@link CursorInspectionService.archiveAgent}, `unarchiveAgent`, or `deleteAgent`:

```ts
import { CursorInspectionService, liveLayer } from "effect-cursor-sdk";
import { Data, Effect } from "effect";

type LifecycleAction = "archive" | "unarchive" | "delete";

class LifecycleConfirmationError extends Data.TaggedError("LifecycleConfirmationError")<{
  readonly message: string;
  readonly action: LifecycleAction;
  readonly agentId: string;
}> {}

const lifecyclePhrase = (action: LifecycleAction, agentId: string) => `${action.toUpperCase()} ${agentId}`;

const ensureLifecycleConfirmation = (
  action: LifecycleAction,
  agentId: string,
  typed: string,
): Effect.Effect<void, LifecycleConfirmationError> => {
  const expected = lifecyclePhrase(action, agentId);
  if (typed !== expected) {
    return Effect.fail(
      new LifecycleConfirmationError({
        message: `Expected confirmation "${expected}".`,
        action,
        agentId,
      }),
    );
  }
  return Effect.void;
};

const archiveAgentConfirmed = (agentId: string, typed: string) =>
  Effect.gen(function* () {
    yield* ensureLifecycleConfirmation("archive", agentId, typed);
    const inspection = yield* CursorInspectionService;
    yield* inspection.archiveAgent(agentId);
  });

// archiveAgentConfirmed("agt_1", "ARCHIVE agt_1").pipe(Effect.provide(liveLayer));
```

Adjust for `unarchiveAgent` / `deleteAgent` the same way.

## Artifacts

After {@link CursorArtifactService.listArtifacts}, pick a path (exact, basename, or suffix match) and {@link CursorArtifactService.downloadArtifact}:

```ts
import { CursorArtifactService, liveLayer } from "effect-cursor-sdk";
import type { SDKAgent, SDKArtifact } from "effect-cursor-sdk";
import { Effect } from "effect";

function resolveArtifactPath(requested: string, list: ReadonlyArray<SDKArtifact>): string | undefined {
  if (list.some((a) => a.path === requested)) return requested;
  const base = requested.replace(/^.*\//, "");
  return list.find((a) => a.path === base || a.path.endsWith(`/${base}`))?.path;
}

const downloadArtifactResolved = (
  agent: SDKAgent,
  listing: ReadonlyArray<SDKArtifact>,
  requested?: string,
) =>
  Effect.gen(function* () {
    const artifacts = yield* CursorArtifactService;
    const path = requested ? resolveArtifactPath(requested, listing) : listing[0]?.path;
    if (path === undefined) return undefined;
    const bytes = yield* artifacts.downloadArtifact(agent, path);
    return { path, bytes } as const;
  });

// downloadArtifactResolved(agent, listing, "coverage.html").pipe(Effect.provide(liveLayer));
```

## Testing

- {@link mockLayer} / {@link makeMockRuntime} for full stack tests.
- {@link CursorMockFixtures.factoryErrors} to exercise error mapping and retries.
- {@link CursorMockFixtures.sendSequence} for multi-turn runs.
- {@link makeMockAssistantSdkMessage} for stream fixtures.

See [SDK_COVERAGE.md](./SDK_COVERAGE.md) for wrapper vs re-export policy.
