---
id: analytics
title: Analytics and data flows
order: 19
svc: [Kinesis, Glue, Athena, Redshift, EMR, OpenSearch, QuickSight, Lake Formation, ElastiCache]
---

# Analytics

A block with a lot of similar services. It's easiest to work through by following the
chain: how data gets into the cloud (ingest) → where it lives (storage) → what processes
it (process) → what displays it (visualize).

## Kinesis

| Service | Purpose | Notable traits |
|---|---|---|
| Data Streams | ingest and retention of a stream | shards or on-demand, retention up to 365 days, multiple consumers, ordering within a shard |
| Data Firehose | delivers a stream to a destination | no administration, buffering, Lambda transformation, S3/Redshift/OpenSearch/Splunk destinations |
| Managed Service for Apache Flink | stream analytics | SQL and Flink applications on top of a stream |
| Video Streams | video streams | ingest from cameras, ML integration |

The distinction that gets tested: Data Streams — when you need arbitrary access to the
data, several independent consumers, replay, and minimal latency; Firehose — when the
task is "just drop the stream into S3/Redshift/OpenSearch with no code and no servers."
Firehose buffers (typically 60 seconds or more), so "near real-time delivery" fits it,
while "process within milliseconds" does not.

SQS solves a different problem in this lineup: a work queue, not a stream for analytics.

## Storage and catalog

S3 is the actual data layer for analytics (a data lake). Format matters: columnar
Parquet and ORC cut down the amount of data scanned, which lowers Athena cost and query
time; partitioning by date and key cuts it down even further.

Glue Data Catalog holds table metadata for Athena, EMR, and Redshift Spectrum; Glue
Crawler infers the schema automatically; Glue ETL (Spark) and Glue Studio run
transformations without servers. Lake Formation adds centralized permissions on tables,
columns, and rows on top of the catalog.

## Processing and queries

| Service | Model | When it's chosen |
|---|---|---|
| Athena | SQL over data in S3, pay per byte scanned | one-off and irregular queries, logs, minimal administration |
| Redshift | MPP warehouse with loaded data | ongoing heavy analytics, complex joins, BI over terabytes |
| Redshift Spectrum | Redshift queries against data in S3 | hot data in the cluster, cold data in the lake |
| EMR | Hadoop, Spark, Hive, Presto on a cluster | existing Spark/Hadoop jobs, fine-tuning, ML pipelines |
| OpenSearch | search and log analysis | full-text search, log dashboards, near real-time |
| QuickSight | BI dashboards | business-facing visualization, SPICE cache, ML insights |

The rule for choosing between Athena and Redshift: if the question says "ad-hoc,"
"occasionally," "no infrastructure to manage," "data already in S3" — Athena; if it says
"complex joins," "consistent high query volume," "data warehouse," "BI team runs reports
all day" — Redshift.

## Redshift in more detail

RA3 nodes separate compute from storage (Managed Storage); Serverless removes the
cluster entirely. Features that show up in questions: Concurrency Scaling adds capacity
during read spikes, materialized views speed up repeated queries, data sharing gives
access to another cluster's data without copying it, cross-Region snapshots are part of
a DR plan, and Zero-ETL from Aurora removes the need for a pipeline.

## ElastiCache in analytics and beyond

Redis and Memcached, fully managed. Redis: replication, Multi-AZ with automatic
failover, persistence, data structures, pub/sub, sorted sets for leaderboards,
clustering. Memcached: a simple cache, multithreading, horizontal scaling, no
replication and no persistence.

Typical answers: caching hot queries in front of RDS, session storage, leaderboards,
rate limiting. If you need durability and failover — Redis; if you need the simplest
cache with per-node scaling — Memcached.

## Typical pipelines

- Application logs → Firehose → S3 → Athena/QuickSight (cheap, near real-time).
- Clicks → Data Streams → Flink → DynamoDB/OpenSearch (real-time analytics).
- Partner files → S3 → Glue Crawler → Glue ETL → Redshift → QuickSight.
- IoT data → IoT Core → Firehose → S3 → Athena.
- Log search and monitoring → OpenSearch with dashboards.

## What the exam asks

1. "Query logs in S3 with SQL, no infrastructure" — Athena.
2. "Ingest a stream and drop it into S3 with no code" — Firehose.
3. "Several applications reading one stream independently" — Kinesis Data Streams.
4. "Warehouse for BI under constant load" — Redshift.
5. "Migrate existing Spark jobs to the cloud" — EMR.
6. "Full-text search and dashboards over logs" — OpenSearch.
7. "Reduce Athena query cost" — Parquet, partitioning, compression.
8. "Grant centralized permissions on lake tables" — Lake Formation.

## Numbers to remember

- Kinesis Data Streams: a shard gives 1 MB/s or 1,000 records/s on write and 2 MB/s on
  read, records up to 1 MB, retention from 24 hours to 365 days;
- Firehose: buffers by size (1–128 MB) or time (60–900 seconds), so delivery is
  near real-time, not instant;
- Athena is billed per byte scanned; Parquet and partitioning cut that by a large factor;
- Redshift RA3 separates compute from storage, Concurrency Scaling adds capacity during
  spikes;
- OpenSearch stores hot, warm (UltraWarm), and cold data at different price points;
- QuickSight SPICE is an in-memory cache for fast dashboards.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "ad-hoc SQL over data already in S3" | Athena |
| "data warehouse, complex joins, BI all day" | Redshift |
| "stream to S3 with no code" | Kinesis Data Firehose |
| "multiple consumers, replay the stream" | Kinesis Data Streams |
| "existing Spark and Hadoop jobs" | EMR |
| "full-text search and log dashboards" | OpenSearch |
| "reduce Athena cost" | Parquet, partitioning, compression |
| "fine-grained permissions on lake tables" | Lake Formation |

## Telling similar pairs apart

Firehose vs. Data Streams: if the data just needs to land in storage with no in-flight
processing — Firehose; if several applications read one stream and control over the
read position matters — Data Streams.

Athena vs. Redshift Spectrum: Athena is self-contained and needs no cluster; Spectrum
makes sense where a Redshift cluster already exists and you need to reach cold data in
S3 in the same query as hot data.

OpenSearch vs. Athena: OpenSearch keeps an index and answers search queries in
milliseconds; Athena scans files and answers in seconds to minutes. Logs for interactive
investigation — OpenSearch; infrequent reports — Athena.

ElastiCache vs. DAX: DAX understands the DynamoDB API and needs no code changes;
ElastiCache is general-purpose, but you have to populate and invalidate the cache
yourself.

## Mini practicum

**1.** ALB logs have piled up in S3, and an analyst wants a few queries a week.
→ Athena over the data in S3, ideally with date partitioning.

**2.** A clickstream needs to land in S3 and simultaneously feed real-time aggregates.
→ Kinesis Data Streams: one consumer is Firehose to S3, the other is Flink for
aggregates.

**3.** Finance builds reports over terabytes of data all workday long.
→ Redshift (RA3) with materialized views and Concurrency Scaling.

**4.** Engineers need to search application logs with dashboards and alerts.
→ OpenSearch, with logs delivered via Firehose and UltraWarm for older indices.

## Bank audit

- {{q:687}} — demand forecasting with no ML experience: train a predictor in Amazon
  Forecast and invoke it from Lambda; the dump key conflated training in SageMaker with
  the Forecast predictor.
- {{q:113}} — low confidence: Snowball Edge with later Glue processing vs. compute on
  the device.
