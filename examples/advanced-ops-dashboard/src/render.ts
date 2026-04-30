import { Effect } from "effect";
import type {
  AgentMessage,
  ListResult,
  Run,
  SDKAgentInfo,
  SDKModel,
  SDKRepository,
  SDKUser,
} from "effect-cursor-sdk";
import { redact } from "effect-cursor-sdk";

export interface Inventory {
  readonly user: SDKUser;
  readonly models: ReadonlyArray<SDKModel>;
  readonly repositories: ReadonlyArray<SDKRepository>;
  readonly agents: ListResult<SDKAgentInfo>;
  readonly runsByAgent: ReadonlyArray<readonly [string, ListResult<Run>]>;
  readonly messagesByAgent: ReadonlyArray<readonly [string, ReadonlyArray<AgentMessage>]>;
}

export const printHeading = (title: string) =>
  Effect.sync(() => {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
  });

export function printInventory(inventory: Inventory) {
  return Effect.gen(function* () {
    const summary = yield* Effect.sync(() => {
      return redact({
        account: inventory.user,
        models: inventory.models.map((model) => model.id),
        repositories: inventory.repositories.map((repo) => repo.url),
        agents: inventory.agents.items.map((agent) => ({
          agentId: agent.agentId,
          name: agent.name,
          summary: agent.summary,
        })),
        runsByAgent: inventory.runsByAgent.map(([agentId, runs]) => ({
          agentId,
          runs: runs.items.map((run) => ({ id: run.id, status: run.status })),
        })),
        messagesByAgent: inventory.messagesByAgent.map(([agentId, messages]) => ({
          agentId,
          messages: messages.length,
        })),
      });
    });
    const summaryString = yield* Effect.sync(() => JSON.stringify(summary, null, 2));
    console.log(summaryString);
  });
}

export const agentSummary = (agent: SDKAgentInfo): string =>
  [
    `Agent: ${agent.agentId}`,
    `Name: ${agent.name ?? "(unnamed)"}`,
    `Summary: ${agent.summary ?? "(no summary)"}`,
  ].join("\n");
