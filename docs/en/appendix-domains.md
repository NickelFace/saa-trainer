---
id: appendix-domains
title: Appendix — how a question's domain is determined
order: 23
svc: []
---

# How a question's domain is determined

The SAA-C03 exam is split into four domains with fixed weights. Knowing which domain a
question belongs to is useful for more than statistics: the domain tells you which
requirement in the text is the deciding one, and therefore which answer option is
correct. The same service can be the right answer in different questions for entirely
different reasons.

| Code | Domain | Exam weight | Questions in the bank |
|---|---|---|---|
| SEC | Design Secure Architectures | 30% | 324 |
| RES | Design Resilient Architectures | 26% | 209 |
| PERF | Design High-Performing Architectures | 24% | 259 |
| COST | Design Cost-Optimized Architectures | 20% | 227 |

The bank's shares don't match the exam weights, and that's expected: the dump wasn't
assembled against the blueprint. "Exam" mode in the trainer draws questions using the
weights in the table above, not proportionally to the bank.

## Where the bank's labeling comes from

Domain labeling isn't part of the source dump — it was added on top of the bank in two
passes.

**First pass, rule-based.** The script `scripts/classify.py` looks for requirement
markers in the question text. This labeled 672 questions — the ones where the wording
leaves no real choice.

| Domain | Markers the rule fires on |
|---|---|
| COST | `cost-effective`, `minimize cost`, `lowest cost`, `budget`, `Savings Plans`, `Reserved Instance`, `Spot`, `data transfer charges` |
| SEC | `encrypt`, `KMS`, `IAM`, `least privilege`, `unauthorized`, `public access`, `WAF`, `compliance`, `PII`, `MFA`, `must not traverse the internet`, `cross-account` |
| RES | `highly available`, `fault tolerant`, `disaster recovery`, `RPO`, `RTO`, `failover`, `durable`, `Multi-AZ`, `backup`, `must not lose data`, `decouple` |
| PERF | `latency`, `throughput`, `caching`, `IOPS`, `concurrency`, `real-time`, `bottleneck`, `response time` |

**Second pass, manual.** The remaining 347 questions had no markers: they either use
neutral phrasing like "which solution will meet these requirements," or carry several
requirements at once. Each such question was read individually, its domain assigned by
hand, with a short justification recorded alongside — visible in the trainer's
walkthrough under the answer. No question in the bank is left with a domain assigned "by
default."

## The core principle: discriminator, not topic

The domain is determined by **the requirement that rules out the wrong options**, not by
the question's topic or the motive stated in the first paragraph. This is the most
common mistake when labeling on your own, and at the same time the most useful skill on
the exam itself: finding the phrase in the text that the question was actually written
around.

Three examples from the bank where the topic and the discriminator diverge:

- a question about S3 and a VPC endpoint. If the text says "traffic must not go out to
  the internet" — that's SEC, because isolation is what's being decided. If it says "the
  NAT gateway bill is too high" — that's COST, because traffic cost is what's being
  decided. The service in the answer is the same either way;
- a question about blocking large instance launches across all accounts. The motive in
  the preamble is financial (idle instances), but the options differ by mechanism, and
  the correct one is an SCP in Organizations. This is SEC: an organizational guardrail;
- a question about choosing a Storage Gateway type. The company "doesn't want to buy a
  new array," but the options differ by gateway type, and the type is determined by the
  clients' protocol and which data needs to stay local. This is PERF, not COST.

## Tie-breaking rules

When a requirement honestly pulls toward two domains, these rules apply. They were
derived while re-checking disputed calls and are recorded here to keep labeling
consistent.

| Situation | Domain | Why |
|---|---|---|
| Choosing a storage type: EFS vs. EBS, FSx type, Storage Gateway type | PERF | Decided by protocol and access pattern |
| Choosing a storage class and lifecycle: IA, Glacier, Deep Archive | COST | Decided by storage price and acceptable retrieval time |
| Organizational guardrail: SCP, Control Tower, Config, inventory | SEC | Decided by governance and permission restriction |
| Tagging for cost allocation | COST | Decided by cost accounting |
| Moving state out of instances: sessions, shared documents | RES | Decided by surviving instance replacement |
| Shared storage for speed, growth, or consistency | PERF | Decided by access performance |
| Choosing compute for a task's duration and profile | PERF | Decided by matching the resource to the task |
| Guaranteeing capacity, surviving a zone or region outage | RES | Decided by availability |
| A queue or bus for "don't lose it" and "decouple" | RES | Decided by exchange resilience |
| Choosing an analytics service for the data and queries | PERF | Decided by the service's fit for the workload |

## Wording clues

The exam almost always highlights the key requirement in all caps or a superlative.
Read the last paragraph of the question first.

| Wording | What it means |
|---|---|
| MOST cost-effectively | among the options that meet all requirements, pick the cheap one — not the cheapest overall |
| LEAST operational overhead | less administration: a managed service over a self-managed one |
| MOST securely | the option with the fewest permissions granted and no public access |
| Highly available, fault tolerant | at least two Availability Zones, automatic replacement of a failed component |
| MOST performant, lowest latency | closer to the user, caching, the right resource class |
| Without changing application code | look for a drop-in replacement transparent to the application: DAX, RDS Proxy, Babelfish, alias |
| No servers to manage | Lambda, Fargate, Aurora Serverless, managed services |

## How to use this while studying

1. Practice by domain: the "Domain" filter in training limits the question pool to one
   domain, and weak spots show up faster than with random ordering.
2. Look at the justification in the walkthrough. If you assigned a question to a
   different domain but still picked the right answer — that's not a mistake, just a
   different framing of the same thing. If the domains diverged and the answer is
   wrong — you were probably reading the wrong requirement.
3. Keep the weights in mind: on the real exam SEC accounts for almost a third of the
   questions, so IAM, KMS, VPC isolation, and access policies pay off the most.
4. Every chapter of the handbook has an automatic "Domains for this chapter's questions"
   block showing which domain the chapter's topic most often turns out to be.

## What to do if you disagree with a label

Labeling lives in `data/dom-overrides.json`, in the format
`{"id": {"dom": "SEC", "why": "short justification"}}`, and is applied at build time.
Changing one line and rebuilding changes the question's domain, which filters it falls
into, and whether it appears in the exam-mode draw. Build checks require every manual
label to carry a justification, and no question in the bank to be left without a
rationale for its wording.
