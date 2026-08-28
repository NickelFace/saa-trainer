---
id: ec2
title: EC2 — compute and purchasing models
order: 2
svc: [EC2]
---

# EC2

A virtual machine in someone else's data center: you're responsible for the
OS, patches, the application, and configuration; AWS is responsible for the
hypervisor, hardware, and network. On the exam, EC2 almost always competes
with managed services, and the question "do we even need EC2 here" is worth
asking first.

## Instance families

| Family | Letters | Profile | Typical workloads |
|---|---|---|---|
| General purpose | T, M | balanced | web servers, small databases, applications |
| Compute optimized | C | high CPU-to-memory ratio | batch processing, HPC nodes, video encoding |
| Memory optimized | R, X, z1d | high memory | in-memory caches, SAP HANA, large DBMS |
| Storage optimized | I, D, H | local NVMe/HDD | high-IOPS NoSQL, data warehouse nodes |
| Accelerated | P, G, Inf, Trn | GPU and accelerators | model training and inference, graphics |

The T family runs on CPU credits: a baseline level plus accumulated credits.
Once credits run out, in standard mode the instance is throttled; in
unlimited mode it runs at full speed for an extra charge. Sustained high
utilization on a T instance is a typical design mistake — the fix is to move
to M or C.

If the question says "high memory utilization" and is asking you to pick an
instance type, the answer is memory optimized for every component with high
memory usage, whether it's the application or the database.

## Purchasing models

| Model | Discount | Commitment | When |
|---|---|---|---|
| On-Demand | none | none | unpredictable load, development, spikes |
| Savings Plans | up to 72% | hourly spend commitment for 1 or 3 years | baseline load, flexibility across instance types |
| Reserved Instances | up to 72% | specific configuration for 1 or 3 years | steady load, needs capacity reservation |
| Spot | up to 90% | none, interruption with 2-minute notice | fault-tolerant batch workloads |
| Dedicated Host | — | physical server | socket-bound licensing, regulatory requirements |
| Dedicated Instance | — | hardware-level isolation | isolation requirements without license binding |

Distinctions the exam likes to test:

- Compute Savings Plans apply to EC2, Fargate, and Lambda and aren't tied to
  a Region, family, or OS; EC2 Instance Savings Plans are cheaper but lock in
  a family and Region;
- Standard RIs give the maximum discount but can't change family;
  Convertible RIs can be exchanged for a different configuration;
- Capacity Reservation reserves capacity in an AZ and doesn't itself provide
  a discount; the discount comes from adding RIs or Savings Plans;
- Spot can't be used where interruption is unacceptable; Spot Fleet and an
  ASG with a mixed instances policy blend On-Demand and Spot in a single
  group.

A typical design for a steady service with peaks: baseline capacity on
Savings Plans or RIs, peaks on On-Demand, background batch jobs on Spot.

## Instance storage

- EBS — a network volume that survives an instance stop, snapshots go to S3,
  encrypted with KMS.
- Instance store — the hypervisor's physical disk, maximum IOPS, but data
  disappears on stop or host failure. The answer wherever you need a
  temporary cache or scratch space.
- The root volume is deleted on terminate by default; additional volumes are
  not.

## Placement and networking

Placement groups:

- Cluster — instances in a single AZ and a single rack, minimal latency and
  up to 100 Gbps between nodes; the answer for HPC and tightly coupled
  computation;
- Spread — instances on distinct hardware, maximum 7 per AZ; the answer for
  a handful of critical nodes that must not fail together;
- Partition — independent groups of racks, up to 7 partitions per AZ; the
  answer for HDFS, Cassandra, Kafka, where the cluster itself is aware of the
  topology.

Networking options: ENA and Enhanced Networking by default on modern types,
EFA for HPC with MPI, multiple ENIs to separate management and data traffic.

## Metadata, roles, and bootstrapping

- An IAM role is granted to an instance through an instance profile; keys
  baked into an AMI or stored in files are always the wrong answer.
- IMDSv2 (session-oriented) protects against SSRF theft of temporary
  credentials — require it whenever a question is about metadata
  compromise.
- User data runs once, on first launch, via cloud-init.
- A golden AMI reduces launch time and makes configuration reproducible; EC2
  Image Builder automates image building and patching.

## Lifecycle and maintenance

