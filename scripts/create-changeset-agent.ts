import { readdir } from "node:fs/promises";

import * as BunServices from "@effect/platform-bun/BunServices";
import { Effect, Layer } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  CursorAgentService,
  CursorRunService,
  agentOptionsFromConfig,
  liveLayer,
  loadCursorConfig,
} from "../src/index";

/**
 * Executable example for running a Cursor SDK agent inside repository automation.
 *
 * The GitHub Actions workflow in `.github/workflows/changeset-agent.yml` runs
 * this script when a same-repository pull request targets `main`. The script is
 * intentionally narrow: it asks Cursor to add a missing Changesets release note
 * and then verifies whether a new `.changeset/*.md` file appeared.
 *
 * This demonstrates the intended "agent as maintainer assistant" pattern for
 * `effect-cursor-sdk`:
 *
 * 1. Load Cursor credentials through Effect config.
 * 2. Start a scoped local Cursor agent in the checked-out repository.
 * 3. Send a constrained maintenance prompt.
 * 4. Let CI commit only the expected artifact type.
 */
export const DEFAULT_CHANGESET_BASE_REF = "origin/main";
export const DEFAULT_CURSOR_MODEL = "composer-2";

/**
 * `origin/main` is available in CI because the workflow checks out full history.
 * A different base can be supplied locally with `CHANGESET_BASE_REF`.
 */
export function changesetBaseRefFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.CHANGESET_BASE_REF ?? DEFAULT_CHANGESET_BASE_REF;
}

/**
 * GitHub Actions sets `GITHUB_WORKSPACE`; local runs fall back to the current
 * process directory. The Cursor agent receives the same cwd so all file edits
 * are scoped to this checkout.
 */
export function cwdFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.GITHUB_WORKSPACE ?? process.cwd();
}

export function cursorModelFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return env.CURSOR_MODEL ?? DEFAULT_CURSOR_MODEL;
}

/**
 * Runs git through Effect's process API rather than a shell. This avoids shell interpolation
 * and keeps the helper safe even when refs or paths come from the environment.
 */
function runGit(args: ReadonlyArray<string>, cwd: string) {
  return Effect.gen(function* () {
    const childProcesses = yield* ChildProcessSpawner.ChildProcessSpawner;
    const stdout = yield* childProcesses.string(ChildProcess.make("git", args, { cwd }));

    return stdout.trim();
  });
}

/**
 * Returns the PR's changed file list relative to the release base branch. The
 * file list is included in the prompt as context, but the agent is still asked
 * to inspect the real diff before deciding the release impact.
 */
export function listChangedFiles(baseRef: string, cwd: string) {
  return Effect.gen(function* () {
    const output = yield* runGit(["diff", "--name-only", `${baseRef}...HEAD`], cwd);

    return output
      .split("\n")
      .map((file) => file.trim())
      .filter(Boolean);
  });
}

/**
 * Lists actual Changesets managed by the repo. `.changeset/README.md` is
 * excluded because it is documentation for the folder, not a release note.
 */
export async function listChangesets(cwd: string) {
  const entries = await readdir(`${cwd}/.changeset`, { withFileTypes: true });
  return changesetFilesFromEntries(
    entries.map((entry) => ({ name: entry.name, isFile: entry.isFile() })),
  );
}

export function changesetFilesFromEntries(
  entries: ReadonlyArray<{ readonly name: string; readonly isFile: boolean }>,
) {
  return entries
    .filter((entry) => entry.isFile)
    .map((entry) => `.changeset/${entry.name}`)
    .filter((file) => file.endsWith(".md") && !file.endsWith("README.md"));
}

/**
 * Idempotency guard: if the PR already modifies a changeset, the agent should
 * not add a second one. This keeps manual release notes authoritative and
 * prevents synchronize events from producing duplicate files.
 */
export function changedChangesetsFromFiles(changedFiles: ReadonlyArray<string>) {
  return changedFiles.filter((file) => file.startsWith(".changeset/") && file.endsWith(".md"));
}

export function newChangesets(before: ReadonlyArray<string>, after: ReadonlyArray<string>) {
  return after.filter((file) => !before.includes(file));
}

/**
 * Builds the Cursor prompt from repository policy, not free-form intent.
 *
 * The key constraints are:
 * - create at most one file;
 * - edit only `.changeset/*.md`;
 * - skip non-release PRs;
 * - choose semver impact using Changesets conventions.
 */
export const promptForChangeset = (
  changedFiles: ReadonlyArray<string>,
  baseRef = DEFAULT_CHANGESET_BASE_REF,
) => `You are maintaining this repository.

The current branch is a pull request against ${baseRef}. Create exactly one Changesets file for this PR unless the diff only contains non-release changes.

Repository facts:
- Package name: effect-cursor-sdk
- Changeset directory: .changeset
- Changeset file format:
  ---
  "effect-cursor-sdk": patch|minor|major
  ---

  Short user-facing release note.

Instructions:
- Inspect the diff against ${baseRef}.
- If the PR changes shipped package behavior or public docs, add one concise .changeset/*.md file.
- Pick patch/minor/major according to Changesets semver conventions.
- Prefer patch unless there is a new public feature or breaking change.
- Do not edit source files, package metadata, lockfiles, or existing changesets.
- If no changeset is needed, leave the workspace unchanged and explain why.

Changed files:
${changedFiles.map((file) => `- ${file}`).join("\n")}
`;

/**
 * Main Effect program.
 *
 * The program uses `agents.scoped` so the Cursor SDK agent is disposed when the
 * Effect scope closes, even if the run fails. After the run, it compares the
 * before/after changeset list and logs what was created; the workflow is
 * responsible for committing only `.changeset` changes.
 */
export function makeProgram(env: NodeJS.ProcessEnv = process.env) {
  return Effect.gen(function* () {
    const baseRef = changesetBaseRefFromEnv(env);
    const cwd = cwdFromEnv(env);

    const before = yield* Effect.promise(() => listChangesets(cwd));
    const existingChangedChangesets = changedChangesetsFromFiles(
      yield* listChangedFiles(baseRef, cwd),
    );

    if (existingChangedChangesets.length > 0) {
      yield* Effect.logInfo(
        `Changeset already present in this PR: ${existingChangedChangesets.join(", ")}`,
      );
      return;
    }

    const changedFiles = yield* listChangedFiles(baseRef, cwd);

    if (changedFiles.length === 0) {
      yield* Effect.logInfo(`No changes detected against ${baseRef}.`);
      return;
    }

    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;

    const agent = yield* agents.scoped(
      agentOptionsFromConfig(config, {
        model: { id: cursorModelFromEnv(env) },
        local: { cwd },
      }),
    );

    const run = yield* agents.send(agent, promptForChangeset(changedFiles, baseRef));
    const response = yield* runs.collectText(run);
    yield* Effect.logInfo(response);

    const after = yield* Effect.promise(() => listChangesets(cwd));
    const created = newChangesets(before, after);

    if (created.length === 0) {
      yield* Effect.logInfo("Cursor agent did not create a changeset.");
      return;
    }

    yield* Effect.logInfo(`Created changeset: ${created.join(", ")}`);
  });
}

export const program = makeProgram().pipe(
  Effect.scoped,
  Effect.provide(Layer.mergeAll(liveLayer, BunServices.layer)),
);

if (import.meta.main) {
  Effect.runPromise(program).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
