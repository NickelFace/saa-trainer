---
id: cost
title: Cost and optimization
order: 22
svc: [Cost Explorer, Budgets, Organizations]
---

# Cost

The "Design Cost-Optimized Architectures" domain accounts for a fifth of the exam, but
cost considerations show up in nearly every question: phrasing like "MOST
cost-effective," "minimize cost," "as low as possible" decides between technically
equivalent options.

## What makes up the bill

| Category | What's billed | How it's reduced |
|---|---|---|
| Compute | instance hours or seconds, Lambda GB-seconds, Aurora ACUs | Savings Plans, RI, Spot, right sizing, shutting down idle resources |
| Storage | GB per month by class, snapshots, backups | storage classes, lifecycle, deleting old snapshots |
| Traffic | outbound to the internet, between AZs, between regions, through NAT | CloudFront, endpoints, traffic locality |
| Requests and operations | API calls, RCU/WCU, load balancer LCUs, KMS requests | batching, caching, Bucket Keys |
| Managed services | hourly rates for NAT, TGW attachments, interface endpoints | consolidation, dropping unnecessary components |

Inbound traffic into AWS is free; outbound traffic costs money. Cross-AZ traffic is
billed in both directions; traffic within a single AZ over private addresses is free.
That explains a good half of the "cheap" answers: removing cross-zone hops, serving
content through CloudFront, replacing NAT with a gateway endpoint.

## Compute pricing models

Quick guide to the choice:

- steady 24/7 workload → Savings Plans (Compute for flexibility, EC2 Instance for the
  maximum discount) or Reserved Instances;
- interruptible batch jobs → Spot, up to 90 percent cheaper;
- infrequent short-lived tasks → Lambda or Fargate, you pay only for execution;
- development environments → a start/stop schedule (Instance Scheduler), Aurora
  Serverless v2, stopping RDS;
- spikes on top of a baseline → On-Demand or Spot layered on top of a reserved base.

## Tools

- Cost Explorer — analyzes and forecasts spend, breaks it down by service, tag, and
  account, and recommends RI and Savings Plans;
- AWS Budgets — budgets by cost, usage, or RI coverage, with notifications and
  automated actions (for example, applying a restrictive policy);
- Cost and Usage Report — line-item detail in S3 for analysis in Athena and QuickSight;
- Compute Optimizer — recommendations on instance types, EBS volumes, Lambda functions,
  and ASGs based on actual metrics;
- Trusted Advisor — checks across five categories, including idle resources and unused
  RIs (the full set of checks requires Business or Enterprise support);
- S3 Storage Lens and Storage Class Analysis — what to move to colder storage classes;
- Billing Conductor and cost allocation tags — splitting spend across teams.

Division of labor: Budgets warns and acts on a threshold, Cost Explorer explains the
past and forecasts the future, Compute Optimizer says what to downsize, Trusted Advisor
finds the obvious waste.

## Common architecture findings

| Symptom | Cheap fix |
|---|---|
| Traffic from private subnets to S3 goes through NAT | gateway endpoint |
| One NAT Gateway serves three AZs | a NAT per AZ (less cross-AZ traffic) |
| Serving static content from EC2 | S3 plus CloudFront |
| Logs and archives have sat in S3 Standard for years | lifecycle into Glacier or Deep Archive |
| Snapshots pile up with no policy | Data Lifecycle Manager, AWS Backup |
| Dev instances run overnight and on weekends | a stop schedule |
| Oversized instances | Compute Optimizer, move to gp3, T-family |
| Lots of small objects in Standard-IA | move back to Standard or aggregate them |
| Separate accounts buying RIs independently | consolidated billing in Organizations |
| A database cluster sits idle at night | Aurora Serverless v2 or stopping it |

## The cost of reliability

The exam often pits cost against fault tolerance. Rules of thumb: One Zone classes and
a single AZ are cheaper but don't survive a zone outage; pilot light is cheaper than
warm standby but recovers slower; replication to another region always adds both
storage and traffic cost. If a question contains both "cost-effective" and "highly
available," pick the cheapest option among those that actually meet the availability
requirement — not the cheapest option overall.

## What the exam asks

1. "Reduce the cost of a steady round-the-clock workload" — Savings Plans or RI.
2. "Processing can be interrupted" — Spot.
3. "Data is read once a year, retrieval within hours is acceptable" — Glacier Deep
   Archive.
