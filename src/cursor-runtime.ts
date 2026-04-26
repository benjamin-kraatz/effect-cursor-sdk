import { Layer, ManagedRuntime } from "effect";

import { CursorAgentService } from "./cursor-agent";
import { CursorArtifactService } from "./cursor-artifacts";
import { CursorInspectionService } from "./cursor-inspection";
import { makeMockSdkFactoryLayer, type CursorMockFixtures } from "./cursor-mock";
import { CursorRunService } from "./cursor-run";
import { CursorSdkFactory } from "./cursor-sdk-factory";

/**
 * Live service layer for the SDK-backed Effect wrapper.
 *
 * Provides {@link CursorAgentService}, {@link CursorRunService},
 * {@link CursorArtifactService}, and {@link CursorInspectionService} using
 * {@link CursorSdkFactory.Live}.
 *
 * @example
 * ```ts
 * const result = yield* program.pipe(Effect.provide(liveLayer))
 * ```
 *
 * @see {@link CursorSdkFactory}
 * @see {@link liveRuntime}
 *
 * @category layers
 */
export const liveLayer = Layer.mergeAll(
  CursorAgentService.Live,
  CursorRunService.Live,
  CursorArtifactService.Live,
  CursorInspectionService.Live,
).pipe(Layer.provideMerge(CursorSdkFactory.Live));

/**
 * Deterministic mock layer for tests and examples.
 *
 * @param fixtures - Static SDK responses returned by the mock factory.
 *
 * @example
 * ```ts
 * const layer = mockLayer({
 *   result: { id: "run-1", status: "finished", result: "ok" }
 * })
 * ```
 *
 * @see {@link CursorMockFixtures}
 * @see {@link makeMockSdkFactoryLayer}
 *
 * @category layers
 */
export const mockLayer = (fixtures: CursorMockFixtures = {}) => {
  return Layer.mergeAll(
    CursorAgentService.Live,
    CursorRunService.Live,
    CursorArtifactService.Live,
    CursorInspectionService.Live,
  ).pipe(Layer.provideMerge(makeMockSdkFactoryLayer(fixtures)));
};

/**
 * Ready-made live runtime.
 *
 * Use this for small scripts that prefer `ManagedRuntime.runPromise` over
 * manually providing {@link liveLayer}.
 *
 * @example
 * ```ts
 * const value = await liveRuntime.runPromise(program)
 * ```
 *
 * @see {@link liveLayer}
 *
 * @category runtimes
 */
export const liveRuntime = ManagedRuntime.make(liveLayer);

/**
 * Ready-made mock runtime.
 *
 * @param fixtures - Static SDK responses returned by the mock services.
 *
 * @example
 * ```ts
 * const runtime = makeMockRuntime({ result: { id: "run-1", status: "finished" } })
 * const value = await runtime.runPromise(program)
 * ```
 *
 * @see {@link mockLayer}
 * @see {@link CursorMockFixtures}
 *
 * @category runtimes
 */
export const makeMockRuntime = (fixtures: CursorMockFixtures = {}) => {
  return ManagedRuntime.make(mockLayer(fixtures));
};
