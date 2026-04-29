import { Layer } from "effect";

import { CursorSdkFactory } from "./cursor-sdk-factory";
import type {
  AgentMessage,
  AgentOperationOptions,
  AgentOptions,
  CursorRequestOptions,
  GetAgentMessagesOptions,
  GetAgentOptions,
  GetRunOptions,
  ListAgentsOptions,
  ListResult,
  ListRunsOptions,
  Run,
  RunOperation,
  RunResult,
  RunStatus,
  SDKAgent,
  SDKAgentInfo,
  SDKArtifact,
  SDKMessage,
  SDKModel,
  SDKRepository,
  SDKUser,
  SDKUserMessage,
  SendOptions,
} from "./cursor-types";

/**
 * Fixture data used by the deterministic mock SDK layer.
 *
 * @example
 * ```ts
 * const fixtures: CursorMockFixtures = {
 *   stream: [assistantEvent],
 *   result: { id: "run-1", status: "finished", result: "Done" }
 * }
 * ```
 *
 * @see {@link mockLayer}
 * @see {@link makeMockSdkFactoryLayer}
 * @category testing
 */
export interface CursorMockFixtures {
  readonly agentId?: string;
  readonly runId?: string;
  readonly stream?: ReadonlyArray<SDKMessage>;
  readonly result?: RunResult;
  readonly artifacts?: ReadonlyArray<SDKArtifact>;
  readonly artifactData?: Buffer;
  readonly agents?: ReadonlyArray<SDKAgentInfo>;
  readonly messages?: ReadonlyArray<AgentMessage>;
  readonly models?: ReadonlyArray<SDKModel>;
  readonly repositories?: ReadonlyArray<SDKRepository>;
  readonly user?: SDKUser;
}

/**
 * Deterministic SDK `Run` implementation for tests.
 *
 * @param streamEvents - Events yielded by {@link MockCursorRun.stream}.
 * @param waitResult - Result returned by {@link MockCursorRun.wait}.
 *
 * @example
 * ```ts
 * const run = new MockCursorRun([assistantEvent], {
 *   id: "run-1",
 *   status: "finished",
 *   result: "Done"
 * })
 * ```
 *
 * @see {@link makeMockRun}
 * @category testing
 */
export class MockCursorRun implements Run {
  readonly id: string;
  readonly agentId: string;
  readonly createdAt = Date.now();
  #status: RunStatus;
  #listeners = new Set<(status: RunStatus) => void>();

  constructor(
    readonly streamEvents: ReadonlyArray<SDKMessage>,
    readonly waitResult: RunResult,
  ) {
    this.id = waitResult.id;
    this.agentId = streamEvents[0]?.agent_id ?? "mock-agent";
    this.#status = waitResult.status;
  }

