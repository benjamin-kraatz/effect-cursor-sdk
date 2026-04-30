import { Config, ConfigProvider, Effect, Option, Redacted, Schema } from "effect";

import type { AgentOptions, ModelSelection } from "./cursor-types";

/**
 * Branded secret material for the Cursor API key.
 *
 * Values are held inside {@link Redacted} on {@link CursorConfig}; this schema
 * only brands the decoded plaintext type so it cannot be confused with other
 * strings at the type level.
 */
export const CursorApiKey = Schema.Redacted(Schema.String).pipe(Schema.brand("CursorApiKey"));
export type CursorApiKey = typeof CursorApiKey.Type;

/**
 * Branded model identifier from wrapper config.
 *
 * Populated from the `CURSOR_MODEL` environment variable when using
 * {@link loadCursorConfig}.
 */
export const CursorModelId = Schema.String.pipe(Schema.brand("CursorModelId"));
export type CursorModelId = typeof CursorModelId.Type;

/**
 * Branded local working directory for agent runs.
 *
 * Populated from `CURSOR_LOCAL_CWD` when using {@link loadCursorConfig}.
 */
export const CursorLocalCwd = Schema.String.pipe(Schema.brand("CursorLocalCwd"));
export type CursorLocalCwd = typeof CursorLocalCwd.Type;

/**
 * Minimal configuration owned by this wrapper.
 *
 * The SDK's `AgentOptions` type remains the source of truth for complete
 * runtime options. This schema models environment-derived defaults only.
 * Use {@link agentOptionsFromConfig} to merge those defaults into SDK-owned
 * {@link AgentOptions} at the SDK boundary.
 *
 * @remarks
 * **Preferred path:** Load defaults with {@link loadCursorConfig}, then call
 * `CursorAgentService` methods such as `createFromConfig` (and related helpers)
 * or merge manually with {@link agentOptionsFromConfig}. Passing plain
 * {@link AgentOptions} directly to deprecated `create` / `resume` / `prompt` /
 * `scoped` overloads may be removed in a future major version.
 *
 * @example
 * ```ts
 * const config = new CursorConfig({
 *   apiKey: Redacted.make(CursorApiKey.make(process.env.CURSOR_API_KEY!)),
 *   modelId: CursorModelId.make("composer-2"),
 *   cwd: CursorLocalCwd.make(process.cwd())
 * })
 * ```
 *
 * @see {@link cursorConfig}
 * @see {@link loadCursorConfig}
 *
 * @category config
 */
export class CursorConfig extends Schema.Class<CursorConfig>("CursorConfig")({
  apiKey: Schema.optional(CursorApiKey),
  modelId: Schema.optional(CursorModelId),
  cwd: Schema.optional(CursorLocalCwd),
}) {}

/**
 * Effect Config descriptors for common Cursor environment variables.
 *
 * Reads `CURSOR_API_KEY`, `CURSOR_MODEL`, and `CURSOR_LOCAL_CWD` from the active
 * Effect {@link ConfigProvider.ConfigProvider}. All fields are optional so
 * callers can merge with explicit overrides via {@link agentOptionsFromConfig}.
 *
 * @example
 * ```ts
 * const config = yield* loadCursorConfig
 * const options = agentOptionsFromConfig(config)
 * ```
 *
 * @see {@link Config}
 * @see {@link loadCursorConfig}
 *
 * @category config
 */
export const cursorConfig = Config.all({
  apiKey: Config.redacted("CURSOR_API_KEY").pipe(Config.option),
  modelId: Config.string("CURSOR_MODEL").pipe(Config.option),
  cwd: Config.string("CURSOR_LOCAL_CWD").pipe(Config.option),
});

/**
 * Build SDK `AgentOptions` from wrapper config and optional overrides.
 *
 * This is the adapter from typed, redacted {@link CursorConfig} to the SDK's
 * plain-string `apiKey` boundary. Prefer `CursorAgentService.createFromConfig`
 * (and related methods) over building {@link AgentOptions} by hand.
 *
 * @param config - Wrapper-owned environment defaults.
 * @param overrides - Complete or partial SDK-owned options to merge over the defaults.
 *
 * @example
 * ```ts
 * const options = agentOptionsFromConfig(config, {
 *   cloud: {
 *     repos: [{ url: "https://github.com/acme/app" }],
 *     autoCreatePR: true
 *   }
 * })
 * ```
 *
 * @see {@link CursorConfig}
 * @see {@link AgentOptions}
 *
 * @remarks
 * Explicit override values always win over environment-derived defaults.
 * For application code, prefer service methods that take {@link CursorConfig}
 * instead of calling this helper and then the deprecated `create` overload.
 *
 * @category config
 */
export const agentOptionsFromConfig = (
  config: CursorConfig,
  overrides: AgentOptions = {},
): AgentOptions => {
  const model: ModelSelection | undefined =
    overrides.model ?? (config.modelId ? { id: config.modelId } : undefined);
  return {
    ...overrides,
    apiKey: overrides.apiKey ?? (config.apiKey ? Redacted.value(config.apiKey) : undefined),
    model,
    local:
      (overrides.local ?? config.cwd)
        ? {
            cwd: config.cwd,
            ...overrides.local,
          }
        : undefined,
  };
};

/**
 * Load environment-derived defaults as a schema-backed value.
 * It uses ConfigProvider to load the environment variables
 * with their default names (`CURSOR_API_KEY`, `CURSOR_MODEL`, `CURSOR_LOCAL_CWD`)
 * from {@link cursorConfig}.
 *
 * @example
 * ```ts
 * const config = yield* loadCursorConfig
 * const options = agentOptionsFromConfig(config, { local: { cwd: process.cwd() } })
 * // Or use CursorAgentService.createFromConfig(config, { local: { cwd: process.cwd() } })
 * ```
 *
 * To change the way that the environment variables are loaded,
 * you can do it with Effect by providing a custom ConfigProvider.
 *
 * ```ts
 * // For example: load via custom environment object
 * const config = yield* loadCursorConfig.pipe(
 *  Effect.provideService(
 *    ConfigProvider.ConfigProvider,
 *    ConfigProvider.fromEnv({
 *      env: {
 *        CURSOR_API_KEY: "crsr_******",
 *        CURSOR_MODEL: "composer-2",
 *        CURSOR_LOCAL_CWD: "/workspace",
 *      },
 *    }),
 *  ),
 * )
 * ```
 *
 * @see {@link cursorConfig}
 * @see {@link agentOptionsFromConfig}
 *
 * @remarks
 * This effect is the preferred entry for redacted environment defaults.
 * Pair it with {@link agentOptionsFromConfig} or `CursorAgentService` helpers
 * such as `createFromConfig`.
 *
 * @category config
 */
export const loadCursorConfig = Effect.gen(function* () {
  const provider = yield* ConfigProvider.ConfigProvider;
  const raw = yield* cursorConfig.parse(provider);
  const apiKey = Option.getOrUndefined(raw.apiKey);
  const modelId = Option.getOrUndefined(raw.modelId);
  const cwd = Option.getOrUndefined(raw.cwd);
  return new CursorConfig({
    apiKey: apiKey ? CursorApiKey.make(apiKey) : undefined,
    modelId: modelId !== undefined ? CursorModelId.make(modelId) : undefined,
    cwd: cwd !== undefined ? CursorLocalCwd.make(cwd) : undefined,
  });
});
