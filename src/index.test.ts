import {
  Agent,
  AuthenticationError,
  ConfigurationError,
  Cursor,
  CursorAgentError,
  IntegrationNotConnectedError,
  NetworkError,
  RateLimitError,
  UnknownAgentError,
  UnsupportedRunOperationError,
} from "@cursor/february";
import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Redacted, Stream } from "effect";
import { vi } from "vitest";
import {
  CursorAgentService,
  CursorApiKey,
  CursorArtifactService,
  CursorAuthenticationError,
  CursorConfig,
  CursorConfigurationError,
  CursorInspectionService,
  CursorIntegrationNotConnectedError,
  CursorLocalCwd,
  CursorModelId,
  CursorNetworkError,
  CursorRateLimitError,
  CursorRunService,
  CursorSdkFactory,
  CursorUnknownError,
  CursorUnsupportedOperationError,
  agentOptionsFromConfig,
  loadCursorConfig,
  makeMockAgent,
  makeMockRun,
  makeMockRuntime,
  makeMockSdkFactoryLayer,
  mapCursorError,
  mockLayer,
  packageName,
  redact,
  type AgentOptions,
  type CursorSdkFactoryShape,
  type Run,
  type SDKAgent,
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
  expect(
    mapCursorError(new CursorAgentError("sdk base error"), { operation: "agent.create" }),
  ).toBeInstanceOf(CursorUnknownError);
  expect(mapCursorError(new Error("plain"), { operation: "agent.create" })).toBeInstanceOf(
    CursorUnknownError,
  );
  expect(mapCursorError("string failure", { operation: "agent.create" })).toMatchObject({
    _tag: "CursorUnknownError",
    message: "string failure",
  });
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

it("redacts arrays and primitive values without changing public data", () => {
  expect(redact([{ token: "secret" }, "visible", 1, true, null])).toEqual([
    { token: "[redacted]" },
    "visible",
    1,
    true,
    null,
  ]);
  expect(redact("plain")).toBe("plain");
});

it("has API key brand, and it is always redacted", () => {
  const apiKey = CursorApiKey.make(Redacted.make("env-key"));
  expect(Redacted.isRedacted(apiKey)).toBe(true);
  expect(String(apiKey)).toBe("<redacted>");
  expect(Redacted.value(apiKey)).toBe("env-key");
});

it("processes redacted values when building SDK options", () => {
  expect(
    agentOptionsFromConfig({
      apiKey: CursorApiKey.make(Redacted.make("env-key")),
      modelId: CursorModelId.make("composer-2"),
      cwd: CursorLocalCwd.make("/repo"),
    }),
  ).toMatchObject({
    apiKey: "env-key",
    model: { id: "composer-2" },
    local: { cwd: "/repo" },
  });
});

it("builds SDK options from wrapper config without replacing overrides", () => {
  expect(
    agentOptionsFromConfig(
      {
        apiKey: CursorApiKey.make(Redacted.make("env-key")),
        modelId: CursorModelId.make("composer-2"),
        cwd: CursorLocalCwd.make("/repo"),
      },
      {
        apiKey: "explicit",
        model: { id: CursorModelId.make("gpt-5.2") },
        local: { cwd: CursorLocalCwd.make("/other") },
      },
    ),
  ).toMatchObject({
    apiKey: "explicit",
    model: { id: "gpt-5.2" },
    local: { cwd: "/other" },
  });
  expect(
    agentOptionsFromConfig({
      cwd: CursorLocalCwd.make("/repo"),
      modelId: CursorModelId.make("auto"),
    }),
  ).toMatchObject({
    model: { id: "auto" },
    local: { cwd: "/repo" },
  });
  expect(
    agentOptionsFromConfig({ apiKey: CursorApiKey.make(Redacted.make("env-key")) }),
  ).toMatchObject({
    apiKey: "env-key",
  });
  expect(agentOptionsFromConfig(new CursorConfig({}))).toEqual({
    apiKey: undefined,
    local: undefined,
    model: undefined,
  });
});

it.effect("loads Cursor config from an Effect config provider", () =>
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    expect(config).toEqual(
      new CursorConfig({
        apiKey: CursorApiKey.make(Redacted.make("env-key")),
        modelId: CursorModelId.make("composer-2"),
        cwd: CursorLocalCwd.make("/workspace"),
      }),
    );
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({
        CURSOR_API_KEY: "env-key",
        CURSOR_MODEL: "composer-2",
        CURSOR_LOCAL_CWD: "/workspace",
      }),
    ),
  ),
);

