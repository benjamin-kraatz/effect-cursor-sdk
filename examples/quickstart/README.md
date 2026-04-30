# QuickStart

The smallest useful `effect-cursor-sdk` application: load Cursor configuration
from the environment, create a local agent, send one prompt, collect the
assistant text, and dispose the agent automatically.

## What it shows

- `loadCursorConfig`
- `agentOptionsFromConfig`
- `CursorAgentService`
- `CursorRunService.collectText`
- `liveLayer`
- `Effect.scoped` with `agents.scoped`

## Prepare

```bash
cd examples/quickstart
bun install
cp .env.example .env
export CURSOR_API_KEY="your-key"
export CURSOR_MODEL="composer-2"
export CURSOR_LOCAL_CWD="$(pwd)"
```

The example package depends on the local repository with
`"effect-cursor-sdk": "file:../.."`. In your own app, install the published
package instead:

```bash
bun add effect-cursor-sdk effect @cursor/sdk
```

## Run

```bash
bun run dev
```

The prompt asks Cursor to explain the repository or directory in
`CURSOR_LOCAL_CWD`. To change the request, edit the `prompt` string in
[`src/main.ts`](./src/main.ts).

## Expected output

The program prints the assistant's response as plain text. If credentials are
missing or invalid, the Effect fails with a tagged Cursor error from the package.
