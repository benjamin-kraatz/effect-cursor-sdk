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
import { instrument } from "./cursor-telemetry";
import type { SDKAgent, SDKArtifact } from "./cursor-types";

export interface CursorArtifactServiceShape {
  readonly listArtifacts: (
    agent: SDKAgent,
  ) => Effect.Effect<
    SDKArtifact[],
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
  readonly downloadArtifact: (
    agent: SDKAgent,
    path: string,
  ) => Effect.Effect<
    Buffer,
    | CursorAuthenticationError
    | CursorRateLimitError
    | CursorIntegrationNotConnectedError
    | CursorConfigurationError
    | CursorNetworkError
    | CursorUnknownError
  >;
}

/**
 * Effect-native wrappers for agent artifacts.
 *
 * @example
 * ```ts
 * const artifacts = yield* CursorArtifactService
 * const items = yield* artifacts.listArtifacts(agent)
 * const bytes = yield* artifacts.downloadArtifact(agent, items[0]!.path)
 * ```
 *
 * @see {@link SDKArtifact}
 *
 * @category services
 */
export class CursorArtifactService extends Context.Service<
  CursorArtifactService,
  CursorArtifactServiceShape
>()("effect-cursor-sdk/cursor-artifacts/CursorArtifactService") {
  static readonly Live = Layer.succeed(CursorArtifactService)(
    CursorArtifactService.of({
      listArtifacts: (agent: SDKAgent) => {
        return instrument(
          "artifacts.list",
          Effect.tryPromise({
            try: () => agent.listArtifacts(),
            catch: (cause) => {
              return mapCursorError(cause, { operation: "artifacts.list", agentId: agent.agentId });
            },
          }),
        );
      },
      downloadArtifact: (agent: SDKAgent, path: string) => {
        return instrument(
          "artifacts.download",
          Effect.tryPromise({
            try: () => agent.downloadArtifact(path),
            catch: (cause) => {
              return mapCursorError(cause, {
                operation: "artifacts.download",
                agentId: agent.agentId,
              });
            },
          }),
        );
      },
    }),
  );
}
