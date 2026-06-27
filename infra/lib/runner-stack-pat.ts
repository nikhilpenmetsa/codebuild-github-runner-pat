import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class RunnerStackPat extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const useVpc = this.node.tryGetContext('useVpc') !== 'false';
    const useWebhook = this.node.tryGetContext('webhook') !== 'false';

    const vpc = useVpc
      ? ec2.Vpc.fromLookup(this, 'Vpc', { tags: { Name: '*NetworkStack*' } })
      : undefined;

    const pat = secretsmanager.Secret.fromSecretNameV2(
      this, 'GitHubPat', 'codebuild/github-pat'
    );

    new codebuild.GitHubEnterpriseSourceCredentials(this, 'GheCredentials', {
      accessToken: pat.secretValue,
    });

    const project = new codebuild.Project(this, 'RunnerProject', {
      projectName: 'hello-world-runner-pat',
      source: codebuild.Source.gitHubEnterprise({
        httpsCloneUrl: 'https://github.com/nikhilpenmetsa/codebuild-github-runner-pat.git',
        webhook: useWebhook,
        ...(useWebhook && {
          webhookFilters: [
            codebuild.FilterGroup.inEventOf(
              codebuild.EventAction.WORKFLOW_JOB_QUEUED
            ),
          ],
        }),
      }),
      environment: {
        buildImage: codebuild.LinuxArmBuildImage.AMAZON_LINUX_2_STANDARD_3_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      ...(vpc && {
        vpc,
        subnetSelection: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      }),
    });

    project.addToRolePolicy(new iam.PolicyStatement({
      actions: ['sts:AssumeRole'],
      resources: ['arn:aws:iam::986112483391:role/cdk-hnb659fds-*'],
    }));
  }
}
