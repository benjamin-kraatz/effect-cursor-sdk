/**
 * Reusable observability helpers: stream metrics, retry schedules, and safe summaries.
 *
 * @example
 * ```ts
 * import {
 *   cursorCatalogLoadTimeout,
 *   cursorCatalogRetrySchedule,
 *   CursorInspectionService,
 *   liveLayer,
 * } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 *
 * const catalog = Effect.gen(function* () {
 *   const inspection = yield* CursorInspectionService;
 *   return yield* Effect.all(
 *     { agents: inspection.listAgents({ runtime: "cloud" }), models: inspection.listModels() },
 *     { concurrency: "unbounded" },
 *   ).pipe(Effect.retry(cursorCatalogRetrySchedule), Effect.timeout(cursorCatalogLoadTimeout));
 * }).pipe(Effect.provide(liveLayer));
 * ```
 *
 * @module
 */
import { Effect, Metric, Schedule, Stream } from "effect";

import type { CursorStreamError } from "./cursor-error";
import { redact } from "./cursor-telemetry";
import { cursorStreamEvents } from "./cursor-telemetry";
import type { AgentOptions, Run, SDKMessage } from "./cursor-types";

/**
 * Default exponential retry for Cursor catalog-style calls (list agents, models, repos).
 *
 * Matches the pattern used in the advanced ops dashboard example: 150ms base, 3 attempts.
 *
 * @example
 * ```ts
 * import { CursorInspectionService, cursorCatalogRetrySchedule, liveLayer } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const inspection = yield* CursorInspectionService;
 *   return yield* inspection.listModels().pipe(Effect.retry(cursorCatalogRetrySchedule));
 * }).pipe(Effect.provide(liveLayer));
 * ```
 *
 * @category observability
 */
export const cursorCatalogRetrySchedule = Schedule.exponential("150 millis").pipe(
  Schedule.upTo({ times: 3 }),
);

/**
 * Default timeout for parallel catalog loads.
 *
 * @example
 * ```ts
 * import { CursorInspectionService, cursorCatalogLoadTimeout, liveLayer } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const inspection = yield* CursorInspectionService;
 *   return yield* Effect.all(
 *     { user: inspection.me(), models: inspection.listModels() },
 *     { concurrency: "unbounded" },
 *   ).pipe(Effect.timeout(cursorCatalogLoadTimeout));
 * }).pipe(Effect.provide(liveLayer));
 * ```
 *
 * @category observability
 */
export const cursorCatalogLoadTimeout = "45 seconds" as const;

/**
 * Append assistant-visible text from a streamed {@link SDKMessage} (same rules as {@link CursorRunService.collectText}).
 *
 * @example
 * ```ts
 * import { appendAssistantSdkMessageText } from "effect-cursor-sdk";
 * import type { SDKMessage } from "effect-cursor-sdk";
 *
 * const events: SDKMessage[] = []; // from run.stream()
 * const text = events.reduce(appendAssistantSdkMessageText, "");
 * ```
 *
 * @category observability
 */
export const appendAssistantSdkMessageText = (text: string, event: SDKMessage): string => {
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
};

/**
 * Wraps a run event stream and increments {@link cursorStreamEvents} per emitted event.
 *
 * @example
 * ```ts
 * import { CursorRunService, streamEventsTracked, liveLayer } from "effect-cursor-sdk";
 * import { Effect, Stream } from "effect";
 * import type { Run } from "effect-cursor-sdk";
 *
 * declare const run: Run;
 *
 * const program = Effect.gen(function* () {
 *   const runs = yield* CursorRunService;
 *   yield* streamEventsTracked(runs.streamEvents(run)).pipe(Stream.runDrain);
 * }).pipe(Effect.provide(liveLayer));
 * ```
 *
 * @category observability
 */
export const streamEventsTracked = <E>(
  stream: Stream.Stream<E, CursorStreamError>,
): Stream.Stream<E, CursorStreamError> => {
  return stream.pipe(
    Stream.tap(() =>
      Effect.void.pipe(Effect.trackSuccesses(cursorStreamEvents.pipe(Metric.withConstantInput(1)))),
    ),
  );
};

/**
 * Like {@link CursorRunService.collectText}, but increments {@link cursorStreamEvents} per stream chunk.
 *
 * @param run - SDK run handle.
 * @param streamEvents - Typically `runs.streamEvents` from {@link CursorRunService}.
 *
 * @example
 * ```ts
 * import { collectTextTracked, CursorRunService, liveLayer } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 * import type { Run } from "effect-cursor-sdk";
 *
 * declare const run: Run;
 *
 * const text = Effect.gen(function* () {
 *   const runs = yield* CursorRunService;
 *   return yield* collectTextTracked(run, (r) => runs.streamEvents(r));
 * }).pipe(Effect.provide(liveLayer));
 * ```
 *
 * @category observability
 */
export const collectTextTracked = (
  run: Run,
  streamEvents: (r: Run) => Stream.Stream<SDKMessage, CursorStreamError>,
): Effect.Effect<string, CursorStreamError> => {
  return streamEventsTracked(streamEvents(run)).pipe(
    Stream.runFold(() => "", appendAssistantSdkMessageText),
  );
};

/**
 * Build a redacted, log-safe summary of {@link AgentOptions} **without** an API key value.
 *
 * @remarks
 * Nested structures are passed through {@link redact}. Never log raw `apiKey`.
 *
 * @example
 * ```ts
 * import { summarizeAgentOptionsForLog } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const options = { model: { id: "composer-2" }, apiKey: "secret" };
 *   yield* Effect.logInfo("cursor run", summarizeAgentOptionsForLog(options));
 * });
 * ```
 *
 * @category observability
 */
export const summarizeAgentOptionsForLog = (options: AgentOptions): Record<string, unknown> => {
  const mcpKeys = options.mcpServers ? Object.keys(options.mcpServers) : undefined;
  return redact({
    model: options.model,
    name: options.name,
    agentId: options.agentId,
    local: options.local,
    cloud: options.cloud
      ? {
          reposCount: options.cloud.repos?.length,
          autoCreatePR: options.cloud.autoCreatePR,
          workOnCurrentBranch: options.cloud.workOnCurrentBranch,
          envType: options.cloud.env?.type,
        }
      : undefined,
    mcpServerNames: mcpKeys,
    agentsCount: options.agents ? Object.keys(options.agents).length : undefined,
  }) as Record<string, unknown>;
};

/**
 * Attach minimal run identifiers for structured logs or span attributes.
 *
 * @example
 * ```ts
 * import { summarizeRunForLog } from "effect-cursor-sdk";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const run = { id: "run_1", agentId: "agt_1", status: "finished" as const };
 *   yield* Effect.logDebug("run done", summarizeRunForLog(run));
 * });
 * ```
 *
 * @category observability
 */
export const summarizeRunForLog = (run: {
  readonly id: string;
  readonly agentId: string;
  readonly status?: string;
}): Record<string, unknown> => {
  return {
    runId: run.id,
    agentId: run.agentId,
    status: run.status,
  };
};
