#!/usr/bin/env python3
"""Разметка банка: домен SAA-C03 + список сервисов.

Читает data/build/questions.parsed.json, пишет data/build/questions.classified.json.
Курируемый банк data/questions.json не трогает — его собирает apply-audit.py."""
import json
import os
import re
from collections import Counter

SRC = "data/build/questions.parsed.json"
OUT = "data/build/questions.classified.json"

os.makedirs(os.path.dirname(OUT), exist_ok=True)

# --- домены blueprint SAA-C03 ---
DOMAINS = {
    "SEC": ("Domain 1: Design Secure Architectures", 0.30),
    "RES": ("Domain 2: Design Resilient Architectures", 0.26),
    "PERF": ("Domain 3: Design High-Performing Architectures", 0.24),
    "COST": ("Domain 4: Design Cost-Optimized Architectures", 0.20),
}

# сигналы ищем в тексте вопроса (не в вариантах): формулировка требования решает домен.
# STRONG — однозначные маркеры домена, WEAK — общие слова, которые сами по себе домен не определяют.
STRONG = [
    ("COST", r"cost[- ]effective|most cost|minimize (the )?cost|reduce (the )?cost|optimize (the )?cost"
             r"|lowest cost|cheapest|budget|savings plan|reserved instance|spot instance"
             r"|data transfer (costs|charges)|billing|cost explorer|cost allocation|storage costs|as low as possible"),
    ("SEC", r"encrypt|\bkms\b|secret|credential|password|\biam\b|least privilege|security group|network acl"
            r"|unauthoriz|public access|\bwaf\b|aws shield|ddos|guardduty|macie|amazon inspector|compliance"
            r"|\bpii\b|sensitive|authenticat|authoriz|\bmfa\b|certificate|\btls\b|\bssl\b|service control policy"
            r"|control tower|not travel|not traverse|without .{0,25}internet|must not .{0,25}internet"
            r"|only .{0,30}(can|to) access|restrict access|private connectivity|secure|privileg"
            r"|vpc endpoint|privatelink|firewall|root user|cross-account"),
    ("RES", r"highly available|high availability|fault toleran|resilien|disaster recovery|\bdr\b|\brpo\b|\brto\b"
            r"|failover|durab|multi-az|back ?up|restore|point-in-time|single point of failure|outage"
            r"|data (must not be )?loss|retention|retain|immutab|object lock|survive"
            r"|exactly once|not lose|without losing|reliab|no data is lost|decoupl|loosely coupled"),
    ("PERF", r"latency|throughput|caching|cache|in-memory|\biops\b|concurren|real[- ]time|near real"
             r"|bottleneck|millisecond|degrad|response time|slow"),
]
WEAK = [
    ("PERF", r"performance|scalab|\bscale\b|scaling|ingest|process .{0,25}quickly"),
    ("RES", r"availab|redundan"),
    ("COST", r"\bcost"),
]

