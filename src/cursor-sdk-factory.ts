import { Agent, Cursor } from "@cursor/february";
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
 * Thin boundary around the static `@cursor/february` APIs.
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
 * **API boundary notice:** `create`, `resume`, and `prompt` take raw
 * {@link AgentOptions} today; the same possible future change described on
 * {@link CursorAgentServiceShape} may apply here. Prefer
 * {@link loadCursorConfig} with {@link agentOptionsFromConfig} before calling
 * these methods when wiring production code.
 *
 * @category services
 */
export interface CursorSdkFactoryShape {
  readonly create: (options: AgentOptions) => SDKAgent;
  readonly resume: (agentId: string, options?: Partial<AgentOptions>) => SDKAgent;
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
 * Context service that provides the live `@cursor/february` static API boundary.
 *
 * Use {@link CursorSdkFactory.Live} in production layers and override the
 * service in tests with {@link makeMockSdkFactoryLayer} or a custom layer.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function*() {
 *   const sdk = yield* CursorSdkFactory
 *   return sdk.create({ model: { id: "composer-2" }, local: { cwd: process.cwd() } })
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
      create: (options: AgentOptions): SDKAgent => {
        return Agent.create(options);
      },
      resume: (agentId: string, options?: Partial<AgentOptions>): SDKAgent => {
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
