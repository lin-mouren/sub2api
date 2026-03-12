# Codex Team Contract

This repository uses a Codex-native multi-agent loop. All instructions flow through `AGENTS.md` files and `.codex/*`.

## Roles

- `orchestrator` reads `.codex/CODEX.md`, `.codex/prd.json`, `.codex/MEMORY.md`, applicable `AGENTS.md`, and external facts. It may only mutate control-plane files, task state, envelopes, and generated reports.
- `specialist` works on exactly one assigned task. It must use its own worktree at `.worktrees/<task-id>-specialist-<attempt>` and may not expand scope on its own.
- `validator` must use a different worktree at `.worktrees/<task-id>-validator-<attempt>`. It only re-checks code, tests, contracts, and evidence. It does not implement fixes.

## Git And Branch Rules

- Never develop directly on `main` or `mirror/*`.
- `mirror/*` is pure fast-forward mirror state only. Never resolve conflicts there.
- All implementation work must happen on task branches backed by dedicated worktrees.
- If the working tree is dirty, the loop must overlay the current delta into task worktrees instead of mutating the main checkout.

## Task State Rules

- `.codex/prd.json` is the only task state source of truth.
- A task may only move through `todo`, `ready`, `in_progress`, `review`, `verified`, `done`, `blocked`, `manual_blocker`.
- Every task execution must emit an ArtifactEnvelope under `.codex/artifacts/envelopes/`.
- Missing external prerequisites must be recorded as `manual_blocker` with an exact missing-input list.

## Safety Rules

- Never commit or echo real secrets.
- Never hide break-glass behavior inside routine automation.
- The loop stops only when every remaining unfinished task is a `manual_blocker`, or every task is `done`.
