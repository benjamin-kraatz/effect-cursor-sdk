import {
  CursorAgentService,
  CursorRunService,
  agentOptionsFromConfig,
  liveLayer,
  loadCursorConfig,
} from "effect-cursor-sdk";
import { Effect } from "effect";

const prompt = process.argv.slice(2).join(" ") || "Explain what this project does in five bullets.";

const program = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;

    const agent = yield* agents.scoped(
      agentOptionsFromConfig(config, {
        local: { cwd: process.cwd() },
      }),
    );
    const run = yield* agents.send(agent, prompt);
    const text = yield* runs.collectText(run);

    return text.trim();
  }),
).pipe(Effect.provide(liveLayer));

const text = await Effect.runPromise(program);
console.log(text);
