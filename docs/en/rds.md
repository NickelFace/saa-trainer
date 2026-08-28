---
id: rds
title: RDS — managed relational databases
order: 7
svc: [RDS, DMS]
---

# RDS

A managed relational database engine: AWS handles installation, patching, backups,
failover, and monitoring; you're responsible for schema, queries, and parameters. Engines:
MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, Db2, and the Aurora family (a separate
chapter).

## Multi-AZ: two different mechanisms

| | Multi-AZ instance | Multi-AZ DB cluster |
|---|---|---|
| Composition | primary + standby | writer + 2 readable standbys |
| Standby is readable | no | yes, with a reader endpoint |
| Zones | 2 | 3 |
| Failover | 60–120 seconds | usually under 35 seconds |
| Engines | all | MySQL and PostgreSQL |
| Purpose | availability | availability plus reads |

Key trap: in a classic Multi-AZ setup, the standby doesn't serve reads. If a requirement
calls for both high availability and read offloading, the answer is either a Multi-AZ DB
cluster or a Multi-AZ instance plus a read replica — not "read from the standby".

Failover happens automatically on the loss of an AZ, an instance, the network, or during
maintenance; the application reconnects using the same DNS name, so the connection string
never needs to change.

## Read replicas

- asynchronous replication, up to 15 replicas, possible in a different AZ, region, or
  account;
- each replica has its own endpoint — the application has to route read queries to it
  itself;
- a replica can be promoted to a standalone database — a way to migrate or split load,
  but not an automatic failover;
- lag is tracked with the ReplicaLag metric; if strict consistency is required, reads
  from a replica are not acceptable;
- a replica in another region reduces latency for remote readers and forms part of a
  DR plan.

## Backup and recovery

- Automated backups: retention from 1 to 35 days, include transaction logs and give
  point-in-time recovery accurate to roughly 5 minutes;
- manual snapshots persist until deleted and survive deletion of the database;
- restoring always creates a new instance with a new endpoint;
- copying a snapshot to another region is the basic DR mechanism; with encryption, a key
  in the target region is required;
- AWS Backup centralizes retention policies for RDS alongside other services.

RPO is set by the logs (minutes); RTO is the time to restore from a snapshot (tens of
minutes or more). If the requirement calls for RPO and RTO in seconds, RDS snapshots won't
cut it — you need Aurora Global Database or replication.

## Performance and scaling

- vertically — change the instance class (with downtime, or via a Multi-AZ failover);
- horizontally for reads — read replicas or an ElastiCache cache;
- for writes — application-side sharding, switching engines, or moving to Aurora;
- storage autoscaling grows the volume automatically; it can't be shrunk;
- storage types: gp3 for most workloads, io1/io2 for guaranteed IOPS, magnetic is
  deprecated;
- Performance Insights shows load by query and wait event, Enhanced Monitoring gives
  OS-level metrics down to a 1-second interval.

RDS Proxy solves the problem of thousands of short-lived connections (typical for
Lambda): connection pooling, faster failover, and integration with Secrets Manager and IAM
authentication. It doesn't speed up the queries themselves and doesn't replace a read
replica — it's about connections, not read performance.

## Security

- the database sits in a private subnet, and the security group allows access only from
  the application's security group;
- encryption at rest is enabled at creation; TLS in transit is an engine parameter;
- IAM authentication removes passwords for applications; administrator passwords live in
  Secrets Manager with rotation;
- auditing: engine logs are shipped to CloudWatch Logs, API events to CloudTrail;
- Multi-AZ and snapshots don't waive the encryption requirement: a snapshot of an
  unencrypted database is also unencrypted.

## Migration

DMS moves data from an on-premises or cloud database with minimal downtime, supporting
full load and CDC. Schema Conversion Tool converts schema and code when switching engines
(Oracle to PostgreSQL, SQL Server to MySQL). The "DMS + SCT" pair is the standard answer
for a heterogeneous migration; "just DMS" for a homogeneous one.

## What the exam asks

1. "Reports load the database, need fresh data with a small lag" — a read replica.
2. "Survive an AZ failure with no data loss" — Multi-AZ (synchronous replication).
3. "Lambda exhausts connections to the database" — RDS Proxy.
4. "Restore state to 10 minutes ago" — point-in-time recovery.
5. "A monthly report loads the database once a month, otherwise it's idle" — either an
   on-demand replica or exporting to S3 and Athena.
