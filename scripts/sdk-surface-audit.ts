#!/usr/bin/env bun
/**
 * Compares `@cursor/sdk` runtime export keys to a committed baseline.
 *
 * When the SDK is bumped, new or removed exports show up as a non-zero exit
 * unless you refresh the baseline after updating wrappers/docs.
 *
 * Usage:
 *   bun run sdk-audit
 *   bun run sdk-audit:refresh   # writes scripts/sdk-export-baseline.json
 */

import * as Sdk from "@cursor/sdk";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sdkExportSurfaceDiff, sortedSdkExportKeys } from "./sdk-surface-audit-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(__dirname, "sdk-export-baseline.json");

const currentKeys = sortedSdkExportKeys(Sdk as Record<string, unknown>);

const writeBaseline = process.argv.includes("--write-baseline");

if (writeBaseline) {
  writeFileSync(baselinePath, `${JSON.stringify({ exportKeys: currentKeys }, null, 2)}\n`, "utf8");
  console.log(`Wrote ${baselinePath} (${currentKeys.length} keys).`);
  process.exit(0);
}

let baselineKeys: readonly string[];
try {
  const raw = JSON.parse(readFileSync(baselinePath, "utf8")) as { exportKeys?: string[] };
  baselineKeys = raw.exportKeys ?? [];
} catch {
  console.error(`Missing or invalid ${baselinePath}. Run: bun run sdk-audit:refresh`);
  process.exit(1);
}

const { added, removed } = sdkExportSurfaceDiff(baselineKeys, currentKeys);

if (added.length === 0 && removed.length === 0) {
  console.log(`sdk-surface-audit: OK (${currentKeys.length} exports match baseline).`);
  process.exit(0);
}

console.error("sdk-surface-audit: @cursor/sdk export surface drift detected.");
if (added.length > 0) {
  console.error(
    "\nNew exports (review docs/SDK_COVERAGE.md and src/cursor-types.ts):\n",
    added.join("\n"),
  );
}
if (removed.length > 0) {
  console.error(
    "\nRemoved exports (update baseline and wrappers if intentional):\n",
    removed.join("\n"),
  );
}
console.error("\nRefresh baseline after review: bun run sdk-audit:refresh");
process.exit(1);