4. "The NAT bill is too high" — endpoints for S3 and DynamoDB.
5. "Need a warning when the budget is exceeded" — AWS Budgets with SNS.
6. "Understand which instances are oversized" — Compute Optimizer.
7. "Split spend across teams" — cost allocation tags and Cost Explorer.
8. "Many accounts, want shared discounts" — Organizations with consolidated billing.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "steady 24/7 workload, lowest cost" | Savings Plans or RI |
| "fault-tolerant batch jobs" | Spot |
| "accessed once a year, retrieval in hours is fine" | Glacier Deep Archive |
| "NAT gateway data processing charges" | gateway endpoints for S3 and DynamoDB |
| "alert when spending exceeds a threshold" | AWS Budgets |
| "which instances are oversized" | Compute Optimizer |
| "allocate costs to teams" | cost allocation tags and Cost Explorer |
| "multiple accounts, volume discounts" | Organizations with consolidated billing |

## Order of operations for optimizing an architecture

1. Remove idle resources: unattached Elastic IPs, old snapshots, unused volumes, test
   environments running overnight.
2. Right-size: Compute Optimizer, gp3 instead of gp2, current instance generations.
3. Cover the baseline load with commitments: Savings Plans, RI, leaving spikes to
   On-Demand and Spot.
4. Move data to the right storage class and turn on lifecycle policies.
5. Cut unnecessary traffic: CloudFront for delivery, endpoints instead of NAT, AZ
   locality.
6. Replace self-managed components with managed ones wherever that's cheaper on a total
   cost of ownership basis (RDS instead of a database on EC2, Fargate instead of a node
   cluster).
7. Put controls in place: budgets, tags, regular review with Cost Explorer and Trusted
   Advisor.

## Mini practicum

**1.** The NAT Gateway bill exceeds the cost of the instances themselves; most of the
traffic goes to S3.
→ A gateway endpoint for S3: traffic stops going through NAT and isn't billed.

**2.** Test environments run around the clock but are only used from 9 to 6 on
weekdays.
→ A start/stop schedule (Instance Scheduler or EventBridge with SSM Automation).

**3.** Five accounts buy reservations separately and don't fully utilize them.
→ An organization with consolidated billing: discounts and RI coverage are shared
across accounts.

**4.** Five years of log archives sit in S3 Standard, read once a year for an audit
request.
→ Lifecycle into Glacier Deep Archive, if retrieval within hours is acceptable.

## Related chapters

- Compute purchasing models — the EC2 chapter.
- Storage classes and lifecycle — the S3 chapter.
- Traffic, NAT, and endpoints — the VPC chapter.
- Caching and reducing outbound traffic — the CloudFront chapter.
- Serverless database options — the Aurora and DynamoDB chapters.

## Wording traps

The word "cost-effective" in a question doesn't mean "the cheapest option on the list":
it means "the cheapest option among those that meet all the other requirements." If
"highly available" or "no data loss" appears alongside it, single-AZ options with no
replication are eliminated, even if they're cheaper.

The reverse trap is "operational overhead." A managed service is often more expensive
on the bill, but wins when the requirement is phrased around effort, not money. Read
carefully what's actually supposed to be minimized: cost, recovery time, or the amount
of administration.

## Numbers to remember

- commitments run for 1 or 3 years: Compute Savings Plans up to 66% savings, EC2
  Instance Savings Plans and standard Reserved Instances up to 72%, convertible ones
  around 54%, Spot Instances up to 90%;
- all upfront is cheaper than partial upfront, partial upfront is cheaper than no
  upfront;
- cost data refreshes no more than once a day, so no tool gives instant spend
  visibility;
- Cost Explorer shows 12 months of history and forecasts 12 months ahead; hourly
  granularity and resource-level data are opt-in add-ons that cost extra;
- the first two budgets in AWS Budgets are free; each additional budget is billed per
  day;
- cost allocation tags must be activated manually and don't work retroactively: they
  only appear in reports from the moment of activation;
- cross-AZ traffic within a region is billed; traffic within a single AZ over private
  addresses is free;
- a NAT gateway is billed both hourly and per gigabyte, which is why cost-saving
  questions often replace it with a gateway endpoint.

## Bank audit

- {{q:245}} — disputed: cutting cost on a dev environment; changing the target group
  doesn't reduce the ASG's instance count.
- {{q:308}} — low confidence: Trusted Advisor recommendations on RDS RIs.
- {{q:574}} — disputed: two hours of use per week; Serverless v2 vs. stopping a
  provisioned cluster.
- {{q:851}} — disputed: Aurora Serverless scales down when idle.
- {{q:835}} — disputed: public VIF vs. an interface endpoint for access to S3.
