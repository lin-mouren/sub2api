# SUB2api Final Go/No-Go Sign-off (2026-03-12)

## Meeting Scope
- Decision type: production release window sign-off
- Version baseline: `v0.1.92-rc.3`
- Repository: `lin-mouren/sub2api`
- Branch model: `main` + `mirror/upstream-main`
- Deployment evidence model: GitHub Deployments marker workflow (`deploy-marker.yml`)

## Frozen Inputs
1. UAT execution plan: `docs/global-uat-execution-plan.md`
2. Production readiness checklist: `docs/production-readiness-checklist.md`
3. UAT report baseline: `docs/global-uat-report-20260306.md`

## Governance Snapshot (frozen)
- `protect-main`: active, PR required, approvals `=1`, strict status checks `=true`.
- Required checks: `test`, `golangci-lint`, `backend-security`, `frontend-security`.
- Merge policy: repository only allows merge commit (`allow_merge_commit=true`, `allow_squash_merge=false`, `allow_rebase_merge=false`).
- Open PR count at sign-off: `0`.

## Evidence Chain (frozen)
1. Release evidence
- Tag: `v0.1.92-rc.3`
- Release: https://github.com/lin-mouren/sub2api/releases/tag/v0.1.92-rc.3
- Release workflow run: https://github.com/lin-mouren/sub2api/actions/runs/22993093721 (`success`)

2. Deploy marker evidence
- Staging deploy-marker run: https://github.com/lin-mouren/sub2api/actions/runs/22993400137 (`success`)
- Staging deployment: `id=4048343284`, `environment=staging`, `ref=v0.1.92-rc.3`
- Production deploy-marker run: https://github.com/lin-mouren/sub2api/actions/runs/22993540931 (`success`)
- Production deployment: `id=4048366966`, `environment=production`, `ref=v0.1.92-rc.3`, `production_environment=true`

3. Upstream sync and branch health
- Latest sync runs: `22993008500`, `22992059459`, `22991329248` (all `success`)
- `compare(main...mirror/upstream-main)`: `status=behind`, `ahead_by=0`, `behind_by=68`
- Interpretation: mirror is not ahead of main; no sync PR required.

## Decision Matrix
- P0 defects: `0`
- Required checks gate: `pass`
- Release traceability: `pass`
- Staging deploy gate: `pass`
- Production deploy marker gate: `pass`
- Rollback artifact baseline: `pass` (prior RC tags and release artifacts available)

## Final Decision
- Decision: **GO** (under the locked deployment-marker audit model).
- Effective version: `v0.1.92-rc.3`
- Decision timestamp: `2026-03-12 Asia/Shanghai`

## Constraints And Follow-up
1. This GO is based on deployment-marker audit closure, not SSH/runtime rollout automation.
2. Continue scheduled upstream-sync monitoring and required-check enforcement as release gate.
3. Keep Sora capability out-of-scope for production acceptance.

## Sign-off Record
- Release Manager: `lin-mouren` (approved)
- QA Lead: `lin-mouren` (approved)
- SRE: `lin-mouren` (approved)
- Security: `lin-mouren` (approved)
