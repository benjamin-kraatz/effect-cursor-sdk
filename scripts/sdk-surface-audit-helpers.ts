/** Sorted `@cursor/sdk` export names, excluding the default export. */
export function sortedSdkExportKeys(sdk: Record<string, unknown>) {
  return Object.keys(sdk)
    .filter((key) => key !== "default")
    .sort();
}

/** Keys added or removed between two export snapshots. */
export function sdkExportSurfaceDiff(
  baseline: ReadonlyArray<string>,
  current: ReadonlyArray<string>,
) {
  const baselineSet = new Set(baseline);
  const currentSet = new Set(current);

  return {
    added: current.filter((key) => !baselineSet.has(key)),
    removed: baseline.filter((key) => !currentSet.has(key)),
  };
}
