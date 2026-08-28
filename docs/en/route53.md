---
id: route53
title: Route 53 — DNS and traffic routing
order: 17
svc: [Route 53]
---

# Route 53

A managed DNS service integrated with AWS services, with health checks and seven routing
policies. On the exam it's used as a tool for fault tolerance and global traffic
distribution, not just as zone hosting.

## Zones and records

- a public hosted zone serves names on the internet, a private hosted zone serves them
  inside specified VPCs;
- record types: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR;
- an alias record is an AWS extension: it points to an ALB, NLB, CloudFront, an S3
  website, API Gateway, Global Accelerator, or another record in the same zone. It's free
  and works at the domain root (zone apex), where CNAME is not allowed — this is a
  distinction tested in almost every set;
- TTL determines how quickly clients see a change: TTL is lowered ahead of a migration.

## Routing policies

| Policy | What it does | Typical requirement |
|---|---|---|
| Simple | one record, no health check | the basic case |
| Weighted | distribution by weight | canary release, a 10/90 migration |
| Latency-based | the region with the lowest network latency | "best performance for global users" |
| Failover | active-passive based on a health check | a DR setup with a standby site |
| Geolocation | by the user's country or continent | content localization, legal restrictions |
| Geoproximity | by distance, with an optional bias | gradually shifting traffic between regions |
| Multivalue answer | up to 8 healthy records in the response | simple load balancing without a load balancer |

The distinction between latency and geolocation is a recurring trap: "lowest latency"
means latency-based routing; "users from Germany must see the German site" means
geolocation.

## Health checks

Three kinds: checking an endpoint over HTTP/HTTPS/TCP, checking the status of other
checks (calculated), and checking a CloudWatch alarm. They're used in failover,
multivalue, and alongside DNS records for any policy. A health check tied to a CloudWatch
alarm is a way to monitor private resources that can't be polled from the internet.

An active-active setup across regions: a latency policy with a health check in each
region; active-passive: a failover policy with a primary that has a health check and a
secondary. In this setup, CloudFront does not perform origin health checks across
regions — Route 53 does.

## Domain registration and DNSSEC

Route 53 can be both the domain registrar and the zone host at the same time, but these
are independent functions: a domain registered with a third-party registrar can happily be
served by a zone in Route 53 by changing the NS records. DNSSEC signs the zone and
protects against response spoofing; it's enabled on a public hosted zone using a key in
KMS.

## Resolver and hybrid DNS

Route 53 Resolver handles name resolution inside a VPC. An inbound endpoint accepts
requests from an on-premises network, and an outbound endpoint with rules forwards
requests to corporate DNS. Rules are shared across accounts via RAM. Resolver DNS
Firewall blocks lookups of malicious domains and forms part of a defense against
exfiltration.

## Fault-tolerance patterns

| Task | Construction |
|---|---|
| A standby static site during an outage | failover to an S3 website or CloudFront |
| Load balancing across regions by performance | latency + health checks |
| Gradual migration to a new platform | weighted, with the weight changing over time |
| Data-localization requirements | geolocation |
| Simple load balancing without an ELB | multivalue answer |

## What the exam asks

1. "The domain root must point to an ALB" — an alias record, since CNAME on the apex is
   impossible.
2. "Users must land in the region with the lowest latency" — latency-based routing.
3. "Fail over to a standby region if the primary fails" — failover with a health check.
4. "Show different content per country" — geolocation.
5. "Roll out a new version to 5 percent of traffic" — weighted.
6. "On-premises servers must resolve a private hosted zone" — a Resolver inbound
   endpoint.
7. "The domain is registered with a third-party registrar" — keep the registrar, switch
   the NS records to Route 53.
8. "Need to switch traffic fast, but clients cache DNS for a long time" — lower the TTL
   in advance or use Global Accelerator with static IPs.

## Numbers to remember

- a health check polls the endpoint from multiple points around the world, at a 30- or
  10-second interval, and fails over after three consecutive failures;
- multivalue answer returns up to 8 healthy records;
- alias is free; regular queries are billed per million;
- a private hosted zone can be associated with multiple VPCs, including across accounts;
- default TTL is 300 seconds for new records; an alias inherits the TTL of its target;
- Resolver endpoints are billed hourly per IP address.

## How to read the wording

| In the question | Answer |
|---|---|
| "apex domain must point to a load balancer" | an alias record |
| "lowest latency for global users" | latency-based routing |
| "active-passive disaster recovery" | failover routing with a health check |
| "serve different content per country" | geolocation |
| "shift 10 percent of traffic to the new stack" | weighted routing |
| "on-premises servers must resolve AWS private names" | a Resolver inbound endpoint |
| "block malicious domain lookups" | Route 53 Resolver DNS Firewall |
| "need static IPs and instant failover" | Global Accelerator, not DNS |

## Full multi-region patterns

Active-passive: the primary region runs the application, the standby is in pilot light
or warm standby, and Route 53 failover switches based on the health check. RTO is
determined by how long it takes to scale up the standby plus the record's TTL.

Active-active: both regions serve traffic; a latency policy with health checks
distributes users, and data is synchronized via Aurora Global Database, DynamoDB global
tables, or S3 replication. This setup costs more, but RTO is measured in minutes or less.

A separate technique: a maintenance page on S3 as the secondary in a failover record — a
cheap way to show users a proper message instead of an error.

## Mini practicum

**1.** The domain example.com must point to an ALB; CNAME at the root doesn't work.
→ An alias A record to the load balancer: free and allowed at the zone apex.

**2.** An application is deployed across four regions, and users must land in the
fastest one.
→ Latency-based routing with a health check in each region.

**3.** The primary region goes down; traffic must switch to the standby automatically.
→ Failover routing: a primary with a health check, and a secondary — either a standby
stack or a maintenance page on S3.

**4.** On-premises servers can't resolve RDS names from a private hosted zone.
→ A Route 53 Resolver inbound endpoint, forwarding requests from the corporate DNS.

## Related chapters

- Caching and edge content delivery — the CloudFront chapter.
- Health checks and cross-region failover in DR setups — the recovery chapter.
- Private zones and Resolver in hybrid networks — the hybrid connectivity chapter.
- Load balancing within a region — the load balancers and Auto Scaling chapter.
- Certificates for your own domains — the encryption chapter.

## Bank audit

- {{q:447}} — a multi-region API on API Gateway and Lambda: active-active failover is
  built on Route 53 health checks; dump key corrected.
- {{q:692}} — disputed: "MOST high-performing" means latency routing; geolocation
  routes by geography, not by actual latency.
