---
id: file-storage
title: File storage: EFS and FSx
order: 12
svc: [EFS, FSx]
---

# File storage

When several servers need the same mutable set of files with ordinary file semantics,
S3 doesn't fit — you need network file access. The choice comes down to protocol and to
whose stack it is: Linux, Windows, or something specialized.

## EFS

An elastic NFS v4.1 file system for Linux. It grows and shrinks on its own, mounts
simultaneously from thousands of clients across multiple AZs, and bills for the storage
actually used.

- availability modes: Regional (multiple AZs, the standard for fault tolerance) and One
  Zone (cheaper, but dependent on a single zone);
- storage classes: Standard and Infrequent Access, moved between by a lifecycle policy,
  plus Archive for rarely touched data;
- performance modes: General Purpose (low latency, the default) and Max I/O (higher
  throughput, higher latency);
- throughput modes: Bursting, Provisioned, and Elastic;
- access is mounted through a mount target in each AZ; the mount target's security group
  must allow port 2049 from clients;
- Access Points define an entry point with a fixed user and directory — handy for
  multi-tenant applications and for Lambda;
- encryption at rest (KMS) and in transit (TLS), a file system policy for access
  control, IAM integration;
- an EFS replica in another Region is made through EFS replication or via AWS Backup.

When EFS is the right answer: a content directory shared by multiple web servers, home
directories, shared data for ECS/EKS containers, file processing where the application
only knows file access.

## FSx: four different services

| Option | Protocol | Profile | Typical scenario |
|---|---|---|---|
| FSx for Windows File Server | SMB | Active Directory integration, NTFS ACLs, DFS | Windows file shares, migration from file servers |
| FSx for Lustre | Lustre (POSIX) | hundreds of GB/s, ties into S3 | HPC, ML training, large dataset processing |
| FSx for NetApp ONTAP | NFS, SMB, iSCSI | snapshots, deduplication, SnapMirror | NetApp migration, multi-protocol access |
| FSx for OpenZFS | NFS | ZFS snapshots, low latency | migration from ZFS servers, dev environments |

Key cues in the question text: "Windows applications," "SMB," "Active Directory" — FSx
for Windows; "high-performance computing," "machine learning training," "process data
from S3 at high speed" — FSx for Lustre; "NetApp," "multi-protocol," "SnapMirror" —
ONTAP; "ZFS snapshots" — OpenZFS.

FSx for Lustre can link to an S3 bucket: objects appear as files, and results export
back out. That's the standard answer to "data lives in S3, but the compute cluster needs
fast POSIX access."

## Comparison with other storage types

| Trait | S3 | EFS | FSx Windows | EBS |
|---|---|---|---|---|
| Access | HTTP API | NFS | SMB | block device |
| Shared across many servers at once | yes | yes | yes | only io1/io2 Multi-Attach in one AZ |
| Across AZs | yes | yes (Regional) | yes (Multi-AZ) | no |
| Partial overwrite | no | yes | yes | yes |
| Price | lowest | medium | medium and up | depends on volume type |

## Backup

EFS and FSx integrate with AWS Backup: schedules, retention periods, copies to another
Region and account, Vault Lock for immutable copies. For EFS, an "EFS-to-EFS backup"
CloudFormation solution used to be recommended — that's a legacy template, not a
service, and it's the wrong answer in current questions.

## Performance and cost

- EFS is billed for storage and, in Provisioned mode, for throughput; moving cold files
  to IA cuts the bill substantially;
- One Zone options are roughly half the price but don't survive a zone failure;
- FSx is billed for provisioned capacity, throughput, and backups;
- Lustre in scratch mode is cheaper and isn't replicated — good for temporary
  computation; persistent is for long-lived data.

## What the exam asks

1. "Several EC2 instances in different AZs write to the same directory" — EFS.
2. "A Windows application requires SMB and domain ACLs" — FSx for Windows File Server.
3. "Model training reads terabytes from S3 at maximum speed" — FSx for Lustre with a
   data repository association.
4. "An application cluster in one AZ needs a shared volume with maximum IOPS" — io2
   Multi-Attach, or instance store if losing the data is acceptable.
5. "Migrate an on-premises NetApp system while keeping snapshots" — FSx for NetApp
   ONTAP.
6. "Lower the cost of shared storage where 80 percent of files haven't been touched in
   months" — EFS lifecycle into Infrequent Access.
7. "Replicate the file system to another Region" — EFS replication or AWS Backup.
8. "Files only need to be accessed as objects through an API" — that's S3, no file
   service needed.

## Numbers to remember

- EFS: NFS v4.1, port 2049, up to thousands of clients, no fixed file system size;
- EFS IA is roughly 10x cheaper than Standard, with a per-access charge;
- EFS One Zone is roughly half the price of Regional, but lives in a single AZ;
- FSx for Windows: SMB, AD integration, Multi-AZ as a separate option at creation;
- FSx for Lustre: throughput in the hundreds of GB/s, scratch (no replication) and
  persistent (replicated) file systems;
- FSx for Lustre links to an S3 bucket and imports object metadata as files.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "shared file system for Linux instances across AZs" | EFS |
| "SMB shares, Active Directory, NTFS ACLs" | FSx for Windows |
| "HPC, machine learning training, sub-millisecond, from S3" | FSx for Lustre |
| "NetApp, SnapMirror, multi-protocol" | FSx for NetApp ONTAP |
| "ZFS snapshots" | FSx for OpenZFS |
| "lower cost for files not accessed in months" | EFS lifecycle into IA |
| "object storage over HTTP" | S3, no file service needed |
| "single instance needs a fast local disk" | EBS io2 or instance store |

## Mounting and permissions

EFS is mounted via the file system's DNS name; for Lambda and containers, an Access
Point with a fixed UID and root directory is used instead. Access is restricted by two
layers: the security group on the mount target (port 2049 from client groups) and the
file system policy with the actions `elasticfilesystem:ClientMount` and `ClientWrite`.
For FSx for Windows, permissions are governed by domain ACLs, and the AD service account
must have rights to join the domain — a detail that comes up in questions about
migrating file servers.

## Mini practicum

**1.** A dozen web servers across three AZs need to serve the same directory of
user-uploaded files.
→ EFS Regional: it mounts in every zone and grows automatically.

**2.** A Windows application requires an SMB share with domain-group permissions.
→ FSx for Windows File Server integrated with Active Directory.

**3.** A model-training cluster reads 20 TB from S3 and is bottlenecked on speed.
→ FSx for Lustre linked to the bucket: objects appear as files, throughput in the
hundreds of GB/s.

**4.** 80 percent of the files in EFS haven't been opened in six months, and the bill
keeps growing.
→ An EFS lifecycle policy into Infrequent Access, and Archive if needed.

## Related chapters

- Object storage and choosing between file and object — the S3 chapter.
- Block volumes, when access is needed from a single instance — the EBS chapter.
- Migrating file shares to the cloud and hybrid access — the data migration chapter.
- Mounting shared volumes into tasks and pods — the containers chapter.
- Centralized backups for EFS and FSx — the governance chapter.

## Bank audit

- {{q:842}} — cross-Region replication of EFS: done with AWS Backup, and the
  "EFS-to-EFS backup" solution is legacy; the dump key was corrected.
