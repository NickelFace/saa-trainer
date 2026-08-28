---
id: encryption-kms
title: Encryption, KMS, and secrets
order: 6
svc: [KMS, Secrets Manager]
---

# Encryption, KMS, and secrets

Encryption in AWS splits into two jobs: data at rest and data in transit. The first is
almost always covered by KMS together with the storage service in question; the second
by a TLS certificate from ACM plus a policy that rejects unencrypted connections.

## KMS: key types

| Type | Owned by | Rotation | Key policy | Visible in CloudTrail |
|---|---|---|---|---|
| AWS owned | AWS, shared across the service | AWS | no | no |
| AWS managed (`aws/s3`) | your account, created by the service | yearly, automatic | not editable | yes |
| Customer managed (CMK) | you | enable it, yearly or on a schedule | yours | yes |
| Imported key material | you | manual, re-import only | yours | yes |
| CloudHSM-backed / External store | you | manual | yours | yes |

A customer managed key is the right choice when you need your own access policy, an
audit trail of key usage, rotation on your own schedule, cross-account access, or the
ability to revoke access to data quickly. Phrasing like "control over the key policy,"
"ability to disable/delete the key," or "audit key usage" points straight at it.

Deleting a key only happens after a 7-to-30-day waiting period. Disabling a key makes
the data unreadable instantly — that's the answer to "immediately stop access to
encrypted data."

## How envelope encryption works

1. The service asks KMS for a data key (`GenerateDataKey`).
2. KMS returns both a plaintext and an encrypted copy of the key.
3. Data is encrypted locally with the plaintext key, which is then wiped from memory.
4. The encrypted key is stored alongside the data; on read it's decrypted through
   `Decrypt`.

The consequences follow from this: KMS never sees the actual data, direct encryption
through KMS is capped at 4 KB, and load on KMS is measured in requests. Bulk operations
run into KMS quotas — S3 Bucket Keys, the data key cache in the AWS Encryption SDK, and
`GenerateDataKeyWithoutPlaintext` for batch writes all bring that down.

## Multi-Region keys

Multi-Region keys are a set of keys that share key material across different Regions.
You need them wherever encrypted data crosses a Region boundary: CRR of an encrypted
bucket, DynamoDB global tables, copying snapshots into a disaster recovery Region. A
regular CMK is tied to its own Region, and a snapshot copy in another Region has to be
re-encrypted with a local key — that's usually the correct answer in DR questions.

## Encryption by service

- S3: SSE-S3 by default, SSE-KMS for control and auditing, SSE-C for your own keys,
  Bucket Keys to cut cost; a policy can reject unencrypted writes.
- EBS: volume and snapshot encryption, the key is chosen at creation; you can't turn on
  encryption for an existing unencrypted volume directly — you snapshot it and restore
  the snapshot into an encrypted volume. The account attribute "encryption by default"
  forces encryption on all new volumes.
- RDS and Aurora: encryption is enabled at creation time; to encrypt an existing
  database, you take a snapshot, copy it with encryption enabled, and restore from that
  copy. A read replica inherits the source's encryption state.
- DynamoDB: encryption is always on, only the key type is a choice.
- EFS and FSx: encryption at rest at creation time, in transit via TLS at mount time.
- SQS, SNS, Kinesis, CloudWatch Logs: SSE-KMS is turned on at the resource level.
- Redshift, EMR, OpenSearch, Glue: cluster and intermediate-data encryption is
  configured at creation.

## ACM and traffic

ACM issues free public certificates and auto-renews the ones validated through DNS. ACM
certificates can't be exported and installed on your own server — that's what ACM
Private CA is for. A certificate for CloudFront is always issued or imported in
us-east-1; for ALB and API Gateway, in the resource's own Region.

You can import a certificate from a third-party CA into ACM, but the service can't issue
one chained from someone else's CA — more than one trap question is built on that fact.

## Secrets Manager and Parameter Store

| | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Cost | per secret and per call | standard parameters are free |
| Rotation | built in, via Lambda | none, manual only |
| Cross-account | resource policy | via RAM/policy, limited |
| Cross-Region replication | yes | no |
| Integration with RDS/Redshift/DocumentDB | yes, ready-made rotators | no |
| Size | up to 64 KB | 4 KB (advanced up to 8 KB) |

If the requirement mentions "automatic rotation," the answer is Secrets Manager. If the
emphasis is "store configuration and non-secret parameters cheaply," the answer is
Parameter Store. Hardcoding credentials in code, environment variables, or an AMI is
always the wrong option.

## What the exam asks