  get status(): RunStatus {
    return this.#status;
  }
  get result(): string | undefined {
    return this.waitResult.result;
  }
  get model(): RunResult["model"] {
    return this.waitResult.model;
  }
  get durationMs(): number | undefined {
    return this.waitResult.durationMs;
  }
  get git(): RunResult["git"] {
    return this.waitResult.git;
  }
  supports(_operation: RunOperation): boolean {
    return true;
  }
  unsupportedReason(_operation: RunOperation): string | undefined {
    return undefined;
  }
  async *stream(): AsyncGenerator<SDKMessage, void> {
    yield* this.streamEvents;
  }
  async conversation(): Promise<[]> {
    return [];
  }
  async wait(): Promise<RunResult> {
    return this.waitResult;
  }
  async cancel(): Promise<void> {
    this.#status = "cancelled";
    for (const listener of this.#listeners) listener(this.#status);
  }
  onDidChangeStatus(listener: (status: RunStatus) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

/**
 * Deterministic SDK `Agent` implementation for tests.
 *
 * @param fixtures - Static data used by `send`, artifact methods, and metadata methods.
 *
 * @example
 * ```ts
 * const agent = new MockCursorAgent({ result: { id: "run-1", status: "finished" } })
 * const run = await agent.send("hello")
 * ```
 *
 * @see {@link makeMockAgent}
 * @see {@link CursorMockFixtures}
 * @category testing
 */
export class MockCursorAgent implements SDKAgent {
  readonly agentId: string;
  readonly runs: Run[] = [];
  closed = false;

  constructor(readonly fixtures: CursorMockFixtures = {}) {
    this.agentId = fixtures.agentId ?? "mock-agent";
  }

  get model(): AgentOptions["model"] | undefined {
    return this.fixtures.result?.model;
  }

  async send(_message: string | SDKUserMessage, _options?: SendOptions): Promise<Run> {
    const run = makeMockRun(this.fixtures);
    this.runs.push(run);
    return run;
  }
  close(): void {
    this.closed = true;
  }
  async reload(): Promise<void> {}
  async [Symbol.asyncDispose](): Promise<void> {
    this.closed = true;
  }
  async listArtifacts(): Promise<SDKArtifact[]> {
    return [...(this.fixtures.artifacts ?? [])];
  }
  async downloadArtifact(_path: string): Promise<Buffer> {
    return this.fixtures.artifactData ?? Buffer.from("");
  }
}

/**
 * Create a mock run from fixtures.
 *
 * @param fixtures - Optional mock run and stream data.
 *
 * @see {@link MockCursorRun}
 * @category testing
 */
export const makeMockRun = (fixtures: CursorMockFixtures = {}): MockCursorRun => {
  const runId = fixtures.runId ?? "mock-run";
  return new MockCursorRun(
    fixtures.stream ?? [],
    fixtures.result ?? { id: runId, status: "finished", result: "" },
  );
};

/**
 * Create a mock agent from fixtures.
 *
 * @param fixtures - Optional mock agent, run, artifact, and metadata data.
 *
 * @see {@link MockCursorAgent}
 * @category testing
 */
export const makeMockAgent = (fixtures: CursorMockFixtures = {}): MockCursorAgent => {
  return new MockCursorAgent(fixtures);
};

/**
 * Layer replacing the SDK factory with deterministic mock behavior.
 *
 * This is the lowest-level mock entry point. Prefer {@link mockLayer} when you
 * want all higher-level services wired together for tests.
 *
 * @param fixtures - Static SDK responses returned by the factory methods.
 *
 * @example
 * ```ts
 * const layer = makeMockSdkFactoryLayer({
 *   agents: [{ agentId: "mock-agent", name: "Mock", summary: "Test", lastModified: 0 }]
 * })
 * ```
 *
 * @see {@link CursorSdkFactory}
 * @see {@link mockLayer}
 * @category testing
 */
export const makeMockSdkFactoryLayer = (fixtures: CursorMockFixtures = {}) => {
  return Layer.succeed(
    CursorSdkFactory,
    CursorSdkFactory.of({
      create: (_options: AgentOptions): Promise<SDKAgent> => {
        return Promise.resolve(makeMockAgent(fixtures));
      },
      resume: (_agentId: string, _options?: Partial<AgentOptions>): Promise<SDKAgent> => {
        return Promise.resolve(makeMockAgent(fixtures));
      },
      prompt: async (_message: string, _options?: AgentOptions): Promise<RunResult> => {
        return (
          fixtures.result ?? { id: fixtures.runId ?? "mock-run", status: "finished", result: "" }
        );
      },
      listAgents: async (_options?: ListAgentsOptions): Promise<ListResult<SDKAgentInfo>> => {
        return { items: [...(fixtures.agents ?? [])] };
      },
      listRuns: async (_agentId: string, _options?: ListRunsOptions): Promise<ListResult<Run>> => {
        return { items: [makeMockRun(fixtures)] };
      },
      getRun: async (_runId: string, _options?: GetRunOptions): Promise<Run> => {
        return makeMockRun(fixtures);
      },
      getAgent: async (_agentId: string, _options?: GetAgentOptions): Promise<SDKAgentInfo> => {
        return (
          fixtures.agents?.[0] ?? {
            agentId: fixtures.agentId ?? "mock-agent",
            name: "Mock Agent",
            summary: "Deterministic mock agent",
            lastModified: 0,
          }
        );
      },
      archiveAgent: async (_agentId: string, _options?: AgentOperationOptions): Promise<void> => {},
      unarchiveAgent: async (
        _agentId: string,
        _options?: AgentOperationOptions,
      ): Promise<void> => {},
      deleteAgent: async (_agentId: string, _options?: AgentOperationOptions): Promise<void> => {},
      listMessages: async (
        _agentId: string,
        _options?: GetAgentMessagesOptions,
      ): Promise<AgentMessage[]> => {
        return [...(fixtures.messages ?? [])];
      },
      me: async (_options?: CursorRequestOptions): Promise<SDKUser> => {
        return fixtures.user ?? { apiKeyName: "mock", createdAt: "1970-01-01T00:00:00.000Z" };
      },
      listModels: async (_options?: CursorRequestOptions): Promise<SDKModel[]> => {
        return [...(fixtures.models ?? [])];
      },
      listRepositories: async (_options?: CursorRequestOptions): Promise<SDKRepository[]> => {
        return [...(fixtures.repositories ?? [])];
      },
    }),
  );
};
