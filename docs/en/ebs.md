---
id: ebs
title: EBS — block volumes and snapshots
order: 13
svc: [EBS]
---

# EBS

A network block volume attached to an instance in the same Availability
Zone. A volume is a disk: file system, database, log. Data is replicated
within the AZ, so a zone failure means the volume becomes unavailable;
protection against that comes from snapshots and application-level
replication.

## Volume types

| Type | Class | IOPS | Throughput | Purpose |
|---|---|---|---|---|
| gp3 | SSD | 3000 baseline, up to 16,000 | 125 MB/s baseline, up to 1000 | general-purpose default choice |
| gp2 | SSD | 3 IOPS per GB, up to 16,000 | up to 250 MB/s | previous generation |
| io2 / io2 Block Express | SSD | up to 256,000 | up to 4000 MB/s | critical databases, maximum durability |
| io1 | SSD | up to 64,000 | up to 1000 MB/s | previous-generation provisioned IOPS |
| st1 | HDD | up to 500 | up to 500 MB/s | large sequential workloads, logs, big data |
| sc1 | HDD | up to 250 | up to 250 MB/s | cold data, lowest cost |

Practical takeaways:

- gp3 lets you change IOPS and throughput independently of size, so "need
  more IOPS but not more space" is solved by moving from gp2 to gp3, not by
  inflating the volume;
- HDD types can't be used as boot volumes and are poor for random access;
- io2 Block Express delivers the highest numbers and 99.999% durability;
- Multi-Attach (io1/io2) attaches a volume to several instances in the same
  AZ, but requires a cluster-aware file system — it is not a replacement for
  EFS.

## Modification and maintenance

Elastic Volumes change size, type, and performance parameters on the fly,
without stopping the instance; you cannot shrink a volume. After expanding a
volume you still need to extend the file system inside the OS — a step
answer choices love to mention.

Initializing a volume from a snapshot: blocks are pulled from S3 on first
access, which causes a slowdown; Fast Snapshot Restore removes that latency
for an extra fee.

## Snapshots

- incremental, stored in S3 (in AWS's internal storage), billed for the
  blocks actually changed;
- copied across Regions and accounts, and can be re-encrypted during the
  copy;
- Data Lifecycle Manager or AWS Backup create them on a schedule and delete
  them by policy;
- Recycle Bin protects against accidental snapshot deletion;
- snapshots can be archived to the Archive tier for long-term storage at low
  cost (restore takes hours).

Snapshots are the primary mechanism for migrating a volume between AZs and
Regions: create a snapshot, create a volume in the target zone, or copy it to
the target Region.

## Encryption

Encryption is enabled at volume creation and propagates to snapshots and
volumes created from them. An unencrypted volume can't be encrypted in
place: you take a snapshot, copy it while specifying a key, and create a new
volume from the copy. The account setting "encryption by default" guarantees
that all new volumes and snapshots in a Region are encrypted — this is the
answer to a requirement that "unencrypted volumes must not be created."

## EBS versus instance store

| | EBS | Instance store |
|---|---|---|
| Data on stop/terminate | persists (except root by default) | lost |
| Host failure | volume intact | data lost |
| Performance | high, depends on type | maximum, local NVMe |
| Snapshots | yes | no |
| Price | per GB and IOPS | included in instance price |

Instance store is chosen for caching, temporary data, buffers, and clusters
replicated at the application level (Cassandra, Kafka), where losing a node
is acceptable.

## Monitoring and diagnostics

CloudWatch metrics: VolumeReadOps, VolumeWriteOps, VolumeQueueLength,
BurstBalance for gp2 and HDD types. Exhausted BurstBalance is the direct
cause of "disks suddenly slow down after a few hours of operation," fixed by
switching to gp3 or io2. A throughput ceiling can also sit on the instance
side: every instance type has an EBS-bandwidth limit, so "we increased the
volume's IOPS but it didn't get any faster" is solved by switching to an
EBS-optimized instance type with a higher limit.

## What the exam asks

1. "Need maximum, predictable IOPS for a database" — io2 (Block Express).
2. "Cheaply store large sequential logs" — st1.
3. "Not enough IOPS, but plenty of space" — gp3 with provisioned IOPS.
4. "Move a volume to another AZ" — snapshot, then create a volume in the
   target zone.
5. "Existing volumes need to be encrypted" — snapshot, copy with a key, new
   volume.
6. "Data must survive instance termination" — EBS with
   `DeleteOnTermination=false`.
7. "Shared file access from multiple instances across AZs" — not EBS, but
   EFS.
8. "Automatic daily disk backups retained for 30 days" — Data Lifecycle
   Manager or AWS Backup.

## Numbers to remember

- gp3: 3000 IOPS and 125 MB/s baseline regardless of size, maximum 16,000
  IOPS and 1000 MB/s;
- gp2: 3 IOPS per GB, burst up to 3000 for volumes under 1 TB;
- io2 Block Express: up to 256,000 IOPS, 4000 MB/s, ratio up to 1000 IOPS per
  GB;
- st1 and sc1 start at 125 GB, optimized for sequential access;
- a volume lives in a single AZ; migration only happens through a snapshot;
- snapshots are incremental, the first one contains all occupied blocks;
- Multi-Attach: up to 16 instances in one AZ, io1 and io2 only.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "highest and most consistent IOPS for a database" | io2 Block Express |
| "throughput for large sequential logs at low cost" | st1 |
| "need more IOPS but not more capacity" | gp3 |
| "move the volume to another AZ" | snapshot, then create a volume in the target zone |
| "all new volumes must be encrypted" | encryption by default in account settings |
| "data must survive instance termination" | disable DeleteOnTermination |
| "shared access from many instances across AZs" | EFS, not EBS |
| "temporary scratch space with maximum speed" | instance store |

## Operations checklist

Expanding a volume: resize it, then extend the partition and file system
inside the OS. Changing type: Elastic Volumes on the fly, the optimizing
state can last hours, but the volume stays available. Moving between
accounts: share the snapshot (for an encrypted one, also share the KMS key),
copy the snapshot into your own account, create the volume. Regular backups:
a Data Lifecycle Manager policy or an AWS Backup plan with copying to another
Region for DR.

## Mini practicum

**1.** A 200 GB gp2 database is capped at 600 IOPS, with plenty of space
left.
→ Switch to gp3 and set the required IOPS independently of size.

**2.** An existing unencrypted volume needs to be encrypted.
→ Snapshot, copy the snapshot specifying a KMS key, create a new volume, and
swap it in.

**3.** An instance was restarted and its temporary data disappeared.
→ The data was on instance store; use an EBS volume for durability.

**4.** You need to guarantee that unencrypted volumes can no longer be
created in the Region.
→ Enable encryption by default in the account's and Region's EC2 settings.

## Related chapters

- Choosing an instance type and its EBS throughput limits — the EC2 chapter.
- Shared file access from multiple servers — the EFS and FSx chapter.
- Encrypting volumes and snapshots with KMS keys — the encryption chapter.
- Backup policies and Vault Lock — the governance chapter.
- Volume and snapshot cost, and right-sizing — the cost chapter.

## Bank audit

- {{q:887}} — preventing unencrypted volume creation is done with an account
  setting, not an AWS Config detective rule; the dump key was corrected.
