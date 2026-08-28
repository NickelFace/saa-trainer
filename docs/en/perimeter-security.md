---
id: perimeter-security
title: Perimeter security and threat detection
order: 20
svc: [WAF, Shield, GuardDuty, Macie, Inspector, Cognito]
---

# Perimeter security

A layer of services that catch attacks, find vulnerabilities, and detect suspicious
activity. In questions, they're distinguished by what they protect: traffic, the account,
data, instances, and images.

## WAF

Filters HTTP requests at layer 7. It attaches to CloudFront, ALB, API Gateway,
AppSync, a Cognito user pool, and App Runner — but not to an NLB. A Web ACL is made up of
rules:

- managed rule groups from AWS and partners (OWASP Top 10, bots, known bad addresses);
- custom rules on IP, country, headers, body, length, regular expressions;
- rate-based rules cap the rate from a single address — the answer to "too many
  requests from one client" and to layer-7 floods;
- Bot Control and Fraud Control (protection against credential stuffing and fraudulent
  sign-ups);
- logging to Firehose, CloudWatch Logs, or S3.

A requirement to "block SQL injection and XSS" points to WAF, not a security group and not
a NACL.

## Shield

Shield Standard is included for everyone at no cost and protects against common
volumetric attacks at the network and transport layers. Shield Advanced (paid) adds
enhanced protection, a 24/7 response team (SRT), cost protection against a traffic-spike
bill, detailed visibility, and integration with WAF on managed rules. Phrases like
"dedicated DDoS response team", "cost protection", "advanced DDoS" point to Advanced.

## GuardDuty

Continuous threat detection over CloudTrail, VPC Flow Logs, DNS logs, plus EKS logs,
S3 events, RDS login logs, EBS snapshots (malware protection), and Lambda. It turns on in
minutes, with nothing to deploy on instances. It finds: cryptocurrency mining, calls to C2
servers, anomalous API calls, credential compromise, port scanning.

Phrases like "detect unusual activity", "compromised credentials", "no agents to
install" point to GuardDuty. Automating a response uses EventBridge and Lambda, while
Security Hub gives a centralized view of findings.

## Inspector

Scans for vulnerabilities: EC2 (via the SSM agent), images in ECR, and Lambda
functions. It runs continuously, matches packages against the CVE database, and scores
risk factoring in network reachability. The answer to "automatically check images and
instances for known vulnerabilities".

## Macie

Looks for sensitive data in S3: personal data, card numbers, access keys, tokens.
It builds a bucket inventory with risk scoring (public access, encryption, external
access). The phrase "discover PII in S3" always points to Macie.

## Security Hub, Detective, Config

- Security Hub aggregates findings from GuardDuty, Inspector, Macie, Config, and partner
  solutions, and checks compliance against standards (CIS, PCI DSS, AWS FSBP);
- Detective builds a graph of related events for incident investigation;
- Config records configurations and compliance rules, and can auto-remediate via SSM;
- CloudTrail records API calls and serves as a source of evidence.

## Network Firewall and DNS Firewall

AWS Network Firewall is a managed stateful firewall at the VPC level, with Suricata
rules, domain filtering, and IPS. It's deployed in an inspection VPC together with
Transit Gateway or a GWLB. Route 53 Resolver DNS Firewall blocks resolution of malicious
domains and hinders data exfiltration over DNS.

Compared with security groups and NACLs: those work at the ENI and subnet level and
don't understand domains, signatures, or content; Network Firewall does.

## Cognito

User pools are an application's user directory: sign-up, sign-in, MFA, password
recovery, federation with Google, Apple, Facebook, SAML, and OIDC; they issue JWTs that
API Gateway or an ALB validates. Identity pools exchange a token for temporary IAM
credentials for direct access to AWS services. The typical answer to "need to authenticate
mobile app users and give them access to S3 on their behalf".

## What the exam asks

1. "A web app is under SQL injection attacks" — WAF on an ALB or CloudFront.
2. "Need a response team and protection from a DDoS bill spike" — Shield Advanced.
3. "Find PII in buckets" — Macie.
4. "Detect credential compromise with no agents" — GuardDuty.
5. "Check container images for CVEs" — Inspector with ECR.
6. "A centralized view of compliance against standards" — Security Hub.
7. "Limit the number of requests from one IP" — a rate-based rule in WAF.
8. "Filter outbound traffic by domain" — Network Firewall or DNS Firewall.

## Numbers to remember

- WAF attaches to CloudFront, ALB, API Gateway, AppSync, Cognito, App Runner,
  but not to an NLB;
- a rate-based rule counts requests from one IP over a 5-minute window;
- GuardDuty turns on in minutes and needs no agents; findings go to EventBridge;
- Inspector scans EC2 via the SSM agent, images in ECR, and Lambda functions;
- Macie looks for sensitive data only in S3;
- Shield Standard is free; Advanced has a fixed monthly cost and provides the SRT
  and cost protection;
- Security Hub aggregates findings, Detective builds an investigation graph.

## How to read the wording

| In the question | Answer |
|---|---|
| "SQL injection, XSS, OWASP" | WAF with managed rules |
| "dedicated DDoS response team, cost protection" | Shield Advanced |
| "detect compromised credentials, no agents" | GuardDuty |
| "find PII stored in S3" | Macie |
| "scan container images for CVEs" | Inspector |
| "single view of compliance across accounts" | Security Hub |
| "limit requests per IP" | a rate-based rule |
| "inspect and filter egress traffic by domain" | Network Firewall or DNS Firewall |

## Incident response

A typical automated loop: GuardDuty finds a threat → an event goes to EventBridge →
Lambda or SSM Automation isolates the instance (swaps the security group, takes a
snapshot, revokes the role's sessions) → a notification goes to SNS → the finding lands
in Security Hub. Investigation draws on Detective, CloudTrail, and VPC Flow Logs; recovery
draws on snapshots and AWS Backup. In questions, look for the option where the response is
automated and doesn't require an on-call engineer to log into the console manually.

## Mini practicum

**1.** A public API is being brute-forced from a single address range.
→ WAF with a rate-based rule and an IP rule on CloudFront or an ALB.

**2.** The security team needs to find personal data leaks in buckets.
→ Macie with recurring discovery jobs and findings surfaced in Security Hub.

**3.** Need to detect mining and calls to C2 servers with no agents installed.
→ GuardDuty across all accounts in the organization with a delegated administrator.

**4.** Need to block outbound calls to domains outside an allow list.
→ AWS Network Firewall with domain filtering or Route 53 Resolver DNS Firewall.

## Related chapters

- Permissions, roles, and permission boundaries — the IAM chapter.
- Data encryption and key management — the KMS chapter.
- Network boundaries, security groups, and NACLs — the VPC chapter.
- Logging and compliance — the governance chapter.
- Protecting content delivery and WAF on a CDN — the CloudFront chapter.

## Bank audit

- {{q:754}} — disputed: WAF on an ALB works correctly, but the static IP requirement is
  met by Global Accelerator.
- {{q:878}} — disputed: sharing a common mailbox with account owners conflicts with a
  maximum-security requirement.
