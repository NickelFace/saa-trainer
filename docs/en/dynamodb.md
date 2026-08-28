---
id: dynamodb
title: DynamoDB — managed NoSQL
order: 9
svc: [DynamoDB]
---

# DynamoDB

A key-value and document store with predictable single-digit-millisecond
latency and no servers to administer. Data is automatically partitioned
across three Availability Zones, and capacity and storage grow without manual
intervention.

## Data model

- a table consists of items up to 400 KB;
- primary key: either a partition key alone, or a partition key plus a sort
  key;
- the partition key determines the partition — its cardinality drives load
  uniformity; a "hot" key runs into a partition's limit;
- attributes aren't declared up front, except the ones used in keys and
  indexes;
- queries: `GetItem` by key, `Query` by partition key with a condition on the
  sort key, `Scan` across the whole table (expensive, use only deliberately).

## Indexes

| | LSI | GSI |
|---|---|---|
| When it's created | only at table creation | anytime |
| Partition key | same as the table's | any |
| Consistency | strong consistency possible | eventual only |
| Capacity | shared with the table | its own |
| Limit | 5 per table, 10 GB per partition key | 20 per table |

Practical takeaway: nearly every answer to "need to look up by a different
attribute" is a GSI. LSI shows up in answers only when strongly consistent
reads on an alternate sort key are required and the index could have been set
up at table creation.

## Capacity modes

- On-demand: you pay per request, absorbs spikes instantly, ideal for
  unpredictable load and new applications;
- Provisioned: cheaper for steady load, you set RCUs and WCUs, complemented
  by auto scaling and Reserved Capacity.

1 RCU = one strongly consistent read of an item up to 4 KB per second (or two
eventually consistent reads); 1 WCU = one write of an item up to 1 KB per
second. Transactional operations cost double. When load jumps sharply from
thousands to millions of users, on-demand wins: auto scaling for provisioned
capacity reacts with a delay of minutes.

## Consistency and transactions

By default, reads are eventually consistent — a replica may lag by fractions
of a second. Strongly consistent reads are requested via a flag and cost
twice as much; they're unavailable on GSIs. TransactWriteItems and
TransactGetItems provide ACID guarantees within a Region for up to 100 items.
Conditional writes (`ConditionExpression`) are the standard way to implement
optimistic locking and idempotency.

## Streams and event processing

DynamoDB Streams retains changes for 24 hours and invokes Lambda for each
record: auditing, aggregation, replication into OpenSearch, sending
notifications. Kinesis Data Streams for DynamoDB gives longer retention and
different consumers. A requirement to "react to data changes" is solved with
a stream, not by polling the table on a schedule.

## Performance and caching

- DAX — an in-memory cache in front of the table, cuts read latency down to
  microseconds, works transparently with the DynamoDB API, and lives in a
  VPC. The answer to "reads of hot data must be faster than milliseconds"
  without rewriting the application;
- ElastiCache is a better fit when you're caching aggregates and query
  results rather than table items;
- Adaptive capacity smooths out unevenness, but won't save you from a truly
  hot key: design a partition key that spreads load (for example, by adding
  a suffix).

## Storage, TTL, and backups

- TTL deletes expired items for free — the typical answer to "automatically
  delete records older than N days";
- PITR restores state to any second within the last 35 days;
- full backups can be taken on demand, integrated with AWS Backup;
- export to S3 without affecting table performance, followed by Athena or
  Glue;
- the Standard-IA table class stores infrequently read data more cheaply.

## Global tables

Global tables provide multi-Region replication with active writes in every
Region, using "last writer wins" conflict resolution, and require Streams to
be enabled. The answer to "users worldwide write and read locally, a Region
may fail."

## What the exam asks

1. "Product catalog with unpredictable load and lookups by key" — DynamoDB
   on-demand.
2. "Need to search by a non-key attribute" — GSI.
3. "Store web application sessions" — DynamoDB with TTL (or ElastiCache when
   latency requirements are strict).
4. "React to every record change" — Streams plus Lambda.
5. "Microsecond read latency without code changes" — DAX.
6. "Multi-Region application writing in every Region" — global tables.
7. "Analytics over DynamoDB data" — export to S3 and Athena, not a Scan
   against the table.
8. "Complex joins and reporting" — that's not DynamoDB, it's a relational
   database.

## Numbers to remember

- item up to 400 KB, partition key up to 2048 bytes, sort key up to 1024
  bytes;
- 1 RCU = 1 strongly consistent read of 4 KB per second (2 eventual), 1 WCU =
  write of 1 KB;
- transactions cost double and cover up to 100 items;
- a partition sustains around 3000 RCU and 1000 WCU;
- Query returns up to 1 MB per call, then pagination kicks in;
- 20 GSIs and 5 LSIs per table, LSI limited to 10 GB per partition key value;
- Streams retain changes for 24 hours, PITR for 35 days;
- BatchGetItem up to 100 items, BatchWriteItem up to 25.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "key-value access, single-digit millisecond" | DynamoDB |
| "microsecond reads without code changes" | DAX |
| "query by an attribute that is not the key" | GSI |
| "delete records older than 90 days automatically" | TTL |
| "react to every item change" | Streams plus Lambda |
| "write locally in multiple Regions" | global tables |
| "unpredictable traffic, no capacity planning" | on-demand |
| "complex joins and ad-hoc SQL" | relational database, not DynamoDB |

## Key design

Modeling mistakes cause more failures than capacity shortfalls. Signs of a
bad key: a single partition key value serves most of the traffic (for
example, a date used as the key for an event feed), Scan is used as the
routine way to read data, every new query requires a new GSI. Techniques:
suffixes and hashes in the key to spread load, a composite sort key like
`ORDER#2026-05-14` for range queries, single-table design with an
entity-type attribute, moving aggregates into separate items updated by a
Streams handler.

## Mini practicum

**1.** A gaming app grew from thousands to millions of users in a week,
spikes are unpredictable, downtime isn't acceptable.
→ On-demand capacity: absorbs spikes instantly, whereas auto scaling for
provisioned capacity reacts on the order of minutes.

**2.** You need to find orders by customer email, but the table's key is the
order ID.
→ GSI with partition key email; an LSI doesn't fit — it can't be added after
the table is created and it requires the same partition key.

**3.** Every record change must land in a search index.
→ DynamoDB Streams plus a Lambda function writing into OpenSearch.

**4.** Analysts need a full export of the table for BI without affecting the
application.
→ Export to S3 and Athena queries; a Scan against the table would burn
capacity and slow down the application.

## Bank audit

- {{q:622}} — disputed: when load spikes from thousands to millions of
  users, on-demand scales instantly, while auto scaling for provisioned
  capacity lags behind.
- {{q:372}} — disputed: pairing S3 with DynamoDB is cheaper and more
  scalable, but the source data doesn't always reduce to a simple key.
