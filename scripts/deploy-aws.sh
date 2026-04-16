#!/bin/bash
# AthletIQ AWS Deployment Script

set -e

echo "========================================"
echo "  AthletIQ AWS Deployment"
echo "========================================"
echo ""

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not installed"
    exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo "Error: AWS CDK not installed"
    echo "Install with: npm install -g aws-cdk"
    exit 1
fi

# Get AWS account and region
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)

echo "AWS Account: $AWS_ACCOUNT"
echo "AWS Region:  $AWS_REGION"
echo ""

# Deploy infrastructure
echo "Deploying AWS infrastructure..."
cd infrastructure

npm install
npx cdk bootstrap aws://${AWS_ACCOUNT}/${AWS_REGION}
npx cdk deploy --all --require-approval never

# Get outputs
API_URL=$(aws cloudformation describe-stacks --stack-name AthletiqStack --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
DB_ENDPOINT=$(aws cloudformation describe-stacks --stack-name AthletiqStack --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" --output text)
S3_BUCKET=$(aws cloudformation describe-stacks --stack-name AthletiqStack --query "Stacks[0].Outputs[?OutputKey=='RawDataBucket'].OutputValue" --output text)

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "API URL:      https://${API_URL}"
echo "Database:     ${DB_ENDPOINT}"
echo "S3 Bucket:    ${S3_BUCKET}"
echo ""

# Create .env.production
echo "Creating production environment file..."
cat > ../backend/.env.production << EOF
DATABASE_HOST=${DB_ENDPOINT%:*}
DATABASE_PORT=5432
DATABASE_NAME=athletiq
DATABASE_USER=postgres
AWS_REGION=${AWS_REGION}
S3_RAW_DATA_BUCKET=${S3_BUCKET}
API_URL=${API_URL}
EOF

echo "Environment file created at backend/.env.production"
echo ""
echo "Next steps:"
echo "1. Configure your Strava app webhook to: https://${API_URL}webhooks/strava"
echo "2. Add your Anthropic API key for the chatbot"
echo "3. Deploy backend Lambda functions"
echo "4. Deploy frontend to Vercel or Amplify"
