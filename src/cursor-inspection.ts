import { Context, Effect, Layer } from "effect";

import {
  CursorAuthenticationError,
  CursorConfigurationError,
  CursorIntegrationNotConnectedError,
  CursorNetworkError,
  CursorRateLimitError,
  CursorUnknownError,
  mapCursorError,
} from "./cursor-error";
import { CursorSdkFactory } from "./cursor-sdk-factory";
import { instrument } from "./cursor-telemetry";
import type {
  AgentMessage,
  AgentOperationOptions,
  CursorRequestOptions,
  GetAgentMessagesOptions,
  GetAgentOptions,
  GetRunOptions,
  ListAgentsOptions,
  ListResult,
  ListRunsOptions,
  Run,
  SDKAgentInfo,
  SDKModel,
  SDKRepository,
  SDKUser,
} from "./cursor-types";

export interface CursorInspectionServiceShape {
  readonly listAgents: (
    options?: ListAgentsOptions,
  ) => Effect.Effect<
    ListResult<SDKAgentInfo>,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly getAgent: (
    agentId: string,
    options?: GetAgentOptions,
  ) => Effect.Effect<
    SDKAgentInfo,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly archiveAgent: (
    agentId: string,
    options?: AgentOperationOptions,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly unarchiveAgent: (
    agentId: string,
    options?: AgentOperationOptions,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly deleteAgent: (
    agentId: string,
    options?: AgentOperationOptions,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly listRuns: (
    agentId: string,
    options?: ListRunsOptions,
  ) => Effect.Effect<
    ListResult<Run>,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly getRun: (
    runId: string,
    options?: GetRunOptions,
  ) => Effect.Effect<
    Run,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly listMessages: (
    agentId: string,
    options?: GetAgentMessagesOptions,
  ) => Effect.Effect<
    AgentMessage[],
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly me: (
    options?: CursorRequestOptions,
  ) => Effect.Effect<
    SDKUser,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly listModels: (
    options?: CursorRequestOptions,
  ) => Effect.Effect<
    SDKModel[],
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly listRepositories: (
    options?: CursorRequestOptions,
  ) => Effect.Effect<
    SDKRepository[],
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
}

/**
 * Effect-native wrappers for SDK inspection, lifecycle, and account catalog APIs.
 *
 * @example
 * ```ts
 * const inspection = yield* CursorInspectionService
 * const agents = yield* inspection.listAgents({ runtime: "cloud", includeArchived: true })
 * const models = yield* inspection.listModels()
 * ```
 *
 * @see {@link CursorSdkFactory}
 * @see {@link SDKAgentInfo}
 *
 * @category services
 */
export class CursorInspectionService extends Context.Service<
  CursorInspectionService,
  CursorInspectionServiceShape
>()("effect-cursor-sdk/cursor-inspection/CursorInspectionService") {
  static readonly Live = Layer.effect(CursorInspectionService)(
    Effect.gen(function* () {
      const sdk = yield* CursorSdkFactory;
      return {
        listAgents: (options?: ListAgentsOptions) => {
          return instrument(
            "agent.list",
            Effect.tryPromise({
              try: () => sdk.listAgents(options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "agent.list" });
              },
            }),
          );
        },
        getAgent: (agentId: string, options?: GetAgentOptions) => {
          return instrument(
            "agent.get",
            Effect.tryPromise({
              try: () => sdk.getAgent(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "agent.get", agentId });
              },
            }),
          );
        },
        archiveAgent: (agentId: string, options?: AgentOperationOptions) => {
          return instrument(
            "agent.archive",
            Effect.tryPromise({
              try: () => sdk.archiveAgent(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "agent.archive", agentId });
              },
            }),
          );
        },
        unarchiveAgent: (agentId: string, options?: AgentOperationOptions) => {
          return instrument(
            "agent.unarchive",
            Effect.tryPromise({
              try: () => sdk.unarchiveAgent(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "agent.unarchive", agentId });
              },
            }),
          );
        },
        deleteAgent: (agentId: string, options?: AgentOperationOptions) => {
          return instrument(
            "agent.delete",
            Effect.tryPromise({
              try: () => sdk.deleteAgent(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "agent.delete", agentId });
              },
            }),
          );
        },
        listRuns: (agentId: string, options?: ListRunsOptions) => {
          return instrument(
            "run.list",
            Effect.tryPromise({
              try: () => sdk.listRuns(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "run.list", agentId });
              },
            }),
          );
        },
        getRun: (runId: string, options?: GetRunOptions) => {
          return instrument(
            "run.get",
            Effect.tryPromise({
              try: () => sdk.getRun(runId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "run.get", runId });
              },
            }),
          );
        },
        listMessages: (agentId: string, options?: GetAgentMessagesOptions) => {
          return instrument(
            "messages.list",
            Effect.tryPromise({
              try: () => sdk.listMessages(agentId, options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "messages.list", agentId });
              },
            }),
          );
        },
        me: (options?: CursorRequestOptions) => {
          return instrument(
            "cursor.me",
            Effect.tryPromise({
              try: () => sdk.me(options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "cursor.me" });
              },
            }),
          );
        },
        listModels: (options?: CursorRequestOptions) => {
          return instrument(
            "cursor.models.list",
            Effect.tryPromise({
              try: () => sdk.listModels(options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "cursor.models.list" });
              },
            }),
          );
        },
        listRepositories: (options?: CursorRequestOptions) => {
          return instrument(
            "cursor.repositories.list",
            Effect.tryPromise({
              try: () => sdk.listRepositories(options),
              catch: (cause) => {
                return mapCursorError(cause, { operation: "cursor.repositories.list" });
              },
            }),
          );
        },
      } as const;
    }),
  );
}
