import type { SDKArtifact, SDKMessage } from "effect-cursor-sdk";
import { Effect } from "effect";

export const assistantText = (event: SDKMessage): string => {
  if (event.type !== "assistant") return "";
  return event.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
};

export const formatArtifact = (artifact: SDKArtifact): string => {
  const maybeSize = "size" in artifact && typeof artifact.size === "number" ? ` (${artifact.size} bytes)` : "";
  return `- ${artifact.path}${maybeSize}`;
};

export const textFromAssistantEvent = assistantText;

export const printSection = (title: string) =>
  Effect.sync(() => {
    console.log(`\n${title}`);
    console.log("-".repeat(title.length));
  });

export const printArtifacts = (artifacts: ReadonlyArray<SDKArtifact>) =>
  Effect.sync(() => {
    if (artifacts.length === 0) {
      console.log("No artifacts were produced by this run.");
      return;
    }
    for (const artifact of artifacts) {
      console.log(formatArtifact(artifact));
    }
  });
