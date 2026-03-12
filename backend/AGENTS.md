# Backend Agent Rules

- Keep backend changes inside the assigned task scope.
- Any compatibility change must include tests.
- Read paths must not introduce active outbound probes, billing writes, or hidden side effects.
- If a task changes toolchain or CI assumptions, verify `backend/go.mod` and `.github/workflows/backend-ci.yml` stay aligned.
- Before marking backend work complete, run the minimum relevant Go test set for that task.