6. "Migrate Oracle to PostgreSQL with minimal downtime" — SCT for the schema, DMS with
   CDC for the data.
7. "The database must survive a region failure with an RPO of minutes" — a cross-region
   replica or Aurora Global Database.
8. "We don't want to manage patches and backups" — RDS instead of a database on EC2.

## Maintenance and windows

Engine patches and class changes apply during the maintenance window; with Multi-AZ,
AWS updates the standby first, then fails over, so downtime is bounded by the failover
time. Blue/Green Deployments create a full copy of the environment, apply changes on the
green side, and cut over traffic within seconds — the right answer to "upgrade a major
version with minimal downtime".

Reserved Instances for RDS work the same way as for EC2 and cover steady workloads;
dev databases are cheaper stopped overnight (RDS can be stopped for up to 7 days, after
which the instance starts automatically) or moved to Aurora Serverless v2.

## Choosing between RDS, Aurora, and a database on EC2

| Requirement | Answer |
|---|---|
| Standard engine, minimal administration | RDS |
| Maximum throughput and fast failover | Aurora |
| Need file system access, non-standard extensions, custom patching | database on EC2 |
| Global readers with about a second of replication lag | Aurora Global Database |
| Unpredictable load with idle periods | Aurora Serverless v2 |
| Oracle or SQL Server license tied to sockets | RDS with BYOL or EC2 on a Dedicated Host |

Any wording like "reduce operational overhead" tied to a relational database on EC2 is an
invitation to migrate to RDS or Aurora, not to improve the maintenance scripts.

## How to read the wording

| In the question | Answer |
|---|---|
| "offload reporting queries" | a read replica |
| "survive an AZ failure with no data loss" | Multi-AZ (synchronous replication) |
| "Lambda exhausts database connections" | RDS Proxy |
| "restore to any point in the last week" | PITR from automated backups |
| "minimal downtime major version upgrade" | Blue/Green Deployments |
| "migrate Oracle to PostgreSQL" | SCT plus DMS with CDC |
| "encrypt an existing database" | snapshot, copy with a key, restore |
| "cross-Region disaster recovery, RPO minutes" | a cross-region replica or Aurora Global Database |

## Numbers to remember

- automated backups are kept for 0 to 35 days (7 by default); point-in-time restore is
  accurate to roughly 5 minutes;
- failover in a Multi-AZ DB instance configuration takes 60–120 seconds, in a Multi-AZ
  DB cluster usually under 35 seconds, and the cluster form is only available for MySQL
  and PostgreSQL;
- up to 15 read replicas for MySQL, MariaDB, and PostgreSQL, and up to 5 for Oracle and
  SQL Server;
- RDS Proxy cuts failover time by roughly two-thirds and maintains a connection pool;
- storage autoscaling grows the volume with no downtime; the limit is set when you
  enable it;
- default ports: MySQL and MariaDB 3306, PostgreSQL 5432, SQL Server 1433, Oracle 1521;
- encryption is enabled at instance creation: for a database already running, it's added
  via a snapshot and restore;
- manual snapshots live until deleted; automated ones are removed once retention expires.

## Mini practicum

**1.** Monthly reports load down the production database.
→ A read replica, redirecting reporting queries to it.

**2.** A serverless application gets connection failures during traffic spikes.
→ RDS Proxy: a connection pool instead of a thousand new sessions.

**3.** Need to roll back five minutes after a bad data update.
→ Point-in-time recovery from automated backups, not a snapshot and not a replica.

**4.** A third-party extension needs privileged access to the operating system.
→ RDS Custom: a managed service with administrator access, not a self-managed install
on EC2.

## Bank audit

- {{q:536}} — disputed: a Multi-AZ DB cluster with two readable standbys solves both HA
  and reads with three instances instead of four.
- {{q:268}} — disputed: RDS Proxy addresses the connection pool, not read performance;
  part of the community picks ElastiCache instead.
- {{q:511}} — low confidence: the Aurora On-Demand and RDS Single-AZ option wordings
  nearly duplicate each other.
- {{q:350}} — low confidence: the question mixes availability requirements with
  reporting performance.
