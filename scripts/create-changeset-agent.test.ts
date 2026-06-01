import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Logger, Sink, Stream } from "effect";
import {
  ChildProcessSpawner,
  ExitCode,
  ProcessId,
  make as makeChildProcessSpawner,
  makeHandle,
} from "effect/unstable/process/ChildProcessSpawner";

import {
  CursorAgentService,
  CursorRunService,
  CursorSdkFactory,
  makeMockAgent,
  makeMockAssistantSdkMessage,
  makeMockRun,
  mockLayer,
} from "../src/index";
import {
  DEFAULT_CHANGESET_BASE_REF,
  DEFAULT_CURSOR_MODEL,
  changedChangesetsFromFiles,
  changesetBaseRefFromEnv,
  changesetFilesFromEntries,
  cwdFromEnv,
  cursorModelFromEnv,
  listChangedFiles,
  listChangesets,
  makeProgram,
  newChangesets,
  promptForChangeset,
} from "./create-changeset-agent";

const gitLayer = (stdout: string) => {
  const bytes = new TextEncoder().encode(stdout);

  return Layer.succeed(
    ChildProcessSpawner,
    makeChildProcessSpawner(() =>
      Effect.succeed(
        makeHandle({
          pid: ProcessId(1),
          exitCode: Effect.succeed(ExitCode(0)),
          isRunning: Effect.succeed(false),
          kill: () => Effect.void,
          stdin: Sink.drain,
          stdout: Stream.fromIterable([bytes]),
          stderr: Stream.empty,
          all: Stream.fromIterable([bytes]),
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
          unref: Effect.succeed(Effect.void),
        }),
      ),
    ),
  );
};

const configProvider = ConfigProvider.fromUnknown({
  CURSOR_API_KEY: "test-key",
  CURSOR_MODEL: "composer-2.5",
});

const programLayer = (gitStdout: string) => {
  return Layer.mergeAll(
    mockLayer({
      stream: [makeMockAssistantSdkMessage("Added changeset for release.")],
      result: { id: "mock-run", status: "finished", result: "ok" },
    }),
    gitLayer(gitStdout),
  );
};

const layerThatWritesChangesetOnSend = (cwd: string) => {
  return Layer.succeed(
    CursorSdkFactory,
    CursorSdkFactory.of({
      create: async () => {
        const agent = makeMockAgent();
        const baseSend = agent.send.bind(agent);

        agent.send = async (message, options) => {
          await writeFile(
            join(cwd, ".changeset", "from-agent.md"),
            `---\n"effect-cursor-sdk": patch\n---\n\nAgent changeset.\n`,
          );
          return baseSend(message, options);
        };

        return agent;
      },
      resume: async () => makeMockAgent(),
      prompt: async () => ({ id: "mock-run", status: "finished" as const, result: "" }),
      listAgents: async () => ({ items: [] }),
      listRuns: async () => ({ items: [] }),
      getRun: async () => makeMockRun(),
      getAgent: async () => ({
        agentId: "mock-agent",
        name: "Mock",
        summary: "Mock",
        lastModified: 0,
      }),
      archiveAgent: async () => undefined,
      unarchiveAgent: async () => undefined,
      deleteAgent: async () => undefined,
      listMessages: async () => [],
      me: async () => ({ apiKeyName: "mock", createdAt: "now" }),
      listModels: async () => [],
      listRepositories: async () => [],
    }),
  );
};

const agentServicesWithWriter = (cwd: string) =>
  Layer.mergeAll(
    CursorRunService.Live,
    Layer.provide(CursorAgentService.Live, layerThatWritesChangesetOnSend(cwd)),
  );

describe("create-changeset-agent policy", () => {
  it("keeps the default Cursor model pinned", () => {
    expect(DEFAULT_CURSOR_MODEL).toBe("composer-2.5");
    expect(cursorModelFromEnv({})).toBe("composer-2.5");
  });

  it("allows the Cursor model to be overridden by the workflow environment", () => {
    expect(cursorModelFromEnv({ CURSOR_MODEL: "custom-model" })).toBe("custom-model");
  });

  it("keeps the default changeset base pinned to origin/main", () => {
    expect(DEFAULT_CHANGESET_BASE_REF).toBe("origin/main");
    expect(changesetBaseRefFromEnv({})).toBe("origin/main");
  });

  it("allows the changeset base to be overridden for local or release-branch runs", () => {
    expect(changesetBaseRefFromEnv({ CHANGESET_BASE_REF: "origin/release" })).toBe(
      "origin/release",
    );
  });

  it("uses GITHUB_WORKSPACE when set and otherwise falls back to cwd", () => {
    expect(cwdFromEnv({ GITHUB_WORKSPACE: "/tmp/ci-checkout" })).toBe("/tmp/ci-checkout");
    expect(cwdFromEnv({})).toBe(process.cwd());
  });

  it("filters changed files down to changeset markdown files", () => {
    expect(
      changedChangesetsFromFiles([
        "src/index.ts",
        ".changeset/add-agent.md",
        ".changeset/config.json",
        "docs/changeset-agent.md",
      ]),
    ).toEqual([".changeset/add-agent.md"]);
  });

  it("ignores .changeset/README.md when detecting PR changesets", () => {
    expect(changedChangesetsFromFiles([".changeset/README.md"])).toEqual([]);
  });

  it("lists changeset files while ignoring directories and README.md", () => {
    expect(
      changesetFilesFromEntries([
        { name: "README.md", isFile: true },
        { name: "great-news.md", isFile: true },
        { name: "config.json", isFile: true },
        { name: "nested.md", isFile: false },
      ]),
    ).toEqual([".changeset/great-news.md"]);
  });

  it("detects newly created changesets", () => {
    expect(
      newChangesets(
        [".changeset/old.md", ".changeset/existing.md"],
        [".changeset/old.md", ".changeset/new.md", ".changeset/existing.md"],
      ),
    ).toEqual([".changeset/new.md"]);
  });

  it("builds a constrained prompt for Cursor", () => {
    const prompt = promptForChangeset(["src/index.ts", "README.md"], "origin/main");

    expect(prompt).toContain("pull request against origin/main");
    expect(prompt).toContain("Package name: effect-cursor-sdk");
    expect(prompt).toContain('"effect-cursor-sdk": patch|minor|major');
    expect(prompt).toContain("Do not edit source files, package metadata, lockfiles");
    expect(prompt).toContain("- src/index.ts");
    expect(prompt).toContain("- README.md");
  });
});

