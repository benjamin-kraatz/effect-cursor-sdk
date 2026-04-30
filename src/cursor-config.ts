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
 * runtime options. This schema only models environment-derived defaults.
 * Use {@link agentOptionsFromConfig} to merge those defaults into SDK-owned
 * {@link AgentOptions}.
 *
 * @remarks
 * **Forward path:** A future major version of this package may require all
 * agent-related options to be supplied through this module (for example
 * {@link loadCursorConfig} plus {@link agentOptionsFromConfig}) instead of raw
 * {@link AgentOptions} on {@link CursorAgentService}.
 * Prefer this path for new code.
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
  apiKey: Config.redacted("CURSOR_API_KEY").pipe(Config.option),
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
 * @remarks
 * Same **forward path** notice as {@link CursorConfig}: this merge is the
 * intended boundary for redacted keys and env defaults ahead of a possible
 * requirement to use it for all agent entry points.
 *
 * @category config
 */
export const agentOptionsFromConfig = (
  config: CursorConfig,
  overrides: AgentOptions = {},
): AgentOptions => {
  const model: ModelSelection | undefined =
    overrides.model ?? (config.modelId ? { id: config.modelId } : undefined);
  const local =
    overrides.local !== undefined || config.cwd !== undefined
      ? {
          ...(overrides.local ?? {}),
          cwd: overrides.local?.cwd ?? config.cwd,
        }
      : undefined;
  return {
    ...overrides,
    apiKey: overrides.apiKey ?? (config.apiKey ? Redacted.value(config.apiKey) : undefined),
    model,
    local,
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
 * @remarks
 * Same **forward path** notice as {@link CursorConfig}: this effect is the
 * intended entry for redacted env defaults ahead of a possible requirement to
 * use it (with {@link agentOptionsFromConfig}) for all agent entry points.
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
