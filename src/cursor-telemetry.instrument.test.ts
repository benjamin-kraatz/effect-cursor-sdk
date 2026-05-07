import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, Layer, ManagedRuntime, Metric } from "effect";

import { cursorOperationsFailed, cursorOperationsStarted, instrument } from "./cursor-telemetry";

describe("instrument", () => {
  it("increments started and not failed on success", async () => {
    const runtime = ManagedRuntime.make(Layer.empty);
    try {
      await runtime.runPromise(
        Effect.gen(function* () {
          const started0 = yield* Metric.value(cursorOperationsStarted);
          const failed0 = yield* Metric.value(cursorOperationsFailed);

          const ex = yield* instrument("agent.get", Effect.succeed(42)).pipe(Effect.exit);
          expect(Exit.isSuccess(ex)).toBe(true);
          if (Exit.isSuccess(ex)) expect(ex.value).toBe(42);

          const started = yield* Metric.value(cursorOperationsStarted);
          const failed = yield* Metric.value(cursorOperationsFailed);
          expect(started.count - started0.count).toBe(1);
          expect(failed.count - failed0.count).toBe(0);
        }),
      );
    } finally {
      await runtime.dispose();
    }
  });

  it("increments started and failed when the effect fails", async () => {
    const runtime = ManagedRuntime.make(Layer.empty);
    try {
      await runtime.runPromise(
        Effect.gen(function* () {
          const started0 = yield* Metric.value(cursorOperationsStarted);
          const failed0 = yield* Metric.value(cursorOperationsFailed);

          const ex = yield* instrument("agent.get", Effect.fail("boom" as const)).pipe(Effect.exit);
          expect(Exit.isFailure(ex)).toBe(true);

          const started = yield* Metric.value(cursorOperationsStarted);
          const failed = yield* Metric.value(cursorOperationsFailed);
          expect(started.count - started0.count).toBe(1);
          expect(failed.count - failed0.count).toBe(1);
        }),
      );
    } finally {
      await runtime.dispose();
    }
  });
});