SERVICES = [
    ("S3", r"\bS3\b|Simple Storage"), ("EC2", r"\bEC2\b|instance famil(y|ies)"), ("Lambda", r"\bLambda\b"),
    ("RDS", r"\bRDS\b"), ("Aurora", r"\bAurora\b"), ("DynamoDB", r"DynamoDB"),
    ("VPC", r"\bVPC\b"), ("CloudFront", r"CloudFront"), ("Route 53", r"Route\s?53"),
    ("ELB", r"Load Balancer|\bALB\b|\bNLB\b|\bGWLB\b"), ("Auto Scaling", r"Auto Scaling"),
    ("SQS", r"\bSQS\b|Simple Queue"), ("SNS", r"\bSNS\b|Simple Notification"),
    ("EventBridge", r"EventBridge"), ("Step Functions", r"Step Functions"),
    ("Kinesis", r"Kinesis"), ("Glue", r"\bGlue\b"), ("Athena", r"Athena"),
    ("Redshift", r"Redshift"), ("EFS", r"\bEFS\b|Elastic File System"),
    ("FSx", r"\bFSx\b"), ("EBS", r"\bEBS\b|Elastic Block Store"),
    ("Storage Gateway", r"Storage Gateway"), ("DataSync", r"DataSync"),
    ("Snow Family", r"Snowball|Snowcone|Snowmobile"), ("Direct Connect", r"Direct Connect"),
    ("Transit Gateway", r"Transit Gateway"), ("PrivateLink", r"PrivateLink"),
    ("Global Accelerator", r"Global Accelerator"), ("API Gateway", r"API Gateway"),
    ("ECS", r"\bECS\b"), ("EKS", r"\bEKS\b"), ("Fargate", r"Fargate"),
    ("IAM", r"\bIAM\b"), ("KMS", r"\bKMS\b|Key Management"), ("Secrets Manager", r"Secrets Manager"),
    ("Cognito", r"Cognito"), ("Organizations", r"Organizations"), ("Control Tower", r"Control Tower"),
    ("CloudWatch", r"CloudWatch"), ("CloudTrail", r"CloudTrail"), ("Config", r"AWS Config"),
    ("WAF", r"\bWAF\b"), ("Shield", r"AWS Shield"), ("GuardDuty", r"GuardDuty"),
    ("Macie", r"Macie"), ("Inspector", r"Amazon Inspector"), ("Systems Manager", r"Systems Manager"),
    ("Backup", r"AWS Backup"), ("Transfer Family", r"Transfer Family|Transfer for SFTP"),
    ("DMS", r"\bDMS\b|Database Migration"), ("ElastiCache", r"ElastiCache"),
    ("OpenSearch", r"OpenSearch|Elasticsearch"), ("QuickSight", r"QuickSight"),
    ("Elastic Beanstalk", r"Elastic Beanstalk"), ("CloudFormation", r"CloudFormation"),
    ("Amazon MQ", r"Amazon MQ|RabbitMQ|ActiveMQ"), ("EMR", r"\bEMR\b"),
    ("SageMaker", r"SageMaker"), ("Rekognition", r"Rekognition"), ("Textract", r"Textract"),
    ("Comprehend", r"Comprehend"), ("Transcribe", r"Transcribe"), ("Batch", r"AWS Batch"),
    ("Lake Formation", r"Lake Formation"), ("AppFlow", r"AppFlow"), ("Neptune", r"Neptune"),
    ("Outposts", r"Outposts"), ("Budgets", r"AWS Budgets"), ("Cost Explorer", r"Cost Explorer"),
]


def classify(text):
    low = text.lower()
    strong = {dom: len(re.findall(pat, low, re.I)) for dom, pat in STRONG}
    # 1) сильные маркеры, в порядке приоритета blueprint
    for dom in ("COST", "SEC", "RES", "PERF"):
        if strong[dom]:
            return dom, "strong"
    # 2) слабые маркеры
    for dom, pat in WEAK:
        if re.search(pat, low, re.I):
            return dom, "weak"
    return "PERF", "fallback"  # маркеров нет — домен назначен по умолчанию


def services(text):
    found = [name for name, pat in SERVICES if re.search(pat, text, re.I)]
    return found[:8]


qs = json.load(open(SRC, encoding="utf-8"))
for q in qs:
    body = q["question"] + " " + " ".join(o["t"] for o in q["options"])
    dom, conf = classify(q["question"])
    q["dom"] = dom
    q["dom_conf"] = conf
    q["svc"] = services(body)
    q["multi"] = len(q["answer"]) > 1

json.dump(qs, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

c = Counter(q["dom"] for q in qs)
total = len(qs)
print("домены (факт / blueprint):")
for d, (name, w) in DOMAINS.items():
    print(f"  {d:5} {c[d]:4} ({100*c[d]/total:4.1f}%)   blueprint {100*w:.0f}%   {name}")
print("\nтоп сервисов:")
sc = Counter(s for q in qs for s in q["svc"])
for s, n in sc.most_common(20):
    print(f"  {s:20} {n}")
print("\nуверенность разметки:", dict(Counter(q["dom_conf"] for q in qs)))
print(f"мультиответных: {sum(1 for q in qs if q['multi'])}")
print(f"без сервисов: {[q['id'] for q in qs if not q['svc']][:10]}")
