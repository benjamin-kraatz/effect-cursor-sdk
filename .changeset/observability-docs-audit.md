---
"effect-cursor-sdk": minor
---

Add `cursor-observability` helpers (stream metrics, catalog retry/timeout defaults, safe summaries). Extend mocks and `cursor-run` wiring; warn when `CURSOR_API_KEY` is missing during config load. Bump `@cursor/sdk` to `^1.0.12`. Add `scripts/sdk-surface-audit.ts` with `sdk-audit` / `sdk-audit:refresh`, run it in CI and `verify:publish`. Ship `docs/` in the published package; add `RECIPES`, `RELEASE_CHECKLIST`, `SDK_COVERAGE`, and `MIGRATION_NEXT_MAJOR`. Refresh README (documentation index, exports, quality gates, release notes). Add a Cursor rule requiring Changesets on PRs to `main`; minor tooling/config updates (Vitest wiring, formatter ignore, gitignore).
