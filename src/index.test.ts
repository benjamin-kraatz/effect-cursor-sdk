import {
  AuthenticationError,
  ConfigurationError,
  IntegrationNotConnectedError,
  NetworkError,
  RateLimitError,
  UnknownAgentError,
  UnsupportedRunOperationError,
} from "@cursor/february";
import { expect, it } from "@effect/vitest";
import { Effect, Stream } from "effect";
import {
  CursorAgentService,
  CursorArtifactService,
  CursorAuthenticationError,
  CursorConfigurationError,
  CursorIntegrationNotConnectedError,
  CursorInspectionService,
  CursorNetworkError,
  CursorRateLimitError,
  CursorRunService,
  CursorUnsupportedOperationError,
  CursorUnknownError,
  agentOptionsFromConfig,
  makeMockAgent,
  makeMockRun,
  mapCursorError,
  mockLayer,
  packageName,
  redact,
  type SDKMessage,
} from "./index";

it("packageName (sync)", () => {
  expect(packageName).toBe("effect-cursor-sdk");
});

it.effect("packageName (Effect)", () =>
  Effect.gen(function* () {
    const name = yield* Effect.sync(() => packageName);
    expect(name).toBe("effect-cursor-sdk");
  }),
);

it("maps known SDK errors to tagged errors", () => {
  expect(
    mapCursorError(new AuthenticationError("nope"), { operation: "agent.create" }),
  ).toBeInstanceOf(CursorAuthenticationError);
  expect(
    mapCursorError(new RateLimitError("slow down"), { operation: "agent.create" }),
  ).toBeInstanceOf(CursorRateLimitError);
  expect(
    mapCursorError(new ConfigurationError("bad config"), { operation: "agent.create" }),
  ).toBeInstanceOf(CursorConfigurationError);
  expect(mapCursorError(new NetworkError("offline"), { operation: "agent.create" })).toBeInstanceOf(
    CursorNetworkError,
  );
  expect(
    mapCursorError(new UnsupportedRunOperationError("cancel"), { operation: "run.cancel" }),
  ).toBeInstanceOf(CursorUnsupportedOperationError);
  expect(
    mapCursorError(
      new IntegrationNotConnectedError("connect github", {
        helpUrl: "https://cursor.com",
        provider: "github",
      }),
      { operation: "agent.create" },
    ),
  ).toBeInstanceOf(CursorIntegrationNotConnectedError);
  expect(
    mapCursorError(new UnknownAgentError("mystery"), { operation: "agent.create" }),
  ).toBeInstanceOf(CursorUnknownError);
  expect(mapCursorError(new Error("stream exploded"), { operation: "run.stream" })).toMatchObject({
    _tag: "CursorStreamError",
  });
});

it("redacts common secret fields recursively", () => {
  expect(
    redact({
      apiKey: "secret",
      nested: { Authorization: "bearer token", keep: "value" },
      images: [{ data: "base64" }],
    }),
  ).toEqual({
    apiKey: "[redacted]",
    nested: { Authorization: "[redacted]", keep: "value" },
    images: [{ data: "[redacted]" }],
  });
});

it("builds SDK options from wrapper config without replacing overrides", () => {
  expect(
    agentOptionsFromConfig(
      { apiKey: "env-key", modelId: "composer-2", cwd: "/repo" },
      { apiKey: "explicit", model: { id: "gpt-5.2" }, local: { cwd: "/other" } },
    ),
  ).toMatchObject({
    apiKey: "explicit",
    model: { id: "gpt-5.2" },
    local: { cwd: "/other" },
  });
  expect(agentOptionsFromConfig({ cwd: "/repo", modelId: "auto" })).toMatchObject({
    model: { id: "auto" },
    local: { cwd: "/repo" },
  });
});

const assistantEvent: SDKMessage = {
  type: "assistant",
  agent_id: "mock-agent",
  run_id: "mock-run",
  message: {
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
  },
};

