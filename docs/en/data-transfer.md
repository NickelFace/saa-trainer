---
id: data-transfer
title: Data transfer — DataSync, Storage Gateway, Snow, Transfer Family
order: 15
svc: [DataSync, Storage Gateway, Snow Family, Transfer Family, DMS]
---

# Data transfer and synchronization

Questions in this block come down to two parameters: volume and whether a link
exists. From there you narrow down whether it's a one-time transfer or ongoing
hybrid operation, and which protocol the application needs.

## Quick decision matrix

| Situation | Answer |
|---|---|
| Hundreds of TB or PB, link is insufficient | Snowball Edge; at 100 PB — Snowmobile |
| Tens of TB, link exists, one-time or scheduled | DataSync |
| On-premises apps need ongoing access to data in the cloud | Storage Gateway |
| Partners upload files over SFTP/FTPS | Transfer Family |
| Database migration with minimal downtime | DMS (plus SCT on an engine change) |
| Continuous event stream | Kinesis Data Firehose |
| Syncing S3 across Regions | S3 Replication |

Rule of thumb: 1 TB over a 1 Gbps link ideally takes about 2.5 hours, in
practice longer. If the math gives you weeks but the deadline is days, the
answer is Snow.

## DataSync

An agent (or an agentless service for cloud sources) moves files between NFS,
SMB, HDFS, object storage, and AWS services: S3, EFS, FSx. It handles
incremental sync, integrity verification, filters, scheduling, preservation of
metadata and ACLs, encryption in transit, and operation through a VPC
endpoint. Speed reaches tens of Gbps, and throttling is configurable.

The answer to "transfer 50 TB of files and then sync daily," "migrate a file
server to FSx," "copy data between Regions and accounts with verification."

## Storage Gateway

Hybrid storage: a local cache in front of "unlimited" capacity in S3.

| Type | Local protocol | Where the data lives | Scenario |
|---|---|---|---|
| S3 File Gateway | NFS, SMB | objects in S3 | file access to objects, document archiving |
| FSx File Gateway | SMB | FSx for Windows | local cache for Windows file shares |
| Volume Gateway (cached) | iSCSI | primary data in S3, hot data locally | extending disk space |
| Volume Gateway (stored) | iSCSI | primary data locally, copies in S3 | backup with fast local access |
| Tape Gateway | iSCSI VTL | S3 and Glacier | replacing tape libraries, no change to backup software |

Cues in question text: "backup software writes to tape" — Tape Gateway; "need
low-latency access to recently used data with unlimited cloud storage" —
cached Volume Gateway or File Gateway; "Windows file shares with AD" — FSx
File Gateway.

## Snow Family

- Snowcone — up to 8 or 14 TB, a portable device that can run in the field;
- Snowball Edge Storage Optimized — around 80 TB of usable capacity;
- Snowball Edge Compute Optimized — less storage, but has vCPUs, memory, and
  a GPU for on-site processing (edge computing, preprocessing before
  shipping);
- Snowmobile — a shipping-container truck, tens of petabytes.

Data is encrypted with KMS, the device is tracked, and the return trip goes
through the carrier. Snowball is also used for one-way migrations before a
data center shutdown and for collecting data where there's no connectivity at
all.

## Transfer Family

Managed SFTP, FTPS, FTP, and AS2 endpoints on top of S3 and EFS. Users and
their keys are stored in the service, in Directory Service, or with your own
provider via Lambda. The answer to "partners have been sending files over
SFTP for years, we can't change their process, but we don't want to maintain
a server."

## S3 transfer mechanics

- Multipart upload and Transfer Acceleration for large files over the
  internet;
- S3 Batch Operations — bulk actions across millions of objects (copying,
  changing storage class, invoking Lambda);
- S3 Batch Replication — replicating objects that already exist;
- Import/Export via Snow, when volume makes the network pointless.

## Server and database migration

Application Migration Service (MGN) replicates entire servers at the block
level and cuts them over to EC2 with minimal downtime. Database Migration
Service moves DBMS data using CDC. Migration Hub shows overall progress. For
inventory and dependency assessment — Application Discovery Service.

## What the exam asks

1. "Transfer 500 TB in two weeks, 500 Mbps link" — Snowball Edge.
2. "Copy NFS files into S3 daily with integrity verification" — DataSync.
3. "On-premises applications must see S3 as a file share" — S3 File Gateway.
4. "Retire tape libraries without changing the backup software" — Tape
   Gateway.
5. "Clients send files over SFTP" — Transfer Family.
6. "Move Oracle to Aurora PostgreSQL" — SCT plus DMS.
7. "Collect data from a ship with no connectivity" — Snowcone or Snowball
   with onboard compute.
8. "Keep S3 continuously in sync across Regions" — Cross-Region Replication,
   not DataSync.

## Numbers to remember

- Snowcone up to 8 or 14 TB, Snowball Edge around 80 TB usable, Snowmobile up
  to 100 PB;
- a Snow device travels to you and back, a typical cycle is about a week;
- DataSync speeds up transfer many times over compared to plain copying and
  verifies the integrity of every file;
- Storage Gateway keeps a local cache while the full dataset lives in S3;
- Transfer Family is billed per hour of protocol endpoint uptime and per
  gigabyte transferred;
- S3 Transfer Acceleration uses the CloudFront edge network and is billed
  separately.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "petabytes, limited bandwidth, weeks deadline" | Snow Family |
| "ongoing incremental sync of NFS shares" | DataSync |
| "on-premises apps need low-latency access to cloud data" | Storage Gateway |
| "replace tape backups without changing software" | Tape Gateway |
| "partners upload via SFTP" | Transfer Family |
| "migrate database with minimal downtime" | DMS with CDC |
| "keep two buckets in sync across Regions" | S3 Replication |
| "collect data at a remote site with no connectivity" | Snowcone or Snowball Edge |

## Choosing in three steps

1. Calculate the transfer time over the link: volume divided by real
   throughput. If that exceeds the project deadline, only Snow devices remain
   in play.
2. Determine whether this is a one-time transfer or an ongoing process.
   One-time — Snow or DataSync; ongoing hybrid access — Storage Gateway;
   ongoing exchange with partners — Transfer Family.
3. Check the application's protocol: NFS and SMB — DataSync or File Gateway,
   iSCSI — Volume Gateway, SFTP — Transfer Family, SQL — DMS.

## Mini practicum

**1.** 600 TB of archives need to move into S3 within a month, link is 200
Mbps.
→ Several Snowball Edge devices: over the link, the transfer would take more
than nine months.

**2.** Every day, 2 TB of new files from an NFS share must land in S3 with
integrity verification.
→ Scheduled DataSync with incremental sync.

**3.** An on-premises application writes to an iSCSI volume and must keep
working, but the data needs to be in the cloud.
→ Volume Gateway in cached mode: hot blocks locally, the full dataset in S3.

**4.** Partners have been sending files over SFTP for years, and their
process can't change.
→ AWS Transfer Family on top of S3 with authentication via a directory or
Lambda.

## Bank audit

- {{q:113}} — low confidence: Snowball Edge with later processing in Glue
  versus Snowball with onboard compute.
