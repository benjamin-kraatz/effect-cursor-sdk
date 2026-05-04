/**
 * Telemetry helpers for the Effect Cursor SDK boundary.
 *
 * Services wrap SDK calls with {@link instrument}, which records Effect metrics
 * and opens an OpenTelemetry-style span per {@link CursorOperation}. Named
 * `Metric.counter` values are exported so applications can wire them into a
 * metrics backend via Effect's metrics layer.
 *
 * {@link redact} is a small helper for scrubbing structured metadata before it
 * leaves a trust boundary (for example log attributes or debug payloads).
 *
 * @see {@link CursorOperation}
 * @see {@link CursorAgentService}
 * @see {@link CursorRunService}
 * @see {@link CursorInspectionService}
 * @see {@link CursorArtifactService}
 *
 * @module
 */

import { Effect, Metric } from "effect";

import type { CursorOperation } from "./cursor-error";

/**
 * Increments once when an instrumented SDK effect **starts** execution.
 *
 * Bound to the metric key `cursor_operations_started`. Used by
 * {@link instrument} on every wrapped call; pair with
 * {@link cursorOperationsFailed} to compute failure rates per operation when
 * both counters are exported to your metrics stack.
 *
 * @see {@link instrument}
 * @see {@link cursorOperationsFailed}
 *
 * @category telemetry
 */
export const cursorOperationsStarted = Metric.counter("cursor_operations_started");

/**
 * Increments once when an instrumented SDK effect **fails** (any error channel
 * value), after {@link cursorOperationsStarted} has already been recorded for
 * that run.
 *
 * Bound to the metric key `cursor_operations_failed`. Failures are tracked in
 * `Effect.tapError` so the effect still fails with the original error; this
 * counter is observability-only.
 *
 * @see {@link instrument}
 * @see {@link cursorOperationsStarted}
 *
 * @category telemetry
 */
export const cursorOperationsFailed = Metric.counter("cursor_operations_failed");

/**
 * Counter reserved for **per-message** or **per-chunk** stream throughput.
 *
 * Bound to the metric key `cursor_stream_events`. The service wrappers do not
 * attach this metric automatically to {@link CursorRunService.streamEvents};
 * export it from your app if you want to `Metric.track` inside a
 * `Stream.tapEffect` (or similar) when consuming SDK stream payloads.
 *
 * @see {@link CursorRunService}
 *
 * @category telemetry
 */
export const cursorStreamEvents = Metric.counter("cursor_stream_events");

/** String substituted for values under sensitive-looking keys. */
const REDACTED_MARKER = "[redacted]";

/** Replaces non-plain objects (for example `Date`, `Map`) so they are not mistaken for empty `{}`. */
const OPAQUE_MARKER = "[opaque]";

/** Replaces a value when the same object appears on the recursion stack (true cycles only). */
const CIRCULAR_MARKER = "[circular]";

/** Replaces nested values when recursion depth exceeds this limit (prevents stack overflow). */
const MAX_REDACT_DEPTH = 64;

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

/**
 * Lower-cased key substring / equality checks. Substrings such as `key` also
 * match `apiKey` (and unfortunately unrelated keys like `monkey`); that is an
 * intentional tradeoff for simple log scrubbing.
 */
const isSensitiveKeyName = (normalized: string): boolean => {
  if (normalized === "authorization" || normalized === "data") return true;
  return (
    normalized.includes("key") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("passwd") ||
    normalized.includes("credential") ||
    normalized.includes("cookie") ||
    normalized.includes("jwt") ||
    normalized.includes("bearer")
  );
};

const redactInner = (value: unknown, path: Set<object>, depth: number): unknown => {
  if (depth > MAX_REDACT_DEPTH) {
    return OPAQUE_MARKER;
  }

  if (Array.isArray(value)) {
    if (path.has(value)) {
      return CIRCULAR_MARKER;
    }
    path.add(value);
    const out = value.map((item) => {
      return redactInner(item, path, depth + 1);
    });
    path.delete(value);
    return out;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  if (!isPlainObject(value)) {
    return OPAQUE_MARKER;
  }

  if (path.has(value)) {
    return CIRCULAR_MARKER;
  }

  path.add(value);
  const out = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const normalized = key.toLowerCase();
      if (isSensitiveKeyName(normalized)) {
        return [key, REDACTED_MARKER];
      }
      return [key, redactInner(item, path, depth + 1)];
    }),
  );
  path.delete(value);
  return out;
};

/**
 * Deep-clones **plain** objects and arrays while replacing values under keys that
 * often carry secrets, bearer material, or large opaque blobs (for example API
 * keys, tokens, passwords, cookies, `Authorization`, or a generic `data` field).
 *
 * Matching is **substring-based on the lower-cased key name** (for example
 * `apiKey`, `CURSOR_API_TOKEN`, `client_secret`, `setCookie` all match). Primitives
 * and `null` pass through unchanged. Non-plain objects (for example `Date`, `Map`,
 * class instances) are replaced by `"[opaque]"` so they are not serialized as empty
 * objects. True circular references in the input are replaced by `"[circular]"`.
 * Recursion deeper than 64 levels falls back to `"[opaque]"` for the overflow branch.
 *
 * This is a best-effort redactor for logs and attributes—not a cryptographic
 * guarantee; do not rely on it for compliance redaction without review.
 *
 * @param value - Arbitrary JSON-like value to sanitize.
 * @returns A structure of the same shape with sensitive-looking entries replaced
 *   by the string `"[redacted]"`.
 *
 * @example
 * ```ts
 * redact({ apiKey: "secret", nested: { token: "x" }, safe: 1 })
 * // => { apiKey: "[redacted]", nested: { token: "[redacted]" }, safe: 1 }
 * ```
 *
 * @category telemetry
 */
export const redact = (value: unknown): unknown => {
  return redactInner(value, new Set(), 0);
};

/**
 * Wraps an SDK-backed {@link Effect} with consistent
 * observability: increments {@link cursorOperationsStarted} at execution start,
 * increments {@link cursorOperationsFailed} on the error channel, and attaches
 * a span named `cursor.<operation>` (for example `cursor.agent.list`).
 *
 * The span name is stable and includes the {@link CursorOperation} tag space
 * so traces can be filtered consistently across agent, run, artifact, and
 * inspection APIs.
 *
 * @param operation - Logical SDK operation; must match {@link CursorOperation}
 *   for typed error mapping and trace taxonomy.
 * @param effect - The effect produced by `Effect.tryPromise` (or similar)
 *   around a single SDK call.
 * @returns The same effect type `Effect<A, E, R>` with metrics and span
 *   attached; success and failure values are unchanged.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { instrument } from "./cursor-telemetry"
 *
 * const eff = instrument(
 *   "agent.get",
 *   Effect.tryPromise({
 *     try: () => sdk.getAgent(id),
 *     catch: (e) => e,
 *   }),
 * )
 * ```
 *
 * @see {@link cursorOperationsStarted}
 * @see {@link cursorOperationsFailed}
 * @see {@link CursorOperation}
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
