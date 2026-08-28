---
id: vpc
title: VPC — networking, routing, endpoints
order: 4
svc: [VPC]
---

# VPC

A VPC is an isolated network within a Region with its own address range. A subnet is
tied to a single AZ, so "a resource in two AZs" always means at least two subnets. A
convenient way to work through a networking question is the chain: addressing →
route → security group → NACL → where the traffic exits.

## Addressing and subnets

- CIDR from /16 to /28; it can't be changed after creation, but a secondary CIDR can
  be added;
- AWS reserves 5 addresses in every subnet: the network address, the VPC router, DNS,
  future use, and broadcast; a /24 subnet has 251 usable addresses;
- a public subnet differs from a private one by exactly one thing: its route table has
  a `0.0.0.0/0` route to an Internet Gateway;
- IPv6 addresses in AWS are always public; "privacy" is provided by an egress-only
  internet gateway, the IPv6 equivalent of NAT.

## Getting to the internet

| Mechanism | Direction | Notes |
|---|---|---|
| Internet Gateway | inbound and outbound | resource needs a public IP or Elastic IP |
| NAT Gateway | outbound only | managed, scales automatically, billed hourly and per GB |
| NAT Instance | outbound only | your own EC2 instance, must disable source/destination check |
| Egress-only IGW | outbound IPv6 only | free |

A NAT Gateway lives in a specific AZ. The fault-tolerant pattern is one NAT Gateway
per AZ, with each private subnet's route pointing to "its own" NAT: a zone failure
then doesn't break connectivity for the others, and there's no cross-AZ data-transfer
charge. A single NAT Gateway for the whole VPC is both a single point of failure and
extra cost from cross-AZ traffic.

NAT cost is a recurring theme in optimization questions: traffic to S3 and DynamoDB
through NAT is billed, but through a gateway endpoint it's free.

## Security groups and NACLs

| | Security group | Network ACL |
|---|---|---|
| Level | ENI (instance) | subnet |
| State | stateful: return traffic is allowed automatically | stateless: both directions need rules |
| Rules | allow only | allow and deny, evaluated by rule number |
| Scope | multiple SGs per ENI | one NACL per subnet |
| References | can reference another SG as the source | CIDR only |

Exam pattern: "block a specific attacker IP address" — that's a NACL with a deny
rule, because a security group can't deny anything. "Let the application reach the
database" — the database's security group referencing the application's security
group.

## Connecting networks

