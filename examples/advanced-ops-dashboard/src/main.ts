import {
  CursorAgentService,
  CursorInspectionService,
  CursorRunService,
  agentOptionsFromConfig,
  cursorStreamEvents,
  liveRuntime,
  loadCursorConfig,
  makeMockRuntime,
  redact,
} from "effect-cursor-sdk";
import { Config, Effect, Metric, Schedule, Stream } from "effect";

import { fixtures } from "./fixtures";
import { agentSummary, printInventory } from "./render";

type LifecycleAction = "archive" | "unarchive" | "delete";

interface CliOptions {
  readonly agentId?: string;
  readonly confirm?: string;
  readonly help: boolean;
  readonly lifecycle?: LifecycleAction;
  readonly mock: boolean;
  readonly triage: boolean;
}

const usage = `Usage:
  bun run dev -- [--mock] [--triage]
  bun run dev -- [--mock] --lifecycle <archive|unarchive|delete> --agent-id <id>

Safety:
  Lifecycle commands mutate remote agent state. They require the confirmation
  phrase shown after the selected agent is loaded.

Examples:
  bun run dev -- --mock
  bun run dev -- --mock --triage
  bun run dev -- --lifecycle archive --agent-id agt_123`;

const parseArgs = (args: ReadonlyArray<string>): CliOptions => {
  let agentId: string | undefined;
  let confirm: string | undefined;
  let help = false;
  let lifecycle: LifecycleAction | undefined;
  let mock = false;
  let triage = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--mock") {
      mock = true;
    } else if (arg === "--triage") {
      triage = true;
    } else if (arg === "--agent-id") {
      agentId = args[++index];
    } else if (arg?.startsWith("--agent-id=")) {
      agentId = arg.slice("--agent-id=".length);
    } else if (arg === "--confirm") {
      confirm = args[++index];
    } else if (arg?.startsWith("--confirm=")) {
      confirm = arg.slice("--confirm=".length);
    } else if (arg === "--lifecycle") {
      lifecycle = parseLifecycle(args[++index]);
    } else if (arg?.startsWith("--lifecycle=")) {
      lifecycle = parseLifecycle(arg.slice("--lifecycle=".length));
    }
  }

  return { agentId, confirm, help, lifecycle, mock, triage };
};

const parseLifecycle = (value: string | undefined): LifecycleAction | undefined => {
  if (value === "archive" || value === "unarchive" || value === "delete") return value;
  return undefined;
};

const confirmationPhrase = (action: LifecycleAction, agentId: string) => {
  return `${action.toUpperCase()} ${agentId}`;
};

const readConfirmation = Effect.promise(() => {
  const prompt = "Type the confirmation phrase to continue: ";
  return new Promise<string>((resolve) => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (chunk) => {
      process.stdin.pause();
      resolve(String(chunk).trim());
    });
  });
});

const loadInventory = Effect.gen(function* () {
  const inspection = yield* CursorInspectionService;

  const inventory = yield* Effect.all(
    {
      agents: inspection.listAgents({ runtime: "cloud", includeArchived: true }),
      models: inspection.listModels(),
      repos: inspection.listRepositories(),
      user: inspection.me(),
    },
    { concurrency: "unbounded" },
  ).pipe(
    Effect.retry(Schedule.exponential("150 millis").pipe(Schedule.both(Schedule.recurs(3)))),
    Effect.timeout("45 seconds"),
  );

  const firstAgentId = inventory.agents.items[0]?.agentId;
  const details = firstAgentId
    ? yield* Effect.all(
        {
          messages: inspection.listMessages(firstAgentId),
          runs: inspection.listRuns(firstAgentId),
        },
        { concurrency: "unbounded" },
      )
    : undefined;

  yield* Effect.logInfo("Cursor inventory loaded", {
    agents: inventory.agents.items.length,
    models: inventory.models.length,
    repositories: inventory.repos.length,
  });

  return {
    agents: inventory.agents,
    messagesByAgent: firstAgentId && details ? ([[firstAgentId, details.messages]] as const) : [],
    models: inventory.models,
    repositories: inventory.repos,
    runsByAgent: firstAgentId && details ? ([[firstAgentId, details.runs]] as const) : [],
    user: inventory.user,
  };
});

const runTriage = (summary: string) =>
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    const agents = yield* CursorAgentService;
    const runs = yield* CursorRunService;
    const agent = yield* agents.scoped(
      agentOptionsFromConfig(config, { local: { cwd: process.cwd() } }),
    );
    const run = yield* agents.send(
      agent,
      [
        "You are reviewing a Cursor account inventory.",
        "Identify the first two operational checks to make before trusting automation.",
        "",
        summary,
      ].join("\n"),
    );

    return yield* runs.streamEvents(run).pipe(
      Stream.tap(() =>
        Effect.void.pipe(
          Effect.trackSuccesses(cursorStreamEvents.pipe(Metric.withConstantInput(1))),
        ),
      ),
      Stream.runFold(
        () => "",
        (text, event) =>
          event.type === "assistant"
            ? text +
              event.message.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("")
            : text,
      ),
    );
  });

