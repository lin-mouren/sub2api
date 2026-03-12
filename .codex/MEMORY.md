# Codex Memory

## Current Operating Facts

- The repository already has `upstream-sync`, `release`, `deploy-marker`, and live UAT shell scripts.
- The structural sync issue is the old `mirror/upstream-main -> main` PR path under strict branch protection.
- Live go-live blockers are external by nature: reachable staging URL, deployment environment file, target Docker context/host access, real secrets, and environment approvals.

## Accepted Defaults

- Codex is the only control plane.
- Control files live in `.codex/*`.
- Instructions live in `AGENTS.md`.
- Deployment shape stays `docker-compose.local.yml` plus reverse-proxy TLS.
- The loop should continue until only `manual_blocker` tasks remain or everything is `done`.

## Escalations

- REL-001: No prerelease baseline found in repository releases
