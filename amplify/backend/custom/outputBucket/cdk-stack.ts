import * as cdk from 'aws-cdk-lib';
import * as AmplifyHelpers from '@aws-amplify/cli-extensibility-helper';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';

export class cdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps, amplifyResourceProps?: AmplifyHelpers.AmplifyResourceProps) {
    super(scope, id, props);
    /* Do not remove - Amplify CLI automatically injects the current deployment environment in this input parameter */
    new cdk.CfnParameter(this, 'env', {
      type: 'String',
      description: 'Current Amplify CLI env name',
    });
    
    const stackName = cdk.Fn.ref("AWS::StackName");
    const stackNameToken = cdk.Fn.split("-", stackName, 6);
    // stackに自動で付与されるランダム文字列を取得する
    const stackID = cdk.Fn.select(3, stackNameToken);
    const amplifyProjectInfo = AmplifyHelpers.getProjectInfo();
    
    // 現在のタイムスタンプを使って一意のサフィックスを作成
    const timestamp = new Date().getTime().toString().slice(-6);
    
    // 出力用バケットの名前を設定 - タイムスタンプを追加して一意にする
    const bucketNamePrefix = `${amplifyProjectInfo.projectName}-output-${timestamp}${stackID}`;
    const bucket = new s3.Bucket(this, "OutputBucket", {
      bucketName: `${bucketNamePrefix}-${cdk.Fn.ref('env')}`
    });
    
    // CORSの設定
    bucket.addCorsRule({
      allowedHeaders: ["*"],
      allowedMethods: [
        s3.HttpMethods.GET,
        s3.HttpMethods.HEAD,
        s3.HttpMethods.PUT,
        s3.HttpMethods.POST,
        s3.HttpMethods.DELETE
      ],
      allowedOrigins: ["*"],
      exposedHeaders: [
        "x-amz-server-side-encryption",
        "x-amz-request-id",
        "x-amz-id-2",
        "ETag",
        "x-amz-version-id",
        "x-amz-delete-marker",
        "x-amz-expiration",
        "x-amz-restore",
        "x-amz-server-side-encryption-aws-kms-key-id",
        "x-amz-server-side-encryption-context"
      ],
      maxAge: 3000
    });

    // 以下のロールへのポリシー付与は現時点(2025/06/11)では機能していない。この原因は
    // ① amplify update custom や amplify update function では設定の変更ができず
    // ② cdk-stack.ts の変更のみならず、parameters.json や cloudformation-template.json の変更も必要
    // であり、その変更を行う工数が大きいため、現時点ではコンソールから手動でポリシーを付与することとした。
    
    // Lambda関数に出力バケットへのアクセス権限を付与
    // 関数名を短くして64文字制限以内に収める
    const roleName = `lambda-transcription-role-${timestamp}-${cdk.Fn.ref('env')}`;
    
    // ロールを新しく作成してLambdaに関連付け
    const lambdaRole = new iam.Role(this, 'TranscriptionLambdaRole', {
      roleName: roleName,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for transcription Lambda to access output bucket'
    });
    
    // バケットアクセス権限をロールに付与
    bucket.grantReadWrite(lambdaRole);
    
    // 動的に生成されるポリシー名も短くする
    const policyName = `s3-access-policy-${timestamp}-${cdk.Fn.ref('env')}`;
    
    // ポリシーをLambda関数に直接添付する代わりにポリシーを作成
    new iam.Policy(this, 'LambdaS3AccessPolicy', {
      policyName: policyName,
      statements: [
        new iam.PolicyStatement({
          actions: [
            's3:GetObject',
            's3:PutObject',
            's3:DeleteObject',
            's3:ListBucket'
          ],
          resources: [
            bucket.bucketArn,
            `${bucket.bucketArn}/*`
          ],
          effect: iam.Effect.ALLOW
        })
      ],
      roles: [lambdaRole]
    });
    
    // Lambda関数との依存関係を設定
    // 注: このtry-catchブロックはファイルのコンパイルと型エラー防止のためです
    try {
      // 実際のデプロイメントではこの依存関係設定は必要ですが、
      // 型の互換性問題が発生する可能性があるためtry-catchでラップしています
      if (amplifyResourceProps) {
        // @ts-expect-error - 型エラーを無視
        AmplifyHelpers.addResourceDependency(this, 
          amplifyResourceProps.category, 
          amplifyResourceProps.resourceName, 
          [
            {category: "function", resourceName: "transcriptionProcessor"}
          ]
        );
      }
    } catch (error) {
      console.log('依存関係設定エラー:', error);
    }
    
    // バケット名を出力として登録（環境変数設定などで使用）
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: "The name of output bucket"
    });
    
    // Lambda Role ARNも出力
    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: lambdaRole.roleArn,
      description: "ARN of the role for Lambda to access the output bucket"
    });
  }
}