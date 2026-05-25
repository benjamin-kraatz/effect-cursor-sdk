import { Context, Effect, Layer, type Scope } from "effect";

import {
  CursorAgentBusyError,
  CursorAuthenticationError,
  CursorConfigurationError,
  CursorIntegrationNotConnectedError,
  CursorNetworkError,
  CursorRateLimitError,
  CursorUnknownError,
  mapCursorError,
} from "./cursor-error";
import { agentOptionsFromConfig, type CursorConfig } from "./cursor-config";
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

/**
 * Agent lifecycle surface backed by the Cursor SDK.
 *
 * @remarks
 * Use {@link loadCursorConfig} with {@link CursorAgentServiceShape.create},
 * {@link CursorAgentServiceShape.resume},
 * {@link CursorAgentServiceShape.prompt}, and
 * {@link CursorAgentServiceShape.scoped}
 * so secrets stay in `Redacted` form until {@link agentOptionsFromConfig}
 * merges into SDK {@link AgentOptions} at the SDK boundary.
 */
export interface CursorAgentServiceShape {
  /**
   * Create an agent from {@link CursorConfig} and optional SDK overrides.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly create: (
    config: CursorConfig,
    overrides?: AgentOptions,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorAgentBusyError
    | CursorNetworkError
    | CursorUnknownError
  >;
  /**
   * Resume an agent from {@link CursorConfig} and optional SDK overrides.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly resume: (
    agentId: string,
    config: CursorConfig,
    overrides?: AgentOptions,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorAgentBusyError
    | CursorNetworkError
    | CursorUnknownError
  >;
  /**
   * One-shot prompt from {@link CursorConfig} and optional SDK overrides.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly prompt: (
    message: string,
    config: CursorConfig,
    overrides?: AgentOptions,
  ) => Effect.Effect<
    RunResult,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorAgentBusyError
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
    | CursorAgentBusyError
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
    | CursorAgentBusyError
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
    | CursorAgentBusyError
    | CursorNetworkError
    | CursorUnknownError
  >;
  /**
   * Acquire an agent in a scope from {@link CursorConfig} and optional SDK overrides.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly scoped: (
    config: CursorConfig,
    overrides?: AgentOptions,
  ) => Effect.Effect<
    SDKAgent,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorAgentBusyError
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
 * import { CursorAgentService, liveLayer, loadCursorConfig } from "effect-cursor-sdk"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const agents = yield* CursorAgentService
 *   const config = yield* loadCursorConfig
 *   const agent = yield* agents.create(config, {
 *     model: { id: "composer-2" },
 *     local: { cwd: process.cwd() },
 *   })
 *   return yield* agents.send(agent, "Summarize this repository")
 * }).pipe(Effect.provide(liveLayer))
 * ```
 *
 * @see {@link CursorRunService} for operations on returned `Run` handles.
 * @see {@link CursorSdkFactory} for replacing SDK construction in tests.
 *
 * @remarks
 * Load defaults with {@link loadCursorConfig}, then call {@link CursorAgentServiceShape.create},
 * {@link CursorAgentServiceShape.resume}, {@link CursorAgentServiceShape.prompt}, or
 * {@link CursorAgentServiceShape.scoped} with optional SDK overrides.
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

      const createWithOptions = (options: AgentOptions) => {
        return instrument(
          "agent.create",
          Effect.tryPromise({
            try: () => sdk.create(options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.create" });
            },
          }),
        );
      };

      const resumeWithOptions = (agentId: string, options?: Partial<AgentOptions>) => {
        return instrument(
          "agent.resume",
          Effect.tryPromise({
            try: () => sdk.resume(agentId, options),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "agent.resume", agentId });
            },
          }),
        );
      };

      const promptWithOptions = (message: string, options?: AgentOptions) => {
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

      const create = (config: CursorConfig, overrides: AgentOptions = {}) => {
        return createWithOptions(agentOptionsFromConfig(config, overrides));
      };

      const resume = (agentId: string, config: CursorConfig, overrides: AgentOptions = {}) => {
        return resumeWithOptions(agentId, agentOptionsFromConfig(config, overrides));
      };

      const prompt = (message: string, config: CursorConfig, overrides: AgentOptions = {}) => {
        return promptWithOptions(message, agentOptionsFromConfig(config, overrides));
      };

      const scoped = (config: CursorConfig, overrides: AgentOptions = {}) => {
        return Effect.acquireRelease(
          createWithOptions(agentOptionsFromConfig(config, overrides)),
          (agent) => {
            return Effect.ignore(dispose(agent));
          },
        );
      };

      return {
        create,
        resume,
        prompt,
        send,
        reload,
        close,
        dispose,
        scoped,
      } as const;
    }),
  );
}
