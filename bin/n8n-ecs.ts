#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { EfsStack } from '../lib/efs-stack';
import { EcsStack } from '../lib/ecs-stack';

const app = new cdk.App();

const vpcStack = new VpcStack(app, 'N8nVpcStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

const efsStack = new EfsStack(app, 'N8nEfsStack', {
  vpc: vpcStack.vpc,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

new EcsStack(app, 'N8nEcsStack', {
  vpc: vpcStack.vpc,
  fileSystem: efsStack.fileSystem,
  accessPoint: efsStack.accessPoint,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});