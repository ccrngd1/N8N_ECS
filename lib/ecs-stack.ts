import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  fileSystem: efs.FileSystem;
  accessPoint: efs.AccessPoint;
}

export class EcsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    // Create ECS Cluster
    const cluster = new ecs.Cluster(this, 'N8nCluster', {
      vpc: props.vpc,
      containerInsights: true,
    });

    // Create Task Role
    const taskRole = new iam.Role(this, 'N8nTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Add EFS permissions to Task Role
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'elasticfilesystem:ClientMount',
          'elasticfilesystem:ClientWrite',
          'elasticfilesystem:ClientRootAccess',
        ],
        resources: [props.fileSystem.fileSystemArn],
      })
    );

    // Create Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'N8nTaskDef', {
      memoryLimitMiB: 2048,
      cpu: 1024,
      taskRole,
    });

    // Add EFS volume to task definition
    taskDefinition.addVolume({
      name: 'n8n-data',
      efsVolumeConfiguration: {
        fileSystemId: props.fileSystem.fileSystemId,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: props.accessPoint.accessPointId,
          iam: 'ENABLED',
        },
      },
    });

    // Create container definition
    const container = taskDefinition.addContainer('n8n', {
      image: ecs.ContainerImage.fromRegistry('n8nio/n8n'),
      environment: {
        N8N_BASIC_AUTH_ACTIVE: 'true',
        //N8N_PROTOCOL: 'https',
        N8N_PROTOCOL: 'http',
        N8N_PORT: '5678',
        N8N_SECURE_COOKIE: 'false',
        DB_TYPE: 'sqlite',
        DB_SQLITE_PATH: '/home/node/.n8n/database.sqlite',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'n8n' }),
    });

    // Add port mapping
    container.addPortMappings({
      containerPort: 5678,
      protocol: ecs.Protocol.TCP,
    });

    // Mount EFS volume
    container.addMountPoints({
      sourceVolume: 'n8n-data',
      containerPath: '/home/node/.n8n',
      readOnly: false,
    });

    // Create ALB Security Group
    const albSg = new ec2.SecurityGroup(this, 'N8nAlbSg', {
      vpc: props.vpc,
      description: 'Security group for N8N ALB',
      allowAllOutbound: true,
    });

    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      'Allow HTTP traffic'
    );
    albSg.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(5678),
      'Allow HTTP traffic'
    );

    // Create ALB
    const alb = new elbv2.ApplicationLoadBalancer(this, 'N8nAlb', {
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSg,
    });

    // Create Target Group
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'N8nTargetGroup', {
      vpc: props.vpc,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 5678,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        healthyHttpCodes: '200',
      },
    });

    // Add listener - allows public access
    alb.addListener('HttpListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Create Fargate Service
    const service = new ecs.FargateService(this, 'N8nService', {
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: false,
      capacityProviderStrategies: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 1,
        },
      ],
      securityGroups: [
        new ec2.SecurityGroup(this, 'N8nServiceSg', {
          vpc: props.vpc,
          description: 'Security group for N8N Fargate service',
          allowAllOutbound: true,
        }),
      ],
    });

    // Allow inbound from ALB
    service.connections.allowFrom(
      alb,
      ec2.Port.tcp(5678),
      'Allow inbound from ALB'
    );

    // Add service to target group
    targetGroup.addTarget(service);

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Load Balancer DNS Name',
      exportName: 'N8nLoadBalancerDNS',
    });

    // Add auto scaling
    const scaling = service.autoScaleTaskCount({
      minCapacity: 0,  // Allow scaling to zero
      maxCapacity: 2,  // Or whatever maximum you want
    });

    // Add scaling policy based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Optional: Add scaling policy based on memory utilization
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 50,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });
  }
}