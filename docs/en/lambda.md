---
id: lambda
title: Lambda and serverless computing
order: 10
svc: [Lambda, API Gateway]
---

# Lambda

A function runs in response to an event; you pay for execution time and number of
invocations, with no servers to manage. Typical roles in an architecture: an event handler
for S3, DynamoDB Streams, SQS, EventBridge; an API backend behind API Gateway or an ALB;
glue between services; scheduled periodic tasks.

## Limits the exam tests

| Parameter | Value |
|---|---|
| Maximum execution time | 15 minutes |
| Memory | 128 MB — 10,240 MB |
| vCPU | proportional to memory, up to 6 at maximum |
| Package size | 50 MB zip (compressed), 250 MB unzipped, 10 GB container image |
| `/tmp` | 512 MB — 10,240 MB |
| Payload | 6 MB synchronous, 256 KB asynchronous |
| Account concurrency | 1000 by default, raised via quotas |

A requirement that "processing takes longer than 15 minutes" automatically rules out
Lambda: the answer moves to ECS/Fargate, AWS Batch, or Step Functions broken into steps.

## Invocation models

- Synchronous (API Gateway, ALB, direct invoke): the error is returned to the caller,
  retries are the caller's responsibility.
- Asynchronous (S3, SNS, EventBridge): two built-in retries, then a destination or a
  dead-letter queue.
- Poll-based (SQS, Kinesis, DynamoDB Streams): Lambda polls the source itself, in
  batches; order is guaranteed for FIFO and for a stream shard.

Error handling: a DLQ or Lambda Destinations (success and failure are routed to SQS, SNS,
EventBridge, or another function). Handler idempotency is a requirement, not a nice-to-have.

## Concurrency

- Reserved concurrency reserves part of the account-wide limit for a function while also
  capping it — a way to protect a database from overload and stop one function from eating
  the whole account limit;
- Provisioned concurrency keeps initialized environments ready — the answer to "cold
  starts are unacceptable", especially for Java and .NET;
- SnapStart dramatically speeds up Java startup by snapshotting an initialized environment;
- once the limit is exhausted, calls get throttled (429); asynchronous events are queued
  and retried.

## Function in a VPC

By default, functions run outside your VPC and have internet access. Connecting to a
VPC is needed to reach RDS, ElastiCache, or internal services. Once connected, internet
access disappears: you need a NAT Gateway for public APIs or interface endpoints for AWS
services. This is exactly the trap where "the function can't reach an external API" is
solved with NAT, not by editing a security group.

## Layers, images, environment

A layer is shared code and dependencies, up to 5 layers per function; handy for SDKs,
client libraries, and the Secrets Manager/Parameter Store extension. A container image up
to 10 GB suits large ML dependencies. Environment variables are encrypted with KMS; secrets
belong in Secrets Manager, fetched through the caching extension rather than hardcoded.

Versions and aliases give you a controlled rollout: a `prod` alias with weights routes a
percentage of traffic to a new version (canary), and rollback is instant.

## Cost

Charge = number of requests + GB-seconds. More memory raises both the price per
millisecond and the speed: a function with 1024 MB is often cheaper than one with 128 MB,
because it finishes many times faster. AWS Lambda Power Tuning finds the optimum. Compute
Savings Plans cover Lambda alongside EC2 and Fargate.

## API Gateway

| API type | Protocol | Features |
|---|---|---|
| REST | HTTP | the most features: caching, usage plans, API keys, WAF, request validation |
| HTTP | HTTP | cheaper and faster, JWT authorization, fewer features |
| WebSocket | WSS | two-way communication, chat, notifications |

Capabilities the exam tests: throttling and usage plans for partners, response caching
to cut backend load, authorization via IAM, Cognito, or a Lambda authorizer, direct service
integrations (e.g., putting a message on SQS with no function involved), private APIs via
an interface endpoint, stages (dev, prod), and canary releases.

A Lambda function URL is a direct HTTPS endpoint for a function, with or without IAM
authorization. It's the right answer wherever you need a single call to a single function
and don't need routing, throttling, keys, or transformations: API Gateway would be an
unnecessary extra service there.

