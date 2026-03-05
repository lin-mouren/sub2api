# Global UAT Execution Plan (Production Grade)

Last updated: 2026-03-05

## Scope
- In scope: core gateway/API auth/account routing, admin/user UI, billing/usage visibility, sync governance, release/deploy safety.
- Out of scope: Sora production capability.

## Entry Criteria
- `main` protection strict + required checks enabled.
- Upstream sync workflow green and no stale sync PRs.
- `staging` and `production` environments protected.
- Release artifact available (`v0.1.92-rc.1` or newer).
- Production baseline env reviewed from `deploy/.env.production.ready.example`.

## Phase 0: Preflight (Blocking)
1. Governance snapshot
   - Check: rulesets (`main` strict, `mirror` locked), open PR count, sync workflow status.
   - Pass: no open governance exceptions.
2. Artifact validation
   - Check: release page exists, image/tag retrievable.
   - Pass: artifact metadata traceable to commit SHA.
3. Config validation
   - Check: required secrets set and non-empty in target environment.
   - Pass: security baseline flags match production requirements.

## Phase 1: Functional UAT
1. Authentication flows
   - Login/logout/session refresh/admin bootstrap.
   - Pass: no unexpected 5xx, token lifecycle correct.
2. Account and key management
   - Create/update/disable upstream accounts, key issue/revoke.
   - Pass: state transitions persisted and auditable.
3. Gateway routing
   - OpenAI/Claude/Gemini request/response path including error passthrough.
   - Pass: expected model routing and response semantics.
4. Usage and billing visibility
   - Usage charts/logs/admin overview.
   - Pass: values update consistently without stale totals.

## Phase 2: Regression UAT
1. Main critical paths
   - Repeat high-frequency API and UI operations.
   - Pass: no regression vs baseline behavior.
2. Sync contract regression
   - Trigger upstream-sync manually.
   - Pass: if mirror ahead -> PR upserted; if not ahead -> no new PR.

## Phase 3: Performance & Capacity
1. Baseline load
   - Sustained mixed traffic on staging.
   - Pass: latency/error within agreed SLO thresholds.
2. Burst test
   - Short spike traffic and recovery.
   - Pass: system recovers without manual intervention.

## Phase 4: Failure Drills
1. Upstream transient failure
   - Inject upstream 5xx/timeouts.
   - Pass: graceful error propagation, no data corruption.
2. Dependency restart drill
   - Restart Redis/Postgres service in maintenance window.
   - Pass: app reconnects and resumes safely.
3. Workflow failure alert drill
   - Simulate upstream-sync failure path.
   - Pass: alert comment/issue path works as configured.

## Phase 5: Go/No-Go Sign-off
1. Collect evidence
   - CI links, release link, UAT case results, incident notes.
2. Decision meeting
   - Go only if all blocking checks pass and no unresolved high-risk issues.

## Evidence Template
- Case ID:
- Environment: staging / production-like
- Build/Tag:
- Steps:
- Result: pass/fail
- Logs/Links:
- Owner:
- Timestamp:
