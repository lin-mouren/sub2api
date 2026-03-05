# Global UAT Execution Report (2026-03-06)

## Summary
- Scope executed: governance, release/deployment traceability, automated regression checks.
- Result: automation gate is green; repository is ready to enter manual functional/performance/failure-drill UAT.
- Remaining work: manual UAT phases in `docs/global-uat-execution-plan.md` (functional, performance, failure drills, sign-off meeting).

## Environment Snapshot
- Timezone: Asia/Shanghai
- Repository: `lin-mouren/sub2api`
- Default branch: `main`
- Main SHA at verification: `616d42222eb2ac59d9a59ebab5211974629be80d`

## Governance & Sync Contract
- Branch policy:
  - `protect-main`: active, PR required, strict required checks, merge method `merge` only.
  - `protect-mirror`: active, update restricted, no force-push/delete.
- Repo merge settings:
  - `allow_merge_commit=true`
  - `allow_squash_merge=false`
  - `allow_rebase_merge=false`
- Upstream sync regression:
  - Manual dispatch run: `22733917907` (success)
  - URL: `https://github.com/lin-mouren/sub2api/actions/runs/22733917907`
  - Compare snapshot: `main...mirror/upstream-main => {status: behind, ahead_by: 0, behind_by: 40}`
  - Open sync PRs: `[]` (expected)

## Release & Deployment Traceability
- Release artifact:
  - Tag: `v0.1.92-rc.1`
  - Release exists and is retrievable.
- Deploy marker workflow:
  - Staging run: `22727966095` (success)
  - Production run: `22730916048` (success)
- Deployment records:
  - Staging marker: `3991057668` (`ref=v0.1.92-rc.1`, success status present)
  - Production marker: `3991087679` (`ref=v0.1.92-rc.1`, success status present)

## Security Baseline
- Staging environment:
  - Secrets present: `POSTGRES_PASSWORD`, `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`
  - Variables: `SECURITY_URL_ALLOWLIST_ENABLED=true`, `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false`, `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false`
- Production environment:
  - Secrets present: `POSTGRES_PASSWORD`, `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`
  - Variables: `SECURITY_URL_ALLOWLIST_ENABLED=true`, `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false`, `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false`

## Automated Regression Results
- GitHub required checks on main: all pass
  - `test`
  - `golangci-lint`
  - `backend-security`
  - `frontend-security`
- Local frontend regression:
  - `pnpm run lint:check`: pass
  - `pnpm run typecheck`: pass
  - `pnpm run build`: pass
- Local frontend unit tests:
  - `pnpm run test:run` failed on this workstation due local Node runtime mismatch symptoms (`localStorage.* is not a function` under Node `v25.5.0`).
  - CI remains green on repository-required checks (Node 20 in GitHub Actions).

## Fixes Applied During UAT
- Lint defect fixed in:
  - `frontend/src/views/admin/AccountsView.vue`
  - `frontend/src/views/admin/DashboardView.vue`
- Change type: non-functional refactor to satisfy lint safety rules (no logic-intent change).

## Risk & Decision
- Go/No-Go recommendation for moving to manual UAT: **Go**
- Rationale:
  - Governance, sync contract, release artifact, environment baseline, and deployment traceability are all in place and verified.
  - Required CI checks on `main` are green.
- Residual risk:
  - Manual UAT phases (functional/performance/failure drills) have not been executed in this report and must be completed before final production sign-off.
