#!/usr/bin/env bash
set -euo pipefail

export AWS_REGION=us-east-1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"
PROJECT_NAME="hello-world-runner-pat"
REPO="nikhilpenmetsa/codebuild-github-runner-pat"

echo "==> Installing dependencies..."
cd "$INFRA_DIR"
npm ci

# Phase 1: Create the project without webhook or VPC
echo "==> Phase 1: Creating CodeBuild project (no webhook, no VPC)..."
npx cdk deploy RunnerStackPat --require-approval never \
  --context useVpc=false --context webhook=false

# Phase 2: Create webhook with manualCreation, then register on GitHub
echo "==> Phase 2: Creating webhook (manual mode)..."
WEBHOOK_OUTPUT=$(aws codebuild create-webhook \
  --project-name "$PROJECT_NAME" \
  --filter-groups '[[{"type":"EVENT","pattern":"WORKFLOW_JOB_QUEUED"}]]' \
  --manual-creation 2>&1)

PAYLOAD_URL=$(echo "$WEBHOOK_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['webhook']['payloadUrl'])")
SECRET=$(echo "$WEBHOOK_OUTPUT" | python3 -c "import sys,json; print(json.load(sys.stdin)['webhook']['secret'])")

echo "==> Registering webhook on GitHub repo ($REPO)..."
gh api "repos/$REPO/hooks" --method POST --input - <<EOF
{
  "name": "web",
  "active": true,
  "events": ["workflow_job"],
  "config": {
    "url": "$PAYLOAD_URL",
    "content_type": "json",
    "secret": "$SECRET",
    "insecure_ssl": "0"
  }
}
EOF

# Phase 3: Add VPC to the project
echo "==> Phase 3: Adding VPC (private subnets with egress)..."
npx cdk deploy RunnerStackPat --require-approval never --context webhook=false

echo "==> Done. CodeBuild project '$PROJECT_NAME' deployed with VPC and webhook."
