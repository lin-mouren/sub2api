# Deploy Agent Rules

- Default deployment shape is `deploy/docker-compose.local.yml` plus reverse-proxy TLS.
- Never commit real deployment secrets or filled local input files.
- Deployment automation may run compose, health checks, and deployment markers once manual inputs exist.
- Production cutover still requires explicit human approval and environment review.
