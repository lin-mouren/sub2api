# ADR-0001: Codex-Native Agent Loop

## Decision

Use a Codex-native control plane backed by `AGENTS.md`, `.codex/prd.json`, `.codex/MEMORY.md`, and `.codex/artifacts/*`.

## Why

- The repository already uses Codex tooling and GitHub automation.
- Local dependencies such as Taskmaster, `tmux`, and `jq` are not guaranteed.
- The loop needs to keep operating even when only Node, Git, Docker, and `gh` are available.

## Consequences

- Instructions are centralized in `AGENTS.md`.
- Runtime state is centralized in `.codex/*`.
- Worktree isolation is mandatory for specialist and validator execution.
- External deployment access and approvals remain explicit human gates.
