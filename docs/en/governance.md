---
id: governance
title: Governance: Organizations, Config, CloudTrail, SSM, Backup
order: 21
svc: [Organizations, Control Tower, Config, CloudTrail, CloudWatch, Systems Manager, Backup, CloudFormation]
---

# Governance and observability

This block covers how to keep the landscape under control: account structure, logging,
compliance, operational automation, and backup.

## Organizations and Control Tower

Organizations groups accounts into an OU tree with a consolidated bill, SCPs, and shared
services (a CloudTrail organization trail, a Config aggregator, RAM). Consolidated
billing gives volume discounts and shared Reserved Instances and Savings Plans across
the whole organization — the standard answer to "lower the combined cost across several
accounts."

Control Tower deploys a landing zone: OUs by purpose, log archive and audit accounts,
guardrails (preventive ones built on SCPs, detective ones built on Config), and Account
Factory for issuing new accounts to a standard. The phrase "new accounts must
automatically comply" points to Control Tower, not manual policies.

## CloudTrail

A log of API calls: who, when, from where, with what parameters. Management events are
written to Event history for free and kept for 90 days; for longer retention you create
a trail into S3 — ideally an organization trail, in a separate account, with file
integrity validation and KMS encryption turned on. Data events (operations on S3
objects, Lambda invocations) aren't logged by default and have to be enabled
separately — a detail that frequently shows up as "we can't see who deleted the
object."

CloudTrail Lake stores events and lets you query them with a SQL-like language;
integration with Athena solves the same problem on top of S3.

## Config

Records resource configuration over time and evaluates it against rules: "volumes must
be encrypted," "buckets must not be public," "instances must have an Owner tag." It can
auto-remediate through SSM Automation. Conformance packs bundle rule sets for standards,
and an aggregator rolls up the picture across all accounts and Regions.

The difference from CloudTrail: CloudTrail answers "who did this," Config answers "what
state is the resource in now, and what was it before." The difference from preventive
control: Config detects a violation after the fact, while SCPs and secure defaults stop
it from happening at all.

## CloudWatch

- metrics (standard and custom), alarms, composite alarms;
- Logs: log groups, streams, metric filters on text patterns, Logs Insights for queries,
  subscriptions for streaming delivery to Firehose or Lambda;
- the CloudWatch agent collects memory, disk, and log data from EC2 and on-premises
  servers;
- dashboards, Container Insights, Lambda Insights, Application Signals;
- EventBridge (formerly CloudWatch Events) reacts to events and schedules.

An alarm with an action — an SNS notification, Auto Scaling, instance recovery, a Lambda
invocation through EventBridge — is the standard answer to "react automatically."

## Systems Manager

A toolset for operations: Session Manager (access without SSH or a bastion), Patch
Manager (maintenance windows and patch reports), Run Command, State Manager, Automation
(runbooks), Inventory, Parameter Store, Fleet Manager. It works on both EC2 and
on-premises servers through an agent.

Three answers that come up constantly: secure access to instances — Session Manager;
centralized OS updates — Patch Manager; configuration storage — Parameter Store.

## AWS Backup

Centralized backup policies for EBS, EC2, RDS, Aurora, DynamoDB, EFS, FSx, Storage
Gateway, S3, and other services. Plans define the schedule, retention period, transition
to cold storage, and copying to another Region and account. Vault Lock makes copies
immutable (WORM) — the answer to a regulatory requirement that "backups cannot be
deleted before their retention period." Backup Audit Manager checks that every resource
is covered by a policy.

## Infrastructure as code

CloudFormation describes resources in a template and supports change sets, drift
detection, nested stacks, and StackSets for deploying across many accounts and Regions.
CDK generates templates from code in a familiar language. Service Catalog publishes
approved products that teams can deploy without permissions on the underlying
services — the answer to "let teams create only approved configurations."

## Tags and cost tracking

