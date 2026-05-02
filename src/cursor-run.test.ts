import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeMockRun } from "./cursor-mock";
import { CursorRunService } from "./cursor-run";
import type { SDKMessage } from "./cursor-types";

it.effect("collectText joins multiple text blocks in one assistant message", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const stream: SDKMessage[] = [
      {
        type: "assistant",
        agent_id: "mock-agent",
        run_id: "mock-run",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "hello " },
            { type: "text", text: "world" },
          ],
        },
      },
    ];
    const text = yield* runs.collectText(
      makeMockRun({ stream, result: { id: "mock-run", status: "finished" } }),
    );
    expect(text).toBe("hello world");
  }).pipe(Effect.provide(CursorRunService.Live)),
);

it.effect("collectText ignores tool_use blocks and keeps only text blocks", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const stream: SDKMessage[] = [
      {
        type: "assistant",
        agent_id: "mock-agent",
        run_id: "mock-run",
        message: {
          role: "assistant",
          content: [
            { type: "tool_use", id: "call-1", name: "read_file", input: { path: "x" } },
            { type: "text", text: "summary" },
          ],
        },
      },
    ];
    const text = yield* runs.collectText(
      makeMockRun({ stream, result: { id: "mock-run", status: "finished" } }),
    );
    expect(text).toBe("summary");
  }).pipe(Effect.provide(CursorRunService.Live)),
);

it.effect("collectText concatenates text across multiple assistant stream events", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const stream: SDKMessage[] = [
      {
        type: "assistant",
        agent_id: "mock-agent",
        run_id: "mock-run",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "first" }],
        },
      },
      {
        type: "assistant",
        agent_id: "mock-agent",
        run_id: "mock-run",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "second" }],
        },
      },
    ];
    const text = yield* runs.collectText(
      makeMockRun({ stream, result: { id: "mock-run", status: "finished" } }),
    );
    expect(text).toBe("firstsecond");
  }).pipe(Effect.provide(CursorRunService.Live)),
);
