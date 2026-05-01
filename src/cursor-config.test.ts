import { expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";
import {
  agentOptionsFromConfig,
  CursorApiKey,
  CursorConfig,
  CursorLocalCwd,
  CursorModelId,
  loadCursorConfig,
} from "./cursor-config";

it("agentOptionsFromConfig lets explicit local.cwd override config cwd", () => {
  const options = agentOptionsFromConfig(
    {
      apiKey: CursorApiKey.make(Redacted.make("from-config")),
      cwd: CursorLocalCwd.make("/env"),
      modelId: CursorModelId.make("m1"),
    },
    { local: { cwd: "/override" } },
  );
  expect(options.local).toEqual({ cwd: "/override" });
  expect(options.apiKey).toBe("from-config");
  expect(options.model).toEqual({ id: "m1" });
});

it("agentOptionsFromConfig does not replace explicit apiKey with config when override is empty string", () => {
  const options = agentOptionsFromConfig(
    { apiKey: CursorApiKey.make(Redacted.make("from-config")) },
    { apiKey: "" },
  );
  expect(options.apiKey).toBe("");
});

it.effect("loadCursorConfig preserves empty string model and cwd from provider", () =>
  Effect.gen(function* () {
    const config = yield* loadCursorConfig;
    expect(config).toEqual(
      new CursorConfig({
        apiKey: CursorApiKey.make(Redacted.make("k")),
        modelId: CursorModelId.make(""),
        cwd: CursorLocalCwd.make(""),
      }),
    );
  }).pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown({
        CURSOR_API_KEY: "k",
        CURSOR_MODEL: "",
        CURSOR_LOCAL_CWD: "",
      }),
    ),
  ),
);
