import { Effect, Metric } from "effect";

import type { CursorOperation } from "./cursor-error";

/**
 * Count of Cursor SDK operations started through the Effect wrapper.
 *
 * @category telemetry
 */
export const cursorOperationsStarted = Metric.counter("cursor_operations_started");

/**
 * Count of Cursor SDK operations that failed through the Effect wrapper.
 *
 * @category telemetry
 */
export const cursorOperationsFailed = Metric.counter("cursor_operations_failed");

/**
 * Count of SDK stream events observed by `streamEvents`.
 *
 * @category telemetry
 */
export const cursorStreamEvents = Metric.counter("cursor_stream_events");

/**
 * Redact values that commonly contain credentials or large prompt payloads.
 *
 * @category telemetry
 */
export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      return redact(item);
    });
  }
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const normalized = key.toLowerCase();
      if (
        normalized.includes("key") ||
        normalized.includes("token") ||
        normalized.includes("secret") ||
        normalized === "authorization" ||
        normalized === "data"
      ) {
        return [key, "[redacted]"];
      }
      return [key, redact(item)];
    }),
  );
};

/**
 * Add consistent logs, metrics, and tracing to an SDK boundary.
 *
 * @category telemetry
 */
export const instrument = <A, E, R>(
  operation: CursorOperation,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => {
  return effect.pipe(
    Effect.track(cursorOperationsStarted.pipe(Metric.withConstantInput(1))),
    Effect.tapError(() => {
      return Effect.track(Effect.void, cursorOperationsFailed.pipe(Metric.withConstantInput(1)));
    }),
    Effect.withSpan(`cursor.${operation}`),
  );
};
