# infra/ — AWS for ATS Hero (not deployed yet)

Infrastructure as code for the AWS side. Nothing in this folder runs on its own: the stacks are
created by hand, phase by phase (F0–F5 in `CURSOR-AWS-INFRA.md`), and no workflow watches it yet.

| File | Stack / use |
|---|---|
| `foundation.yaml` | `atshero-foundation`: GitHub and Vercel OIDC roles, the `atshero-app-boundary` permissions boundary, artifacts bucket, ECR repository, budget and cost-anomaly alerts, CloudTrail, GuardDuty, Access Analyzer |
| `data.yaml` | `atshero-data`: RDS PostgreSQL 16 (`db.t4g.micro`, TLS, 14-day PITR), backups bucket |
| `template.yaml` | `atshero-dev` / `atshero-prod`: HTTP API with the Clerk JWT authorizer, the Python API on Lambda (arm64), per-user rate limit (DynamoDB), dashboard, alarms; workers and assets only when enabled |
| `scripts/inventory.sh` | read-only inventory of the account; prints no secrets and changes nothing |
| `github/infra-deploy.yml` | the deploy workflow; kept here, inactive, until F3 moves it to `.github/workflows/` (`git mv`) |

Rules: `us-east-1` only, tag `project=atshero` on everything, no NAT Gateway, no access keys in the
repo (GitHub and Vercel assume roles through OIDC). Lint with `cfn-lint infra/*.yaml`.
The Lambda entry point and the rate limiter live in `apps/ai` (`app/lambda_handler.py`,
`app/rate_limit.py`, `Dockerfile.lambda`).
