import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import { Construct } from 'constructs';

interface EfsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class EfsStack extends cdk.Stack {
  public readonly fileSystem: efs.FileSystem;
  public readonly accessPoint: efs.AccessPoint;

  constructor(scope: Construct, id: string, props: EfsStackProps) {
    super(scope, id, props);

    // Create security group for EFS
    const efsSecurityGroup = new ec2.SecurityGroup(this, 'EfsSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for N8N EFS',
      allowAllOutbound: true,
    });

    // Allow NFS inbound from private subnets
    efsSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(2049),
      'Allow NFS access from within VPC'
    );

    // Create EFS file system
    this.fileSystem = new efs.FileSystem(this, 'N8nFileSystem', {
      vpc: props.vpc,
      securityGroup: efsSecurityGroup,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: efs.ThroughputMode.BURSTING,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Create access point for n8n
    this.accessPoint = this.fileSystem.addAccessPoint('N8nAccessPoint', {
      path: '/n8n-data',
      createAcl: {
        ownerGid: '1000',
        ownerUid: '1000',
        permissions: '755',
      },
      posixUser: {
        gid: '1000',
        uid: '1000',
      },
    });

    // Output the EFS ID and Access Point ID
    new cdk.CfnOutput(this, 'EfsId', {
      value: this.fileSystem.fileSystemId,
      description: 'EFS File System ID',
      exportName: 'N8nEfsId',
    });

    new cdk.CfnOutput(this, 'EfsAccessPointId', {
      value: this.accessPoint.accessPointId,
      description: 'EFS Access Point ID',
      exportName: 'N8nEfsAccessPointId',
    });
  }
}