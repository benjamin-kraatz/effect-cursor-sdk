# Changeset Agent

The changeset agent is a repository automation pattern built with `effect-cursor-sdk`: when a pull request against `main` is opened or updated, GitHub Actions starts a local Cursor SDK agent in the PR checkout and asks it to create a missing Changesets release note.

This is not part of the published library API. It is an executable example of using the package itself to automate a focused maintainer task.

## What It Solves

This repository uses Changesets for versioning. Any user-facing source or documentation change should usually include a `.changeset/*.md` file so the release workflow can produce the correct package version and changelog entry.

The agent reduces reviewer overhead by handling the common case:

- A PR changes package behavior or public docs.
- The author forgot to add a changeset.
- CI asks Cursor to inspect the diff and add one concise release note.
- The workflow commits only `.changeset` changes back to the PR branch.

Manual changesets still win. If a PR already changes `.changeset/*.md`, the agent exits without adding another file.

## Moving Parts

The feature has three pieces:

- `.github/workflows/changeset-agent.yml` runs on `pull_request` events targeting `main`.
- `scripts/create-changeset-agent.ts` contains the Effect program that starts and prompts Cursor.
- `bun run changeset:agent` is the package script used by CI and local maintainers.

The workflow provides repository context and write permissions. The script owns the agent lifecycle and release-note decision. The commit step stages only `.changeset`, so even if the agent reports extra commentary, only release-note files can be committed by the job.

## Event Flow

1. A same-repository PR is opened, reopened, synchronized, or marked ready for review against `main`.
2. GitHub Actions checks out the PR head branch with full history.
3. Bun installs dependencies with the lockfile.
4. `bun run changeset:agent` runs `scripts/create-changeset-agent.ts`.
5. The script compares `origin/main...HEAD` and exits early if the PR already includes a changeset.
6. The script creates a scoped local Cursor agent using `CursorAgentService`.
7. The agent receives a constrained prompt that allows exactly one `.changeset/*.md` file when release impact exists.
8. The script logs the agent response and reports whether a new changeset appeared.
9. The workflow commits and pushes only `.changeset` changes.

## Why Same-Repository PRs Only

The workflow requires both `CURSOR_API_KEY` and `contents: write`. Those are powerful capabilities. The job therefore has this guard:

```yaml
if: ${{ github.event.pull_request.head.repo.full_name == github.repository && !github.event.pull_request.draft }}
```

That keeps secrets and write access away from forked pull requests. Forked PRs should continue to add changesets manually, or a maintainer can run the script from a trusted checkout.

## Configuration

The workflow expects this repository secret:

- `CURSOR_API_KEY`: API key used by `@cursor/sdk`.

The script also reads optional environment variables:

- `CURSOR_MODEL`: Cursor model id. The workflow currently sets `composer-2.5`.
- `CHANGESET_BASE_REF`: diff base for release-impact detection. Defaults to `origin/main`.
- `GITHUB_WORKSPACE`: checkout directory in CI. Local runs default to `process.cwd()`.

The script loads Cursor credentials through `loadCursorConfig`, then creates a scoped agent with `CursorAgentService.scoped(config, overrides)`. This keeps the example aligned with the package's recommended configuration path.

## Local Usage

From a branch with `main` fetched:

```bash
export CURSOR_API_KEY=...
git fetch origin main
bun run changeset:agent
```

To compare against a different base:

```bash
CHANGESET_BASE_REF=origin/release bun run changeset:agent
```

If the branch already contains a changeset, the command logs that fact and exits without invoking Cursor for another release note.

## Prompt Contract

The prompt intentionally gives Cursor a narrow maintenance task. It tells the agent to:

- inspect the diff against the configured base;
- create one concise `.changeset/*.md` file only when the PR affects shipped behavior or public docs;
- choose `patch`, `minor`, or `major` using Changesets semver conventions;
- prefer `patch` unless there is a new public feature or breaking change;
- avoid editing source files, package metadata, lockfiles, or existing changesets;
- leave the workspace unchanged when no changeset is needed.

The prompt includes the changed-file list for orientation, but the agent is still expected to inspect the actual diff before deciding.

## Idempotency

The script checks for changed `.changeset/*.md` files before starting Cursor. That prevents duplicate release notes on repeated `synchronize` events.

After Cursor finishes, the script lists `.changeset/*.md` files again and logs any newly created file. The workflow then checks `git status --porcelain .changeset` so untracked new files are detected; if the tree is clean under `.changeset`, it exits successfully without committing.

## Failure Modes

Common failures are intentionally visible in CI:

- Missing or invalid `CURSOR_API_KEY` fails during agent creation.
- Cursor rate limits or network issues surface through the package's mapped Cursor errors.
- A missing `origin/main` ref causes the git diff command to fail; the workflow avoids this by using `fetch-depth: 0`.
- Forked PRs do not run the job because the workflow guard blocks them.

When the agent decides no changeset is required, the workflow succeeds and commits nothing.

## Release Workflow Relationship

The changeset agent only creates release-note files on PR branches. It does not version, publish, or alter the release workflow.

Publishing still works through the existing Changesets process:

- PRs add `.changeset/*.md`.
- The release workflow creates or updates the version PR on `main`.
- Merging the version PR publishes with `bun run release`.

This separation keeps the agent focused on authoring missing release metadata, while Changesets remains the source of truth for version calculation and changelog generation.
