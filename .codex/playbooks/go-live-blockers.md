# Go-Live Manual Blockers Playbook

The automation loop may only stop on explicit `manual_blocker` items. Those blockers are resolved by providing the missing external condition below.

## Expected Manual Inputs

- `deploy/manual-inputs.local.json` exists and satisfies `deploy/manual-inputs.schema.json`
- reachable `staging.base_url`
- valid `deployment.compose_file`
- valid `deployment.env_file`
- optional `deployment.docker_context` if the target engine is not the local Docker context
- GitHub Environment reviewers approve `staging` or `production` markers when requested
- real runtime secrets are present in the target environment

## Resolution Flow

1. Fill or update `deploy/manual-inputs.local.json`.
2. Confirm the target Docker context or host access works.
3. Re-run `node tools/agent-loop/orchestrate.mjs run --until-manual`.
4. Inspect `.codex/reports/latest-status.md` for the remaining blockers, if any.
