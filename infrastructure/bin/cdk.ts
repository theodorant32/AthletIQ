#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AthletiqStack } from '../lib/athletiq-stack';

const app = new cdk.App();

new AthletiqStack(app, 'AthletiqStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'AthletIQ - Personal Athletic Intelligence Platform',
});

app.synth();