## Step Functions

A state orchestrator: sequences, parallel branches, conditions, retries, timeouts,
compensations. Standard workflow — up to a year, billed per transition, exactly-once;
Express — up to 5 minutes, billed by duration, for high-frequency events. The answer to
"a complex multi-step process with retries and branching" and to "processing takes longer
than 15 minutes but the logic breaks into steps".

## What the exam asks

1. "Process an image on upload to S3" — an S3 event plus Lambda.
2. "A spike in requests breaks the database" — reserved concurrency and RDS Proxy.
3. "The first request after idle time is too slow" — provisioned concurrency
   or SnapStart.
4. "The function can't see the database in a VPC" — connect it to the VPC and open the
   security group.
5. "A function in a VPC lost internet access" — a NAT Gateway or an endpoint.
6. "Need a single HTTPS endpoint for one function, minimum services" — a function URL.
7. "The job runs for 40 minutes" — Fargate, Batch, or Step Functions, not Lambda.
8. "Messages must be processed in strict order" — SQS FIFO with a handler whose
   concurrency is bounded by the message group.

## Numbers to remember

- 15 minutes max, 10,240 MB memory, up to 6 vCPUs at maximum memory;
- 50 MB zip package and 250 MB unzipped, image up to 10 GB;
- payload 6 MB synchronous and 256 KB asynchronous;
- `/tmp` from 512 MB up to 10 GB;
- 1000 concurrent executions by default per account and region;
- asynchronous invocations retry twice, events are kept for up to 6 hours;
- batch size up to 10,000 records for Kinesis and DynamoDB Streams, up to 10,000 for SQS
  in standard queue mode;
- API Gateway: 29-second integration timeout, 10 MB payload.

## How to read the wording

| In the question | Answer |
|---|---|
| "no servers to manage, pay per request" | Lambda |
| "processing takes 30 minutes" | Fargate, Batch, or Step Functions |
| "cold start unacceptable" | provisioned concurrency, SnapStart |
| "protect the database from too many connections" | reserved concurrency plus RDS Proxy |
| "function cannot reach the internet" | NAT Gateway or an endpoint |
| "single function needs an HTTPS endpoint" | a function URL |
| "throttle partner APIs, issue API keys" | API Gateway usage plans |
| "coordinate multiple steps with retries" | Step Functions |

## Observability and debugging

Function logs go to CloudWatch Logs, and metrics like Invocations, Errors, Throttles,
Duration, and ConcurrentExecutions go to CloudWatch. X-Ray shows call traces across
services and helps find where time is lost. Typical alarms: rising Throttles (hitting the
concurrency limit), rising Errors alongside a DLQ (problem events), Duration near the
timeout limit. For events that can't be lost, a DLQ or Destinations is mandatory: without
one, an asynchronous event disappears after two retries.

## Mini practicum

**1.** A function processes files from a bucket; during a marketing campaign some
events got lost.
→ An SQS queue in front of the function: the buffer absorbs the spike, nothing is lost.

**2.** Java functions take a long time to start, there's no hard latency requirement, and
budget matters.
→ SnapStart: a snapshot of the initialized environment without paying for a standing
reserve.

**3.** Employees log in simultaneously in the morning, and the first requests are slow.
→ Scheduled provisioned concurrency before the start of the workday.

**4.** A job runs for an hour and is written in a non-standard language.
→ This isn't Lambda: the 15-minute execution limit means the job belongs on AWS Batch or
containers.

## Bank audit

- {{q:239}} — a single microservice with AWS_IAM authorization: a Lambda function URL,
  API Gateway would add an unneeded service; dump key corrected.
- {{q:809}} — a Batch job completion event is caught by an EventBridge rule, not
  EventBridge Scheduler; calling an external HTTP API is done via an API destination.
- {{q:110}} — decoupling image upload from processing: a queue plus Lambda,
  key corrected during the CD audit.
- {{q:422}} — low confidence: SQS with Fargate vs. SQS with Lambda, the choice depends
  on the size of the ML models, which the text doesn't state directly.
