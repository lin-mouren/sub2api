# SUB2api Post-Release Health Audit (2026-03-12)

## Purpose
- Freeze post-release health evidence for `v0.1.92-rc.3`.
- Confirm sync/release/deploy/governance chains remain healthy after final sign-off.

## Scope
- Repository: `lin-mouren/sub2api`
- Default branch: `main`
- Release target: `v0.1.92-rc.3`
- Timezone baseline: `Asia/Shanghai`

## Chain A: Upstream Sync Health
1. Latest schedule runs: success
- `23010179239`
- `23007153258`
- `23004840809`
- `23001925337`
- `22999661994`

2. Manual regression run: success
- run: `23010471666`
- url: https://github.com/lin-mouren/sub2api/actions/runs/23010471666

3. Branch relationship snapshot
- `compare(main...mirror/upstream-main)`:
  - `status=behind`
  - `ahead_by=0`
  - `behind_by=70`
- interpretation: mirror is not ahead of main; no sync PR required.

4. Sync PR inventory
- open sync PR count: `0`

## Chain B: Release Health
1. Release artifact
- tag: `v0.1.92-rc.3`
- release: https://github.com/lin-mouren/sub2api/releases/tag/v0.1.92-rc.3
- prerelease: `true`
- target branch: `main`

2. Release workflow
- run: `22993093721`
- url: https://github.com/lin-mouren/sub2api/actions/runs/22993093721
- conclusion: `success`

3. Node runtime risk hardening
- upgraded in `release.yml`:
  - `docker/setup-qemu-action@v4`
  - `docker/setup-buildx-action@v4`
  - `docker/login-action@v4`
- no `docker/*@v3` references remain in `.github/workflows`.

## Chain C: Deploy Audit Health
1. Staging marker closure
- run: `22993400137` (success)
- deployment: `4048343284`
- environment: `staging`
- ref: `v0.1.92-rc.3`

2. Production marker closure
- run: `22993540931` (success)
- deployment: `4048366966`
- environment: `production`
- ref: `v0.1.92-rc.3`
- `production_environment=true`

## Chain D: Governance Gate Health
1. `protect-main` ruleset snapshot
- enforcement: `active`
- required approvals: `1`
- strict status checks: `true`
- required contexts:
  - `test`
  - `golangci-lint`
  - `backend-security`
  - `frontend-security`
- allowed merge methods: `merge`

2. Repository merge policy snapshot
- `allow_merge_commit=true`
- `allow_squash_merge=false`
- `allow_rebase_merge=false`

3. Open PR status
- open PR count: `0`

## Final Status
- Post-release audit conclusion: **HEALTHY**
- Risk level: **Low** (normal operational monitoring)

## Operational Follow-up (non-blocking)
1. Keep hourly `upstream-sync` schedule and monitor failures.
2. Re-run deploy marker if environment variables/secrets are rotated.
3. Keep dependency triage SLA active for newly disclosed vulnerabilities.
