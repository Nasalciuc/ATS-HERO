#!/usr/bin/env bash
# ATS Hero - read-only AWS inventory (Phase 0). Run it in YOUR terminal, logged in with
# `aws sso login` (or the current profile). It only reads: no create/update/delete calls, and it
# prints no secrets (no passwords, no secret keys, no full access-key IDs, no secret ARNs).
# Paste the output back for the design review.
set -uo pipefail
R="${AWS_REGION:-us-east-1}"
say() { printf '\n== %s\n' "$1"; }
run() { "$@" 2>&1 | sed 's/^/  /' || true; }
hide_secrets() { sed -E 's#arn:aws:secretsmanager:[^[:space:]]+#(secret ARN hidden)#g'; }

say "identity"
run aws sts get-caller-identity --query '{account:Account, arn:Arn}' --output table

say "free-tier plan (FREE/PAID, status, credits left, expiry)"
run aws freetier get-account-plan-state --region us-east-1 --output table

say "AWS Organizations and IAM Identity Center (an error = none yet)"
run aws organizations describe-organization --query 'Organization.{id:Id,managementAccount:MasterAccountId,featureSet:FeatureSet}' --output table
run aws sso-admin list-instances --region "$R" --query 'Instances[].{arn:InstanceArn,status:Status,owner:OwnerAccountId}' --output table

say "everything tagged project=atshero"
aws resourcegroupstaggingapi get-resources --region "$R" --tag-filters Key=project,Values=atshero \
  --query 'ResourceTagMappingList[].ResourceARN' --output text 2>&1 | tr '\t' '\n' | hide_secrets | sed 's/^/  /'

say "RDS instances (everything an import into atshero-data has to match)"
run aws rds describe-db-instances --region "$R" --query 'DBInstances[].{id:DBInstanceIdentifier,class:DBInstanceClass,version:EngineVersion,autoMinor:AutoMinorVersionUpgrade,public:PubliclyAccessible,multiAZ:MultiAZ,storage:StorageType,storageGB:AllocatedStorage,maxStorageGB:MaxAllocatedStorage,encrypted:StorageEncrypted,backupDays:BackupRetentionPeriod,backupWindow:PreferredBackupWindow,maintenance:PreferredMaintenanceWindow,iamAuth:IAMDatabaseAuthenticationEnabled,deletionProtection:DeletionProtection,managedPassword:MasterUserSecret!=`null`,ca:CACertificateIdentifier,status:DBInstanceStatus}' --output json
run aws rds describe-db-instances --region "$R" --query 'DBInstances[].{id:DBInstanceIdentifier,parameterGroups:DBParameterGroups[].DBParameterGroupName,subnetGroup:DBSubnetGroup.DBSubnetGroupName,vpc:DBSubnetGroup.VpcId,securityGroups:VpcSecurityGroups[].VpcSecurityGroupId}' --output json
run aws rds describe-db-snapshots --region "$R" --snapshot-type manual --query 'DBSnapshots[].{id:DBSnapshotIdentifier,created:SnapshotCreateTime}' --output table

say "network: the default VPC and its subnets (atshero-data uses them; no NAT)"
run aws ec2 describe-vpcs --region "$R" --filters Name=isDefault,Values=true --query 'Vpcs[].VpcId' --output text
run aws ec2 describe-subnets --region "$R" --filters Name=default-for-az,Values=true --query 'Subnets[].{id:SubnetId,az:AvailabilityZone}' --output table
run aws ec2 describe-nat-gateways --region "$R" --query 'NatGateways[?State!=`deleted`].NatGatewayId' --output text

say "S3 buckets (names only)"
run aws s3api list-buckets --query 'Buckets[].Name' --output text

say "SES"
run aws sesv2 get-account --region "$R" --query '{productionAccess:ProductionAccessEnabled,sendingEnabled:SendingEnabled,status:EnforcementStatus}' --output table
run aws sesv2 list-email-identities --region "$R" --query 'EmailIdentities[].{identity:IdentityName,type:IdentityType,verified:VerificationStatus}' --output table

say "money and alerts: budgets, cost anomaly monitors, SNS topics, alarms"
ACC=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
run aws budgets describe-budgets --account-id "$ACC" --query 'Budgets[].{name:BudgetName,limit:BudgetLimit.Amount}' --output table
echo "  (only one 'AWS services' monitor can exist; if one is listed, F1 passes its ARN)"
run aws ce get-anomaly-monitors --region us-east-1 --query 'AnomalyMonitors[].{arn:MonitorArn,name:MonitorName,type:MonitorType,dimension:MonitorDimension}' --output table
run aws sns list-topics --region "$R" --query 'Topics[].TopicArn' --output text
run aws cloudwatch describe-alarms --region "$R" --query 'MetricAlarms[].{name:AlarmName,state:StateValue}' --output table

say "the account's watch: CloudTrail trails, GuardDuty, IAM Access Analyzer (F1 creates any that is missing)"
run aws cloudtrail describe-trails --region "$R" --query 'trailList[].{name:Name,multiRegion:IsMultiRegionTrail,homeRegion:HomeRegion,bucket:S3BucketName}' --output table
run aws guardduty list-detectors --region "$R" --query 'DetectorIds' --output text
run aws accessanalyzer list-analyzers --region "$R" --query 'analyzers[].{name:name,type:type,status:status}' --output table

say "IAM: users and their access keys (status and age only), atshero roles, OIDC providers"
for u in $(aws iam list-users --query 'Users[].UserName' --output text 2>/dev/null); do
  echo "  user: $u"
  run aws iam list-access-keys --user-name "$u" --query 'AccessKeyMetadata[].{status:Status,created:CreateDate}' --output table
done
run aws iam list-roles --query "Roles[?starts_with(RoleName, 'atshero')].RoleName" --output text
run aws iam list-policies --scope Local --query "Policies[?starts_with(PolicyName, 'atshero')].PolicyName" --output text
run aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text

say "compute: Lambda, ECR, App Runner, CloudFormation"
run aws lambda list-functions --region "$R" --query 'Functions[].{name:FunctionName,runtime:Runtime,type:PackageType}' --output table
run aws ecr describe-repositories --region "$R" --query 'repositories[].repositoryName' --output text
echo "  (App Runner is closed to new customers: an error here means this account can't use it)"
run aws apprunner list-services --region "$R" --query 'ServiceSummaryList[].{name:ServiceName,status:Status}' --output table
run aws cloudformation list-stacks --region "$R" --query 'StackSummaries[?StackStatus!=`DELETE_COMPLETE`].{name:StackName,status:StackStatus}' --output table

say "done - nothing was changed"
