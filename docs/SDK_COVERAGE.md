# SDK coverage and compatibility

This document is the (somewhat?) **source of truth** for how `effect-cursor-sdk` tracks [@cursor/sdk](https://cursor.com/docs/sdk/typescript). Update it whenever you add wrappers, re-exports, or bump the SDK.

## Policy

| Layer                      | What belongs here                                                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Effect-native services** | Each important SDK call gets `Effect.tryPromise` (or `Stream`), `mapCursorError`, and `instrument` via `CursorAgentService`, `CursorRunService`, `CursorArtifactService`, or `CursorInspectionService`.            |
| **Thin factory**           | `CursorSdkFactory` mirrors static `Agent.*` / `Cursor.*` entry points for tests and advanced DI.                                                                                                                   |
| **Types and utilities**    | Curated re-exports in [`src/cursor-types.ts`](../src/cursor-types.ts). Anything else: import from `@cursor/sdk` directly (SDK stays the data-model source of truth).                                               |
| **Cross-cutting helpers**   | Observability presets in [`src/cursor-observability.ts`](../src/cursor-observability.ts). Common multi-step flows belong in [RECIPES.md](./RECIPES.md) as documentation, not extra package exports. |

## Wrapper checklist (maintain when `@cursor/sdk` changes)

Mark each row when verified against the **pinned** SDK version in root [`package.json`](../package.json).

### `Agent` static and instances

| SDK surface                                       | Wrapper location                                                            | Status |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| `Agent.create`                                    | `CursorAgentService.create`, `CursorSdkFactory.create` | OK     |
| `Agent.resume`                                    | `CursorAgentService.resume`, `CursorSdkFactory.resume` | OK     |
| `Agent.prompt`                                    | `CursorAgentService.prompt`, `CursorSdkFactory.prompt` | OK     |
| `Agent.list`                                      | `CursorInspectionService.listAgents`, `CursorSdkFactory.listAgents`         | OK     |
| `Agent.get`                                       | `CursorInspectionService.getAgent`, `CursorSdkFactory.getAgent`             | OK     |
| `Agent.archive` / `unarchive` / `delete`          | `CursorInspectionService.archiveAgent` / `unarchiveAgent` / `deleteAgent`   | OK     |
| `Agent.listRuns`                                  | `CursorInspectionService.listRuns`, `CursorSdkFactory.listRuns`             | OK     |
| `Agent.getRun`                                    | `CursorInspectionService.getRun`, `CursorSdkFactory.getRun`                 | OK     |
| `Agent.messages.list`                             | `CursorInspectionService.listMessages`, `CursorSdkFactory.listMessages`     | OK     |
| `SDKAgent.send`                                   | `CursorAgentService.send`                                                   | OK     |
| `SDKAgent.reload`                                 | `CursorAgentService.reload`                                                 | OK     |
| `SDKAgent.close`                                  | `CursorAgentService.close`                                                  | OK     |
| async dispose                                     | `CursorAgentService.dispose`                                                | OK     |
| `SDKAgent.listArtifacts`                          | `CursorArtifactService.listArtifacts`                                       | OK     |
| `SDKAgent.downloadArtifact`                       | `CursorArtifactService.downloadArtifact`                                    | OK     |
| `Run.wait` / `cancel` / `conversation` / `stream` | `CursorRunService`                                                          | OK     |
| `Run.supports` / `unsupportedReason`              | `CursorRunService.supports` / `unsupportedReason`                           | OK     |
| `Run.onDidChangeStatus`                           | `CursorRunService.onDidChangeStatus` (+ `streamStatusChanges` helper)       | OK     |

### `Cursor` account APIs

| SDK surface                | Wrapper location                                                                | Status |
| -------------------------- | ------------------------------------------------------------------------------- | ------ |
| `Cursor.me`                | `CursorInspectionService.me`, `CursorSdkFactory.me`                             | OK     |
| `Cursor.models.list`       | `CursorInspectionService.listModels`, `CursorSdkFactory.listModels`             | OK     |
| `Cursor.repositories.list` | `CursorInspectionService.listRepositories`, `CursorSdkFactory.listRepositories` | OK     |

### Re-exported from `cursor-types`

Helpers and errors such as `AuthenticationError`, `AgentBusyError`, local run stream decoders, `createAgentPlatform`, etc. See [`src/cursor-types.ts`](../src/cursor-types.ts). New SDK exports are **not** automatic: add them here deliberately to avoid semver surprises.

## Optional audit script

From the repo root (after `bun install` so `@cursor/sdk` is present):

```bash
bun run sdk-audit
```

The script compares known wrapper operations to exports reachable from `@cursor/sdk` and prints gaps. It is advisory: some SDK exports are types-only or platform binaries.

## Release alignment

When bumping `@cursor/sdk`:

1. Run `bun run sdk-audit`.
2. Update this checklist if new `Agent` / `Cursor` methods appear.
3. Update `CursorSdkFactoryShape`, live implementation, and `makeMockSdkFactoryLayer` mocks in lockstep.
4. Run `bun run verify:publish` and `bun run examples:typecheck`.

See also [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
