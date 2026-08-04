import { Data, Effect, Match, Metric, Schedule, Stream } from "effect";
import {
  CursorAgentService,
  CursorInspectionService,
  CursorRunService,
  cursorStreamEvents,
  liveRuntime,
  loadCursorConfig,
  makeMockRuntime,
  redact,
} from "effect-cursor-sdk";

import { fixtures } from "./fixtures";
import { agentSummary, printInventory } from "./render";

type LifecycleAction = "archive" | "unarchive" | "delete";

class LifecycleAgentIdRequiredError extends Data.TaggedError("LifecycleAgentIdRequiredError")<{
  readonly message: string;
  readonly lifecycle: LifecycleAction;
}> {}

class LifecycleConfirmationError extends Data.TaggedError("LifecycleConfirmationError")<{
  readonly message: string;
  readonly action: LifecycleAction;
  readonly agentId: string;
}> {}

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
    Effect.retry(Schedule.exponential("150 millis").pipe(Schedule.upTo({ times: 3 }))),
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
    const agent = yield* agents.scoped(config, { local: { cwd: process.cwd() } });
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
      return yield* new LifecycleConfirmationError({
        message: "Confirmation phrase did not match; no lifecycle action was run.",
        action: options.lifecycle,
        agentId: options.agentId,
      });
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

/**
 * Map some Cursor SDK errors to CLI errors for better user experience, enriched with more context.
 */
const toCliError = (error: {
  readonly _tag: string;
  readonly message: string;
  readonly provider?: string;
  readonly helpUrl?: string;
}): Error => {
  return Match.value(error._tag).pipe(
    Match.when("CursorAuthenticationError", () => {
      return new Error(
        `${error.message}\n\nSet CURSOR_API_KEY in .env or your environment, or run with --mock for offline demos.`,
      );
    }),
    Match.when("ConfigError", () => {
      return new Error(
        `${error.message}\n\nInvalid Cursor configuration for triage. Check .env values such as CURSOR_MODEL and CURSOR_LOCAL_CWD.`,
      );
    }),
    Match.when("CursorConfigurationError", () => {
      return new Error(
        `${error.message}\n\nCheck agent options such as CURSOR_MODEL and the local working directory used by --triage.`,
      );
    }),
    Match.when("CursorIntegrationNotConnectedError", () => {
      const lines = [error.message];
      if (error.provider !== undefined) {
        lines.push(`Provider: ${error.provider}`);
      }
      if (error.helpUrl !== undefined) {
        lines.push(`Connect integration: ${error.helpUrl}`);
      }
      lines.push("Repository listing requires a connected SCM integration.");
      return new Error(lines.join("\n"));
    }),
    Match.when("CursorRateLimitError", () => {
      return new Error(`${error.message}\n\nRate limited by Cursor. Wait and retry later.`);
    }),
    Match.when("TimeoutError", () => {
      return new Error(
        `${error.message}\n\nLoading account inventory timed out after 45 seconds. Retry, or use --mock to test without live API calls.`,
      );
    }),
    Match.when("CursorStreamError", () => {
      return new Error(
        `${error.message}\n\nTriage streaming failed. Retry with --triage, or run without it to confirm inventory loading works.`,
      );
    }),
    Match.when("CursorNetworkError", () => {
      return new Error(`${error.message}\n\nNetwork error after inventory retries were exhausted.`);
    }),
    Match.when("CursorUnknownError", () => {
      return new Error(
        `${error.message}\n\nUnexpected failure. Try --mock to isolate SDK wiring from live API issues.`,
      );
    }),
    Match.orElse(() => {
      return error instanceof Error ? error : new Error(error.message);
    }),
  );
};

const program = (options: CliOptions) =>
  Effect.scoped(
    Effect.gen(function* () {
      if (options.lifecycle) {
        if (!options.agentId) {
          return yield* new LifecycleAgentIdRequiredError({
            message: "--agent-id is required for lifecycle commands.",
            lifecycle: options.lifecycle,
          });
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

      // @effect-diagnostics-next-line preferSchemaOverJson:off - That's necessary here, as we don't have an exact schema at this point.
      const rendered = ["Redacted diagnostics:", JSON.stringify(safeSummary, null, 2)].join("\n");

      if (!options.triage) return rendered;

      const triage = yield* runTriage(rendered);
      return `${rendered}\n\nTriage\n------\n${triage.trim()}`;
    }),
  ).pipe(Effect.mapError(toCliError));

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
