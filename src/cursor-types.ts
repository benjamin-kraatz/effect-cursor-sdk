/**
 * Re-exported Cursor SDK types.
 *
 * `effect-cursor-sdk` deliberately does not rebuild the public data model from
 * `@cursor/february`. The upstream SDK remains the source of truth for agent
 * options, run handles, message events, artifacts, MCP definitions, model
 * records, and platform helpers.
 *
 * @module
 */
export type {
  AgentDefinition,
  AgentMessage,
  AgentOperationOptions,
  AgentOptions,
  CursorRequestOptions,
  GetAgentMessagesOptions,
  GetAgentOptions,
  GetRunOptions,
  ListAgentsOptions,
  ListResult,
  ListRunsOptions,
  McpServerConfig,
  ModelListItem,
  ModelParameterDefinition,
  ModelParameterValue,
  ModelSelection,
  ModelVariant,
  Run,
  RunOperation,
  RunResult,
  RunResultStatus,
  RunStatus,
  SDKAgent,
  SDKAgentInfo,
  SDKArtifact,
  SDKAssistantMessage,
  SDKImage,
  SDKImageDimension,
  SDKMessage,
  SDKModel,
  SDKRepository,
  SDKStatusMessage,
  SDKSystemMessage,
  SDKTaskMessage,
  SDKThinkingMessage,
  SDKToolUseMessage,
  SDKUser,
  SDKUserMessage,
  SDKUserMessageEvent,
  SendOptions,
  SettingSource,
  TextBlock,
  ToolUseBlock,
} from "@cursor/february";

export {
  AuthenticationError,
  ConfigurationError,
  CursorAgentError,
  CursorAgentPlatform,
  IntegrationNotConnectedError,
  NetworkError,
  RateLimitError,
  UnknownAgentError,
  UnsupportedRunOperationError,
  createAgentPlatform,
  createInMemoryRunEventNotifier,
  createLocalRunEventNotifier,
  createSdkMessageRunStreamEvent,
  decodeLocalRunStreamEvent,
  decodeSdkMessageRunStreamEvent,
  getTurnType,
  isTerminalLocalRunStreamEvent,
  localRunStreamEventToSdkMessage,
  startLocalRunEventNotifierServer,
} from "@cursor/february";
