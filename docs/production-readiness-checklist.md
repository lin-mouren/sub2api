# SUB2api Production Readiness Checklist

Last updated: 2026-03-05

## Scope
- Deployment model: Docker Compose (`deploy/docker-compose.local.yml`) + reverse proxy TLS.
- Release channel: origin tag release artifacts only.
- Branch model: `main` for iteration, `mirror/upstream-main` for strict upstream mirror.
- Out of scope for production sign-off: Sora capability (do not use as go-live gate).

## P0 Go/No-Go Gates
- [ ] Upstream sync automation uses compare-first logic and cannot silently skip PR creation.
- [ ] If `mirror` is ahead of `main`, PR `mirror/upstream-main -> main` is auto-created/reused.
- [ ] If `main` already contains `mirror`, stale sync PR is auto-closed.
- [ ] `main` branch protection requires PR, requires status checks, blocks force-push/delete.
- [ ] Required checks for `main`: `test`, `golangci-lint`, `backend-security`, `frontend-security`.
- [ ] Required status checks are strict (branch must be up to date before merge).
- [ ] At least one origin release tag pipeline completed successfully with traceable artifacts.
- [ ] GitHub environments `staging` and `production` exist with reviewer protection.
- [ ] Production secret baseline is frozen and approved:
  - [ ] `POSTGRES_PASSWORD`
  - [ ] `JWT_SECRET`
  - [ ] `TOTP_ENCRYPTION_KEY`
  - [ ] `SECURITY_URL_ALLOWLIST_ENABLED=true`
  - [ ] `SECURITY_URL_ALLOWLIST_ALLOW_INSECURE_HTTP=false`
  - [ ] `SECURITY_URL_ALLOWLIST_ALLOW_PRIVATE_HOSTS=false`

## P1 Recommended Before Global UAT
- [x] Mirror branch CI noise strategy documented (accepted or mitigated).
- [ ] `UPSTREAM_SYNC_DEPLOY_KEY` rotated with owner + expiry policy.
- [x] PAT minimized in workflow; prefer `GITHUB_TOKEN`.
- [ ] Residual `UPSTREAM_SYNC_TOKEN` secret removed (if no longer required).
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
