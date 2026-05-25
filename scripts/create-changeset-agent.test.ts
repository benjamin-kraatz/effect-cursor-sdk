import { describe, expect, it } from "@effect/vitest";

import {
  DEFAULT_CHANGESET_BASE_REF,
  DEFAULT_CURSOR_MODEL,
  changedChangesetsFromFiles,
  changesetBaseRefFromEnv,
  changesetFilesFromEntries,
  cursorModelFromEnv,
  newChangesets,
  promptForChangeset,
} from "./create-changeset-agent";

describe("create-changeset-agent policy", () => {
  it("keeps the default Cursor model pinned", () => {
    expect(DEFAULT_CURSOR_MODEL).toBe("composer-2.5");
    expect(cursorModelFromEnv({})).toBe("composer-2.5");
  });

  it("allows the Cursor model to be overridden by the workflow environment", () => {
    expect(cursorModelFromEnv({ CURSOR_MODEL: "custom-model" })).toBe("custom-model");
  });

  it("keeps the default changeset base pinned to origin/main", () => {
    expect(DEFAULT_CHANGESET_BASE_REF).toBe("origin/main");
    expect(changesetBaseRefFromEnv({})).toBe("origin/main");
  });

  it("allows the changeset base to be overridden for local or release-branch runs", () => {
    expect(changesetBaseRefFromEnv({ CHANGESET_BASE_REF: "origin/release" })).toBe(
      "origin/release",
    );
  });

  it("filters changed files down to changeset markdown files", () => {
    expect(
      changedChangesetsFromFiles([
        "src/index.ts",
        ".changeset/add-agent.md",
        ".changeset/config.json",
        "docs/changeset-agent.md",
      ]),
    ).toEqual([".changeset/add-agent.md"]);
  });

  it("lists changeset files while ignoring directories and README.md", () => {
    expect(
      changesetFilesFromEntries([
        { name: "README.md", isFile: true },
        { name: "great-news.md", isFile: true },
        { name: "config.json", isFile: true },
        { name: "nested.md", isFile: false },
      ]),
    ).toEqual([".changeset/great-news.md"]);
  });

  it("detects newly created changesets", () => {
    expect(
      newChangesets(
        [".changeset/old.md", ".changeset/existing.md"],
        [".changeset/old.md", ".changeset/new.md", ".changeset/existing.md"],
      ),
    ).toEqual([".changeset/new.md"]);
  });

  it("builds a constrained prompt for Cursor", () => {
    const prompt = promptForChangeset(["src/index.ts", "README.md"], "origin/main");

    expect(prompt).toContain("pull request against origin/main");
    expect(prompt).toContain("Package name: effect-cursor-sdk");
    expect(prompt).toContain('"effect-cursor-sdk": patch|minor|major');
    expect(prompt).toContain("Do not edit source files, package metadata, lockfiles");
    expect(prompt).toContain("- src/index.ts");
    expect(prompt).toContain("- README.md");
  });
});
