#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RunnerStackPat } from '../lib/runner-stack-pat';

const app = new cdk.App();

new RunnerStackPat(app, 'RunnerStackPat', {
  env: { account: '986112483391', region: 'us-east-1' },
});
