import { expect, it } from "@effect/vitest";
import { Effect, Layer, ManagedRuntime, Metric, Stream } from "effect";

import {
  appendAssistantSdkMessageText,
  collectTextTracked,
  streamEventsTracked,
  summarizeAgentOptionsForLog,
  summarizeRunForLog,
} from "./cursor-observability";
import { cursorStreamEvents } from "./cursor-telemetry";
import { CursorRunService } from "./cursor-run";
import { makeMockRun } from "./cursor-mock";

it("appendAssistantSdkMessageText ignores non-assistant events", () => {
  expect(
    appendAssistantSdkMessageText("a", {
      type: "user",
      agent_id: "x",
      run_id: "r",
      message: { role: "user", content: [{ type: "text", text: "n" }] },
    }),
  ).toBe("a");
  expect(
    appendAssistantSdkMessageText("a", {
      type: "assistant",
      agent_id: "x",
      run_id: "r",
      message: { role: "assistant", content: [{ type: "text", text: "b" }] },
    }),
  ).toBe("ab");
});

it.effect("collectTextTracked matches assistant stream text", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const run = makeMockRun({
      stream: [
        {
          type: "assistant",
          agent_id: "mock-agent",
          run_id: "mock-run",
          message: { role: "assistant", content: [{ type: "text", text: "x" }] },
        },
      ],
      result: { id: "mock-run", status: "finished", result: "x" },
    });
    const text = yield* collectTextTracked(run, (r) => runs.streamEvents(r));
    expect(text).toBe("x");
  }).pipe(Effect.provide(CursorRunService.Live)),
);

it("summarizeAgentOptionsForLog never includes raw apiKey", () => {
  const summary = summarizeAgentOptionsForLog({
    apiKey: "secret",
    model: { id: "composer-2" },
  });
  expect(summary).not.toHaveProperty("apiKey");
  expect(summary.model).toEqual({ id: "composer-2" });
});

it("summarizeAgentOptionsForLog summarizes cloud, MCP servers, and subagent counts", () => {
  const summary = summarizeAgentOptionsForLog({
    apiKey: "secret",
    model: { id: "composer-2" },
    name: "my-agent",
    agentId: "agt_1",
    local: { cwd: "/repo" },
    cloud: {
      repos: [{ url: "https://github.com/acme/app" }],
      autoCreatePR: true,
      workOnCurrentBranch: false,
      env: { type: "cloud", name: "default" },
    },
    mcpServers: {
      fs: { command: "mcp-fs", args: [] },
      git: { command: "mcp-git", args: [] },
    },
    agents: {
      reviewer: { description: "d", prompt: "p" },
    },
  });
  expect(summary).not.toHaveProperty("apiKey");
  expect(summary).toMatchObject({
    name: "my-agent",
    agentId: "agt_1",
    local: { cwd: "/repo" },
    mcpServerNames: expect.arrayContaining(["fs", "git"]),
    agentsCount: 1,
    cloud: {
      reposCount: 1,
      autoCreatePR: true,
      workOnCurrentBranch: false,
      envType: "cloud",
    },
  });
});

it("summarizeRunForLog returns ids", () => {
  expect(summarizeRunForLog({ id: "r1", agentId: "a1", status: "finished" })).toEqual({
    runId: "r1",
    agentId: "a1",
    status: "finished",
  });
});

it("streamEventsTracked increments cursorStreamEvents once per emitted chunk", async () => {
  const runtime = ManagedRuntime.make(Layer.empty);
  try {
    await runtime.runPromise(
      Effect.gen(function* () {
        const before = yield* Metric.value(cursorStreamEvents);
        yield* streamEventsTracked(Stream.fromIterable([1, 2, 3])).pipe(Stream.runDrain);
        const after = yield* Metric.value(cursorStreamEvents);
        expect(after.count - before.count).toBe(3);
      }),
    );
  } finally {
    await runtime.dispose();
  }
});
