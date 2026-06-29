# CodeBuild GitHub Actions Runner (PAT variant)

Self-hosted GitHub Actions runner on AWS CodeBuild, authenticated via a Personal Access Token (PAT) instead of AWS CodeConnections.

## Why this exists

[AWS CodeConnections does not yet support GitHub Enterprise Cloud with data residency](https://docs.aws.amazon.com/dtconsole/latest/userguide/supported-versions-connections.html#:~:text=AWS%20CodeConnections%20does%20not%20yet%20support%20GitHub%20Enterprise%20Cloud%20with%20data%20residency%20(custom%20*.ghe.com%20domains)) (`.ghe.com` domains). This project uses `GitHubEnterpriseSourceCredentials` with a classic PAT to register the webhook and clone the repo — no CodeConnections required.

For standard GitHub.com repos where CodeConnections works, see: [codebuild-github-runner](https://github.com/nikhilpenmetsa/codebuild-github-runner)

## Prerequisites

- AWS account with CDK bootstrapped in the target region
- Secrets Manager secret `codebuild/github-pat` containing a classic PAT with scopes: `repo`, `admin:repo_hook`, `read:org`
- A VPC with private subnets and NAT egress (looked up by tag `Name: *NetworkStack*`)
- [`gh` CLI](https://cli.github.com/) authenticated (used to register the webhook on GitHub)

## Deploy

```bash
./deploy.sh
```

The script runs three phases:

1. **CDK deploy** — creates the CodeBuild project with GHE source credentials, placed in VPC private subnets. Webhook is *not* created by CDK (auto-creation fails — see gotchas below).
2. **CodeBuild webhook** — calls `aws codebuild create-webhook --manual-creation` to get a payload URL and secret. Manual mode tells CodeBuild not to call GitHub itself (needed because CodeBuild's auto-creation doesn't work for GHE source on github.com).
3. **GitHub webhook** — registers the payload URL on the repo via `gh api`, listening for `workflow_job` events.

## Architecture

1. **RunnerStackPat** creates a CodeBuild project in your VPC (private subnets with NAT egress) with a `GITHUB_ENTERPRISE` source credential (separate slot from the `GITHUB`/CodeConnections credential, so they coexist).
2. On push to `main`, GitHub sends a `workflow_job.queued` event to the CodeBuild webhook URL.
3. CodeBuild spins up an ephemeral runner in your AWS account and executes the workflow steps.

## Adapting for GHE data residency

Change the `httpsCloneUrl` in `lib/runner-stack-pat.ts`:

```typescript
source: codebuild.Source.gitHubEnterprise({
  httpsCloneUrl: 'https://your-org.ghe.com/org/repo.git',
  ...
})
```

Additionally:

- The PAT must be issued from the GHE instance (not github.com)
- The `gh api` webhook registration in `deploy.sh` needs `--hostname your-org.ghe.com`

The runner registration uses the GHE Server API path (`https://HOSTNAME/api/v3/...`) which is correct for `.ghe.com` domains.

## Deployment gotchas

- **Webhook auto-creation fails for `GITHUB_ENTERPRISE` source on github.com** — CDK's `webhook: true` triggers CloudFormation to call `CreateWebhook`, which fails with different errors depending on whether VPC is attached ("Failed to create vpc connection for webhook") or not ("GitHub webhook limit reached" with 0 existing webhooks). The workaround is `--manual-creation` via CLI, then registering the webhook on GitHub yourself. Real `.ghe.com` servers may not hit this.
- **CDK deploys with `webhook=false` will remove an existing webhook** — that's why the deploy script creates the webhook *after* the final CDK deploy, not between deploys.
