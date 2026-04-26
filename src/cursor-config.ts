import { Config, ConfigProvider, Effect, Option, Schema } from "effect";

import type { AgentOptions, ModelSelection } from "./cursor-types";

/**
 * Minimal configuration owned by this wrapper.
 *
 * The SDK's `AgentOptions` type remains the source of truth for complete
 * runtime options. This schema only models environment-derived defaults.
 * Use {@link agentOptionsFromConfig} to merge those defaults into SDK-owned
 * {@link AgentOptions}.
 *
 * @example
 * ```ts
 * const config = new CursorConfig({
 *   apiKey: process.env.CURSOR_API_KEY,
 *   modelId: "composer-2",
 *   cwd: process.cwd()
 * })
 * ```
 *
 * @see {@link cursorConfig}
 * @see {@link loadCursorConfig}
 *
 * @category config
 */
export class CursorConfig extends Schema.Class<CursorConfig>("CursorConfig")({
  apiKey: Schema.optional(Schema.String),
  modelId: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.String),
}) {}

/**
 * Effect Config descriptors for common Cursor environment variables.
 *
 * Reads `CURSOR_API_KEY`, `CURSOR_MODEL`, and `CURSOR_LOCAL_CWD` from the active
 * Effect {@link ConfigProvider.ConfigProvider}. All fields are optional so
 * callers can still pass complete SDK options explicitly.
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
  apiKey: Config.string("CURSOR_API_KEY").pipe(Config.option),
  modelId: Config.string("CURSOR_MODEL").pipe(Config.option),
  cwd: Config.string("CURSOR_LOCAL_CWD").pipe(Config.option),
});

/**
 * Build SDK `AgentOptions` from wrapper config and optional overrides.
 *
 * Explicit override values always win over environment-derived defaults.
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
    apiKey: overrides.apiKey ?? config.apiKey,
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
 *
 * @example
 * ```ts
 * const config = yield* loadCursorConfig
 * const options = agentOptionsFromConfig(config, { local: { cwd: process.cwd() } })
 * ```
 *
 * @see {@link cursorConfig}
 * @see {@link agentOptionsFromConfig}
 *
 * @category config
 */
export const loadCursorConfig = Effect.gen(function* () {
  const provider = yield* ConfigProvider.ConfigProvider;
  const raw = yield* cursorConfig.parse(provider);
  return new CursorConfig({
    apiKey: Option.getOrUndefined(raw.apiKey),
    modelId: Option.getOrUndefined(raw.modelId),
    cwd: Option.getOrUndefined(raw.cwd),
  });
});
