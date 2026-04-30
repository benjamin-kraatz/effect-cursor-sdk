# effect-cursor-sdk examples

This directory contains a guided set of applications that show how to use
`effect-cursor-sdk` from a small first script through production-style Effect
composition.

## Prerequisites

- [Bun](https://bun.sh)
- A Cursor API key in `CURSOR_API_KEY` for live examples
- Optional `CURSOR_MODEL`, for example `composer-2`
- Optional `CURSOR_LOCAL_CWD`, used as the default local agent working directory

Each example depends on the repository package with `"effect-cursor-sdk": "file:../.."`.
If you copy an example into your own project, replace that dependency with the
published npm package:

```bash
bun add effect-cursor-sdk effect @cursor/sdk
```

## Learning path

| Example | Focus | Run without credentials |
| --- | --- | --- |
| [`quickstart`](./quickstart) | First config-first local agent call | No |
| [`cli`](./cli) | Small CLI, runtime helpers, mock mode, tagged errors | Yes, with `--mock` |
| [`basic-agent-workflow`](./basic-agent-workflow) | Scoped agents, streaming, status, artifacts | No |
| [`advanced-ops-dashboard`](./advanced-ops-dashboard) | Inspection APIs, lifecycle operations, telemetry, redaction, mocks | Yes, with `--mock` |

## Shared setup

For any live example:

```bash
cp .env.example .env
export CURSOR_API_KEY="your-key"
export CURSOR_MODEL="composer-2"
export CURSOR_LOCAL_CWD="$(pwd)"
```

You can also set the environment variables directly in your shell. Effect's
default `ConfigProvider` reads from `process.env`, so no extra provider is
needed for these examples.

## Safety notes

The QuickStart, CLI, and Basic Workflow examples create local agents and avoid
remote lifecycle mutations. The Advanced Ops Dashboard includes opt-in
`archiveAgent`, `unarchiveAgent`, and `deleteAgent` demonstrations; those
commands require an explicit `--agent-id` and a typed confirmation phrase.
