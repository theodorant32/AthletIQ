import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class AthletiqStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for RDS and Lambda
    const vpc = new ec2.Vpc(this, 'AthletiqVpc', {
      maxAzs: 2,
      natGateways: 1, // Single NAT for free tier
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // S3 Buckets
    const rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
      bucketName: `athletiq-raw-data-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
          ],
        },
      ],
    });

    const modelsBucket = new s3.Bucket(this, 'ModelsBucket', {
      bucketName: `athletiq-models-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    // RDS PostgreSQL
    const database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      allocatedStorage: 20, // Free tier max
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      databaseName: 'athletiq',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SNS Topic for alerts
    const alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      displayName: 'AthletIQ Alerts',
    });

    // Lambda functions
    const ingestionLambda = new lambda.Function(this, 'IngestionLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/dist/lambda'),
      environment: {
        DATABASE_SECRET_ARN: database.secret!.secretArn,
        RAW_DATA_BUCKET: rawDataBucket.bucketName,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });

    const dailyAggregationLambda = new lambda.Function(this, 'DailyAggregationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../backend/dist/lambda'),
      environment: {
        DATABASE_SECRET_ARN: database.secret!.secretArn,
      },
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'AthletiqApi', {
      restApiName: 'AthletIQ API',
      deployOptions: {
        stageName: 'prod',
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
    });

    // Webhook endpoints
    const webhooks = api.root.addResource('webhooks');
    const garminResource = webhooks.addResource('garmin');
    const stravaResource = webhooks.addResource('strava');

    garminResource.addMethod('POST', new apigateway.LambdaIntegration(ingestionLambda));
    stravaResource.addMethod('POST', new apigateway.LambdaIntegration(ingestionLambda));

    // EventBridge rules
    const dailyRule = new events.Rule(this, 'DailyAggregationRule', {
      schedule: events.Schedule.cron({
        hour: '6',
        minute: '0',
      }),
    });
    dailyRule.addTarget(new targets.LambdaFunction(dailyAggregationLambda));

    // Permissions
    database.secret!.grantRead(ingestionLambda);
    database.secret!.grantRead(dailyAggregationLambda);
    rawDataBucket.grantReadWrite(ingestionLambda);
    modelsBucket.grantReadWrite(ingestionLambda);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.dbInstanceEndpointAddress,
      description: 'RDS Database Endpoint',
    });

    new cdk.CfnOutput(this, 'RawDataBucket', {
      value: rawDataBucket.bucketName,
      description: 'S3 Bucket for Raw Activity Data',
    });
  }
}
