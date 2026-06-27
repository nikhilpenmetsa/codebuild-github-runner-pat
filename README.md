# CodeBuild GitHub Actions Runner (PAT variant)

Self-hosted GitHub Actions runner on AWS CodeBuild, authenticated via a Personal Access Token (PAT) instead of AWS CodeConnections.

## Why this exists

AWS CodeConnections does not yet support GitHub Enterprise Cloud with data residency (`.ghe.com` domains). This project uses `GitHubEnterpriseSourceCredentials` with a classic PAT to register the webhook and clone the repo — no CodeConnections required.

For standard GitHub.com repos where CodeConnections works, see: [codebuild-github-runner](https://github.com/nikhilpenmetsa/codebuild-github-runner)

## Prerequisites

- AWS account with CDK bootstrapped
- Secrets Manager secret `codebuild/github-pat` containing a classic PAT with scopes: `repo`, `admin:repo_hook`, `read:org`
- A VPC with private subnets and NAT egress (looked up by tag `Name: *NetworkStack*`)

## Deploy

```bash
./deploy.sh
```

Or manually:

```bash
cd infra
npm ci
AWS_REGION=us-east-1 npx cdk deploy RunnerStackPat --require-approval never
```

## Architecture

1. **RunnerStackPat** creates a CodeBuild project in your VPC (private subnets with NAT egress) with a GitHub Enterprise webhook (filter: `WORKFLOW_JOB_QUEUED`).
2. On push to `main`, the GitHub Actions workflow triggers — GitHub sends the webhook to CodeBuild.
3. CodeBuild spins up an ARM64 runner in your AWS account and executes the workflow steps.

## Adapting for GHE data residency

Change the `httpsCloneUrl` in `lib/runner-stack-pat.ts`:

```typescript
source: codebuild.Source.gitHubEnterprise({
  httpsCloneUrl: 'https://your-org.ghe.com/org/repo.git',
  ...
})
```

Everything else stays the same.
