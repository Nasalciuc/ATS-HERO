# infra/ — AWS for ATS Hero (not deployed yet)

Infrastructure as code for the AWS side. Nothing in this folder runs on its own: the stacks are
created by hand, phase by phase (F0–F5 in `CURSOR-AWS-INFRA.md`), and no workflow watches it yet.

| File | Stack / use |
|---|---|
| `foundation.yaml` | `atshero-foundation`: GitHub and Vercel OIDC roles, the `atshero-app-boundary` permissions boundary, artifacts bucket, ECR repository, budget and cost-anomaly alerts, CloudTrail, GuardDuty, Access Analyzer |
| `data.yaml` | `atshero-data`: RDS PostgreSQL 16 (`db.t4g.micro`, TLS, 14-day PITR), backups bucket, daily cleanup of manual snapshots |
| `template.yaml` | `atshero-dev` / `atshero-prod`: HTTP API with the Clerk JWT authorizer, the Python API on Lambda (arm64), per-user rate limit (DynamoDB), dashboard, alarms; workers and assets only when enabled |
| `scripts/inventory.sh` | read-only inventory of the account; prints no secrets and changes nothing |
| `github/infra-deploy.yml` | the deploy workflow; kept here, inactive, until F3 moves it to `.github/workflows/` (`git mv`) |

Rules: `us-east-1` only, tag `project=atshero` on everything, no NAT Gateway, no access keys in the
repo (GitHub and Vercel assume roles through OIDC). Lint with `cfn-lint infra/*.yaml`.
Manual RDS snapshots (the one taken before a production migration) are deleted within 30 days: the
privacy page promises it. The `atshero-snapshot-cleanup` job in `data.yaml` runs every day and deletes
them at 28 days, but only those tagged `project=atshero`. The instance copies its tags to a snapshot
unless the snapshot gets tags of its own, so don't pass `--tags` to `aws rds create-db-snapshot`.
A snapshot the job can't delete fails the run, and the alarm e-mails you. Deploying `atshero-data`
needs `--capabilities CAPABILITY_IAM` (the job's role). If that stack is ever deleted, the final
snapshot it leaves behind is not covered: delete it by hand within 30 days.
The Lambda entry point and the rate limiter live in `apps/ai` (`app/lambda_handler.py`,
`app/rate_limit.py`, `Dockerfile.lambda`).
