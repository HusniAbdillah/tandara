# CI for the three-week demo

Routine CI runs on pushes to `main`/`bulk/everything` and pull requests. It keeps
one `checks` job and the existing `CI` workflow name so deployment and required
status checks retain their identities. New commits cancel obsolete CI runs.

## Routine gate

- Frozen dependency install and repository formatting.
- ESLint and architecture dependency boundaries.
- TypeScript for all workspaces and tooling.
- Unit and HTTP tests, then production builds for every workspace.
- Real PostgreSQL/PostGIS integration and API product contracts.
- Migrations and synthetic seed applied twice to verify repeatability.
- OpenAPI regenerated and compared against the checked-in contract.
- Static deployment routing/package tests, portable image identity tests, Bash
  syntax and ShellCheck for deployment scripts.

Named steps make a failing check and its duration visible separately. Integration
executes directly after the workspace builds; it does not call the integration
script's extra `pnpm build`. Database/API integration remains mandatory on every
routine run. The test database is a disposable GitHub service, not Tencent.

## Full browser validation

The full Docker build and Playwright suite are opt-in. Open **Actions → CI → Run
workflow**, choose the intended branch, enable **full_e2e**, and run it. All
routine checks run first, then Chromium installation, the full Compose stack,
and all browser tests. Browser evidence is retained for three days, including
failure traces. The temporary browser stack and its test volumes are cleaned up.

Run full E2E after substantial browser/offline/auth/map flow changes and before
the final jury rehearsal. Routine green CI does not prove those browser flows.
This deliberate coverage tradeoff removes the Docker/browser cost from ordinary
pushes; the suite is still available and unchanged.

## Deployment

Automatic deployment still requires a successful **push CI** for the exact
current main SHA and `DEPLOY_ENABLED=true`. Manual CI is read-only validation;
it does not trigger automatic production deployment. Deploy demo separately
builds and smoke-tests the actual production backend image before release.

No broader permissions, paid runner, registry or additional secrets are needed.
The existing pnpm download cache is retained. Do not cache integration outcomes
or remove fresh production-image smoke checks to speed up deployment.

## Baseline and measurement

Before this change, runs `38383130933` and `38381057539` took 257 and 326 seconds.
Their full Compose build/start took 96–113 seconds, browser tests 34–54 seconds,
and Chromium installation 20–24 seconds. Routine CI now skips those three stages.
The actual new runtime must be measured on GitHub; subtracting old step durations
is only an estimate, not a benchmark of the new workflow.
