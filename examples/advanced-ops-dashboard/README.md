# Advanced Ops Dashboard

This example treats `effect-cursor-sdk` as an Effect-native integration layer for
operational tooling. It loads Cursor account metadata and catalog information,
renders a safe summary, optionally asks Cursor for a triage recommendation, and
demonstrates confirmation-gated agent lifecycle operations.

It is the richest example in the suite and covers:

- `CursorInspectionService.me`
- `listModels`, `listRepositories`, `listAgents`, `listRuns`, and `listMessages`
- `archiveAgent`, `unarchiveAgent`, and `deleteAgent`
- `CursorAgentService.prompt`
- `mockLayer` / `makeMockRuntime`
- `redact`
- telemetry exports such as `cursorStreamEvents`
- `Effect.all`, retries, timeouts, logging, and tagged error recovery

## Setup

```bash
bun install
bun run --cwd ../.. build
cp .env.example .env
export CURSOR_API_KEY="your-key"
export CURSOR_MODEL="composer-2"
```

The example package links to this repository after install. In an application,
install the published package instead.

## Run

Mock mode works without credentials:

```bash
bun run dev -- --mock
bun run dev -- --mock --triage
```

Live read-only dashboard:

```bash
bun run dev
```

Ask Cursor for a short triage note based on the loaded inventory:

```bash
bun run dev -- --triage
```

## Lifecycle operations

Lifecycle operations mutate remote Cursor state. They require a concrete agent id
and a typed confirmation phrase.

```bash
bun run dev -- --mock lifecycle archive --agent-id mock-agent
bun run dev -- lifecycle archive --agent-id agt_123
bun run dev -- lifecycle unarchive --agent-id agt_123
bun run dev -- lifecycle delete --agent-id agt_123
```

Before executing, the example fetches and displays the target agent summary. Type
the shown phrase exactly to continue.

## What to read

- [`src/main.ts`](./src/main.ts) wires the application and lifecycle safeguards.
- [`src/fixtures.ts`](./src/fixtures.ts) provides deterministic mock data.
- [`src/render.ts`](./src/render.ts) keeps terminal output formatting separate
  from SDK orchestration.

## Safety

The default command is read-only. Lifecycle mutations only run when you select a
lifecycle subcommand, pass `--agent-id`, and confirm the exact phrase.
