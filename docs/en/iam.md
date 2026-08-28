---
id: iam
title: IAM — identities, policies, cross-account access
order: 5
svc: [IAM, Organizations]
---

# IAM

Every request to AWS is checked against who (principal), what (action), on what
(resource), and under what conditions (condition). Permission is granted only when
there's an explicit allow and no explicit deny. An explicit deny always wins, at any
level.

## Entities

- Root — the account owner, can do anything, cannot be disabled. Best practice: MFA on
  root, delete root's access keys, do day-to-day work under other identities.
- IAM user — long-term credentials. Works for people without SSO and for external
  systems that can't be given a role. Almost always the losing option in modern answers.
- IAM group — a container of policies for users, not itself a principal.
- IAM role — a set of permissions with temporary keys via STS. The primary mechanism
  for AWS services, applications on EC2/ECS/Lambda, cross-account access, and
  federation.
- Identity Center (formerly SSO) — manages people's access across multiple accounts
  through a corporate directory, using permission sets instead of copying policies.

## Policy types

| Type | Attached to | Purpose |
|---|---|---|
| Identity-based | user, group, role | what that identity is allowed to do |
| Resource-based | bucket, queue, topic, key, function | who is allowed to access the resource |
| Permissions boundary | user or role | upper limit on the identity's permissions |
| SCP (Organizations) | OU or account | upper limit for the whole account |
| Session policy | STS session | narrows permissions for the session's duration |
| ACL | S3, legacy | don't use in new designs |

How the result is computed: effective permissions = (identity-based ∪ resource-based) ∩
boundary ∩ SCP, minus any explicit denies. SCPs never grant anything on their own — they
only restrict. That's why "grant access through an SCP" is always the wrong option.

## Cross-account access

The canonical pattern: in the account that owns the resource, you create a role whose
trust policy names the consumer — an account or a role — as principal; the consumer
calls `sts:AssumeRole` and gets temporary keys. There's no need to duplicate users in
every account.

Subtleties that get tested:

- the trust policy names who will assume the role, not who is already in the same
  account: a role in account A that trusts account A itself accomplishes nothing;
- `sts:ExternalId` protects against the confused deputy problem for third-party access;
- for S3 and other resources with resource-based policies, access can be granted
  directly through the resource policy, without assuming a role;
- the assumed role's permissions are limited by the intersection of its policy and any
  session policy.

## Federation

- A corporate directory (AD, Okta, Entra) via SAML 2.0 or Identity Center — employees
  sign in with their own credentials, and roles are issued by group.
- Web identities and mobile apps — Cognito identity pools exchange a provider's token
  for temporary AWS keys.
- Cognito user pools handle application user authentication; identity pools handle
  granting AWS permissions. Questions about "signing in via Google/Facebook in a mobile
  app and accessing S3" need both.
- IAM Roles Anywhere issues roles to workloads outside AWS based on certificates.

## Conditions in policies

Commonly used keys: `aws:SourceIp`, `aws:SourceVpce`, `aws:PrincipalOrgID`,
`aws:RequestedRegion`, `aws:MultiFactorAuthPresent`, `s3:x-amz-server-side-encryption`,
`ec2:ResourceTag/...`. These are the tool for requirements like "access only from the
office network," "only from our organization," "only with MFA enabled," "only for
resources tagged with the project" (ABAC).

ABAC is tag-based access control: a single policy along the lines of "allow the action
if the resource's tag matches the principal's tag" replaces dozens of per-project
policies and needs no edits when a new team is added.

## Control tools

- IAM Access Analyzer finds resources with external access, checks policies for
  mistakes, and generates a policy from actual API calls seen in CloudTrail;
- Credential report and Access Advisor show unused keys and permissions — the basis for
  reducing privileges;
- Access Analyzer plus permission boundaries is the standard answer to "let teams
  create roles, but don't let them escalate their own privileges."

## What the exam asks

1. "An application on EC2 accesses S3" — an instance role, not keys in a file and not
   an IAM user.
2. "Developers need access to the production account" — a role in the target account
   that trusts the development account.
