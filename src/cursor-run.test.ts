import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { CursorRunService } from "./cursor-run";
import { makeMockRun } from "./cursor-mock";

const assistantEvent = {
  type: "assistant" as const,
  agent_id: "mock-agent",
  run_id: "mock-run",
  message: {
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "hello" }],
  },
};

it.effect("collectText concatenates multiple assistant text blocks in order", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const text = yield* runs.collectText(
      makeMockRun({
        stream: [
          {
            ...assistantEvent,
            message: {
              role: "assistant",
              content: [
                { type: "text", text: "a" },
                { type: "text", text: "b" },
              ],
            },
          },
        ],
        result: { id: "mock-run", status: "finished" },
      }),
    );
    expect(text).toBe("ab");
  }).pipe(Effect.provide(CursorRunService.Live)),
);
