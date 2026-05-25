import { Agent } from "@cursor/sdk";
import { expect, it } from "@effect/vitest";
import { Effect, ManagedRuntime } from "effect";
import { vi } from "vitest";
import { CursorAgentService } from "./cursor-agent";
import { makeMockAgent } from "./cursor-mock";
import { CursorRunService } from "./cursor-run";
import { CursorSdkFactory } from "./cursor-sdk-factory";
import { liveLayer, makeMockRuntime, mockLayer } from "./cursor-runtime";

it("liveLayer wires CursorSdkFactory into the merged service stack", async () => {
  const agent = makeMockAgent({ agentId: "live-stack-agent" });
  using create = vi.spyOn(Agent, "create").mockResolvedValue(agent);

  const runtime = ManagedRuntime.make(liveLayer);

  try {
    const got = await runtime.runPromise(
      Effect.gen(function* () {
        const sdk = yield* CursorSdkFactory;
        return yield* Effect.promise(() => sdk.create({ model: { id: "composer-2" } }));
      }),
    );

    expect(got).toBe(agent);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ model: { id: "composer-2" } }));
  } finally {
    await runtime.dispose();
  }
});

it.effect("mockLayer wires mock agent and run services without custom fixtures", () =>
  Effect.gen(function* () {
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const agent = yield* agents.create({});
    const run = yield* agents.send(agent, "ping");
    const text = yield* runs.collectText(run);
    expect(text).toBe("");
  }).pipe(Effect.provide(mockLayer())),
);

it("makeMockRuntime runs programs and disposes cleanly", async () => {
  const runtime = makeMockRuntime();
  const value = await runtime.runPromise(Effect.succeed(42));
  expect(value).toBe(42);
  await runtime.dispose();
});
