---
id: aurora
title: Aurora — cloud-native MySQL and PostgreSQL engine
order: 8
svc: [Aurora]
---

# Aurora

Aurora is protocol-compatible with MySQL and PostgreSQL, but its storage is its own: a
distributed volume that grows up to 128 TB, with six copies of every block across three
Availability Zones. The cluster survives the loss of two copies with no data loss, and
the loss of three copies with no loss of read availability. That's where all of its
properties come from: fast failover, cheap replicas, cloning, and point-in-time
recovery.

## Cluster architecture

- writer — the single instance that accepts writes;
- up to 15 reader instances reading the same volume, typically tens of milliseconds
  behind;
- storage is shared and self-healing; replicas don't copy the data;
- if the writer fails, one of the readers becomes the writer, usually within seconds,
  with the order set by instance priority (tier).

Endpoints — what gets tested most often:

| Endpoint | What it points to | When to use it |
|---|---|---|
| Cluster (writer) | the current writer | writes; follows failover |
| Reader | load-balances across readers | application reads |
| Custom | a defined subset of instances | a dedicated pool for reporting or BI |
| Instance | a specific instance | diagnostics, targeted tasks |

The application should use the reader endpoint for reads; if an answer option routes
reads to the cluster endpoint, that option is wrong.

## Storage types and pricing

Aurora has only two storage configuration types: Standard and I/O-Optimized. The terms
gp2, gp3, and Provisioned IOPS belong to RDS and EBS, not to an Aurora cluster — a ready-
made trap. Standard bills I/O operations separately; I/O-Optimized folds them into
instance pricing and pays off once I/O is roughly 25 percent or more of the bill.

Overall cost structure: instances (or ACUs in Serverless), storage per GB, I/O
operations under Standard, backups beyond the cluster size, and cross-AZ/cross-Region
traffic.

## Serverless v2

Serverless v2 scales instance capacity continuously in ACU units (0.5 ACU and up, with
scale-to-zero available for certain configurations since 2024) without dropping
connections. It suits unpredictable, "spiky" workloads, dev environments, and
multi-tenant applications. An important detail for cost questions: a regular
provisioned cluster can be stopped for at most 7 days before it starts itself back up,
while Serverless v2 scales itself down when idle.

## Global Database

Aurora Global Database replicates data to up to 10 secondary regions with typical
replication lag under a second. A secondary region provides local reads and lets you
promote it in about a minute: RPO is measured in seconds, RTO in minutes. This is the
standard answer to "global application with regional reads and fast recovery from a
regional outage." A cross-Region RDS read replica is slower and takes longer to fail
over.

## Clones, backups, recovery

- Backtrack (MySQL-compatible edition only) rewinds a cluster by several hours in
  minutes, without restoring a snapshot — the answer to "roll back an accidental DELETE
  as fast as possible";
- fast database cloning creates a copy-on-write copy in minutes with almost no extra
  storage — the answer to "need a copy of prod for testing";
- continuous backup to S3 provides PITR within the retention period;
- snapshots can be copied across regions and accounts.

## Additional features

- Aurora Auto Scaling adds readers based on a load metric;
- Parallel Query (MySQL-compatible edition) speeds up analytical queries by pushing
  filtering down into the storage layer;
- Aurora Machine Learning calls SageMaker and Comprehend directly from SQL;
- Zero-ETL integration with Redshift moves data into analytics without a pipeline;
- Babelfish accepts connections from SQL Server applications into Aurora PostgreSQL —
  the answer to "migrate off SQL Server without rewriting client code."

## Aurora vs. RDS

| Requirement | Choice |
|---|---|
| Maximum throughput and up to 15 replicas | Aurora |
| Failover in seconds | Aurora |
| Oracle, SQL Server, Db2 engines | RDS |
| Lowest cost for a small, stable database | RDS |
| On-the-fly environment copies for testing | Aurora (fast clone) |
| Global reads with RPO in seconds | Aurora Global Database |
| Workload running two hours a week | Aurora Serverless v2 or a stopped RDS instance |

## What the exam asks

1. "Reporting queries must not interfere with writes" — a reader endpoint or a custom
   endpoint on dedicated instances.
2. "Need a copy of the production database for testing by tonight" — fast clone.
3. "A developer dropped a table an hour ago" — Backtrack (MySQL) or PITR.
4. "Application spans three regions, local reads, recover from a regional outage within
   minutes" — Global Database.
5. "Workload is unpredictable, we don't want to pay for idle time" — Serverless v2.
6. "The bill grew because of I/O operations" — I/O-Optimized.
7. "Need to scale writes" — scale the writer vertically or shard; replicas don't scale
   writes.
8. "Compatibility with a SQL Server application without rewriting it" — Babelfish.

## Numbers to remember

- 6 copies of data across 3 AZs; losing 2 copies doesn't block writes, losing 3 blocks
  reads;
- up to 15 reader instances, lag of tens of milliseconds;
- the volume grows automatically up to 128 TB, in 10 GB increments;
- failover is usually under 30 seconds, vs. 60–120 seconds for a Multi-AZ RDS instance;
- Global Database: up to 10 secondary regions, replication lag around a second,
  promotion in about a minute;
- Backtrack goes back up to 72 hours (MySQL-compatible edition only);
- Serverless v2 scales in 0.5 ACU increments without dropping connections.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "read-heavy, reports slow down writes" | reader endpoint or additional readers |
| "need a copy of production for testing quickly" | fast clone |
| "accidentally dropped a table an hour ago" | Backtrack or PITR |
| "users in three continents, local reads" | Global Database |
| "unpredictable, spiky workload" | Serverless v2 |
| "I/O charges dominate the bill" | I/O-Optimized |
| "must support Oracle" | that's not Aurora, it's RDS |
| "application uses SQL Server drivers" | Babelfish on Aurora PostgreSQL |

## What Aurora doesn't solve

Writes only scale vertically: reader instances don't accept writes, and the question
"how do we scale writes" is answered by a bigger writer, splitting data across clusters,
or moving to DynamoDB if the data model allows it. Aurora doesn't turn a relational
workload serverless for free: Serverless v2 is billed per ACU-hour and, under constant
load, costs more than a provisioned cluster.

## Mini practicum

**1.** An Aurora MySQL cluster backs an online store. Analysts complain their reports
take minutes and slow down checkout. What do you do?
→ A custom endpoint on dedicated reader instances: reports go to their own nodes, the
writer stays free for orders.

**2.** A developer needs a 4 TB copy of the production database by end of day, on a
tight budget.
→ Fast database clone: the copy is created in minutes via copy-on-write and takes up
almost no extra space.

**3.** The cluster runs two hours a week and sits idle the rest of the time.
→ Aurora Serverless v2: scales down when idle; a provisioned cluster can be stopped for
at most 7 days before it starts itself back up.

**4.** The application runs in three regions, needs local reads and recovery from a
regional outage within minutes.
→ Aurora Global Database: replication around a second, promotion of the secondary
region in about a minute.

## Bank audit

- {{q:827}} — Aurora only has Standard and I/O-Optimized; options with General Purpose
  and Provisioned IOPS belong to RDS; the dump key has been corrected.
- {{q:574}} — disputed: two hours of use per week; Serverless v2 doesn't always scale
  to zero, and a provisioned cluster can only be stopped for up to 7 days.
- {{q:851}} — disputed: Aurora Serverless scales down when idle, which more precisely
  matches the requirement "resources are only needed while running."
