---
id: scaling-elb
title: Load Balancers and Auto Scaling
order: 3
svc: [ELB, Auto Scaling]
---

# Load Balancers and Auto Scaling

The pairing "ELB in front of an Auto Scaling group across multiple AZs" is the baseline
fault tolerance pattern on the exam. The load balancer provides a single entry point
and health checks; the ASG is responsible for instance count and replacing failed
instances.

## Types of load balancers

| | ALB | NLB | GWLB | CLB (legacy) |
|---|---|---|---|---|
| Layer | 7 (HTTP/HTTPS/gRPC) | 4 (TCP/UDP/TLS) | 3 (GENEVE) | 4 and 7 |
| Routing | by host, path, header, query, method | by port | all traffic to appliances | basic |
| Performance | high | millions of requests, minimal latency | depends on appliance | low |
| Static IP | no, DNS only | yes, Elastic IP per AZ | no | no |
| Target types | instance, IP, Lambda | instance, IP, ALB | appliance | instance |
| TLS termination | yes | yes (TLS listener) | no | yes |
| Sticky sessions | load balancer or application cookie | by source IP | — | cookie |

How the exam expects you to choose:

- need URL/host parsing, authentication via Cognito or OIDC, WAF — ALB;
- need UDP, a static IP, extremely low latency, TLS passthrough — NLB;
- need to route traffic through third-party firewall appliances — GWLB;
- "WAF must protect it" — WAF attaches to ALB, CloudFront, API Gateway, and AppSync,
  but not to NLB.

Useful details: ALB supports redirecting HTTP to HTTPS and returning fixed responses
with no backend; a target group of type Lambda lets ALB invoke a function; cross-zone
load balancing is always on and free for ALB, but disabled by default for NLB and must
be turned on explicitly; serving an application across multiple domains uses SNI with
multiple certificates.

## Health checks

Checks happen at two levels: the load balancer checks a target over a protocol and
path, and the ASG uses either EC2 status checks or the ELB health check result. If the
ASG is configured to use only EC2 status checks, a hung application on a live instance
won't be replaced — a classic trap. The correct answer: set the ASG health check type
to ELB.

## Auto Scaling group

Core parameters: launch template (versioned, recommended over launch configuration),
min/desired/max, a list of subnets across different AZs, a warm-up policy, health check
type and grace period, termination policy.

Scaling policies:

| Policy | What it does | When |
|---|---|---|
| Target tracking | keeps a metric at a target value (e.g., CPU 50%) | almost always the simplest answer |
| Step scaling | different steps for different alarm thresholds | needs different reactions at different levels |
| Simple scaling | one step with a cooldown period | legacy option |
| Scheduled | scaling on a schedule | known peaks: business hours, reporting |
| Predictive | ML forecast from history, provisions ahead of time | regular recurring patterns |

Practical details:

- the metric doesn't have to be CPU: ALBRequestCountPerTarget, SQS queue depth (via a
  custom "messages per instance" metric), network traffic;
- predictive scaling learns from recurring patterns and handles rare, unpredictable
  spikes poorly;
- lifecycle hooks give time to warm the cache on launch and to drain connections and
  flush logs on termination;
- a warm pool keeps pre-initialized but stopped instances ready for a fast start;
- instance refresh rolls out a new launch template version gradually;
- an ASG can span multiple AZs, which is a cheap way to meet the "survive an AZ
  failure" requirement.

## Fault tolerance and cost

The requirement "survive an AZ failure" = at least two AZs, with min set so the
remaining zones can carry the load. "As cheap as possible" + "workload can tolerate
interruption" = a mixed instances policy with Spot. "Serve static content instantly" =
offload static content to S3 and CloudFront rather than adding more instances.

Connection draining (deregistration delay) lets active connections finish while an
instance is being taken out of service — the right answer for "users get errors during
scale-in or during a deployment."

## What the exam asks

1. "Users lose their session during scaling" — move state out to ElastiCache or
   DynamoDB; sticky sessions are a workaround, not data storage.
2. "A hung application isn't being replaced" — health check type = ELB.
3. "Load predictably grows every weekday at 9 AM" — scheduled scaling.
4. "Need a fixed IP for a partner's allowlist" — NLB with an Elastic IP or Global
   Accelerator; ALB won't work.
5. "Load balancing between EC2 and an on-premises data center" — a target group of
   type IP.
6. "Workers should scale with queue length" — the SQS ApproximateNumberOfMessages
   metric per instance, target tracking.
