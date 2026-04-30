import type { SDKArtifact, SDKMessage } from "effect-cursor-sdk";

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
