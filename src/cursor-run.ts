import { Context, Effect, Layer, Stream } from "effect";

import {
  CursorAuthenticationError,
  CursorConfigurationError,
  CursorIntegrationNotConnectedError,
  CursorNetworkError,
  CursorRateLimitError,
  CursorStreamError,
  CursorUnknownError,
  CursorUnsupportedOperationError,
  mapCursorError,
} from "./cursor-error";
import { instrument } from "./cursor-telemetry";
import type { Run, RunOperation, RunResult, RunStatus, SDKMessage } from "./cursor-types";

export interface CursorRunServiceShape {
  readonly supports: (run: Run, operation: RunOperation) => boolean;
  readonly unsupportedReason: (run: Run, operation: RunOperation) => string | undefined;
  readonly wait: (
    run: Run,
  ) => Effect.Effect<
    RunResult,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly cancel: (
    run: Run,
  ) => Effect.Effect<
    void,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnsupportedOperationError
    | CursorUnknownError
  >;
  readonly conversation: (
    run: Run,
  ) => ReturnType<Run["conversation"]> extends Promise<infer A>
    ? Effect.Effect<
        A,
        | CursorAuthenticationError
        | CursorRateLimitError
        | CursorIntegrationNotConnectedError
        | CursorConfigurationError
        | CursorNetworkError
        | CursorUnsupportedOperationError
        | CursorUnknownError
      >
    : never;
  readonly streamEvents: (run: Run) => Stream.Stream<SDKMessage, CursorStreamError>;
  readonly collectText: (run: Run) => Effect.Effect<string, CursorStreamError>;
  readonly onDidChangeStatus: (
    run: Run,
    listener: (status: RunStatus) => void,
  ) => Effect.Effect<() => void>;
}

/**
 * Effect-native helpers for SDK run handles.
 *
 * @example
 * ```ts
 * const run = yield* agents.send(agent, "Refactor auth")
 * const text = yield* runs.collectText(run)
 * ```
 *
 * @see {@link CursorAgentService} for creating and sending runs.
 * @see {@link SDKMessage} for the SDK-owned stream event shape.
 *
 * @category services
 */
export class CursorRunService extends Context.Service<CursorRunService, CursorRunServiceShape>()(
  "effect-cursor-sdk/cursor-run/CursorRunService",
) {
  static readonly Live = Layer.succeed(CursorRunService)(
    CursorRunService.of({
      supports: (run: Run, operation: RunOperation): boolean => {
        return run.supports(operation);
      },
      unsupportedReason: (run: Run, operation: RunOperation): string | undefined => {
        return run.unsupportedReason(operation);
      },
      wait: (run: Run) => {
        return instrument(
          "run.wait",
          Effect.tryPromise({
            try: () => run.wait(),
            catch: (cause) => {
              return mapCursorError(cause, {
                operation: "run.wait",
                agentId: run.agentId,
                runId: run.id,
              });
            },
          }),
        );
      },
      cancel: (run: Run) => {
        return instrument(
          "run.cancel",
          Effect.tryPromise({
            try: () => run.cancel(),
            catch: (cause) => {
              return mapCursorError(cause, {
                operation: "run.cancel",
                agentId: run.agentId,
                runId: run.id,
              });
            },
          }),
        );
      },
      conversation: (run: Run) => {
        return instrument(
          "run.conversation",
          Effect.tryPromise({
            try: () => run.conversation(),
            catch: (cause) => {
              return mapCursorError(cause, {
                operation: "run.conversation",
                agentId: run.agentId,
                runId: run.id,
              });
            },
          }),
        );
      },
      streamEvents: (run: Run): Stream.Stream<SDKMessage, CursorStreamError> => {
        return Stream.fromAsyncIterable(run.stream(), (cause) => {
          return mapCursorError(cause, {
            operation: "run.stream",
            agentId: run.agentId,
            runId: run.id,
          }) as CursorStreamError;
        });
      },
      onDidChangeStatus: (
        run: Run,
        listener: (status: RunStatus) => void,
      ): Effect.Effect<() => void> => {
        return Effect.sync(() => run.onDidChangeStatus(listener));
      },
      collectText: (run: Run): Effect.Effect<string, CursorStreamError> => {
        return Stream.fromAsyncIterable(run.stream(), (cause) => {
          return mapCursorError(cause, {
            operation: "run.stream",
            agentId: run.agentId,
            runId: run.id,
          }) as CursorStreamError;
        }).pipe(
          Stream.runFold(
            () => "",
            (text, event) => {
              if (event.type !== "assistant") return text;
              return (
                text +
                event.message.content
                  .filter((block) => {
                    return block.type === "text";
                  })
                  .map((block) => {
                    return block.text;
                  })
                  .join("")
              );
            },
          ),
        );
      },
    }),
  );
}
