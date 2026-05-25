import {
  CursorAgentService,
  CursorArtifactService,
  CursorRunService,
  type SDKArtifact,
  type SDKMessage,
  liveLayer,
  loadCursorConfig,
} from "effect-cursor-sdk";
import { Effect, Stream } from "effect";
import { writeFileSync } from "node:fs";

import { assistantText, formatArtifact } from "./format";

const defaultPrompt =
  "Review this repository and call out the three most important things a maintainer should verify.";

const userArgs = process.argv.slice(2);
let downloadArtifactArg: string | undefined;
let prompt: string;

if (userArgs[0] === "--download-artifact") {
  const pathArg = userArgs[1];
  if (!pathArg) {
    console.error("error: missing path after --download-artifact");
    process.exit(1);
  }
  downloadArtifactArg = pathArg;
  prompt = userArgs.slice(2).join(" ").trim() || defaultPrompt;
} else {
  prompt = userArgs.join(" ").trim() || defaultPrompt;
}

function resolveListedArtifact(
  requested: string,
  list: ReadonlyArray<SDKArtifact>,
): string | undefined {
  if (list.some((a) => a.path === requested)) return requested;
  const base = requested.replace(/^.*\//, "");
  return list.find((a) => a.path === base || a.path.endsWith(`/${base}`))?.path;
}

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const artifacts = yield* CursorArtifactService;

    const agent = yield* agents.scoped(config, {
      local: { cwd: process.cwd() },
    });

    yield* heading("Sending prompt");
    yield* Effect.sync(() => console.log(prompt));

    const run = yield* agents.send(agent, prompt);
    const unsubscribe = yield* runs.onDidChangeStatus(run, (status) => {
      console.log(`\n[status] ${status}`);
    });

    yield* heading("Assistant stream");
    yield* runs.streamEvents(run).pipe(
      Stream.runForEach((event: SDKMessage) =>
        Effect.sync(() => {
          const text = assistantText(event);
          if (text.length > 0) process.stdout.write(text);
        }),
      ),
    );
    yield* Effect.sync(() => process.stdout.write("\n"));

    const result = yield* runs.wait(run);
    yield* Effect.sync(() => unsubscribe());

    yield* heading("Run result");
    yield* Effect.sync(() => {
      console.log(`run: ${result.id}`);
      console.log(`status: ${result.status}`);
      if (result.result) console.log(`result: ${result.result}`);
    });

    yield* heading("Run capabilities");
    yield* Effect.sync(() => {
      for (const operation of ["cancel", "conversation"] as const) {
        const supported = runs.supports(run, operation);
        const reason = runs.unsupportedReason(run, operation);
        console.log(
          `${operation}: ${supported ? "supported" : `unsupported (${reason ?? "no reason"})`}`,
        );
      }
    });

    const artifactList = yield* artifacts.listArtifacts(agent);
    yield* heading("Artifacts");
    yield* Effect.sync(() => {
      if (artifactList.length === 0) {
        console.log("No artifacts were produced by this run.");
        return;
      }
      for (const artifact of artifactList) console.log(formatArtifact(artifact));
    });

    const artifactPath = downloadArtifactArg
      ? resolveListedArtifact(downloadArtifactArg, artifactList)
      : artifactList[0]?.path;

    if (downloadArtifactArg && !artifactPath) {
      yield* Effect.sync(() => {
        console.log(`No artifact matching "${downloadArtifactArg}" was found.`);
      });
    }

    if (artifactPath) {
      const bytes = yield* artifacts.downloadArtifact(agent, artifactPath);
      yield* Effect.sync(() => {
        console.log(`Downloaded ${artifactPath}: ${bytes.byteLength} bytes`);
        if (downloadArtifactArg) {
          const outFile = downloadArtifactArg.includes("/")
            ? downloadArtifactArg.slice(downloadArtifactArg.lastIndexOf("/") + 1)
            : downloadArtifactArg;
          writeFileSync(outFile, bytes);
          console.log(`Wrote ${outFile}`);
        }
      });
    }
  }),
).pipe(Effect.provide(liveLayer));

await Effect.runPromise(program);

function heading(title: string): Effect.Effect<void> {
  return Effect.sync(() => {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
  });
}
