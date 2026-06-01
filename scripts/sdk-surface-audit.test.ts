import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as Sdk from "@cursor/sdk";
import { describe, expect, it } from "@effect/vitest";

import { sdkExportSurfaceDiff, sortedSdkExportKeys } from "./sdk-surface-audit-helpers";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("sdk-surface-audit helpers", () => {
  it("sorts export keys and drops the default export", () => {
    expect(sortedSdkExportKeys({ default: {}, Z: 1, Agent: 2, b: 3 })).toEqual(["Agent", "Z", "b"]);
  });

  it("detects added and removed export keys", () => {
    expect(sdkExportSurfaceDiff(["Agent", "Cursor"], ["Agent", "Cursor", "NewThing"])).toEqual({
      added: ["NewThing"],
      removed: [],
    });
    expect(sdkExportSurfaceDiff(["Old", "Agent"], ["Agent"])).toEqual({
      added: [],
      removed: ["Old"],
    });
  });

  it("reports no drift when baseline matches the installed @cursor/sdk", () => {
    const current = sortedSdkExportKeys(Sdk as Record<string, unknown>);
    expect(sdkExportSurfaceDiff(current, current)).toEqual({
      added: [],
      removed: [],
    });
  });
});

describe("sdk-surface-audit script", () => {
  it("refreshes the baseline and passes audit (same as CI)", () => {
    const refresh = spawnSync("bun", ["scripts/sdk-surface-audit.ts", "--write-baseline"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(refresh.status).toBe(0);

    const audit = spawnSync("bun", ["scripts/sdk-surface-audit.ts"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(audit.status).toBe(0);
    expect(audit.stdout).toContain("sdk-surface-audit: OK");
  });
});
