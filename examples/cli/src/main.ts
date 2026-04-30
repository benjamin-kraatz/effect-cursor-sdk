import {
  CursorAgentService,
  CursorRunService,
  agentOptionsFromConfig,
  liveRuntime,
  loadCursorConfig,
  makeMockRuntime,
} from "effect-cursor-sdk";
import { Effect } from "effect";

interface CliOptions {
  readonly cwd?: string;
  readonly help: boolean;
  readonly mock: boolean;
  readonly model?: string;
  readonly prompt: string;
}

const usage = `Usage:
  bun run dev -- [--mock] [--cwd <path>] [--model <id>] <prompt>

Examples:
  bun run dev -- "Explain this repository in five bullets"
  bun run dev -- --cwd ../.. --model composer-2 "Find risky code paths"
  bun run dev -- --mock "Summarize the mock response"`;

const parseArgs = (args: ReadonlyArray<string>): CliOptions => {
  const promptParts: string[] = [];
  let cwd: string | undefined;
  let model: string | undefined;
  let mock = false;
  let help = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--mock") {
      mock = true;
    } else if (arg === "--cwd") {
      cwd = args[++index];
    } else if (arg === "--model") {
      model = args[++index];
    } else if (arg?.startsWith("--cwd=")) {
      cwd = arg.slice("--cwd=".length);
    } else if (arg?.startsWith("--model=")) {
      model = arg.slice("--model=".length);
    } else if (arg !== undefined) {
      promptParts.push(arg);
    }
  }

  return { cwd, help, mock, model, prompt: promptParts.join(" ").trim() };
};

const program = (options: CliOptions) =>
  Effect.scoped(
    Effect.gen(function* () {
      const config = yield* loadCursorConfig;
      const agents = yield* CursorAgentService;
      const runs = yield* CursorRunService;

      const agent = yield* agents.scoped(
        agentOptionsFromConfig(config, {
          local: { cwd: options.cwd ?? process.cwd() },
          model: options.model ? { id: options.model } : undefined,
        }),
      );
      const run = yield* agents.send(agent, options.prompt);
      return yield* runs.collectText(run);
    }),
  ).pipe(
    Effect.catchTag("CursorAuthenticationError", (error) =>
      Effect.fail(new Error(`Cursor authentication failed: ${error.message}`)),
    ),
    Effect.catchTag("CursorRateLimitError", (error) =>
      Effect.fail(new Error(`Cursor rate limit reached: ${error.message}`)),
    ),
    Effect.catchTag("CursorConfigurationError", (error) =>
      Effect.fail(new Error(`Cursor configuration is invalid: ${error.message}`)),
    ),
  );

const options = parseArgs(process.argv.slice(2));

if (options.help || options.prompt.length === 0) {
  console.log(usage);
  process.exit(options.help ? 0 : 1);
}

const runtime = options.mock
  ? makeMockRuntime({
      result: {
        id: "mock-run",
        status: "finished",
        result: "This mock response proves the CLI wiring works without a Cursor API key.",
      },
      stream: [
        {
          type: "assistant",
          agent_id: "mock-agent",
          run_id: "mock-run",
          message: {
            role: "assistant",
            content: [
              {
                type: "text",
                text: "This mock response proves the CLI wiring works without a Cursor API key.",
              },
            ],
          },
        },
      ],
    })
  : liveRuntime;

try {
  const text = await runtime.runPromise(program(options));
  console.log(text.trim());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
