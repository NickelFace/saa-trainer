---
id: integration
title: Integration — SQS, SNS, EventBridge, Step Functions
order: 11
svc: [SQS, SNS, EventBridge, Step Functions, Amazon MQ]
---

# Application integration

Decoupling components is a theme that runs through the whole exam. Words like "decouple",
"loosely coupled", "buffer", "spikes", "producer must not wait" almost always point to a
queue or a bus, not to adding more instances.

## SQS

A queue that holds messages for up to 14 days (4 days by default), with a message size up to
256 KB (larger payloads go through the extended client into S3). A consumer picks up a message,
it becomes invisible for the visibility timeout, and is deleted once processing succeeds.

| | Standard | FIFO |
|---|---|---|
| Order | not guaranteed | strict within a message group |
| Delivery | at least once | exactly once |
| Throughput | practically unlimited | up to 3000 messages/sec with batching |
| Deduplication | none | by content hash or an explicit id |

Mechanics the exam tests:

- the visibility timeout must exceed the processing time, otherwise the message returns to
  the queue and gets processed twice — a common cause of duplicates;
- long polling (`WaitTimeSeconds` up to 20) reduces empty responses and cost;
- a dead-letter queue after N failed attempts isolates "poison" messages;
- a delay queue and per-message timers postpone delivery;
- SSE-KMS encryption and a queue policy handle cross-account access;
- consumers scale off the `ApproximateNumberOfMessagesVisible` metric.

## SNS

Publish/subscribe: one message, many recipients. Subscribers can be SQS, Lambda,
HTTP(S), email, SMS, mobile push, or Kinesis Data Firehose. A filter policy lets a
subscriber receive only matching messages. FIFO topics pair with FIFO queues.

Fan-out (SNS to several SQS queues) is the standard pattern when one event needs to reach
several independent handlers, each with its own buffering and retries.

## EventBridge

An event bus with content-based routing: rules match a JSON pattern and send the event to
targets (Lambda, SQS, SNS, Step Functions, an API destination, and others).
What sets it apart from SNS and drives the choice:

- AWS service events land on the default bus automatically — you can react to an EC2 state
  change, a Batch job completing, or a Config change;
- partner event buses accept SaaS events (Zendesk, Datadog, Shopify);
- a schema registry, event archive, and replay;
- EventBridge Scheduler triggers targets on a schedule or one-off — it's about time,
  not about matching events;
- an API destination calls an external HTTP API using stored credentials.

Rule of thumb: need to broadcast your own message to many subscribers with minimal
latency — SNS; need to route events (including system events) by content and keep a
history — EventBridge.

## Step Functions

A state machine for processes: steps, branching, parallel execution, Map for processing
collections, built-in retries and error handling, and integration with hundreds of AWS APIs
with no code. Standard is for long-running processes, exactly-once, billed per transition;
Express is for short, frequent runs, billed by duration. The answer to "orchestrate several
Lambda functions with retries and rollbacks" and to "need visibility into which step failed".

## Amazon MQ

Managed ActiveMQ and RabbitMQ with the JMS, AMQP, MQTT, and STOMP protocols. The only
reason to pick it over SQS/SNS is migrating an existing application that relies on standard
messaging protocols and cannot be rewritten.

## Kinesis vs. queues

Kinesis Data Streams is an ordered stream with replay and multiple independent
consumers; data is retained for up to 365 days. With SQS, a message disappears once one
consumer processes it. If the question mentions "real-time analytics", "multiple consumers
read the same data", "replay" — it's Kinesis; if it says "work queue", "task per message",
"buffer between tiers" — it's SQS.

## Patterns that keep coming up in questions

| Requirement | Solution |
|---|---|
| Traffic spikes break the handler | SQS in front of the handler, autoscaling on queue depth |
| Three systems need to process one order | SNS fan-out to three SQS queues |
| Per-customer order matters | SQS FIFO with a message group per client |
| Long multi-step processing | Step Functions |
| React to infrastructure events | EventBridge rule |
| Migrating a JMS application to the cloud | Amazon MQ |
| Analytics on a clickstream | Kinesis Data Streams or Firehose |

## What the exam asks

1. "Messages are lost when the handler crashes" — a queue instead of a direct call.
2. "Some messages are processed twice" — visibility timeout, idempotency,
   FIFO if the requirement is strict.
3. "The same message needs to reach four subscribers" — SNS with SQS subscriptions.
4. "Processing needs to be delayed by 15 minutes" — a delay queue or EventBridge Scheduler.
5. "Problem messages block the queue" — a DLQ.
6. "A message is 10 MB" — S3 plus a reference in the message (extended client).
7. "Need to call an external SaaS API on an event" — EventBridge API destination.
8. "Need visibility into steps and retries across services" — Step Functions.

## Numbers to remember

- SQS: message up to 256 KB, retention from 60 seconds to 14 days (4 days by default),
  default visibility timeout 30 seconds, up to 12 hours, long polling up to 20 seconds;
- FIFO: up to 3000 messages/sec with batching, deduplication window of 5 minutes;
- SNS: up to 12.5 million subscriptions per topic, message up to 256 KB;
- EventBridge: event up to 256 KB, archive and replay, up to 5 targets per rule;
- Step Functions Standard: up to 1 year to run, Express: up to 5 minutes;
- Kinesis Data Streams: 1 MB/s write and 2 MB/s read per shard, retention up to 365 days.

## How to read the wording

| In the question | Answer |
|---|---|
| "decouple", "buffer spikes" | SQS |
| "fan out to multiple subscribers" | SNS with SQS subscriptions |
| "react to AWS service events" | EventBridge rule |
| "schedule a one-time or recurring task" | EventBridge Scheduler |
| "exactly once, strict order" | SQS FIFO |
| "multiple consumers read the same stream, replay" | Kinesis Data Streams |
| "existing app uses JMS/AMQP" | Amazon MQ |
| "visibility into a multi-step workflow" | Step Functions |

## Diagnosing common failures

| Symptom | Cause | What to do |
|---|---|---|
| Messages processed twice | processing takes longer than the visibility timeout | increase the timeout, make the handler idempotent |
| Queue keeps growing | not enough consumers | autoscale on queue depth, batch |
| One message blocks processing | a "poison" message | DLQ with maxReceiveCount |
| Subscriber gets extra messages | no filter | filter policy on the SNS subscription |
| Events get lost | asynchronous call with no DLQ | Lambda Destinations or a DLQ |
| Order is broken | standard queue | FIFO with a message group id |

## Mini practicum

**1.** A web app calls an image handler synchronously; during traffic spikes users get
timeouts.
→ Put the job on SQS and process it asynchronously, scaling consumers off queue depth.

**2.** An "order paid" event needs to reach billing, warehouse, and analytics.
→ An SNS topic with three SQS subscriptions: each consumer gets its own queue, retries,
and DLQ.

**3.** Some messages are processed twice.
→ Check the visibility timeout against processing time and make the handler
idempotent; if the requirement is strict, use a FIFO queue.

**4.** Need to run an export every day at 3 AM and react to an AWS Batch job finishing.
→ The schedule is EventBridge Scheduler; reacting to the event is an EventBridge rule
matching the Batch event pattern.

## Bank audit

- {{q:110}} — decoupling image upload from processing via a queue; key corrected.
- {{q:931}} — cross-account Lambda subscription to SNS: a function policy plus a topic
  policy; an SQS buffer in the dump changed the calling source.
- {{q:809}} — EventBridge rule vs. EventBridge Scheduler: a rule matches an event,
  a scheduler runs on time.
- {{q:390}} — disputed: session state storage, sticky sessions don't store data.