const runLifecycle = (
  options: Required<Pick<CliOptions, "agentId" | "lifecycle">> & Pick<CliOptions, "confirm">,
) =>
  Effect.gen(function* () {
    const inspection = yield* CursorInspectionService;
    const agent = yield* inspection.getAgent(options.agentId);
    const phrase = confirmationPhrase(options.lifecycle, options.agentId);

    console.log("Selected agent:");
    console.log(agentSummary(agent));
    console.log(`Confirmation phrase: ${phrase}`);

    const typed = options.confirm ?? (yield* readConfirmation);
    if (typed !== phrase) {
      return yield* Effect.fail(
        new Error("Confirmation phrase did not match; no lifecycle action was run."),
      );
    }

    if (options.lifecycle === "archive") {
      yield* inspection.archiveAgent(options.agentId);
    } else if (options.lifecycle === "unarchive") {
      yield* inspection.unarchiveAgent(options.agentId);
    } else {
      yield* inspection.deleteAgent(options.agentId);
    }

    return `${options.lifecycle} completed for ${options.agentId}`;
  });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const messageFromUnknown = (value: object): string => {
  if ("message" in value && typeof (value as { message: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return String(value);
};

/**
 * Map SDK / config tagged failures to plain `Error` at the CLI boundary.
 * Avoids `Effect.catchTag` chains that narrow the error channel in ways that
 * break inference for `ManagedRuntime.runPromise`.
 */
const remapProgramFailure = (error: unknown): Effect.Effect<never, Error, never> => {
  if (error instanceof Config.ConfigError) {
    return Effect.fail(new Error(`Environment configuration error: ${error.message}`));
  }
  if (isRecord(error) && typeof error._tag === "string") {
    const msg = messageFromUnknown(error);
    switch (error._tag) {
      case "CursorAuthenticationError":
        return Effect.fail(new Error(`Cursor authentication failed: ${msg}`));
      case "CursorConfigurationError":
        return Effect.fail(new Error(`Cursor configuration is invalid: ${msg}`));
      case "CursorIntegrationNotConnectedError": {
        const helpUrl = error.helpUrl;
        const help =
          typeof helpUrl === "string" && helpUrl.length > 0 ? ` (${helpUrl})` : "";
        return Effect.fail(new Error(`Cursor integration is not connected: ${msg}${help}`));
      }
      case "CursorNetworkError":
        return Effect.fail(new Error(`Cursor network error: ${msg}`));
      case "CursorRateLimitError":
        return Effect.fail(new Error(`Cursor rate limit reached: ${msg}`));
      case "CursorStreamError":
        return Effect.fail(new Error(`Cursor run stream error: ${msg}`));
      case "CursorUnknownError":
        return Effect.fail(new Error(`Cursor error: ${msg}`));
      default:
        break;
    }
  }
  if (error instanceof Error) {
    return Effect.fail(error);
  }
  return Effect.fail(new Error(String(error)));
};

const program = (options: CliOptions) =>
  Effect.scoped(
    Effect.gen(function* () {
      if (options.lifecycle) {
        if (!options.agentId) {
          return yield* Effect.fail(new Error("--agent-id is required for lifecycle commands."));
        }
        return yield* runLifecycle({
          agentId: options.agentId,
          confirm: options.confirm,
          lifecycle: options.lifecycle,
        });
      }

      const inventory = yield* loadInventory;
      const safeSummary = redact({
        apiKey: process.env.CURSOR_API_KEY,
        user: inventory.user,
        models: inventory.models.map((model) => model.id),
        repositories: inventory.repositories.map((repo) => repo.url),
        agents: inventory.agents.items.map((agent) => agent.agentId),
      });

      yield* printInventory(inventory);

      const rendered = ["Redacted diagnostics:", JSON.stringify(safeSummary, null, 2)].join("\n");

      if (!options.triage) return rendered;

      const triage = yield* runTriage(rendered);
      return `${rendered}\n\nTriage\n------\n${triage.trim()}`;
    }),
  ).pipe(Effect.catch(remapProgramFailure));

const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(usage);
  process.exit(0);
}

const runtime = options.mock ? makeMockRuntime(fixtures) : liveRuntime;

try {
  const output = await runtime.runPromise(program(options));
  console.log(output);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
