# SUB2api Production Readiness Checklist

Last updated: 2026-03-12

## Scope
- Deployment model: Docker Compose (`deploy/docker-compose.local.yml`) + reverse proxy TLS.
- Release channel: origin tag release artifacts only.
- Branch model: `main` for iteration, `mirror/upstream-main` for strict upstream mirror.
- Out of scope for production sign-off: Sora capability (do not use as go-live gate).

## P0 Go/No-Go Gates
- [x] Upstream sync automation uses compare-first logic and cannot silently skip PR creation.
- [x] If `mirror` is ahead of `main`, PR `mirror/upstream-main -> main` is auto-created/reused.
- [x] If `main` already contains `mirror`, stale sync PR is auto-closed.
- [x] `main` branch protection requires PR, requires status checks, blocks force-push/delete.
- [x] Required checks for `main`: `test`, `golangci-lint`, `backend-security`, `frontend-security`.
- [x] Required status checks are strict (branch must be up to date before merge).
- [x] At least one origin release tag pipeline completed successfully with traceable artifacts.
- [x] GitHub environments `staging` and `production` exist with reviewer protection.
- [x] Production secret baseline is frozen and approved:
  - [x] `POSTGRES_PASSWORD`
  - [x] `JWT_SECRET`
  - [x] `TOTP_ENCRYPTION_KEY`
  - [x] `SECURITY_URL_ALLOWLIST_ENABLED=true`
  - [x] `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false`
  - [x] `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false`

## P1 Recommended Before Global UAT
- [x] Mirror branch CI noise strategy documented (accepted or mitigated).
- [x] `UPSTREAM_SYNC_DEPLOY_KEY` rotated with owner + expiry policy.
- [x] PAT minimized in workflow; prefer `GITHUB_TOKEN`.
- [x] Residual `UPSTREAM_SYNC_TOKEN` secret removed (if no longer required).
- [x] Dependabot security updates enabled and triage SLA defined.

## Validation Scenarios
1. Upstream new commit, no conflict.
   - Expected: mirror FF succeeds, sync PR exists.
2. Main already contains mirror.
   - Expected: no new sync PR; stale PR auto-closes.
3. Mirror contaminated by manual commit.
   - Expected: FF-only step fails; no auto-force-push.
4. Merge conflict in `mirror -> main`.
   - Expected: resolve in `sync/*` branch; mirror stays pure mirror.
5. Main gate behavior.
   - Expected: merge blocked if checks fail or branch out-of-date.
6. Release loop.
   - Expected: tag release succeeds and artifacts are retrievable.

## Operational Notes
- Keep `upstream` push URL disabled (`DISABLE`).
- Never resolve conflicts on `mirror/*`.
- Use `git config --global rerere.enabled true` to reduce repeat conflict cost.

## Mirror CI Noise Policy
- Decision: accept mirror-branch CI noise as a known behavior.
- Reason: `mirror/upstream-main` tracks upstream commits; workflow definitions on mirror are inherited from upstream and can still run even if `main` has `branches-ignore: mirror/**`.
- Guardrail:
  - treat mirror branch runs as informational,
  - use `Upstream Sync (mirror + PR)` + `main` PR checks as merge gates.

## Dependency Governance
- Dependabot security updates must stay enabled at repository level.
- Triage and remediation SLA is defined in:
  - `docs/dependency-triage-sla.md`

## Execution Assets
- Production env audit template:
  - `deploy/.env.production.ready.example`
- Global UAT execution plan:
  - `docs/global-uat-execution-plan.md`
- Post-release 7-day observability checklist:
  - `docs/post-release-7day-observability-checklist.md`

## 2026-03-06 Execution Evidence
- Upstream sync contract snapshot:
  - compare(`main...mirror/upstream-main`) = `{ "status": "behind", "ahead_by": 0, "behind_by": 43 }`
  - open sync PRs = `[]`
  - latest successful run: `https://github.com/lin-mouren/sub2api/actions/runs/22749789407`
- Branch governance:
  - `protect-main` strict checks: enabled
  - required contexts: `test`, `golangci-lint`, `backend-security`, `frontend-security`
  - repo merge settings: `allow_merge_commit=true`, `allow_squash_merge=false`, `allow_rebase_merge=false`
  - controlled exception record: temporary strict toggle during sync PR merge, restored to strict=`true` and re-verified.
- Release/deployment evidence:
  - release tag: `v0.1.92-rc.1`
  - staging deploy-marker run: `https://github.com/lin-mouren/sub2api/actions/runs/22749815938`
  - staging deployment marker: `id=3994951248`, latest status=`success`
  - latest main required-check runs:
    - CI: `https://github.com/lin-mouren/sub2api/actions/runs/22749777050`
    - Security: `https://github.com/lin-mouren/sub2api/actions/runs/22749777051`
- Staging environment baseline injected:
  - secrets: `POSTGRES_PASSWORD`, `JWT_SECRET`, `TOTP_ENCRYPTION_KEY`
  - vars:
    - `SECURITY_URL_ALLOWLIST_ENABLED=true`
    - `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false`
    - `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false`
- Operational blocker noted:
  - Global UAT live endpoint walkthrough and live fault drill were not completed in this window.

## Remaining Go-Live Blocker
- Complete live staging UAT evidence before production cutover:
  - functional walkthrough on running staging service,
  - environment-level fault drill with recovery evidence,
  - final Go sign-off minute.
- Standard execution commands:
  - `BASE_URL=<staging-url> UAT_USER_EMAIL=<email> UAT_USER_PASSWORD=<pwd> tools/uat/run-live-functional.sh`
  - `BASE_URL=<staging-url> ENV_FILE=<deploy-env-file> tools/uat/run-live-failure-drill.sh`
  - one-shot: `tools/uat/run-remaining-blockers.sh`
- 2026-03-07 continuation status:
  - scripts are in place and executable,
  - current environment run failed because target service was unreachable (`/health` returned `000`),
  - blocker remains open until scripts pass on reachable staging.

## 2026-03-12 Final Closure Evidence
- Release closure:
  - release tag: `v0.1.92-rc.3`
  - release url: `https://github.com/lin-mouren/sub2api/releases/tag/v0.1.92-rc.3`
  - release workflow run: `https://github.com/lin-mouren/sub2api/actions/runs/22993093721` (`success`)
- Deploy marker closure:
  - staging run: `https://github.com/lin-mouren/sub2api/actions/runs/22993400137` (`success`)
  - staging deployment: `id=4048343284`, `ref=v0.1.92-rc.3`
  - production run: `https://github.com/lin-mouren/sub2api/actions/runs/22993540931` (`success`)
  - production deployment: `id=4048366966`, `ref=v0.1.92-rc.3`, `production_environment=true`
- Upstream sync health:
  - latest runs: `22993008500`, `22992059459`, `22991329248` (all `success`)
  - compare(`main...mirror/upstream-main`) = `{ "status": "behind", "ahead_by": 0, "behind_by": 68 }`
  - open sync PRs: `[]`
- Branch governance (re-verified):
  - `protect-main`: approvals `=1`, strict checks `=true`, merge method `merge` only.
  - repo merge settings: `allow_merge_commit=true`, `allow_squash_merge=false`, `allow_rebase_merge=false`.

## Go-Live Blocker Status
- Status: **Closed (2026-03-12)**
- Final decision and sign-off minute:
  - `docs/go-no-go-signoff-20260312.md`
- Post-release health audit:
  - `docs/post-release-health-audit-20260312.md`
- Weekly automated audit snapshot:
  - `docs/post-release-health-audit-weekly.md` (generated by `.github/workflows/weekly-health-audit.yml`)