Tags are the foundation for cost allocation, ABAC access, automation, and search. Tag
Editor and Tag Policies in Organizations keep tagging consistent; activated cost
allocation tags show up in Cost Explorer reports and the Cost and Usage Report.

## What the exam asks

1. "Who deleted the object in the bucket" — CloudTrail data events for S3.
2. "Make sure all volumes are encrypted, and fix violations" — Config with remediation.
3. "New accounts must be created to a standard" — Control Tower Account Factory.
4. "Patch hundreds of instances on a schedule" — Patch Manager.
5. "Unified backups across services, retained for 7 years" — AWS Backup with Vault Lock.
6. "Deploy the same infrastructure across 20 accounts" — CloudFormation StackSets.
7. "Application logs need to be analyzed and alerted on by pattern" — CloudWatch Logs
   with a metric filter and an alarm.
8. "Block Regions outside the EU across all accounts" — SCP.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "who deleted the object" | CloudTrail data events |
| "resource must always be compliant, fix automatically" | Config with remediation |
| "prevent the action entirely" | SCP or a secure default, not Config |
| "new accounts follow the standard" | Control Tower Account Factory |
| "patch hundreds of instances" | Patch Manager |
| "backups immutable for seven years" | AWS Backup with Vault Lock |
| "same stack in 20 accounts and Regions" | CloudFormation StackSets |
| "teams deploy only approved configurations" | Service Catalog |

## Centralized logging

The standard pattern: an organization CloudTrail trail writes to a bucket in the
security account, with validation and Object Lock turned on; VPC Flow Logs and
application logs are collected into CloudWatch Logs with a subscription to Firehose that
delivers into the same bucket; only the security team has access to the bucket, and
application accounts can't delete objects. This separation is the typical correct answer
in questions about protecting evidence from a rogue administrator.

## Mini practicum

**1.** You need to prove to a regulator who accessed bucket objects and when.
→ CloudTrail data events for S3, written to a separate bucket in the security account
with integrity validation.

**2.** Public buckets keep appearing across the organization.
→ Preventively: Block Public Access at the account level plus SCPs; detectively: a
Config rule with automatic remediation.

**3.** You need to roll out the same set of roles and logging into 25 accounts.
→ CloudFormation StackSets through Organizations.

**4.** Backups must be retained for 7 years and must not be deletable even by an
administrator.
→ AWS Backup with Vault Lock in compliance mode, plus a copy in another Region.

## Related chapters

- Organization-level restrictions and SCPs — the IAM chapter.
- Threat detection and finding aggregation — the perimeter security chapter.
- Backups for specific services — the EBS, RDS, and file storage chapters.
- Metrics and alarms for Auto Scaling — the load balancers chapter.
- Cost reports and allocation tags — the cost chapter.

## Numbers to remember

- an SCP doesn't apply to the organization's management account, and up to 5 policies
  can be attached to a single node in the hierarchy;
- a CloudTrail event typically shows up in the log within 15 minutes; the console's
  Event history keeps 90 days, anything beyond that requires writing to S3;
- data events (access to S3 objects, function invocations) are off by default and
  billed separately;
- basic EC2 monitoring publishes metrics every 5 minutes, detailed monitoring every
  minute;
- CloudWatch metrics are retained for 15 months, with progressively coarser resolution
  over time;
- CloudWatch Logs log groups have no default retention limit — it must be set
  explicitly;
- AWS Backup Vault Lock in compliance mode becomes irreversible after a three-day
  maturation period; in governance mode it can be lifted by a user with special
  permission;
- Config keeps a history of resource configurations and lets you define compliance
  rules, including ones with automatic remediation.

## Bank audit

- {{q:893}} — automatic guardrails on account creation come from Control Tower; the
  dump key naming Organizations was corrected.
- {{q:887}} — Config detects but doesn't prevent: blocking unencrypted volumes is done
  with an account setting.
- {{q:308}} — low confidence: Trusted Advisor recommendations for RDS Reserved
  Instances also lower cost.
