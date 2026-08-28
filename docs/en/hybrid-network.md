---
id: hybrid-network
title: Hybrid networking: Direct Connect, VPN, Transit Gateway, PrivateLink
order: 14
svc: [Direct Connect, Transit Gateway, PrivateLink, Outposts]
---

# Hybrid connectivity

The task is to connect an on-premises network to AWS in a way that meets requirements
for throughput, latency consistency, privacy, and cost. Four building blocks:
Site-to-Site VPN, Direct Connect, Transit Gateway, and PrivateLink.

## Site-to-Site VPN

An IPSec tunnel over the internet between a customer gateway and a virtual private
gateway or Transit Gateway. Always two tunnels to different AWS endpoints for fault
tolerance.

- comes up in minutes, billed hourly plus data transfer;
- a single tunnel's throughput is around 1.25 Gbps, and it scales with ECMP through
  Transit Gateway;
- latency and jitter depend on the internet — there's no predictability;
- encryption is built in;
- typical roles: a quick start, a backup for Direct Connect, connecting branch offices.

Accelerated Site-to-Site VPN routes the tunnel through the Global Accelerator network,
reducing the impact of the public internet.

## Direct Connect

A dedicated physical connection from your equipment into an AWS point of presence:
1, 10, 100 Gbps (dedicated) or sub-rates through a partner (hosted).

- predictable latency and throughput, cheaper outbound data transfer;
- takes weeks or months to provision — the wrong answer whenever the requirement is
  "needed in two days";
- doesn't encrypt traffic on its own: if encryption on top of DX is required, you run
  IPSec VPN over it or use MACsec on supported ports;
- virtual interface types: private VIF — into a VPC through a VGW, transit VIF — into a
  Transit Gateway, public VIF — to public AWS endpoints (S3, DynamoDB) bypassing the
  internet;
- fault tolerance: two connections at different points of presence, or DX plus VPN as a
  backup (the standard low-cost option), or Direct Connect SiteLink between your own
  sites;
- a Link Aggregation Group bundles ports into a single logical link.

## What to choose

| Requirement | Answer |
|---|---|
| Connect an office to a VPC within a day | Site-to-Site VPN |
| Consistent latency for a latency-sensitive application | Direct Connect |
| Lowest possible cost with heavy outbound traffic | Direct Connect |
| Fast and encrypted, budget limited | VPN |
| DX already exists, need a backup | VPN as backup |
| Connect 50 VPCs and an on-premises network | Transit Gateway |
| Give a partner access to just one application | PrivateLink |

## Transit Gateway

A regional hub: VPCs, VPN, Direct Connect gateway, and other TGWs connect through
attachments, and routing is defined with route tables. Capabilities that get tested:
transitive routing (unlike peering), segmenting environments with separate route
tables, inter-Region peering, multicast, centralized internet egress, and centralized
traffic inspection through Network Firewall or a GWLB.

Cost: an hourly charge per attachment plus a charge for processed traffic, so for just
two VPCs, peering is usually cheaper.

## PrivateLink

An interface endpoint with a private IP in your subnet that leads to an AWS service, a
partner service, or your own service behind an NLB (an endpoint service). The traits it
gets chosen for: the networks don't connect, CIDR ranges can overlap, traffic is
one-directional (consumer to provider), and access is restricted by an endpoint policy.

Classic scenario: a SaaS company gives customers access to its API without VPN or
peering; or a large organization publishes an internal service to hundreds of accounts.

## Hybrid DNS

For on-premises servers to resolve AWS private zones, you create a Route 53 Resolver
inbound endpoint; for AWS resources to resolve corporate zones, an outbound endpoint
with forwarding rules. Rules are shared between accounts through RAM. This pair of
endpoints is the standard answer to "names don't resolve between the data center and the
cloud."

## On-premises extensions of AWS

- Outposts — an AWS rack or server in your data center, the same APIs, for data
  residency and latency requirements toward local systems;
- Local Zones — AWS sites in major cities for single-digit-millisecond latency;
- Wavelength — zones inside 5G carrier networks;
- Storage Gateway and DataSync — see the data migration chapter;
- ECS Anywhere and EKS Anywhere run container orchestrators on your own hardware.

## What the exam asks

1. "We need consistent latency and high throughput to the data center" — Direct
   Connect, plus VPN if encryption is required.
2. "DX is already being built, but the connection is needed now" — VPN, temporarily.
3. "Connect dozens of VPCs without a peering mesh" — Transit Gateway.
4. "A partner needs access only to our API, networks can't be connected" —
   PrivateLink.
5. "Backup for Direct Connect at minimal cost" — Site-to-Site VPN.
6. "The application must run on-site because of data requirements" — Outposts.
7. "On-premises servers can't see RDS names in the VPC" — Resolver inbound endpoint.
8. "Access S3 from the data center bypassing the internet" — public VIF over Direct
   Connect or an interface endpoint, the choice depending on cost and requirements.

## Numbers to remember

- Site-to-Site VPN: always two tunnels, about 1.25 Gbps per tunnel, comes up within
  minutes;
- Direct Connect: 1, 10, 100 Gbps dedicated, sub-rates hosted, lead time of weeks to
  months;
- Direct Connect doesn't encrypt traffic on its own;
- Transit Gateway: thousands of attachments, billed per attachment and per processed
  traffic, supports inter-Region peering;
- PrivateLink: one-directional access, consumer → provider, CIDR ranges can overlap;
- VPC peering: not transitive, CIDR ranges must not overlap.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "consistent latency, dedicated bandwidth" | Direct Connect |
| "connect quickly, encrypted, low cost" | Site-to-Site VPN |
| "backup for Direct Connect" | VPN as a backup path |
| "hundreds of VPCs, central routing" | Transit Gateway |
| "expose one service to customers without connecting networks" | PrivateLink |
| "overlapping CIDR ranges after a merger" | PrivateLink or NAT, not peering |
| "resolve on-premises names from AWS" | Resolver outbound endpoint with rules |
| "run AWS services in our data center" | Outposts |

## How to work through a hybrid question

1. What are we connecting: network to network (VPN, DX, TGW) or consumer to service
   (PrivateLink)?
2. Timeline: days — VPN; months acceptable — Direct Connect.
3. Encryption requirement: DX alone doesn't provide it.
4. Scale: two or three VPCs — peering; dozens — Transit Gateway.
5. Address overlap: if CIDR ranges match, routing is impossible in principle.
6. Redundancy: two DX connections at different points of presence, or DX plus VPN.

## Mini practicum

**1.** A company is migrating its ERP to AWS and needs consistent latency to the data
center, with go-live in six months.
→ Direct Connect; Site-to-Site VPN while it's being built.

**2.** An audit requirement: traffic between the data center and AWS must be encrypted,
and the link must be dedicated.
→ Direct Connect plus IPSec VPN on top of it (or MACsec on supported ports).

**3.** The organization has 40 VPCs across two Regions and two data centers.
→ Transit Gateway in each Region, inter-Region peering, attachments for VPN and DX.

**4.** A SaaS provider gives access to its API, networks can't be connected, and
addressing overlaps.
→ PrivateLink: an interface endpoint in your VPC, no routing needed between the
networks.

## Bank audit

- {{q:835}} — disputed: access to S3 over Direct Connect, public VIF versus interface
  endpoint; a question of pricing, not technical feasibility.
- {{q:754}} — disputed: a static IP requirement points to Global Accelerator, since
  CloudFront has no static addresses.
