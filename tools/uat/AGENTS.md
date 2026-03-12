# UAT Agent Rules

- Every UAT script must write evidence into `docs/uat-evidence/`.
- Failures must include a concrete reason that distinguishes missing prerequisites from functional regressions.
- Allowed failure drills are limited to the scripted Redis/Postgres restart path and upstream smoke checks.
- Do not expand UAT scripts into destructive or irreversible operations.
