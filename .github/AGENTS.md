# Workflow Agent Rules

- GitHub workflows must keep least-privilege permissions.
- `main` remains merge-commit-only with strict required checks.
- `mirror/*` remains fast-forward mirror state only.
- Upstream sync automation must create `sync/* -> main` PRs instead of `mirror/* -> main` PRs.
- Break-glass actions belong in playbooks, not in normal workflow paths.
