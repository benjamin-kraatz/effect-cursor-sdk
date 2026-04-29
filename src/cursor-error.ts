import {
  AuthenticationError,
  ConfigurationError,
  CursorAgentError,
  IntegrationNotConnectedError,
  NetworkError,
  RateLimitError,
  UnknownAgentError,
  UnsupportedRunOperationError,
} from "@cursor/sdk";
import { Data, Match } from "effect";

import type { RunOperation } from "./cursor-types";

/**
 * The operation being executed when an SDK error crossed into Effect.
 *
 * @category errors
 */
export type CursorOperation =
  | "agent.create"
  | "agent.resume"
  | "agent.prompt"
  | "agent.send"
  | "agent.close"
  | "agent.reload"
  | "agent.dispose"
  | "agent.list"
  | "agent.get"
  | "agent.archive"
  | "agent.unarchive"
  | "agent.delete"
  | "messages.list"
  | "run.list"
  | "run.get"
  | "run.wait"
  | "run.stream"
  | "run.conversation"
  | "run.cancel"
  | "artifacts.list"
  | "artifacts.download"
  | "cursor.me"
  | "cursor.models.list"
  | "cursor.repositories.list";

/**
 * Safe metadata attached to wrapper errors.
 *
 * @category errors
 */
export interface CursorErrorContext {
  readonly operation: CursorOperation;
  readonly agentId?: string;
  readonly runId?: string;
  readonly runtime?: "local" | "cloud";
  readonly status?: string;
}

interface CursorErrorFields extends CursorErrorContext {
  readonly message: string;
  readonly cause: unknown;
  readonly isRetryable: boolean;
}

/**
 * Authentication or permission failure reported by the Cursor SDK.
 *
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorAuthenticationError extends Data.TaggedError(
  "CursorAuthenticationError",
)<CursorErrorFields> {}

/**
 * Cursor rate limit or usage-limit failure.
 *
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorRateLimitError extends Data.TaggedError(
  "CursorRateLimitError",
)<CursorErrorFields> {}

/**
 * Invalid configuration, model, prompt, repository, or request options.
 *
 * @see {@link AgentOptions}
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorConfigurationError extends Data.TaggedError(
  "CursorConfigurationError",
)<CursorErrorFields> {}

/**
 * SCM integration is not connected for a requested cloud repository.
 *
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorIntegrationNotConnectedError extends Data.TaggedError(
  "CursorIntegrationNotConnectedError",
)<CursorErrorFields & { readonly provider?: string; readonly helpUrl?: string }> {}

/**
 * Network, service availability, timeout, or backend failure.
 *
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorNetworkError extends Data.TaggedError("CursorNetworkError")<CursorErrorFields> {}

/**
 * A run operation is unavailable for the current runtime or run state.
 *
 * @see {@link RunOperation}
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorUnsupportedOperationError extends Data.TaggedError(
  "CursorUnsupportedOperationError",
)<CursorErrorFields & { readonly sdkOperation?: RunOperation }> {}

/**
 * A run reached an error terminal state or failed to produce a usable result.
 *
 * @see {@link RunResult}
 * @category errors
 */
export class CursorRunFailedError extends Data.TaggedError(
  "CursorRunFailedError",
)<CursorErrorFields> {}

/**
 * Stream creation or iteration failed.
 *
 * @see {@link CursorRunService}
 * @see {@link SDKMessage}
 * @category errors
 */
export class CursorStreamError extends Data.TaggedError("CursorStreamError")<CursorErrorFields> {}

/**
 * Fallback for unknown SDK or JavaScript failures.
 *
 * @see {@link mapCursorError}
 * @category errors
 */
export class CursorUnknownError extends Data.TaggedError("CursorUnknownError")<CursorErrorFields> {}

const messageFrom = (cause: unknown): string => {
  return cause instanceof Error ? cause.message : String(cause);
};

const retryableFrom = (cause: unknown): boolean => {
  return cause instanceof CursorAgentError ? cause.isRetryable : false;
};

/**
 * Convert any SDK failure into a tagged Effect error.
 *
 * @param cause - Unknown value thrown by `@cursor/sdk` or JavaScript runtime code.
 * @param context - Safe operation metadata to attach to the tagged error.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { mapCursorError } from "effect-cursor-sdk"
 *
 * const effect = Effect.tryPromise({
 *   try: () => run.wait(),
 *   catch: (cause) => mapCursorError(cause, { operation: "run.wait", runId: run.id })
 * })
 * ```
 *
 * @see {@link CursorAuthenticationError}
 * @see {@link CursorUnsupportedOperationError}
 * @see {@link CursorStreamError}
 *
 * @category errors
 */
export function mapCursorError(
  cause: unknown,
  context: CursorErrorContext & { readonly operation: "run.stream" },
): CursorStreamError;
export function mapCursorError(
  cause: unknown,
  context: CursorErrorContext & { readonly operation: "run.cancel" | "run.conversation" },
):
  | CursorAuthenticationError
  | CursorRateLimitError
  | CursorIntegrationNotConnectedError
  | CursorConfigurationError
  | CursorNetworkError
  | CursorUnsupportedOperationError
  | CursorUnknownError;
export function mapCursorError(
  cause: unknown,
  context: CursorErrorContext,
):
  | CursorAuthenticationError
  | CursorRateLimitError
  | CursorIntegrationNotConnectedError
  | CursorConfigurationError
  | CursorNetworkError
  | CursorUnknownError;
export function mapCursorError(cause: unknown, context: CursorErrorContext) {
  const fields = {
    ...context,
    message: messageFrom(cause),
    cause,
    isRetryable: retryableFrom(cause),
  };

  if (context.operation === "run.stream") {
    return new CursorStreamError(fields);
  }

  return Match.value(cause).pipe(
    Match.when(Match.instanceOf(AuthenticationError), () => {
      return new CursorAuthenticationError(fields);
    }),
    Match.when(Match.instanceOf(RateLimitError), () => {
      return new CursorRateLimitError(fields);
    }),
    Match.when(Match.instanceOf(IntegrationNotConnectedError), (error) => {
      return new CursorIntegrationNotConnectedError({
        ...fields,
        provider: error.provider,
        helpUrl: error.helpUrl,
      });
    }),
    Match.when(Match.instanceOf(UnsupportedRunOperationError), (error) => {
      return new CursorUnsupportedOperationError({
        ...fields,
        sdkOperation: error.operation as RunOperation | undefined,
      });
    }),
    Match.when(Match.instanceOf(ConfigurationError), () => {
      return new CursorConfigurationError(fields);
    }),
    Match.when(Match.instanceOf(NetworkError), () => {
      return new CursorNetworkError(fields);
    }),
    Match.when(Match.instanceOf(UnknownAgentError), () => {
      return new CursorUnknownError(fields);
    }),
    Match.when(Match.instanceOf(CursorAgentError), () => {
      return new CursorUnknownError(fields);
    }),
    Match.orElse(() => {
      return new CursorUnknownError(fields);
    }),
  );
}
