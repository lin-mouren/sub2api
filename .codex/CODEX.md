# SUB2api Codex Control Plane

## Purpose

This repository runs a Codex-native automation loop. The control plane lives in `.codex/*`, the execution rules live in `AGENTS.md`, and runtime evidence is produced under `.codex/artifacts/`.

## Core Contracts

- `main` is the iterative branch.
- `mirror/upstream-main` is a strict fast-forward mirror of `upstream/main`.
- Upstream changes enter `main` through automation-managed `sync/* -> main` PRs.
- Release, deployment marker, and live UAT are valid only when they can produce traceable evidence.

## Runtime Entry Points

- Loop CLI: `node tools/agent-loop/orchestrate.mjs <command>`
- Sync workflow: `.github/workflows/upstream-sync.yml`
- Deploy marker: `.github/workflows/deploy-marker.yml`
- Live UAT scripts: `tools/uat/run-live-functional.sh`, `tools/uat/run-live-failure-drill.sh`

## Context Index

- Production readiness baseline: `docs/production-readiness-checklist.md`
- Global UAT plan: `docs/global-uat-execution-plan.md`
- Existing UAT report: `docs/global-uat-report-20260306.md`
- Deployment template: `deploy/docker-compose.local.yml`
- Manual input contract: `deploy/manual-inputs.schema.json`

## Hard Stops

- No direct development on `main` or `mirror/*`.
- No hidden break-glass in routine automation.
- No real secrets in the repository.
- Missing external prerequisites must become `manual_blocker`, never fake success.