1. "All new EBS volumes must be encrypted, no exceptions allowed" — the account
   attribute "encrypt by default," not detection through Config after the fact.
2. "An existing RDS database needs to be encrypted" — snapshot, encrypted copy,
   restore.
3. "Keys must be kept in a device under our control at FIPS 140-2 level 3" — CloudHSM
   or a KMS custom key store.
4. "Audit every operation on the key" — a customer managed key plus CloudTrail.
5. "KMS costs spiked from millions of small S3 objects" — S3 Bucket Keys.
6. "Database passwords must rotate automatically every 30 days" — Secrets Manager with
   rotation.
7. "Data is replicated to another Region and must stay encrypted" — a multi-Region key,
   or the destination Region's own key on copy.
8. "The application reaches KMS from a private subnet with no internet access" — an
   interface endpoint for KMS.

## Key policy and access

The key policy is a resource-based policy without which an identity policy alone does
nothing on KMS: if the key policy doesn't delegate rights to the account, no amount of
user permissions will help. That sets KMS apart from most services and shows up
regularly in questions about cross-account access to encrypted data.

The standard pattern for cross-account access: the key policy lists the consumer account
with the actions `kms:Decrypt` and `kms:DescribeKey`, and on the consumer side the role
gets the same actions in its identity policy. It's further narrowed with conditions like
`kms:ViaService` (use the key only through a specific service) and
`kms:EncryptionContext` (only for a specific resource).

Grants are a temporary delegation of key rights to services acting on your behalf; a
service issues and revokes them, and they're more convenient than editing the policy for
short-lived operations.

## CloudHSM and regulatory requirements

CloudHSM is a dedicated hardware module under your sole control, FIPS 140-2 level 3,
accessed via PKCS#11 and JCE. AWS has no access to the keys and can't recover them if
you lose your credentials. It's the choice when a regulator requires a single-tenant
HSM, key generation and storage entirely under your control, or support for specific
crypto operations. A KMS custom key store pairs the convenience of KMS with key material
held in CloudHSM — a compromise for anyone who wants normal service integrations while
keeping their own keys.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "control the key policy, rotate, audit usage" | customer managed key |
| "single-tenant HSM, FIPS 140-2 level 3" | CloudHSM |
| "automatically rotate database credentials" | Secrets Manager |
| "store configuration values cheaply" | Parameter Store |
| "KMS request costs spiked on S3" | S3 Bucket Keys |
| "encrypted data replicated to another Region" | multi-Region key |
| "revoke access to encrypted data immediately" | disable the key |
| "certificate for CloudFront" | ACM in us-east-1 |

## Numbers to remember

- KMS encrypts data directly only up to 4 KB, so everything else goes through envelope
  encryption: GenerateDataKey returns the data key in both plaintext and encrypted form;
- automatic rotation of a customer managed key happens once a year, and the old key
  material is kept around to decrypt data encrypted earlier;
- deleting a key is only possible after a waiting period of 7 to 30 days;
- AWS managed keys are rotated by the service itself, and their policy can't be changed;
- multi-Region keys are the only way to decrypt data in another Region with the same
  key; a regular key is strictly regional;
- an S3 Bucket Key cuts calls to KMS by roughly 99% and noticeably lowers the bill;
- access to a key is governed by the key policy: without permission there, an IAM policy
  alone grants no access;
- CloudHSM provides a dedicated module at FIPS 140-2 level 3 when full hardware control
  is required.

## Mini practicum

**1.** You need to encrypt files in S3 and know who accessed the key and when.
→ SSE-KMS with a customer key: access shows up in CloudTrail. SSE-S3 keeps no such log.

**2.** Data is copied to another Region and must be readable there without
re-encryption.
→ A multi-Region key: the key's replica in the destination Region decrypts the same
data.

**3.** KMS costs rose because of millions of small objects in a bucket.
→ Turn on S3 Bucket Key.

**4.** You need to store a database password and rotate it automatically once a month.
→ Secrets Manager with built-in rotation; Parameter Store is cheaper, but you'd have to
write the rotation yourself.

## Bank audit

- {{q:887}} — banning unencrypted volumes: the account attribute "always encrypt new EBS
  volumes," Config only detects; the dump key was corrected.
- {{q:936}} — secret rotation: Secrets Manager plus a Lambda layer to fetch the secret.
- {{q:571}} — ACM doesn't issue certificates chained from a third-party CA, only imports
  ready-made ones; the dump's options are technically impossible.
- {{q:974}} — the CloudFront certificate is issued in us-east-1.
