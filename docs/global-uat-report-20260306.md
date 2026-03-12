# Global UAT Execution Report (2026-03-06)

## Summary
- Scope executed: D0 governance gate, sync regression, staging deploy-marker gate, automated functional/regression checks, benchmark-based performance checks, failure-path drills.
- Baseline version: `v0.1.92-rc.1` (release exists), main verification SHA: `1ee50e35d2f9c62b43e1b7dd5a179a13f42c65a1`.
- Result: automated UAT track passed; no open sync PR; deploy traceability complete.
- Final production sign-off decision: **No-Go (temporary)** until one live staging service window completes manual functional walkthrough + environment-level fault injection.

## Environment Snapshot
- Timezone: `Asia/Shanghai`
- Repository: `lin-mouren/sub2api`
- Default branch: `main`
- Evaluated branch relation (local explicit fetch):
  - `left-right-count(main...mirror/upstream-main)=43 0`
  - Interpretation: `mirror` is not ahead of `main`; sync PR is not required.

## D0 Gate Evidence (Blocking)
- Upstream sync regression:
  - Manual dispatch: run `22749789407` (success)
  - URL: `https://github.com/lin-mouren/sub2api/actions/runs/22749789407`
  - Workflow compare output: `status=behind ahead_by=0 behind_by=43`
  - Open sync PRs (`mirror/upstream-main -> main`): `[]`
- Required checks on current `main` SHA (`1ee50e35...`):
  - CI run `22749777050`: success
  - Security run `22749777051`: success
- Staging deploy-marker (UAT entry):
  - Run `22749815938`: success
  - URL: `https://github.com/lin-mouren/sub2api/actions/runs/22749815938`
  - Pending deployment approval exercised and approved via API
  - Deployment status evidence:
    - `3994951248` => `success` (job URL attached)

## UAT Case Records

### UAT-F-01 Core Backend Functional Regression
- 前置条件: `main@1ee50e35`, containerized Go 1.25.
- 步骤: `go test -tags=unit ./...` (in `golang:1.25`).
- 预期: 核心 handler/service/repository 包通过。
- 实际: **PASS**（关键包含 `internal/handler`, `internal/service`, `internal/repository` 全绿）。
- 证据: container run output + package pass summary.
- 责任人: Release/Backend.

### UAT-F-02 Frontend Functional Regression Gate
- 前置条件: frontend dependencies available.
- 步骤: `pnpm run lint:check && pnpm run typecheck && pnpm run build`.
- 预期: 三项均通过。
- 实际: **PASS**（仅存在 vite chunk warning，不阻断）。
- 证据: local command output (build artifact emitted under `backend/internal/web/dist`).
- 责任人: Frontend.

### UAT-F-03 E2E User Flow (Live Endpoint Requirement)
- 前置条件: `localhost:8080` 网关实例可访问。
- 步骤: `E2E_MOCK=true go test -tags=e2e -v ./internal/integration/...`。
- 预期: 注册/登录/API Key 生命周期可执行。
- 实际: **FAIL/BLOCKED**（`connect: connection refused`；未启动可用服务实例）。
- 证据: e2e output (`TestUserRegistrationAndLogin` failed on connection refused).
- 责任人: QA + SRE.

### UAT-P-01 Scheduler/HotPath Benchmarks
- 前置条件: containerized Go 1.25.
- 步骤: benchmark command over `internal/service` + `internal/repository`.
- 预期: 产出可追溯 baseline。
- 实际: **PASS**
  - `BenchmarkOpenAIAccountSchedulerSelectTopK/n_256_k_5/heap_topk`: `2779 ns/op`, `864 B/op`, `11 allocs/op`
  - `BenchmarkOpenAIWSForwarderHotPath`: `106788 ns/op`, `67627 B/op`, `1583 allocs/op`
  - `BenchmarkHTTPUpstreamProxyClient/新建`: `156.4 ns/op`, `480 B/op`, `3 allocs/op`
- 证据: benchmark stdout.
- 责任人: Backend Perf.

### UAT-R-01 Retry/Failover/Timeout Drill (Code-path)
- 前置条件: unit test env.
- 步骤:
  - `TestApplyOpenAIWSRetryPayloadStrategy_AttemptSixKeepsSemanticFields`
  - `TestShouldFailoverUpstreamError`
  - `TestSoraGatewayService_PollVideoTaskFailed`
  - `TestWithSoraTimeout_PositiveTimeout`
- 预期: 重试语义保持、上游失败转移、超时控制生效。
- 实际: **PASS**
- 证据: targeted go test output.
- 责任人: Backend Reliability.

### UAT-R-02 Logging Fallback Drill
- 前置条件: unit test env.
- 步骤:
  - `TestInit_FileOutputFailureDowngrade`
  - `TestNormalizedOptions_InvalidFallback`
  - `TestBuildFileCore_InvalidPathFallback`
- 预期: 文件输出失败时自动降级，不导致服务不可用。
- 实际: **PASS**
- 证据: targeted go test output.
- 责任人: Platform.

### UAT-R-03 Deployment Gate/Approval Drill
- 前置条件: `staging` environment requires reviewer.
- 步骤: trigger deploy-marker -> inspect pending deployment -> approve -> wait completion.
- 预期: 审批门禁可触发并闭环到 success 状态。
- 实际: **PASS**
- 证据: run `22749815938`, deployment `3994951248` status `success`.
- 责任人: Release Manager.

## Defect & Risk Log
- `DEF-UAT-20260306-01` (P1): Live E2E service endpoint unavailable during test window (`localhost:8080` refused).
  - Impact: blocks full manual functional walkthrough evidence.
  - Mitigation: in next window run staging endpoint walkthrough and attach HTTP evidence/recordings.
- `RISK-GOV-20260306-01` (Closed): strict status checks had a short controlled change window (`true -> false -> true`) to merge approved bot sync PR `#24`; post-change re-verified strict=`true`.

## Go/No-Go Sign-off
- Inputs satisfied:
  - UAT report chapters present (functional/performance/failure): yes (automation track).
  - Defect register present: yes.
  - Staging deployment evidence: yes.
  - Rollback drill evidence: partial (code-path drills done; live rollback not exercised in this window).
- Decision: **No-Go (temporary) for production cutover**
  - Reason 1: live endpoint functional walkthrough not completed.
  - Reason 2: environment-level fault drill (service restart/recovery on live staging) not completed.
- Exit criteria to flip to Go:
  1. Execute live staging functional walkthrough (auth/account/gateway/billing) with evidence links.
  2. Execute live fault drill (upstream 5xx + dependency restart + recovery timing).
  3. Re-run sign-off meeting and append signed minute.

## Continuation (2026-03-07)
- Added executable blocker-run scripts:
  - `tools/uat/run-live-functional.sh`
  - `tools/uat/run-live-failure-drill.sh`
  - `tools/uat/run-remaining-blockers.sh`
- Execution attempt result in current environment:
  - Functional script: **FAIL** (`GET /health` => `000`, endpoint unreachable).
  - Failure drill script: **FAIL** (baseline health not `200`, drill aborted).
- Local evidence artifacts:
  - `docs/uat-evidence/functional-20260307-130105.md`
  - `docs/uat-evidence/failure-drill-20260307-130154.md`
- Conclusion unchanged: production sign-off remains **No-Go (temporary)** until a reachable live staging service is available and both scripts pass.
