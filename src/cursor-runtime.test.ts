import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CursorAgentService } from "./cursor-agent";
import { CursorRunService } from "./cursor-run";
import { makeMockRuntime, mockLayer } from "./cursor-runtime";

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
