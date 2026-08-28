---
id: containers
title: Containers — ECS, EKS, Fargate
order: 18
svc: [ECS, EKS, Fargate, Elastic Beanstalk]
---

# Containers

A container is a way to package an application with its dependencies. In AWS, the
question comes down to two axes: which orchestrator (ECS or EKS) and what runs the
tasks (EC2 or Fargate).

## ECS

AWS's own orchestrator: a cluster, a task definition (image, CPU, memory, ports,
environment variables, roles), a service (desired task count, ELB integration,
autoscaling).

- task role — permissions for the application itself; task execution role — permissions
  for the agent to pull the image from ECR and write logs; the two get confused, and
  that shows up in questions;
- networking modes: awsvpc gives a task its own ENI and security group (the standard),
  bridge and host run on EC2;
- capacity providers spread tasks across EC2, Fargate, and Fargate Spot;
- service auto scaling scales on CPU, memory, requests per ALB target, or an arbitrary
  CloudWatch metric;
- ECS Anywhere runs tasks on your own hardware.

## EKS

Managed Kubernetes: AWS runs the control plane, you run the worker nodes (managed node
groups, self-managed, or Fargate). Chosen when you need the Kubernetes ecosystem:
existing manifests and Helm charts, portability across clouds, operators, specific
controllers.

- IRSA (IAM Roles for Service Accounts) grants permissions to pods via OIDC — the right
  answer to "give a pod access to S3 without keys";
- AWS Load Balancer Controller provisions an ALB for Ingress and an NLB for Service;
- Cluster Autoscaler or Karpenter add nodes, HPA scales pods;
- nodes can run on Spot for batch workloads.

## Fargate

Serverless task execution: you describe CPU and memory, AWS runs the container with no
instance management. No host access, no daemonset-style agents on the node, no GPU (use
EC2 for GPU), no instance store, but it does offer ephemeral storage and EFS mounting.

Chosen for wording like "no servers to manage," "minimize operational overhead,"
"variable workload." The EC2 mode is chosen when you need GPUs, specific instance
types, maximum density, or savings on steady long-running load via RI and Savings
Plans.

## Image registry

ECR stores images, scans them for vulnerabilities (basic and enhanced scanning via
Inspector), supports lifecycle policies to clean up old tags, replication across
regions and accounts, and private access via an interface endpoint.

## Storage and configuration

- EFS mounts into ECS tasks and EKS pods — shared file access between containers across
  AZs;
- FSx for Lustre attaches to EKS for heavy compute workloads;
- secrets are injected from Secrets Manager and Parameter Store directly into the task
  definition;
- logs go to CloudWatch Logs via awslogs, or to other destinations via FireLens.

## Elastic Beanstalk

A platform for deploying an application on standard stacks: it creates EC2, ASG, and
ELB for you, and sets up monitoring and deployment. The answer to "stand up a web
application with minimal operational overhead, without rewriting it or learning
containers." Supports rolling, immutable, and blue/green deployments.

## What to choose

| Requirement | Answer |
|---|---|
| Already have Kubernetes manifests | EKS |
| Just run containers on AWS | ECS |
| Don't want to manage nodes | Fargate |
| Need GPUs or special instance types | ECS/EKS on EC2 |
| Scheduled batch jobs and queues | AWS Batch or ECS Scheduled Tasks |
| Java/Python application without containers | Elastic Beanstalk |
| Event once a second, 200 ms of work | Lambda, no containers needed |

## What the exam asks

1. "Microservices, minimal administration, no Kubernetes experience" — ECS on Fargate.
2. "A pod needs access to S3 without keys" — IRSA.
3. "Tasks need a shared volume across AZs" — EFS.
4. "Reduce the cost of processing a queue with containers" — Fargate Spot or EC2 Spot in
   a capacity provider.
5. "Route HTTP traffic to services in EKS" — ALB via the AWS Load Balancer Controller.
6. "Images must be checked for vulnerabilities" — ECR scanning with Inspector.
7. "Migrate a docker-compose application to the cloud quickly" — ECS on Fargate.
8. "Need full control over the nodes and kernel" — EC2 mode, not Fargate.

## Numbers to remember

- Fargate: 0.25 to 16 vCPU, memory from 0.5 GB to 120 GB, ephemeral storage up to
  200 GB;
- a task definition stores versions; a service points to a specific revision;
- ECS awsvpc gives a task its own ENI, which consumes the instance's ENI limit;
- EKS: AWS runs the control plane, billed hourly per cluster plus the nodes;
- ECR: images up to 10 GB per layer within limits, lifecycle policies clean up tags;
- Fargate Spot is roughly 70 percent cheaper, and a task can be interrupted.

## How to read the wording

| Wording in the question | Answer |
|---|---|
| "containers without managing servers" | Fargate |
| "existing Kubernetes manifests and Helm" | EKS |
| "pods need AWS permissions without keys" | IRSA |
| "shared storage between tasks across AZs" | EFS |
| "GPU workloads in containers" | ECS or EKS on EC2 |
| "cheap batch container jobs" | Fargate Spot or EC2 Spot |
| "deploy a Java app, no container experience" | Elastic Beanstalk |
| "route HTTP to services by path" | ALB with a target group per service |

## Deployments and reliability

ECS supports rolling updates via the minimumHealthyPercent and maximumPercent
parameters, as well as blue/green deployments through CodeDeploy with target group
switching and automatic rollback on alarms. In EKS, the same needs are met by
Kubernetes Deployment strategies and progressive-delivery controllers. For fault
tolerance, tasks are spread across multiple AZs (ECS's spread placement strategy,
Kubernetes' topology spread constraints), and the ALB health check tracks application
readiness, not just container startup.

## Mini practicum

**1.** A team with no Kubernetes experience is migrating a monolith off docker-compose
and doesn't want to manage servers.
→ ECS on Fargate with an ALB in front of the service.

**2.** A pod in EKS needs access to a bucket; keys in the manifest aren't allowed.
→ IRSA: an IAM role bound to a service account via the cluster's OIDC provider.

**3.** Batch processing with containers runs for hours and can be interrupted.
→ Fargate Spot or EC2 Spot in a capacity provider, jobs pulled from an SQS queue.

**4.** Images need to be scanned for vulnerabilities on every push.
→ ECR with enhanced scanning powered by Inspector, findings surfaced in Security Hub.

## Related chapters

- Choosing between containers and functions — the Lambda chapter.
- Balancing HTTP traffic and health checks — the load balancers chapter.
- Shared file storage for tasks — the EFS and FSx chapter.
- Permissions for pods and tasks without keys — the IAM chapter.
- Image scanning and perimeter protection — the security chapter.

## Bank audit

- {{q:591}} — disputed: for routing to microservices in EKS, the standard solution is
  an ALB; API Gateway is usually more expensive.
- {{q:422}} — low confidence: SQS with ECS Fargate vs. SQS with Lambda, decided by
  model size and processing time.
