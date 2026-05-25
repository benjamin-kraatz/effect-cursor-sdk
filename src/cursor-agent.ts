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
 * Prefer {@link loadCursorConfig} with {@link CursorAgentServiceShape.createFromConfig},
 * {@link CursorAgentServiceShape.resumeFromConfig},
 * {@link CursorAgentServiceShape.promptFromConfig}, and
 * {@link CursorAgentServiceShape.scopedFromConfig}
 * so secrets stay in `Redacted` form until {@link agentOptionsFromConfig}
 * merges into SDK {@link AgentOptions}. Plain {@link AgentOptions} entry points
 * are deprecated; see `DEPRECATIONS.md` and the README at the package root.
 */
export interface CursorAgentServiceShape {
  /**
   * @deprecated Prefer {@link CursorAgentServiceShape.createFromConfig} with {@link loadCursorConfig}
   * instead of raw {@link AgentOptions} (including a plain `apiKey` string). Next major: `createFromConfig`
   * is planned to become `create` with the same parameters.
   */
  readonly create: (
    options: AgentOptions,
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
   * Create an agent from {@link CursorConfig} and optional SDK overrides.
   *
   * @remarks
   * Next major: planned rename to `create` with the same signature once plain-`AgentOptions` entry points are removed.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly createFromConfig: (
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
   * @deprecated Prefer {@link CursorAgentServiceShape.resumeFromConfig} with {@link loadCursorConfig}
   * instead of raw {@link AgentOptions}. Next major: `resumeFromConfig` is planned to become `resume` with the same parameters.
   */
  readonly resume: (
    agentId: string,
    options?: Partial<AgentOptions>,
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
   * @remarks
   * Next major: planned rename to `resume` with the same signature once plain-`AgentOptions` entry points are removed.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly resumeFromConfig: (
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
   * @deprecated Prefer {@link CursorAgentServiceShape.promptFromConfig} with {@link loadCursorConfig}
   * instead of raw {@link AgentOptions}. Next major: `promptFromConfig` is planned to become `prompt` with the same parameters.
   */
  readonly prompt: (
    message: string,
    options?: AgentOptions,
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
  /**
   * One-shot prompt from {@link CursorConfig} and optional SDK overrides.
   *
   * @remarks
   * Next major: planned rename to `prompt` with the same signature once plain-`AgentOptions` entry points are removed.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly promptFromConfig: (
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
   * @deprecated Prefer {@link CursorAgentServiceShape.scopedFromConfig} with {@link loadCursorConfig}
   * instead of raw {@link AgentOptions}. Next major: `scopedFromConfig` is planned to become `scoped` with the same parameters.
   */
  readonly scoped: (
    options: AgentOptions,
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
  /**
   * Acquire an agent in a scope from {@link CursorConfig} and optional SDK overrides.
   *
   * @remarks
   * Next major: planned rename to `scoped` with the same signature once plain-`AgentOptions` entry points are removed.
   *
   * @see {@link loadCursorConfig}
   * @see {@link agentOptionsFromConfig}
   */
  readonly scopedFromConfig: (
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
 *   const agent = yield* agents.createFromConfig(config, {
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
 * Prefer {@link CursorAgentServiceShape.createFromConfig} and related methods
 * with {@link loadCursorConfig}; raw {@link AgentOptions} on
 * {@link CursorAgentServiceShape.create} and siblings are deprecated.
 * See `DEPRECATIONS.md` at the package root for migration and planned next-major renames
 * (`createFromConfig` → `create`, etc.).
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
          Effect.tryPromise({
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
          Effect.tryPromise({
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

      const createFromConfig = (config: CursorConfig, overrides: AgentOptions = {}) => {
        return create(agentOptionsFromConfig(config, overrides));
      };

      const resumeFromConfig = (
        agentId: string,
        config: CursorConfig,
        overrides: AgentOptions = {},
      ) => {
        return resume(agentId, agentOptionsFromConfig(config, overrides));
      };

      const promptFromConfig = (
        message: string,
        config: CursorConfig,
        overrides: AgentOptions = {},
      ) => {
        return prompt(message, agentOptionsFromConfig(config, overrides));
      };

      const scopedFromConfig = (config: CursorConfig, overrides: AgentOptions = {}) => {
        return scoped(agentOptionsFromConfig(config, overrides));
      };

      return {
        create,
        createFromConfig,
        resume,
        resumeFromConfig,
        prompt,
        promptFromConfig,
        send,
        reload,
        close,
        dispose,
        scoped,
        scopedFromConfig,
      } as const;
    }),
  );
}