3. "Block all accounts from using Regions outside the EU" — an SCP with a deny on
   `aws:RequestedRegion`.
4. "Teams create their own roles but can't expand their own permissions" — a
   permissions boundary.
5. "Single sign-on for employees across all accounts" — Identity Center with
   federation.
6. "Give a contractor access to our bucket" — a role with an ExternalId or a bucket
   policy naming their account, never shared keys.
7. "Application secrets with automatic rotation" — Secrets Manager, not IAM.
8. "Cut permissions down to what's actually used" — Access Advisor or a policy
   generated by Access Analyzer.

## Policy structure

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "OnlyFromOfficeWithMFA",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::reports/*",
    "Condition": {
      "IpAddress": {"aws:SourceIp": "203.0.113.0/24"},
      "Bool": {"aws:MultiFactorAuthPresent": "true"}
    }
  }]
}
```

What to look for in questions: `Resource` set to `*` signals excessive permissions; a
bucket-level action (`s3:ListBucket`) requires the bucket's ARN, not the objects' ARN;
`NotAction` and `NotResource` are almost always a design mistake; missing a `Condition`
where the requirement says "only from the corporate network" makes the option wrong.

## Organizing accounts

Organizations groups accounts into an OU tree with a single bill and SCPs. A typical
layout: separate OUs for production, non-production, security, and sandbox; CloudTrail
and Config logs are collected into a dedicated security account that application teams
have no delete access to.

Control Tower deploys this structure automatically: a landing zone, guardrails
(preventive via SCPs, detective via Config), and Account Factory for issuing new
accounts from a template. The requirement "new accounts must comply with the standard
immediately" is always solved by Control Tower, not manual policies.

## Temporary credentials

STS issues time-limited keys: `AssumeRole` for roles within and across accounts,
`AssumeRoleWithSAML` for corporate federation, `AssumeRoleWithWebIdentity` for Cognito
and OIDC providers, including IRSA in EKS. Maximum session duration is set by the role
(up to 12 hours), and a role chain is capped at one hour. Revoking access before
expiration is done with a policy condition on `aws:TokenIssueTime` or by disabling the
role — this comes up in questions about compromise.

## Numbers to remember

- up to 10 managed policies can be attached to a single entity; inline policy size is
  capped at 2,048 characters for a user and 10,240 for a role;
- a user can have at most two access keys;
- a role session lasts an hour by default, up to 12 hours maximum, and no more than an
  hour when roles are chained;
- account quotas: 5,000 users, 1,000 roles, 300 groups;
- up to 5 SCPs can be attached to an organization root, OU, or account;
- an SCP grants no permissions, only restricts them, and doesn't apply to the
  organization's management account; a permissions boundary works the same way;
- evaluation order: an explicit deny always wins first, then permissions must agree
  across every applicable policy (identity, resource, SCP, boundary), or there's no
  access;
- roles have a trust policy: without it, no one can assume the role, no matter what
  permissions they have.

## Mini practicum

**1.** An application on an instance needs access to a bucket.
→ An instance role, not access keys in configuration: keys would have to be stored and
rotated.

**2.** A contractor from another account needs to read one bucket.
→ A role that trusts their account, or a bucket policy naming their principal; an
external ID protects against impersonation.

**3.** Developers need to create their own roles without granting themselves admin
rights.
→ A permissions boundary: it caps the maximum permissions the roles they create can
ever get.

**4.** The organization must not deploy resources outside two Regions.
→ An SCP with a Region condition: the restriction applies to every account except the
management account.

## Bank audit

- {{q:870}} — cross-account access: the role is created in the account that owns the
  resource and trusts the consumer's account; the dump key with a contradictory trust
  policy was corrected.
- {{q:931}} — a cross-account Lambda subscription to SNS needs a resource policy on the
  function and a topic policy; the key was corrected to AC.
- {{q:936}} — automatic secret rotation is available only in Secrets Manager, not in
  Parameter Store; the key was corrected to BC.
- {{q:893}} — guardrails on new account creation come from Control Tower, not
  Organizations by itself.