7. "Minimum operational effort for a web application with autoscaling" — Elastic
   Beanstalk or ECS Fargate, not hand-assembling an ASG.

## Standard three-tier application pattern

```
Route 53 -> CloudFront -> ALB (public subnets, 2+ AZ)
             |                 -> ASG with web instances (private subnets)
             |                        -> internal ALB -> application ASG
             |                                                -> RDS Multi-AZ / Aurora
static -> S3 (CloudFront origin with OAC)
```

What's being tested here: the load balancer sits in public subnets, the instances sit
in private subnets, the instance security group allows traffic only from the load
balancer's security group (not a CIDR range), and the database accepts connections
only from the application's security group. Referencing a security group from another
security group instead of a CIDR range is the marker of a correct answer in questions
about securing this pattern.

## Diagnosing common symptoms

| Symptom | Cause | Fix |
|---|---|---|
| 502 and 504 from ALB | target not responding or application timeout | check health check, increase idle timeout |
| Instances get replaced in a loop | health check is stricter than application startup time | increase health check grace period |
| Errors during scale-in | connections are dropped | deregistration delay, lifecycle hook |
| Load is uneven across AZs | NLB cross-zone is off | enable cross-zone balancing |
| Slow response after idle | cold start of instances | warm pool, predictive scaling |

## Cost of load balancing

Charges consist of an hourly rate plus LCUs (or NLCUs) — units that measure new
connections, active connections, throughput, and rules. That leads to practical
conclusions: extra ALB routing rules cost money, long-lived keep-alive connections are
cheaper than frequent new ones, and traffic served by CloudFront never reaches the
load balancer at all and isn't billed as LCUs. NLB cross-zone traffic between AZs is
billed separately — another argument against enabling it without need.

## Listeners, rules, and certificates

A listener accepts connections on a port and protocol; rules parse the request by
conditions: host-header, path, http-header, query-string, source-ip,
http-request-method. Actions: forward to a target group (with weights for canary
rollouts), redirect, fixed-response, authenticate-cognito, and authenticate-oidc.
Authentication on ALB satisfies the requirement "only let employees in" without
touching the application.

Certificates: one default plus additional ones via SNI, which lets a single ALB serve
dozens of domains. The listener's security policy sets the minimum TLS version — the
standard answer for "block TLS below 1.2."

## Numbers to remember

- ALB operates at layer 7 (HTTP and HTTPS), NLB at layer 4 (TCP, UDP, TLS) and
  provides a static address in each Availability Zone; GWLB is only needed for network
  appliances;
- ALB's default idle timeout is 60 seconds; the deregistration delay is 300 seconds;
- the default health check interval is 30 seconds: 5 failures move a target to
  unhealthy, 2 successes bring it back;
- an Auto Scaling group's default cooldown period is 300 seconds, matching the
  default health check grace period after an instance launches;
- predictive scaling requires at least a day of history and forecasts 48 hours ahead;
  the pre-launch lead time is set in minutes;
- cross-zone load balancing is always on and free for ALB, disabled by default for
  NLB, and cross-zone traffic is billed;
- NLB preserves the client's original address, ALB passes it in the
  X-Forwarded-For header;
- a lifecycle hook pauses an instance for a duration that can be extended with a
  heartbeat signal.

## Mini practicum

**1.** A gaming service needs a load balancer for millions of UDP requests per second.
→ Network Load Balancer: it's the only one that handles UDP and sustains that rate.

**2.** A spike repeats every Friday evening; capacity is needed in advance.
→ A scheduled action on the Auto Scaling group, not a metric-based policy.

**3.** Logs must be flushed before an instance terminates.
→ A lifecycle hook on the terminating state: the instance waits until the action
completes.

**4.** The application has several services and needs to route by URL path.
→ ALB with path-based rules: NLB can't route based on request content.

## Bank audit

- {{q:744}} — a static IP in front of a load balancer: NLB supports an Elastic IP, ALB
  does not; the dump key was corrected.
- {{q:591}} — disputed question: routing to microservices in EKS is normally done with
  ALB via the AWS Load Balancer Controller; API Gateway is usually more expensive.
- {{q:664}} — low confidence: a CPU spike twice a month; predictive scaling catches
  regular patterns but can miss rare spikes.
- {{q:390}} — disputed question: sticky sessions don't store session data; durability
  requires ElastiCache Redis with persistence.