it.effect("loads empty Cursor config when environment variables are absent", () =>
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    expect(config).toEqual(new CursorConfig({}));
  }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}))),
);

const assistantEvent: SDKMessage = {
  type: "assistant",
  agent_id: "mock-agent",
  run_id: "mock-run",
  message: {
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
  },
};

const userEvent: SDKMessage = {
  type: "user",
  agent_id: "mock-agent",
  run_id: "mock-run",
  message: {
    role: "user",
    content: [{ type: "text", text: "ignore me" }],
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
    const supportsCancel = runs.supports(run, "cancel");
    const unsupportedCancelReason = runs.unsupportedReason(run, "cancel");
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
    expect(supportsCancel).toBe(true);
    expect(unsupportedCancelReason).toBeUndefined();
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

it.effect("scopes mock agents and disposes them when the scope closes", () =>
  Effect.gen(function* () {
    let scopedAgent: ReturnType<typeof makeMockAgent> | undefined;
    const layer = Layer.succeed(
      CursorSdkFactory,
      CursorSdkFactory.of({
        ...failingSdkFactory(new Error("unused")),
        create: (_options: AgentOptions) => {
          scopedAgent = makeMockAgent();
          return scopedAgent;
        },
      }),
    );

    yield* Effect.scoped(
      Effect.gen(function* () {
        const agents = yield* CursorAgentService;
        const agent = yield* agents.scoped({ model: { id: "composer-2" } });
        expect(scopedAgent).toBe(agent);
        expect(scopedAgent?.closed).toBe(false);
      }),
    ).pipe(Effect.provide(CursorAgentService.Live.pipe(Layer.provide(layer))));

    expect(scopedAgent?.closed).toBe(true);
  }),
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

it("mock run exposes SDK metadata helpers", () => {
  const run = makeMockRun({
    stream: [],
    result: {
      id: "run-with-metadata",
      status: "finished",
      result: "done",
      durationMs: 123,
      git: { branches: [{ repoUrl: "https://github.com/acme/app", branch: "main" }] },
      model: { id: "composer-2" },
    },
  });
  expect(run.id).toBe("run-with-metadata");
  expect(run.result).toBe("done");
  expect(run.durationMs).toBe(123);
  expect(run.git?.branches[0]?.branch).toBe("main");
  expect(run.model?.id).toBe("composer-2");
  expect(run.supports("cancel")).toBe(true);
  expect(run.unsupportedReason("cancel")).toBeUndefined();
});

it.effect("collectText ignores non-assistant stream events", () =>
  Effect.gen(function* () {
    const runs = yield* CursorRunService;
    const text = yield* runs.collectText(
      makeMockRun({
        stream: [userEvent, assistantEvent],
        result: { id: "mock-run", status: "finished" },
      }),
    );
    expect(text).toBe("hello");
  }).pipe(Effect.provide(CursorRunService.Live)),
);

it.effect("mock agent closes on explicit disposal", () =>
  Effect.gen(function* () {
    const agent = makeMockAgent();
    yield* Effect.promise(() => agent[Symbol.asyncDispose]());
    expect(agent.closed).toBe(true);
  }),
);

it.effect("lowest-level mock SDK factory returns deterministic fixture defaults", () =>
  Effect.gen(function* () {
    const sdk = yield* CursorSdkFactory;
    const agent = sdk.create({});
    const resumed = sdk.resume("missing-agent");
    const promptResult = yield* Effect.promise(() => sdk.prompt("hello"));
    const listedAgents = yield* Effect.promise(() => sdk.listAgents());
    const gotAgent = yield* Effect.promise(() => sdk.getAgent("missing-agent"));
    const messages = yield* Effect.promise(() => sdk.listMessages("missing-agent"));
    const user = yield* Effect.promise(() => sdk.me());
    const models = yield* Effect.promise(() => sdk.listModels());
    const repos = yield* Effect.promise(() => sdk.listRepositories());
    const defaultArtifactAgent = sdk.create({});
    const defaultArtifacts = yield* Effect.promise(() => defaultArtifactAgent.listArtifacts());
    const defaultArtifactData = yield* Effect.promise(() =>
      defaultArtifactAgent.downloadArtifact("missing.txt"),
    );

    expect(agent.agentId).toBe("custom-agent");
    expect(resumed.agentId).toBe("custom-agent");
    expect(promptResult.id).toBe("custom-run");
    expect(listedAgents.items).toEqual([]);
    expect(gotAgent.agentId).toBe("custom-agent");
    expect(messages).toEqual([]);
    expect(user.apiKeyName).toBe("mock");
    expect(models).toEqual([]);
    expect(repos).toEqual([]);
    expect(defaultArtifacts).toEqual([]);
    expect(defaultArtifactData.toString()).toBe("");
  }).pipe(
    Effect.provide(makeMockSdkFactoryLayer({ agentId: "custom-agent", runId: "custom-run" })),
  ),
);

it.effect("lowest-level mock SDK factory has stable empty-fixture fallbacks", () =>
  Effect.gen(function* () {
    const sdk = yield* CursorSdkFactory;
    const promptResult = yield* Effect.promise(() => sdk.prompt("hello"));
    const gotAgent = yield* Effect.promise(() => sdk.getAgent("missing-agent"));

    expect(promptResult).toEqual({ id: "mock-run", status: "finished", result: "" });
    expect(gotAgent).toEqual({
      agentId: "mock-agent",
      name: "Mock Agent",
      summary: "Deterministic mock agent",
      lastModified: 0,
    });
  }).pipe(Effect.provide(makeMockSdkFactoryLayer())),
);

it.effect("live SDK factory delegates to the underlying Cursor SDK", () =>
  Effect.gen(function* () {
    const agent = makeMockAgent({ agentId: "live-agent" });
    const run = makeMockRun({ runId: "live-run" });
    const agentInfo = { agentId: "live-agent", name: "Live", summary: "Live", lastModified: 1 };
    const user = { apiKeyName: "live-key", createdAt: "now" };
    const model = { id: "composer-2", displayName: "Composer 2" };
    const repository = {
      owner: "cursor",
      name: "repo",
      repository: "https://github.com/cursor/repo",
    };

    using create = vi.spyOn(Agent, "create").mockReturnValue(agent);
    using resume = vi.spyOn(Agent, "resume").mockReturnValue(agent);
    using prompt = vi.spyOn(Agent, "prompt").mockResolvedValue({
      id: "live-run",
      status: "finished",
    });
    using list = vi.spyOn(Agent, "list").mockResolvedValue({ items: [agentInfo] });
    using listRuns = vi.spyOn(Agent, "listRuns").mockResolvedValue({ items: [run] });
    using getRun = vi.spyOn(Agent, "getRun").mockResolvedValue(run);
    using get = vi.spyOn(Agent, "get").mockResolvedValue(agentInfo);
    using archive = vi.spyOn(Agent, "archive").mockResolvedValue(undefined);
    using unarchive = vi.spyOn(Agent, "unarchive").mockResolvedValue(undefined);
    using deleteAgent = vi.spyOn(Agent, "delete").mockResolvedValue(undefined);
    using messagesList = vi.spyOn(Agent.messages, "list").mockResolvedValue([]);
    using me = vi.spyOn(Cursor, "me").mockResolvedValue(user);
    using modelsList = vi.spyOn(Cursor.models, "list").mockResolvedValue([model]);
    using repositoriesList = vi.spyOn(Cursor.repositories, "list").mockResolvedValue([repository]);

    const sdk = yield* CursorSdkFactory;
    expect(sdk.create({})).toBe(agent);
    expect(sdk.resume("live-agent")).toBe(agent);
    expect(yield* Effect.promise(() => sdk.prompt("hello"))).toMatchObject({ id: "live-run" });
    expect(yield* Effect.promise(() => sdk.listAgents())).toEqual({ items: [agentInfo] });
    expect(yield* Effect.promise(() => sdk.listRuns("live-agent"))).toEqual({ items: [run] });
    expect(yield* Effect.promise(() => sdk.getRun("live-run"))).toBe(run);
    expect(yield* Effect.promise(() => sdk.getAgent("live-agent"))).toBe(agentInfo);
    yield* Effect.promise(() => sdk.archiveAgent("live-agent"));
    yield* Effect.promise(() => sdk.unarchiveAgent("live-agent"));
    yield* Effect.promise(() => sdk.deleteAgent("live-agent"));
    expect(yield* Effect.promise(() => sdk.listMessages("live-agent"))).toEqual([]);
    expect(yield* Effect.promise(() => sdk.me())).toBe(user);
    expect(yield* Effect.promise(() => sdk.listModels())).toEqual([model]);
    expect(yield* Effect.promise(() => sdk.listRepositories())).toEqual([repository]);

    expect(create).toHaveBeenCalledOnce();
    expect(resume).toHaveBeenCalledWith("live-agent", undefined);
    expect(prompt).toHaveBeenCalledWith("hello", undefined);
    expect(list).toHaveBeenCalledWith(undefined);
    expect(listRuns).toHaveBeenCalledWith("live-agent", undefined);
    expect(getRun).toHaveBeenCalledWith("live-run", undefined);
    expect(get).toHaveBeenCalledWith("live-agent", undefined);
    expect(archive).toHaveBeenCalledWith("live-agent", undefined);
    expect(unarchive).toHaveBeenCalledWith("live-agent", undefined);
    expect(deleteAgent).toHaveBeenCalledWith("live-agent", undefined);
    expect(messagesList).toHaveBeenCalledWith("live-agent", undefined);
    expect(me).toHaveBeenCalledWith(undefined);
    expect(modelsList).toHaveBeenCalledWith(undefined);
    expect(repositoriesList).toHaveBeenCalledWith(undefined);
  }).pipe(Effect.provide(CursorSdkFactory.Live)),
);

it.effect("ready-made mock runtime runs programs with mock services", () =>
  Effect.promise(async () => {
    const runtime = makeMockRuntime({
      result: { id: "runtime-run", status: "finished", result: "runtime ok" },
      stream: [assistantEvent],
    });
    const value = await runtime.runPromise(
      Effect.gen(function* () {
        const agents = yield* CursorAgentService;
        const runs = yield* CursorRunService;
        const agent = yield* agents.create({});
        const run = yield* agents.send(agent, "hello");
        return yield* runs.collectText(run);
      }),
    );

    expect(value).toBe("hello");
    await runtime.dispose();
  }),
);

it.effect("maps service failures to operation-specific tagged errors", () =>
  Effect.gen(function* () {
    const authFailure = new AuthenticationError("no auth");
    const unsupportedFailure = new UnsupportedRunOperationError("cancel");
    const streamFailure = new Error("stream failed");
    const agent = makeThrowingAgent(authFailure);
    const run = makeThrowingRun(authFailure, unsupportedFailure, streamFailure);

    const agentLayer = CursorAgentService.Live.pipe(
      Layer.provide(failingSdkFactoryLayer(authFailure)),
    );
    const inspectionLayer = CursorInspectionService.Live.pipe(
      Layer.provide(failingSdkFactoryLayer(authFailure)),
    );

    const agents = yield* Effect.gen(function* () {
      return yield* CursorAgentService;
    }).pipe(Effect.provide(agentLayer));
    const inspection = yield* Effect.gen(function* () {
      return yield* CursorInspectionService;
    }).pipe(Effect.provide(inspectionLayer));
    const runs = yield* Effect.gen(function* () {
      return yield* CursorRunService;
    }).pipe(Effect.provide(CursorRunService.Live));
    const artifacts = yield* Effect.gen(function* () {
      return yield* CursorArtifactService;
    }).pipe(Effect.provide(CursorArtifactService.Live));

    yield* expectFailureTag(agents.create({}), "CursorAuthenticationError");
    yield* expectFailureTag(agents.resume("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(agents.prompt("hello"), "CursorAuthenticationError");
    yield* expectFailureTag(agents.send(agent, "hello"), "CursorAuthenticationError");
    yield* expectFailureTag(agents.reload(agent), "CursorAuthenticationError");
    yield* expectFailureTag(agents.dispose(agent), "CursorAuthenticationError");
    yield* expectFailureTag(runs.wait(run), "CursorAuthenticationError");
    yield* expectFailureTag(runs.cancel(run), "CursorUnsupportedOperationError");
    yield* expectFailureTag(runs.conversation(run), "CursorUnsupportedOperationError");
    yield* expectFailureTag(runs.collectText(run), "CursorStreamError");
    yield* expectFailureTag(Stream.runDrain(runs.streamEvents(run)), "CursorStreamError");
    yield* expectFailureTag(artifacts.listArtifacts(agent), "CursorAuthenticationError");
    yield* expectFailureTag(
      artifacts.downloadArtifact(agent, "artifact.txt"),
      "CursorAuthenticationError",
    );
    yield* expectFailureTag(inspection.listAgents(), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.getAgent("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.archiveAgent("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.unarchiveAgent("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.deleteAgent("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.listRuns("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.getRun("run-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.listMessages("agent-1"), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.me(), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.listModels(), "CursorAuthenticationError");
    yield* expectFailureTag(inspection.listRepositories(), "CursorAuthenticationError");
  }),
);

const failingSdkFactory = (cause: Error): CursorSdkFactoryShape => {
  return {
    create: (_options: AgentOptions) => {
      throw cause;
    },
    resume: (_agentId: string, _options?: Partial<AgentOptions>) => {
      throw cause;
    },
    prompt: async () => {
      throw cause;
    },
    listAgents: async () => {
      throw cause;
    },
    listRuns: async () => {
      throw cause;
    },
    getRun: async () => {
      throw cause;
    },
    getAgent: async () => {
      throw cause;
    },
    archiveAgent: async () => {
      throw cause;
    },
    unarchiveAgent: async () => {
      throw cause;
    },
    deleteAgent: async () => {
      throw cause;
    },
    listMessages: async () => {
      throw cause;
    },
    me: async () => {
      throw cause;
    },
    listModels: async () => {
      throw cause;
    },
    listRepositories: async () => {
      throw cause;
    },
  };
};

const failingSdkFactoryLayer = (cause: Error) => {
  return Layer.succeed(CursorSdkFactory, CursorSdkFactory.of(failingSdkFactory(cause)));
};

const makeThrowingAgent = (cause: Error): SDKAgent => {
  const agent = makeMockAgent();
  return {
    ...agent,
    agentId: agent.agentId,
    send: async () => {
      throw cause;
    },
    close: () => {
      agent.close();
    },
    reload: async () => {
      throw cause;
    },
    [Symbol.asyncDispose]: async () => {
      throw cause;
    },
    listArtifacts: async () => {
      throw cause;
    },
    downloadArtifact: async () => {
      throw cause;
    },
  };
};

const makeThrowingRun = (waitCause: Error, operationCause: Error, streamCause: Error): Run => {
  const run = makeMockRun();
  return {
    ...run,
    id: run.id,
    agentId: run.agentId,
    createdAt: run.createdAt,
    status: run.status,
    result: run.result,
    model: run.model,
    durationMs: run.durationMs,
    git: run.git,
    supports: (operation: Parameters<typeof run.supports>[0]) => {
      return run.supports(operation);
    },
    unsupportedReason: (operation: Parameters<typeof run.unsupportedReason>[0]) => {
      return run.unsupportedReason(operation);
    },
    stream: async function* () {
      yield* [];
      throw streamCause;
    },
    conversation: async () => {
      throw operationCause;
    },
    wait: async () => {
      throw waitCause;
    },
    cancel: async () => {
      throw operationCause;
    },
    onDidChangeStatus: (listener: Parameters<typeof run.onDidChangeStatus>[0]) => {
      return run.onDidChangeStatus(listener);
    },
  };
};

const expectFailureTag = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
  expected: E["_tag"],
) => {
  return Effect.gen(function* () {
    const failure = yield* Effect.flip(effect);
    expect(failure._tag).toBe(expected);
  });
};
