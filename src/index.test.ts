import { Effect } from "effect";
import { expect, it } from "@effect/vitest";
import { packageName } from "./index";

it("packageName (sync)", () => {
  expect(packageName).toBe("effect-cursor-sdk");
});

it.effect("packageName (Effect)", () =>
  Effect.gen(function* () {
    const name = yield* Effect.sync(() => packageName);
    expect(name).toBe("effect-cursor-sdk");
  }),
);
