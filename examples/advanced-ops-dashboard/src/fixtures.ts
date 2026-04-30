import type { CursorMockFixtures, SDKMessage } from "effect-cursor-sdk";

export const triageStream: ReadonlyArray<SDKMessage> = [
  {
    type: "assistant",
    agent_id: "mock-agent",
    run_id: "mock-run",
    message: {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Mock triage: verify repository access, default model availability, and agent lifecycle permissions before enabling automation.",
        },
      ],
    },
  },
];

export const fixtures: CursorMockFixtures = {
  agentId: "mock-agent",
  runId: "mock-run",
  stream: triageStream,
  result: {
    id: "mock-run",
    status: "finished",
    result:
      "Mock triage: verify repository access, default model availability, and agent lifecycle permissions before enabling automation.",
    model: { id: "composer-2" },
  },
  agents: [
    {
      agentId: "mock-agent",
      name: "Mock Agent",
      summary: "Safe fixture used by the advanced dashboard example.",
      lastModified: 0,
    },
  ],
  messages: [
    {
      type: "user",
      uuid: "mock-message",
      agent_id: "mock-agent",
      message: { text: "Summarize the current Cursor workspace." },
    },
  ],
  models: [
    {
      id: "composer-2",
      displayName: "Composer 2",
    },
  ],
  repositories: [{ url: "https://github.com/example/app" }],
  user: {
    apiKeyName: "mock-dashboard-key",
    createdAt: "1970-01-01T00:00:00.000Z",
  },
};
