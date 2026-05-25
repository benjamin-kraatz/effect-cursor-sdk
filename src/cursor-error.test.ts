import { AgentBusyError, AuthenticationError, UnsupportedRunOperationError } from "@cursor/sdk";
import { expect, it } from "@effect/vitest";
import {
  CursorAgentBusyError,
  CursorAuthenticationError,
  CursorStreamError,
  CursorUnknownError,
  CursorUnsupportedOperationError,
  mapCursorError,
} from "./cursor-error";

it("run.stream maps any failure to CursorStreamError including auth failures", () => {
  const err = mapCursorError(new AuthenticationError("denied"), {
    operation: "run.stream",
    runId: "r1",
    agentId: "a1",
  });
  expect(err).toBeInstanceOf(CursorStreamError);
  expect(err).toMatchObject({
    _tag: "CursorStreamError",
    message: "denied",
    operation: "run.stream",
    runId: "r1",
    agentId: "a1",
  });
});

it("run.cancel maps AuthenticationError to CursorAuthenticationError", () => {
  const err = mapCursorError(new AuthenticationError("denied"), {
    operation: "run.cancel",
    runId: "r1",
  });
  expect(err).toBeInstanceOf(CursorAuthenticationError);
  expect(err.operation).toBe("run.cancel");
});

it("run.conversation maps AuthenticationError to CursorAuthenticationError", () => {
  const err = mapCursorError(new AuthenticationError("denied"), {
    operation: "run.conversation",
    runId: "r1",
  });
  expect(err).toBeInstanceOf(CursorAuthenticationError);
  expect(err.operation).toBe("run.conversation");
});

it("run.conversation maps UnsupportedRunOperationError with SDK operation metadata", () => {
  const err = mapCursorError(new UnsupportedRunOperationError("conversation", "nope"), {
    operation: "run.conversation",
    runId: "r1",
  });
  expect(err).toBeInstanceOf(CursorUnsupportedOperationError);
  expect(err).toMatchObject({
    sdkOperation: "run.conversation",
    message: "nope",
  });
});

it("UnsupportedRunOperationError forwards SDK operation onto mapped error", () => {
  const err = mapCursorError(new UnsupportedRunOperationError("cancel", "nope"), {
    operation: "run.cancel",
    runId: "r1",
  });
  expect(err).toBeInstanceOf(CursorUnsupportedOperationError);
  // `@cursor/sdk` stores the run-scoped operation name on the error instance.
  expect(err).toMatchObject({
    sdkOperation: "run.cancel",
    message: "nope",
  });
});

it("maps AgentBusyError to CursorAgentBusyError", () => {
  const err = mapCursorError(new AgentBusyError("agent already has an active run"), {
    operation: "agent.send",
    agentId: "a1",
  });
  expect(err).toBeInstanceOf(CursorAgentBusyError);
  expect(err).toMatchObject({
    _tag: "CursorAgentBusyError",
    message: "agent already has an active run",
    operation: "agent.send",
    agentId: "a1",
    isRetryable: false,
  });
});

it("propagates isRetryable when the cause is a CursorAgentError subclass", () => {
  const retryable = mapCursorError(new AuthenticationError("later", { isRetryable: true }), {
    operation: "agent.create",
  });
  expect(retryable.isRetryable).toBe(true);

  const nonRetryable = mapCursorError(new AuthenticationError("no"), { operation: "agent.create" });
  expect(nonRetryable.isRetryable).toBe(false);
});

it("treats non-CursorAgentError causes as not retryable", () => {
  const err = mapCursorError(new Error("boom"), { operation: "agent.create" });
  expect(err).toBeInstanceOf(CursorUnknownError);
  expect(err.isRetryable).toBe(false);
});
