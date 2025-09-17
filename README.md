# N8N on AWS ECS Fargate

This project deploys n8n workflow automation platform on AWS using containerized infrastructure with AWS CDK.

## Architecture

The solution includes:
- VPC with public and private subnets
- ECS Fargate cluster using SPOT instances
- EFS for persistent storage
- Application Load Balancer for traffic distribution
- Secure network configuration
- Basic authentication enabled
- SQLite database stored on EFS

## Prerequisites

1. Node.js (v14 or later)
2. AWS CLI configured with appropriate credentials
3. AWS CDK CLI installed (`npm install -g aws-cdk`)
4. TypeScript (`npm install -g typescript`)
5. An SSL certificate in AWS Certificate Manager (for HTTPS)

## Project Structure

```
n8n-ecs/
├── bin/
│   └── n8n-ecs.ts
├── lib/
│   ├── vpc-stack.ts
│   ├── efs-stack.ts
│   └── ecs-stack.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Deployment Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   export CDK_DEFAULT_ACCOUNT=your-aws-account-id
   export CDK_DEFAULT_REGION=your-aws-region
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Deploy the stacks:
   ```bash
   cdk deploy --all
   ```

## Configuration

The n8n instance is configured with:
- Basic authentication enabled
- HTTPS protocol
- Port 5678
- SQLite database stored on EFS
- EFS mount point at /root/.n8n

## Security

- The n8n container runs in private subnets
- ALB is in public subnets
- All data is stored on EFS with encryption at rest
- Basic authentication is enabled
- HTTPS is enforced

## Clean Up

To remove all resources:
```bash
cdk destroy --all
```

Note: The EFS file system is retained by default to prevent accidental data loss. To delete it, modify the removal policy in the EFS stack.

## Environment Variables

Key environment variables for n8n:
```
N8N_BASIC_AUTH_ACTIVE=true
N8N_PROTOCOL=https
N8N_PORT=5678
DB_TYPE=sqlite
DB_SQLITE_PATH=/home/node/.n8n
```

## Important Notes

1. Before deploying publicly, make sure to:
   - Configure an SSL certificate in AWS Certificate Manager
   - Update the certificate ARN in the ECS stack
   - Set up basic authentication credentials

2. The solution uses Fargate SPOT instances for cost optimization. For production workloads, consider using a mix of SPOT and regular Fargate instances.

3. Backup strategies for the EFS volume should be implemented based on your requirements.