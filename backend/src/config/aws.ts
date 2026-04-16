import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SESClient } from '@aws-sdk/client-ses';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';

dotenv.config();

const region = process.env.AWS_REGION || 'us-east-1';

// Use credential chain for local dev ( ~/.aws/credentials ) and AWS runtime
const credentials = fromNodeProviderChain();

export const s3Client = new S3Client({
  region,
  credentials,
});

export const snsClient = new SNSClient({
  region,
  credentials,
});

export const sesClient = new SESClient({
  region,
  credentials,
});

export const RAW_DATA_BUCKET = process.env.S3_RAW_DATA_BUCKET || 'athletiq-raw-data';
export const MODELS_BUCKET = process.env.S3_MODELS_BUCKET || 'athletiq-models';
export const SNS_TOPIC_ARN = process.env.AWS_SNS_TOPIC_ARN || '';
export const SES_FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || '';