describe("create-changeset-agent filesystem and git helpers", () => {
  it.effect("listChangesets reads markdown files from .changeset", () =>
    Effect.gen(function* () {
      const cwd = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "changeset-agent-")));
      yield* Effect.promise(() => mkdir(join(cwd, ".changeset"), { recursive: true }));
      yield* Effect.promise(() => writeFile(join(cwd, ".changeset", "README.md"), "# docs"));
      yield* Effect.promise(() => writeFile(join(cwd, ".changeset", "release.md"), "---\n"));

      const files = yield* listChangesets(cwd);
      expect(files).toEqual([".changeset/release.md"]);
    }),
  );

  it.effect("listChangedFiles parses git diff output", () =>
    Effect.gen(function* () {
      const cwd = "/tmp/repo";
      const files = yield* listChangedFiles("origin/main", cwd).pipe(
        Effect.provide(gitLayer("src/index.ts\n\nREADME.md\n")),
      );

      expect(files).toEqual(["src/index.ts", "README.md"]);
    }),
  );
});

describe("makeProgram", () => {
  const runProgramAndCollectLogs = (
    env: NodeJS.ProcessEnv,
    layers: Layer.Layer<CursorAgentService | CursorRunService | ChildProcessSpawner, never, never>,
  ) => {
    const messages: string[] = [];
    const capture = Logger.make<unknown, void>((opts) => {
      messages.push(typeof opts.message === "string" ? opts.message : String(opts.message));
    });

    return makeProgram(env).pipe(
      Effect.scoped,
      Effect.provide(
        Layer.mergeAll(layers, Logger.layer([capture])).pipe(
          Layer.provideMerge(Layer.succeed(ConfigProvider.ConfigProvider, configProvider)),
        ),
      ),
      Effect.map(() => messages),
    );
  };

  it.effect("skips when the PR already changes a changeset file", () =>
    Effect.gen(function* () {
      const cwd = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "changeset-agent-")));
      yield* Effect.promise(() => mkdir(join(cwd, ".changeset"), { recursive: true }));

      const messages = yield* runProgramAndCollectLogs(
        { GITHUB_WORKSPACE: cwd, CHANGESET_BASE_REF: "origin/main" },
        programLayer(".changeset/existing.md\n"),
      );

      expect(messages.join("\n")).toContain("Changeset already present in this PR");
    }),
  );

  it.effect("skips when git reports no diff against the base ref", () =>
    Effect.gen(function* () {
      const cwd = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "changeset-agent-")));
      yield* Effect.promise(() => mkdir(join(cwd, ".changeset"), { recursive: true }));

      const messages = yield* runProgramAndCollectLogs(
        { GITHUB_WORKSPACE: cwd, CHANGESET_BASE_REF: "origin/main" },
        programLayer(""),
      );

      expect(messages.join("\n")).toContain("No changes detected against origin/main");
    }),
  );

  it.effect("logs when the agent finishes without creating a changeset", () =>
    Effect.gen(function* () {
      const cwd = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "changeset-agent-")));
      yield* Effect.promise(() => mkdir(join(cwd, ".changeset"), { recursive: true }));

      const messages = yield* runProgramAndCollectLogs(
        { GITHUB_WORKSPACE: cwd, CHANGESET_BASE_REF: "origin/main" },
        programLayer("src/index.ts\n"),
      );

      const joined = messages.join("\n");
      expect(joined).toContain("Added changeset for release.");
      expect(joined).toContain("Cursor agent did not create a changeset");
    }),
  );

  it.effect("logs created changesets after a successful agent run", () =>
    Effect.gen(function* () {
      const cwd = yield* Effect.promise(() => mkdtemp(join(tmpdir(), "changeset-agent-")));
      yield* Effect.promise(() => mkdir(join(cwd, ".changeset"), { recursive: true }));

      const messages = yield* runProgramAndCollectLogs(
        { GITHUB_WORKSPACE: cwd, CHANGESET_BASE_REF: "origin/main" },
        Layer.mergeAll(agentServicesWithWriter(cwd), gitLayer("src/index.ts\n")),
      );

      expect(messages.join("\n")).toContain("Created changeset: .changeset/from-agent.md");
    }),
  );
});