it.effect("uses mock layer for agent, run, artifact, and inspection services", () =>
  Effect.gen(function* () {
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const artifacts = yield* CursorArtifactService;
    const inspection = yield* CursorInspectionService;

    const agent = yield* agents.create({ model: { id: "composer-2" } });
    const run = yield* agents.send(agent, "Say hello");
    const resumed = yield* agents.resume("mock-agent");
    const prompted = yield* agents.prompt("One shot");
    yield* agents.reload(agent);
    const text = yield* runs.collectText(run);
    const result = yield* runs.wait(run);
    const events = yield* runs.streamEvents(run).pipe(
      Stream.runFold(
        (): SDKMessage[] => [],
        (items, event) => [...items, event],
      ),
    );
    const conversation = yield* runs.conversation(run);
    const unsubscribe = yield* runs.onDidChangeStatus(run, () => undefined);
    const listedArtifacts = yield* artifacts.listArtifacts(agent);
    const downloaded = yield* artifacts.downloadArtifact(agent, "artifacts/output.txt");
    const listedAgents = yield* inspection.listAgents();
    const gotAgent = yield* inspection.getAgent("mock-agent");
    yield* inspection.archiveAgent("mock-agent");
    yield* inspection.unarchiveAgent("mock-agent");
    yield* inspection.deleteAgent("mock-agent");
    const listedRuns = yield* inspection.listRuns("mock-agent");
    const gotRun = yield* inspection.getRun("mock-run");
    const messages = yield* inspection.listMessages("mock-agent");
    const me = yield* inspection.me();
    const models = yield* inspection.listModels();
    const repos = yield* inspection.listRepositories();
    yield* agents.close(resumed);
    yield* agents.dispose(agent);
    unsubscribe();

    expect(text).toBe("hello");
    expect(events).toEqual([assistantEvent]);
    expect(conversation).toEqual([]);
    expect(result.status).toBe("finished");
    expect(prompted.result).toBe("hello");
    expect(listedArtifacts).toEqual([
      { path: "artifacts/output.txt", sizeBytes: 2, updatedAt: "now" },
    ]);
    expect(downloaded.toString()).toBe("ok");
    expect(gotAgent.agentId).toBe("mock-agent");
    expect(listedRuns.items[0]?.id).toBe("mock-run");
    expect(gotRun.id).toBe("mock-run");
    expect(messages[0]?.type).toBe("user");
    expect(me.apiKeyName).toBe("mock-key");
    expect(listedAgents.items[0]?.agentId).toBe("mock-agent");
    expect(models[0]?.id).toBe("composer-2");
    expect(repos[0]?.repository).toContain("example/repo");
  }).pipe(
    Effect.provide(
      mockLayer({
        stream: [assistantEvent],
        result: { id: "mock-run", status: "finished", result: "hello" },
        artifacts: [{ path: "artifacts/output.txt", sizeBytes: 2, updatedAt: "now" }],
        artifactData: Buffer.from("ok"),
        agents: [{ agentId: "mock-agent", name: "Mock", summary: "Mock", lastModified: 0 }],
        messages: [{ type: "user", uuid: "u1", agent_id: "mock-agent", message: { text: "hi" } }],
        user: { apiKeyName: "mock-key", userEmail: "mock@example.com", createdAt: "now" },
        models: [{ id: "composer-2", displayName: "Composer 2" }],
        repositories: [
          { owner: "example", name: "repo", repository: "https://github.com/example/repo" },
        ],
      }),
    ),
  ),
);

it.effect("mock run supports cancellation and status listeners", () =>
  Effect.gen(function* () {
    const run = makeMockRun({
      stream: [assistantEvent],
      result: { id: "mock-run", status: "finished" },
    });
    const statuses: string[] = [];
    const unsubscribe = yield* Effect.sync(() =>
      run.onDidChangeStatus((status) => statuses.push(status)),
    );
    yield* Effect.promise(() => run.cancel());
    unsubscribe();
    expect(statuses).toEqual(["cancelled"]);
  }),
);

it.effect("mock agent closes on explicit disposal", () =>
  Effect.gen(function* () {
    const agent = makeMockAgent();
    yield* Effect.promise(() => agent[Symbol.asyncDispose]());
    expect(agent.closed).toBe(true);
  }),
);