- Stop/Start moves the instance to a different host, and the public IPv4
  address changes (unless it's an Elastic IP);
- Hibernate saves RAM to the root volume and restores state;
- Auto Recovery and Scheduled Maintenance events handle hardware
  degradation;
- Systems Manager Session Manager gives console access without SSH, open
  ports, or a bastion host — the correct answer in nearly every question
  about "how to safely reach an instance in a private subnet."

## What the exam asks

1. "Reduce the cost of steady, round-the-clock load without changing the
   architecture" — Savings Plans or RIs, not Spot and not ASG.
2. "Batch processing, the job can be restarted" — Spot, often paired with
   SQS.
3. "License tied to physical sockets, BYOL" — Dedicated Host, not Dedicated
   Instance.
4. "Latency between cluster nodes must be minimal" — cluster placement
   group.
5. "Instances must not fail together because of a single node" — spread
   placement group.
6. "Administrator access without open ports or keys" — SSM Session Manager.
7. "The application can't be rewritten, but OS administration needs to go
   away" — first consider Elastic Beanstalk or containers, only then EC2
   with automation.
8. "Need peak disk performance only during processing" — instance store or
   io2 Block Express, not a larger gp2 volume.

## Monitoring and limits

CloudWatch collects hypervisor-level metrics by default: CPU, disk, and
network at the device level, plus status checks. The hypervisor can't see
memory or file-system utilization — those come from the CloudWatch agent
inside the OS. A question about "need to alert on EC2 memory" is always
solved by installing the agent, not by built-in metrics.

Detailed monitoring moves metrics from a 5-minute interval to 1 minute and
affects how fast Auto Scaling reacts. Regional vCPU quotas are counted per
family (On-Demand Standard and Spot separately) and are raised through
Service Quotas — a frequent answer to "can't launch the required number of
instances."

## EC2 versus managed services

| Requirement | EC2 fits | Better choice |
|---|---|---|
| Full control over OS and kernel needed | yes | — |
| Non-standard software with socket-based licensing | yes, Dedicated Host | — |
| Web application on a standard stack | possible | Elastic Beanstalk, ECS Fargate |
| Event-driven processing in seconds | no | Lambda |
| Batch jobs with a queue | possible | AWS Batch, ECS on Spot |
| Relational database | almost never | RDS, Aurora |

Phrasing like "minimize operational overhead," "least management effort," "no
servers to manage" almost always steers the answer away from EC2 toward a
managed service. The reverse cue: "legacy application that cannot be
modified," "requires access to the operating system," "custom kernel
modules" — stay on EC2.

## Licensing and compliance

License Manager tracks license usage tied to cores, sockets, or hosts and
blocks launches beyond the limit. For BYOL Windows and SQL Server tied to
physical hardware, you need a Dedicated Host, which exposes sockets and
physical cores. Dedicated Instance isolates hardware but doesn't provide
visibility or socket binding, so it's the wrong answer in licensing
questions.

## Numbers to remember

- billing is per-second with a 60-second minimum (Linux); Windows and some
  Marketplace images are billed hourly;
- commitments run for 1 or 3 years: Compute Savings Plan gives up to 66%
  savings, EC2 Instance Savings Plan and standard Reserved Instances up to
  72%, convertible ones around up to 54%;
- Spot instances are up to 90% cheaper than On-Demand, and the interruption
  notice arrives 2 minutes ahead;
- spread placement group: no more than 7 instances in one Availability Zone;
  partition — up to 7 partitions per zone; cluster — a single Availability
  Zone;
- instance metadata is available at 169.254.169.254, IMDSv2 requires a
  session token, and that's exactly what questions about SSRF protection are
  asking for;
- user data runs only on first launch by default;
- an instance has two status checks: system status (AWS infrastructure) and
  instance status (its own operating system);
- instance store data is lost on stop and terminate, EBS volumes survive
  stop;
- Dedicated Host exposes sockets and cores — only it fits licenses tied to
  physical hardware.

## Mini practicum

**1.** An application runs around the clock, but in six months it's planned
to move to a different instance family.
→ Compute Savings Plan: the discount carries over across family, size, and
even service changes.

**2.** Batch jobs run six hours overnight; losing an instance just means
reprocessing.
→ Spot instances: exactly the workload profile they exist for.

**3.** Compute cluster nodes exchange data with each other, and network
latency matters.
→ Cluster placement group in a single Availability Zone.

**4.** A commercial software license was purchased per socket and core, and
the load is steady.
→ Dedicated Host with reservation: the license carries over, and the price
is lower than On-Demand.

## Bank audit

- {{q:554}} — an SAP application and SQL Server with high memory
  utilization: memory optimized for both components.
- {{q:245}} — disputed: reducing dev environment cost; swapping the target
  group by itself doesn't reduce the number of instances in the ASG.
- {{q:622}} — disputed: a sharp jump from thousands to millions of users,
  on-demand capacity scales instantly, provisioned Auto Scaling lags behind.
