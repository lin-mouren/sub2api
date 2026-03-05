# Dependency Triage SLA

Last updated: 2026-03-05

## Scope
- Sources: Dependabot PRs, `Security Scan` workflow findings, GitHub advisory alerts.
- Ecosystems: Go modules (`/backend`), npm (`/frontend`), GitHub Actions.

## Severity Targets
- Critical: acknowledge within 4 hours, patch or approved mitigation within 24 hours.
- High: acknowledge within 1 business day, patch or approved mitigation within 72 hours.
- Medium: triage within 5 business days, patch in next planned maintenance cycle.
- Low: batch with routine dependency refresh.

## Handling Rules
1. Prefer direct upgrade to fixed version.
2. If direct upgrade is blocked, document mitigation and risk acceptance in PR.
3. Keep `main` green: no merge if required checks fail.
4. For false positives, add explicit rationale and expiry review date.

## Ownership
- Primary owner: repository maintainer (`lin-mouren`).
- Backup owner: designated ops reviewer for release windows.

## Evidence
- Each merged dependency/security PR should include:
  - advisory or scan reference,
  - impact summary,
  - verification (CI run URL),
  - rollback note if applicable.
