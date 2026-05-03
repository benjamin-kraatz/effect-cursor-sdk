import { Agent } from "@cursor/sdk";
import { expect, it } from "@effect/vitest";
import { Effect, ManagedRuntime } from "effect";
import { vi } from "vitest";
import { CursorSdkFactory } from "./cursor-sdk-factory";
import { liveLayer } from "./cursor-runtime";
import { makeMockAgent } from "./cursor-mock";

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
