import { Context, Effect, Layer, type Scope } from "effect";

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
  AgentOptions,
  Run,
  RunResult,
  SDKAgent,
  SDKUserMessage,
  SendOptions,
} from "./cursor-types";

export interface CursorAgentServiceShape {
  readonly create: (
    options: AgentOptions,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly resume: (
    agentId: string,
    options?: Partial<AgentOptions>,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly prompt: (
    message: string,
    options?: AgentOptions,
  ) => Effect.Effect<
    RunResult,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly send: (
    agent: SDKAgent,
    message: string | SDKUserMessage,
    options?: SendOptions,
  ) => Effect.Effect<
    Run,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly reload: (
    agent: SDKAgent,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly close: (agent: SDKAgent) => Effect.Effect<void>;
  readonly dispose: (
    agent: SDKAgent,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly scoped: (
    options: AgentOptions,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError,
    Scope.Scope
  >;
}

/**
 * Effect-native agent lifecycle and prompt service.
 *
 * The service wraps `Agent.create`, `Agent.resume`, `Agent.prompt`, and
 * instance lifecycle methods while preserving SDK-owned option and result
 * types.
 *
 * @example
 * ```ts
 * import { CursorAgentService, liveLayer } from "effect-cursor-sdk"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const agents = yield* CursorAgentService
 *   const agent = yield* agents.create({ model: { id: "composer-2" }, local: { cwd: process.cwd() } })
 *   return yield* agents.send(agent, "Summarize this repository")
 * }).pipe(Effect.provide(liveLayer))
 * ```
 *
 * @see {@link CursorRunService} for operations on returned `Run` handles.
 * @see {@link CursorSdkFactory} for replacing SDK construction in tests.
 *
 * @category services
 */
export class CursorAgentService extends Context.Service<
  CursorAgentService,
  CursorAgentServiceShape
>()("effect-cursor-sdk/cursor-agent/CursorAgentService") {
  static readonly Live = Layer.effect(CursorAgentService)(
    Effect.gen(function* () {
      const sdk = yield* CursorSdkFactory;

      const create = (options: AgentOptions) => {
        return instrument(
          "agent.create",
          Effect.try({
            try: () => sdk.create(options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.create" });
            },
          }),
        );
      };

      const resume = (agentId: string, options?: Partial<AgentOptions>) => {
        return instrument(
          "agent.resume",
          Effect.try({
            try: () => sdk.resume(agentId, options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.resume", agentId });
            },
          }),
        );
      };

      const prompt = (message: string, options?: AgentOptions) => {
        return instrument(
          "agent.prompt",
          Effect.tryPromise({
            try: () => sdk.prompt(message, options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.prompt" });
            },
          }),
        );
      };

      const send = (agent: SDKAgent, message: string | SDKUserMessage, options?: SendOptions) => {
        return instrument(
          "agent.send",
          Effect.tryPromise({
            try: () => agent.send(message, options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.send", agentId: agent.agentId });
            },
          }),
        );
      };

      const reload = (agent: SDKAgent) => {
        return instrument(
          "agent.reload",
          Effect.tryPromise({
            try: () => agent.reload(),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.reload", agentId: agent.agentId });
            },
          }),
        );
      };

      const close = (agent: SDKAgent): Effect.Effect<void> => {
        return instrument(
          "agent.close",
          Effect.sync(() => agent.close()),
        );
      };

      const dispose = (agent: SDKAgent) => {
        return instrument(
          "agent.dispose",
          Effect.tryPromise({
            try: () => agent[Symbol.asyncDispose](),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.dispose", agentId: agent.agentId });
            },
          }),
        );
      };

      const scoped = (options: AgentOptions) => {
        return Effect.acquireRelease(create(options), (agent) => {
          return Effect.ignore(dispose(agent));
        });
      };

      return { create, resume, prompt, send, reload, close, dispose, scoped } as const;
    }),
  );
}
