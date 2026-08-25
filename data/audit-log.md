# SAA-C03 audit log (1019 вопросов, 100%)

## Исправленные ошибки ключа (18)

- **#110**: BD -> **CD**. examtopics t1 q110 community consensus
- **#239**: A -> **B**. examtopics t1 q239 — Lambda function URL with AWS_IAM is the single-function microservice path; API Gateway adds a service that is not required
- **#447**: B -> **A**. examtopics t1 q447 — у CloudFront нет собственных health checks; Route 53 health checks + active-active failover это штатная схема для multi-region API Gateway/Lambda (AWS Compute Blog)
- **#571**: B -> **A**. ACM не выпускает сертификаты, подписанные сторонним CA — только импортирует их; варианты B и D технически невозможны. examtopics t1 q571
- **#647**: C -> **A**. VoIP это UDP — CloudFront работает только с HTTP/HTTPS. Global Accelerator прямо назван AWS как решение для VoIP и быстрого межрегионального failover (GA FAQ, examtopics t1 q647)
- **#687**: BD -> **DE**. ключ смешивает обучение в SageMaker (B) с предсказанием через Forecast-предиктор (D) — несовместимая пара; при отсутствии ML-опыта связка DE (обучить Forecast-предиктор + Lambda с этим предиктором) согласована
- **#744**: C -> **A**. NLB поддерживает Elastic IP на AZ, ALB — нет; вариант C (A-запись на Elastic IP) не описывает работоспособную конструкцию перед ELB. examtopics t1 q744
- **#809**: B -> **A**. EventBridge Scheduler запускает задачи по расписанию и не сопоставляет входящие события; матчинг события Batch SUCCEEDED делает EventBridge rule, а HTTP API с логином/паролем это штатный API destination с connection
- **#827**: C -> **D**. у Aurora только два типа хранилища — Standard и I/O-Optimized; General Purpose/Provisioned IOPS к кластеру Aurora не относятся
- **#842**: A -> **D**. "EFS-to-EFS backup" это устаревшее AWS Solutions-решение на CloudFormation, а не managed-сервис; репликацию EFS между регионами делает AWS Backup
- **#870**: D -> **C**. ключ противоречив: группа в Production указана принципалом в trust policy, ссылающейся на тот же Production; кросс-аккаунт делается ролью в Production с доверием к Development
- **#874**: C -> **A**. ключ описывает pilot light (инфраструктура создаётся по факту аварии); при требовании LEAST downtime нужен warm standby с уже поднятыми ASG и ELB
- **#887**: B -> **A**. AWS Config только детектирует нарушения; запрет незашифрованных томов даёт атрибут аккаунта EC2 "always encrypt new EBS volumes"
- **#893**: B -> **A**. автоматические guardrails при создании аккаунтов это AWS Control Tower, Organizations сам по себе их не даёт
- **#903**: B -> **A**. ACL через Batch Operations не масштабируется и противоречит рекомендациям AWS; префиксный доступ с гранулярным контролем это S3 access points с политиками
- **#931**: AB -> **AC**. для кросс-аккаунтной подписки Lambda на SNS нужны resource policy у функции (A) и политика топика, разрешающая подписку (C); буфер SQS из варианта B меняет источник вызова и с A несовместим
- **#936**: CD -> **BC**. Parameter Store не умеет автоматическую ротацию — её даёт только Secrets Manager; вторым шагом идёт Lambda layer для получения секрета
- **#974**: BD -> **AD**. сертификат для CloudFront должен быть выпущен в us-east-1 независимо от региона бакета

## Спорные, ключ сохранён (15)

- **#245**: ключ A, альтернатива D. examtopics t1 q245 — target group change does not reduce ASG instance count; strong minority argues D
- **#268**: ключ B, альтернатива A. examtopics t1 q268 — ключ RDS Proxy решает пул соединений, а не read performance; часть сообщества за ElastiCache
- **#372**: ключ D, альтернатива B. examtopics t1 q372 — сообщество делится: B (S3+DynamoDB) дешевле и масштабируемее, контраргумент — GIS-изображение не сводится к одному geographic code
- **#390**: ключ AD, альтернатива BD. examtopics t1 q390 — sticky sessions не хранят данные; ElastiCache Redis durable только с persistence; часть сообщества за BD
- **#536**: ключ C, альтернатива D. Multi-AZ DB cluster с двумя readable standby (D) даёт и HA, и read-эндпоинты тремя инстансами против четырёх в варианте C
- **#574**: ключ B, альтернатива A. 2 часа работы в неделю: Aurora Serverless v2 масштабируется вниз, но не до нуля; provisioned-кластер можно останавливать максимум на 7 суток — оба варианта спорны
- **#591**: ключ D, альтернатива B. для маршрутизации к микросервисам в EKS штатное решение это ALB через AWS Load Balancer Controller; API Gateway обычно дороже
- **#622**: ключ CD, альтернатива AD. при скачке с тысяч до миллионов пользователей on-demand capacity (A) масштабируется мгновенно, auto scaling провиженинга отстаёт от резких всплесков
- **#692**: ключ B, альтернатива A. "MOST high-performing" это latency routing policy (A); geolocation маршрутизирует по географии пользователя, а не по фактической задержке
- **#754**: ключ D, альтернатива B. требование static IP addresses выполняет Global Accelerator (B), у CloudFront статических IP нет; при этом WAF в варианте B на ALB работает корректно
- **#835**: ключ C, альтернатива A. public VIF дешевле и штатно используется для доступа к S3 через Direct Connect; interface endpoint тарифицируется почасово плюс за трафик
- **#851**: ключ B, альтернатива C. Aurora Serverless масштабируется вниз в простое, что точнее отвечает "нужны только во время работы"
- **#878**: ключ A, альтернатива D. вариант ключа даёт всем владельцам аккаунтов доступ к одному почтовому ящику, что противоречит требованию MOST securely
- **#881**: ключ AC, альтернатива AE. Cache-Control private вообще запрещает кэширование в CloudFront и убивает смысл кэша; связка TTL + инвалидация при деплое логичнее
- **#971**: ключ C, альтернатива D. повторная раздача одних и тех же файлов на серверы в разных регионах это кэш CloudFront; Transfer Acceleration ускоряет в первую очередь загрузку в S3 и не кэширует

## Низкая уверенность (6)

- **#113**: ключ C. Snowball Edge + Glue vs Snowball with EC2 compute — recheck online
- **#308**: ключ BD. Trusted Advisor RDS Reserved Instance Optimization (C) тоже снижает стоимость — перепроверить
- **#350**: ключ AC. A (Multi-AZ) закрывает требование HA/auto recovery, C — производительность отчётов; формулировка вопроса смешивает два требования
- **#422**: ключ D. SQS+ECS Fargate против SQS+Lambda (C): выбор ключа опирается на размер ML-моделей, в тексте прямо не указан
- **#511**: ключ C. Aurora On-Demand против RDS Single-AZ: формулировка вариантов A и C почти дублирует друг друга
- **#664**: ключ D. скачок CPU дважды в месяц: predictive scaling обучается на регулярных паттернах, редкие всплески он может не поймать

## Дефекты исходного PDF

- **#125**: пятый вариант подписан как D вместо E (буква исправлена в данных)
- **#756**: третий вариант подписан как B вместо C (буква исправлена в данных)
- **#868**: в PDF отсутствует вариант A (поле `defect` в данных)

## Экспонаты

7 вопросов с картинками: 96, 253, 423, 429, 477, 494, 980. У #477 сами варианты ответа это изображения.
