import { Agent, Cursor } from "@cursor/sdk";
import { Context, Layer } from "effect";

import type {
  AgentMessage,
  AgentOperationOptions,
  AgentOptions,
  CursorRequestOptions,
  GetAgentMessagesOptions,
  GetAgentOptions,
  GetRunOptions,
  ListAgentsOptions,
  ListResult,
  ListRunsOptions,
  Run,
  RunResult,
  SDKAgent,
  SDKAgentInfo,
  SDKModel,
  SDKRepository,
  SDKUser,
} from "./cursor-types";

/* oxlint-disable eslint/no-unused-vars -- type-only imports anchor TSDoc `{@link …}`; not referenced in code */
import type { CursorAgentService } from "./cursor-agent";
import type { CursorArtifactService } from "./cursor-artifacts";
import type { CursorInspectionService } from "./cursor-inspection";
import type { CursorRunService } from "./cursor-run";
/* oxlint-enable eslint/no-unused-vars */

/**
 * Thin boundary around the static `@cursor/sdk` APIs.
 *
 * Most application code should use {@link CursorAgentService},
 * {@link CursorRunService}, {@link CursorArtifactService}, and
 * {@link CursorInspectionService}. This factory exists so live code, tests, and
 * user applications can replace SDK construction and static calls without
 * monkey-patching imports.
 *
 * So in one line: you probably won't need this.
 *
 * @example
 * ```ts
 * import { CursorSdkFactory, CursorAgentService } from "effect-cursor-sdk"
 * import { Layer } from "effect"
 *
 * const TestSdk = Layer.succeed(CursorSdkFactory)(
 *   CursorSdkFactory.of({
 *     create: () => mockAgent,
 *     // implement the remaining factory methods for your test
 *   })
 * )
 * ```
 *
 * @see {@link CursorAgentService} for creating, resuming, sending, and disposing agents.
 * @see {@link CursorRunService} for wrapping `Run` handles.
 * @see {@link CursorInspectionService} for static agent and account APIs.
 * @see {@link CursorArtifactService} for artifact APIs on an SDK agent.
 *
 * @remarks
 * **Deprecated for application code:** `create`, `resume`, and `prompt` accept
 * raw {@link AgentOptions} (including a plain `apiKey` string). Prefer
 * {@link CursorAgentService} with `loadCursorConfig` and `createFromConfig` /
 * `resumeFromConfig` / `promptFromConfig` from this package instead.
 * This factory remains the low-level adapter for tests and advanced overrides.
 *
 * @category services
 */
export interface CursorSdkFactoryShape {
  /**
   * @deprecated Prefer {@link CursorAgentService} with config-based helpers.
   * Low-level adapter to `Agent.create`.
   */
  readonly create: (options: AgentOptions) => Promise<SDKAgent>;
  /**
   * @deprecated Prefer {@link CursorAgentService} with config-based helpers.
   * Low-level adapter to `Agent.resume`.
   */
  readonly resume: (agentId: string, options?: Partial<AgentOptions>) => Promise<SDKAgent>;
  /**
   * @deprecated Prefer {@link CursorAgentService} with config-based helpers.
   * Low-level adapter to `Agent.prompt`.
   */
  readonly prompt: (message: string, options?: AgentOptions) => Promise<RunResult>;
  readonly listAgents: (options?: ListAgentsOptions) => Promise<ListResult<SDKAgentInfo>>;
  readonly listRuns: (agentId: string, options?: ListRunsOptions) => Promise<ListResult<Run>>;
  readonly getRun: (runId: string, options?: GetRunOptions) => Promise<Run>;
  readonly getAgent: (agentId: string, options?: GetAgentOptions) => Promise<SDKAgentInfo>;
  readonly archiveAgent: (agentId: string, options?: AgentOperationOptions) => Promise<void>;
  readonly unarchiveAgent: (agentId: string, options?: AgentOperationOptions) => Promise<void>;
  readonly deleteAgent: (agentId: string, options?: AgentOperationOptions) => Promise<void>;
  readonly listMessages: (
    agentId: string,
    options?: GetAgentMessagesOptions,
  ) => Promise<AgentMessage[]>;
  readonly me: (options?: CursorRequestOptions) => Promise<SDKUser>;
  readonly listModels: (options?: CursorRequestOptions) => Promise<SDKModel[]>;
  readonly listRepositories: (options?: CursorRequestOptions) => Promise<SDKRepository[]>;
}

/**
 * Context service that provides the live `@cursor/sdk` static API boundary.
 *
 * Use {@link CursorSdkFactory.Live} in production layers and override the
 * service in tests with {@link makeMockSdkFactoryLayer} or a custom layer.
 *
 * @example
 * ```ts
 * import { CursorSdkFactory, agentOptionsFromConfig, loadCursorConfig } from "effect-cursor-sdk"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const sdk = yield* CursorSdkFactory
 *   const config = yield* loadCursorConfig
 *   return sdk.create(agentOptionsFromConfig(config, { model: { id: "composer-2" } }))
 * })
 * ```
 *
 * @see {@link CursorSdkFactoryShape}
 * @see {@link liveLayer}
 * @category services
 */
export class CursorSdkFactory extends Context.Service<CursorSdkFactory, CursorSdkFactoryShape>()(
  "effect-cursor-sdk/cursor-sdk-factory/CursorSdkFactory",
) {
  static readonly Live = Layer.succeed(CursorSdkFactory)(
    CursorSdkFactory.of({
      create: (options: AgentOptions): Promise<SDKAgent> => {
        return Agent.create(options);
      },
      resume: (agentId: string, options?: Partial<AgentOptions>): Promise<SDKAgent> => {
        return Agent.resume(agentId, options);
      },
      prompt: (message: string, options?: AgentOptions): Promise<RunResult> => {
        return Agent.prompt(message, options);
      },
      listAgents: (options?: ListAgentsOptions): Promise<ListResult<SDKAgentInfo>> => {
        return Agent.list(options);
      },
      listRuns: (agentId: string, options?: ListRunsOptions): Promise<ListResult<Run>> => {
        return Agent.listRuns(agentId, options);
      },
      getRun: (runId: string, options?: GetRunOptions): Promise<Run> => {
        return Agent.getRun(runId, options);
      },
      getAgent: (agentId: string, options?: GetAgentOptions): Promise<SDKAgentInfo> => {
        return Agent.get(agentId, options);
      },
      archiveAgent: (agentId: string, options?: AgentOperationOptions): Promise<void> => {
        return Agent.archive(agentId, options);
      },
      unarchiveAgent: (agentId: string, options?: AgentOperationOptions): Promise<void> => {
        return Agent.unarchive(agentId, options);
      },
      deleteAgent: (agentId: string, options?: AgentOperationOptions): Promise<void> => {
        return Agent.delete(agentId, options);
      },
      listMessages: (agentId: string, options?: GetAgentMessagesOptions) => {
        return Agent.messages.list(agentId, options);
      },
      me: (options?: CursorRequestOptions): Promise<SDKUser> => {
        return Cursor.me(options);
      },
      listModels: (options?: CursorRequestOptions): Promise<SDKModel[]> => {
        return Cursor.models.list(options);
      },
      listRepositories: (options?: CursorRequestOptions): Promise<SDKRepository[]> => {
        return Cursor.repositories.list(options);
      },
    }),
  );
}