- VPC peering: one-to-one, non-transitive (A–B and B–C don't give you A–C), CIDRs
  must not overlap, works across Regions and accounts;
- Transit Gateway: a hub for hundreds of VPCs, VPN, and Direct Connect connections;
  supports route tables for segmentation and inter-Region peering — the answer for
  "many VPCs, centralized routing";
- PrivateLink (interface endpoint): access to a single service over a private IP
  without connecting the networks, CIDRs can overlap, traffic is one-way from
  consumer to service;
- VPN and Direct Connect — see the hybrid connectivity chapter.

Choosing between peering and PrivateLink: need access to the whole network — peering
or a Transit Gateway; need access to a single application and don't want to connect
the networks — PrivateLink.

## Endpoints

| Type | Services | How it works | Cost |
|---|---|---|---|
| Gateway endpoint | S3, DynamoDB | an entry in the route table | free |
| Interface endpoint (PrivateLink) | most AWS services and partner services | an ENI with a private IP + private DNS | hourly plus per GB |
| Gateway Load Balancer endpoint | third-party appliances | entry point into a GWLB | hourly plus per GB |

The key trap: a gateway endpoint exists only for S3 and DynamoDB. SQS, KMS, Secrets
Manager, ECR, Systems Manager, and everything else need an interface endpoint. The
requirement "traffic must not leave to the internet" + "the service isn't S3 or
DynamoDB" = interface endpoint.

Access through an endpoint is restricted by an endpoint policy, and on the bucket side
by the `aws:SourceVpce` condition in the bucket policy.

## DNS and name resolution

- the VPC attributes `enableDnsSupport` and `enableDnsHostnames` turn on
  AmazonProvidedDNS at the VPC+2 address;
- Route 53 Resolver endpoints: inbound — so an on-premises network can resolve a
  private hosted zone in AWS; outbound with forwarding rules — so AWS can resolve
  corporate zones;
- a private hosted zone is associated with one or more VPCs;
- with an interface endpoint, enabling private DNS swaps the service's public name for
  the private address, so the application doesn't need to change.

## Observability

VPC Flow Logs record connection metadata (who, where, port, ACCEPT or REJECT) to
CloudWatch Logs, S3, or Kinesis Data Firehose. They don't show packet contents — for
that you need Traffic Mirroring. The answer to "figure out why traffic isn't arriving"
= Flow Logs; "analyze the payload and run an IDS" = Traffic Mirroring. Reachability
Analyzer and Network Access Analyzer check reachability and access policy statically,
without sending any traffic.

## What the exam asks

1. "Instances in a private subnet need to download updates" — a NAT Gateway in a
   public subnet and a route from the private subnet.
2. "Reduce the cost of accessing S3 from private subnets" — gateway endpoint.
3. "Traffic to SQS/KMS must not go over the internet" — interface endpoint.
4. "Connect 50 VPCs and an on-premises network without a peering mesh" — Transit
   Gateway.
5. "Expose your own SaaS application to customers in their VPCs" — PrivateLink with
   an endpoint service.
6. "Block a specific address" — NACL deny.
7. "Find out who's connecting to the instance" — Flow Logs.
8. "Overlapping CIDRs between two companies after a merger" — PrivateLink or NAT;
   peering is impossible in that case.

## Designing the address space

Practical rule: pick a /16 for the VPC and a /24 per subnet, leaving room for future
AZs and for subnets dedicated to endpoint ENIs, databases, and Transit Gateway
attachments. Ranges must not overlap with either the on-premises network or partner
networks — otherwise peering and VPN become impossible, and the only remaining
options are PrivateLink or NAT with translation.

Standard layout across three AZs:

| Subnet | Purpose | Default route |
|---|---|---|
| public-a/b/c | ALB, NAT Gateway, bastion | Internet Gateway |
| app-a/b/c | EC2, ECS, Lambda with VPC access | NAT Gateway in its own AZ |
| data-a/b/c | RDS, ElastiCache, Redshift | no outbound route |
| tgw-a/b/c | Transit Gateway attachments | Transit Gateway |

A database subnet with no route to the internet is the simplest way to satisfy the
requirement "the database must not be reachable from the internet": even a
misconfigured security group won't make it public.

## Segmentation and centralized egress

In large landscapes, outbound traffic is consolidated into a dedicated egress VPC:
private VPCs send `0.0.0.0/0` to a Transit Gateway, and the NAT Gateway and Network
Firewall live in one place. This is cheaper than a NAT Gateway in every VPC and gives
a single point of filtering. The tradeoff is that cross-AZ and inter-VPC traffic
through the TGW is billed per GB, so for two or three VPCs this pattern is usually
overkill.

Shared VPC via AWS RAM lets one account own the network while other accounts launch
resources into its subnets. The answer to "centralized network management across
dozens of application accounts."

## Numbers to remember

- address block size from /16 to /28; AWS reserves 5 addresses in every subnet;
- additional address blocks can be added to a network, but they must not overlap with
  a peered neighboring network;
- a security group is connection-state aware and contains only allow rules; a network
  ACL is stateless, its rules are numbered and can deny, which means response traffic
  needs the ephemeral port range 1024–65535 allowed;
- a NAT Gateway scales to 100 Gbps and supports up to 55,000 simultaneous connections
  to a single destination; billed hourly and per gigabyte;
- peering is not transitive: three networks need three connections, while a Transit
  Gateway needs one attachment from each;
- a gateway endpoint exists only for S3 and DynamoDB and costs nothing; an interface
  endpoint is billed hourly and per traffic, but works for dozens of services;
- Flow Logs don't show calls to 169.254.169.254, to Amazon DNS, or to DHCP.

## Mini practicum

**1.** Instances in a private subnet need outbound internet access for updates,
inbound connections are not allowed.
→ A NAT Gateway in a public subnet with a default route pointing to it.

**2.** Same requirement, but with IPv6 addresses.
→ Egress-only internet gateway: a NAT Gateway doesn't support IPv6.

**3.** Traffic to S3 must not leave the AWS network, and paying for NAT isn't
desired.
→ A gateway endpoint for S3: it's free and removes the need to go through NAT.

**4.** A handful of addresses are flooding the site with requests and need to be
blocked quickly.
→ A deny rule in a network ACL: security groups have no deny rules.

## Bank audit

- {{q:125}} — PDF defect: the fifth option is labeled D instead of E; relabeled in the
  data, the answer is AE.
- {{q:835}} — disputed question: private access to S3 over Direct Connect, public VIF
  versus interface endpoint — the difference is specifically about cost.
- {{q:878}} — disputed question: granting account owners access to a shared mailbox
  conflicts with the requirement for maximum security.
