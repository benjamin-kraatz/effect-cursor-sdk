# CLI example

This example wraps `effect-cursor-sdk` in a small command-line application. It
shows how to combine simple argument parsing, `liveRuntime`, `makeMockRuntime`,
config overrides, and tagged error handling.

## What it demonstrates

- `liveRuntime.runPromise` for small scripts.
- `makeMockRuntime` for offline demos and docs.
- `loadCursorConfig` and `agentOptionsFromConfig`.
- `CursorAgentService.prompt`.
- `Effect.catchTag` for common Cursor failures.

## Setup

```bash
cd examples/cli
bun install
bun run --cwd ../.. build
cp .env.example .env
export CURSOR_API_KEY="your-key"
```

For mock mode, credentials are not required.

## Run

```bash
bun run dev -- "Explain this repository in five bullets"
bun run dev -- --cwd ../.. --model composer-2 "Find risky code paths"
bun run dev -- --mock "Summarize the mock response"
```

## Flags

| Flag | Description |
| --- | --- |
| `--mock` | Uses deterministic fixtures instead of the live Cursor SDK. |
| `--cwd <path>` | Overrides `CURSOR_LOCAL_CWD` for a local agent run. |
| `--model <id>` | Overrides `CURSOR_MODEL`. |
| `--help` | Prints usage. |

## Common failures

- `CursorAuthenticationError`: check `CURSOR_API_KEY`.
- `CursorConfigurationError`: check model id, cwd, and prompt shape.
- `CursorAgentBusyError`: wait for the current run to finish before sending again.
- `CursorRateLimitError`: wait and retry later.
