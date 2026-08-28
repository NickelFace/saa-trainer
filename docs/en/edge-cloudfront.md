---
id: edge-cloudfront
title: CloudFront, edge, and Global Accelerator
order: 16
svc: [CloudFront, Global Accelerator]
---

# Content and edge

The AWS edge network solves three problems: bring content closer to the
user, take load off the origin, and provide stable network delivery over the
AWS backbone instead of the public internet.

## CloudFront

A CDN spanning hundreds of points of presence. Works with HTTP and HTTPS,
caches responses, and can compress, sign, and process requests with
functions at the edge.

Origin: S3 (through Origin Access Control), ALB, EC2, API Gateway, any
public HTTP server, including ones outside AWS. An origin group provides
failover to a backup source based on error codes — a simple way to meet a
fault-tolerance requirement for content delivery.

Key mechanics:

- a cache policy defines the cache key (which headers, cookies, and query
  strings participate) and the TTL; an origin request policy defines what
  gets forwarded to the origin;
- invalidation removes objects from the cache early; versioning file names
  (`app.v2.js`) is cheaper and more reliable than mass invalidations;
- signed URLs and signed cookies gate paid content: a URL covers one object,
  cookies cover a set of objects;
- Origin Access Control (OAC, the successor to OAI) gives CloudFront access
  to a private bucket while the bucket stays closed to the internet;
- the Geo restriction setting blocks countries at the CDN level;
- a certificate for a custom domain is issued in ACM in the us-east-1 Region
  regardless of where the origin is located;
- WAF attaches to the distribution, Shield Advanced protects against
  volumetric attacks;
- logs: standard access logs to S3 and real-time logs to Kinesis.

Functions at the edge:

| | CloudFront Functions | Lambda@Edge |
|---|---|---|
| Language | JavaScript | Node.js, Python |
| Execution time | under 1 ms | up to 5 or 30 seconds |
| Events | viewer request/response | all four, including origin |
| Access to network and request body | no | yes |
| Price | very low | higher |

Simple header rewriting, redirects, and cache-key normalization —
CloudFront Functions; calling an external API, A/B logic, working with the
body — Lambda@Edge.

## Global Accelerator

Two static anycast IP addresses; traffic enters the nearest point of
presence and then travels over the AWS backbone to the nearest healthy
endpoint (ALB, NLB, EC2, Elastic IP). Works with TCP and UDP, so it fits
cases where CloudFront can't help: gaming, VoIP, IoT, custom protocols.

Properties it's chosen for: static IPs for allowlisting, fast cross-Region
failover based on health checks (seconds), weighted traffic distribution
across Regions, client affinity.

## CloudFront versus Global Accelerator

| Requirement | Answer |
|---|---|
| Caching HTTP content | CloudFront |
| Static IP addresses | Global Accelerator |
| UDP or arbitrary TCP | Global Accelerator |
| Serving video and static assets | CloudFront |
| Instant failover between Regions | Global Accelerator |
| Reducing load on the origin | CloudFront |
| Dynamic API with high latency due to distance | either works: CloudFront terminates TLS closer to the user and keeps a connection to the origin open, GA shortens the path over the backbone |

## Cost

CloudFront saves on outbound traffic: serving from cache is cheaper than
serving from S3 or EC2, plus there's no origin data-transfer charge on a
cache hit. Price Class limits the set of edge locations in use and lowers
cost when the audience is local. Global Accelerator is billed hourly plus a
premium for data transferred.

## Common patterns

- Static content in S3 with OAC + dynamic content on an ALB as a second
  origin, routed by path pattern.
- API Gateway behind CloudFront with GET caching and WAF on the
  distribution.
- Video: S3 as the origin, signed cookies for subscribers, MediaConvert for
  transcoding.
- Multi-Region fault tolerance: Route 53 failover or Global Accelerator in
  front of regional load balancers.

## What the exam asks

1. "Users worldwide complain about slow image loading" — CloudFront.
2. "The bucket must stay private, but content is still served" — OAC.
3. "Need fixed IPs for a partner firewall" — Global Accelerator or NLB.
4. "A UDP game server with players in three Regions" — Global Accelerator.
5. "Paid content is available only to subscribers for 24 hours" — signed
   URL or cookies.
6. "Block access from specific countries" — geo restriction (or a WAF
   rule).
7. "The cache serves an old version of the site after a deploy" —
   invalidation or file-name versioning.
8. "The certificate doesn't show up in the CloudFront list" — it wasn't
   issued in us-east-1.

## Numbers to remember

- hundreds of points of presence, cache by Region plus regional edge
  caches;
- TTL is set by the cache policy and origin headers, 24 hours by default;
- invalidation: the first 1000 paths per month are free, then it's billed;
- CloudFront Functions — under 1 ms and viewer events only, Lambda@Edge — up
  to 5 seconds on viewer events and up to 30 seconds on origin events;
- a certificate for a custom domain must come from ACM in us-east-1 only;
- Global Accelerator provides 2 static anycast addresses and switches
  traffic within seconds.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "global users, static and media content" | CloudFront |
| "keep the S3 bucket private" | OAC |
| "static IP addresses for allowlisting" | Global Accelerator or NLB |
| "UDP or non-HTTP protocol" | Global Accelerator |
| "restrict content to paying subscribers" | signed URL or signed cookies |
| "block specific countries" | geo restriction or WAF |
| "fast failover between Regions" | Global Accelerator or Route 53 health checks |
| "reduce load and egress cost from origin" | CloudFront |

## Checking the cache when walking through a question

The cache works well when the cache key is stable: extra headers, cookies,
and query parameters in the key fragment the cache and drop the hit rate to
zero. Cues in the answer choices: "forward all headers and cookies" is
almost always a regression, "cache policy with only required query strings"
is an improvement. Dynamic content benefits from CloudFront too: TLS is
terminated near the user, and a persistent connection over the AWS backbone
carries traffic to the origin, cutting down session-establishment time.

## Mini practicum

**1.** A site on an ALB in eu-central-1; half the users, in Asia, complain
about slow image loading.
→ CloudFront in front of the ALB and S3: the cache sits closer to the user,
and TLS is terminated at the edge.

**2.** Files from a private bucket need to be served only through the CDN.
→ Origin Access Control plus a bucket policy that allows access only from
the distribution.

**3.** A partner requires a list of static IP addresses for allowlisting;
the application runs over TCP.
→ Global Accelerator: two static anycast addresses and failover driven by
health checks.

**4.** After a deploy, users see the old version of the JavaScript.
→ Version the file names or invalidate the paths; also clean up the cache
policy while you're at it.

## Bank audit

- {{q:647}} — VoIP runs over UDP, and CloudFront only serves HTTP/HTTPS; the
  correct answer is Global Accelerator, the dump key was corrected.
- {{q:754}} — disputed: static IP addresses are provided by Global
  Accelerator, not CloudFront.
- {{q:971}} — disputed: repeatedly serving the same files to servers across
  different Regions is CloudFront caching, not Transfer Acceleration.
- {{q:974}} — the CloudFront certificate always comes from us-east-1; the
  key was corrected to AD.
- {{q:447}} — CloudFront has no health checks of its own: active-active
  failover between Regions is built on Route 53.
