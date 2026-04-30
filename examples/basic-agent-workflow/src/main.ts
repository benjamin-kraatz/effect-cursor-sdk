import {
  CursorAgentService,
  CursorArtifactService,
  CursorRunService,
  type SDKMessage,
  agentOptionsFromConfig,
  liveLayer,
  loadCursorConfig,
} from "effect-cursor-sdk";
import { Effect, Stream } from "effect";

import { printArtifacts, printSection, textFromAssistantEvent } from "./format";

const prompt =
  process.argv.slice(2).join(" ") ||
  "Review this repository and call out the three most important things a maintainer should verify.";

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const artifacts = yield* CursorArtifactService;

    const agent = yield* agents.scoped(
      agentOptionsFromConfig(config, {
        local: { cwd: process.cwd() },
      }),
    );

    yield* printSection("Sending prompt");
    yield* Effect.sync(() => console.log(prompt));

    const run = yield* agents.send(agent, prompt);
    const unsubscribe = yield* runs.onDidChangeStatus(run, (status) => {
      console.log(`\n[status] ${status}`);
    });

    yield* printSection("Assistant stream");
    yield* runs
      .streamEvents(run)
      .pipe(
        Stream.runForEach((event: SDKMessage) =>
          Effect.sync(() => {
            const text = textFromAssistantEvent(event);
            if (text.length > 0) process.stdout.write(text);
          }),
        ),
      );
    yield* Effect.sync(() => process.stdout.write("\n"));

    const result = yield* runs.wait(run);
    yield* Effect.sync(() => unsubscribe());

    yield* printSection("Run result");
    yield* Effect.sync(() => {
      console.log(`run: ${result.id}`);
      console.log(`status: ${result.status}`);
      if (result.result) console.log(`result: ${result.result}`);
    });

    yield* printSection("Run capabilities");
    yield* Effect.sync(() => {
      for (const operation of ["cancel", "conversation"] as const) {
        const supported = runs.supports(run, operation);
        const reason = runs.unsupportedReason(run, operation);
        console.log(`${operation}: ${supported ? "supported" : `unsupported (${reason ?? "no reason"})`}`);
      }
    });

    const artifactList = yield* artifacts.listArtifacts(agent);
    yield* printSection("Artifacts");
    yield* printArtifacts(artifactList);

    const firstArtifact = artifactList[0];
    if (firstArtifact) {
      const bytes = yield* artifacts.downloadArtifact(agent, firstArtifact.path);
      yield* Effect.sync(() => {
        console.log(`Downloaded ${firstArtifact.path}: ${bytes.byteLength} bytes`);
      });
    }
  }),
).pipe(Effect.provide(liveLayer));

await Effect.runPromise(program);
