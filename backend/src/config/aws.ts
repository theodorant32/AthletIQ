import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SESClient } from '@aws-sdk/client-ses';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Credential chain: environment -> SSO -> instance profile
const credentials = fromNodeProviderChain();

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials,
});

const snsClient = new SNSClient({
  region: AWS_REGION,
  credentials,
});

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials,
});

export {
  s3Client,
  snsClient,
  sesClient,
  AWS_REGION,
};

export const BUCKETS = {
  RAW_DATA: process.env.S3_RAW_DATA_BUCKET || 'athletiq-raw-data',
  MODELS: process.env.S3_MODELS_BUCKET || 'athletiq-models',
} as const;

export const ALERTS = {
  SNS_TOPIC_ARN: process.env.AWS_SNS_TOPIC_ARN || '',
  SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL || '',
} as const;
