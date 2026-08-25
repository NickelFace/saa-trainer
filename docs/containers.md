---
id: containers
title: Контейнеры: ECS, EKS, Fargate
order: 18
svc: [ECS, EKS, Fargate, Elastic Beanstalk]
---

# Контейнеры

Контейнер — способ упаковать приложение с зависимостями. В AWS вопрос сводится к двум
осям: какой оркестратор (ECS или EKS) и на чём выполнять задачи (EC2 или Fargate).

## ECS

Собственный оркестратор AWS: кластер, task definition (образ, CPU, память, порты,
переменные, роли), сервис (желаемое количество задач, интеграция с ELB, автоскейлинг).

- task role — права самого приложения, task execution role — права агента на
  вытягивание образа из ECR и запись логов; их путают, и это встречается в вопросах;
- режимы сети: awsvpc даёт задаче собственный ENI и security group (стандарт),
  bridge и host — на EC2;
- capacity providers распределяют задачи между EC2, Fargate и Fargate Spot;
- service auto scaling масштабирует по CPU, памяти, числу запросов на цель ALB или
  произвольной метрике CloudWatch;
- ECS Anywhere запускает задачи на своём железе.

## EKS

Управляемый Kubernetes: AWS обслуживает control plane, вы — рабочие узлы (managed node
groups, self-managed или Fargate). Выбирают, когда нужна экосистема Kubernetes:
существующие манифесты и Helm-чарты, переносимость между облаками, операторы,
специфические контроллеры.

- IRSA (IAM Roles for Service Accounts) выдаёт права подам через OIDC — правильный
  ответ на «дать поду доступ к S3 без ключей»;
- AWS Load Balancer Controller создаёт ALB для Ingress и NLB для Service;
- Cluster Autoscaler или Karpenter добавляют узлы, HPA масштабирует поды;
- узлы могут быть на Spot для пакетных задач.

## Fargate

Бессерверное выполнение задач: вы описываете CPU и память, AWS запускает контейнер
без управления инстансами. Нет доступа к хосту, нет daemonset-подобных агентов на узле,
нет GPU (для GPU нужен EC2), нет instance store, но есть эфемерное хранилище и
подключение EFS.

Выбирают при формулировках «no servers to manage», «minimize operational overhead»,
«variable workload». EC2-режим выбирают, когда нужны GPU, специальные типы инстансов,
максимальная плотность или экономия на длительной стабильной нагрузке через RI и
Savings Plans.

## Реестр образов

ECR хранит образы, сканирует их на уязвимости (базовое и расширенное сканирование через
Inspector), поддерживает lifecycle-политики для очистки старых тегов, репликацию между
регионами и аккаунтами, приватный доступ через interface endpoint.

## Хранилище и конфигурация

- EFS монтируется в задачи ECS и поды EKS — общий доступ к файлам между контейнерами
  в разных AZ;
- FSx for Lustre подключается к EKS для тяжёлых вычислений;
- секреты подставляются из Secrets Manager и Parameter Store прямо в task definition;
- логи уходят в CloudWatch Logs через awslogs или в другие приёмники через FireLens.

## Elastic Beanstalk

Платформа для развёртывания приложения на стандартных стеках: сама создаёт EC2, ASG,
ELB, настраивает мониторинг и деплой. Ответ на «поднять веб-приложение с минимальной
операционной нагрузкой, не переписывая его и не изучая контейнеры». Поддерживает
rolling, immutable и blue/green выкаты.

## Что выбрать

| Требование | Ответ |
|---|---|
| Уже есть манифесты Kubernetes | EKS |
| Просто запустить контейнеры в AWS | ECS |
| Не хотим управлять узлами | Fargate |
| Нужны GPU или особые инстансы | ECS/EKS на EC2 |
| Пакетные задания по расписанию и очереди | AWS Batch или ECS Scheduled Tasks |
| Приложение на Java/Python без контейнеров | Elastic Beanstalk |
| Событие раз в секунду, работа 200 мс | Lambda, контейнеры не нужны |

## Что спрашивают на экзамене

1. «Микросервисы, минимум администрирования, нет опыта Kubernetes» — ECS на Fargate.
2. «Нужен доступ к S3 из пода без ключей» — IRSA.
3. «Задачам нужен общий том между AZ» — EFS.
4. «Снизить стоимость обработки очереди контейнерами» — Fargate Spot или EC2 Spot
   в capacity provider.
5. «Маршрутизация HTTP к сервисам в EKS» — ALB через AWS Load Balancer Controller.
6. «Образы должны проверяться на уязвимости» — сканирование ECR с Inspector.
7. «Мигрировать docker-compose приложение в облако быстро» — ECS с Fargate.
8. «Нужен полный контроль над узлами и ядром» — EC2-режим, не Fargate.

## Числа, которые надо помнить

- Fargate: CPU от 0.25 vCPU до 16, память от 0.5 ГБ до 120 ГБ, эфемерный диск
  до 200 ГБ;
- task definition хранит версии, сервис ссылается на конкретную ревизию;
- ECS awsvpc даёт задаче свой ENI, что расходует лимит ENI на инстансе;
- EKS: control plane обслуживает AWS, оплата почасовая за кластер плюс узлы;
- ECR: образы до 10 ГБ на слой в пределах лимитов, lifecycle-политики чистят теги;
- Fargate Spot дешевле примерно на 70 процентов, задача может быть прервана.

## Как читать формулировку

| В тексте вопроса | Ответ |
|---|---|
| «containers without managing servers» | Fargate |
| «existing Kubernetes manifests and Helm» | EKS |
| «pods need AWS permissions without keys» | IRSA |
| «shared storage between tasks across AZs» | EFS |
| «GPU workloads in containers» | ECS или EKS на EC2 |
| «cheap batch container jobs» | Fargate Spot или EC2 Spot |
| «deploy a Java app, no container experience» | Elastic Beanstalk |
| «route HTTP to services by path» | ALB с target group на сервисы |

## Выкаты и надёжность

ECS поддерживает rolling update с параметрами minimumHealthyPercent и maximumPercent,
а также blue/green через CodeDeploy с переключением target group и автоматическим
откатом по алармам. В EKS те же задачи решают Deployment-стратегии Kubernetes и
контроллеры прогрессивной доставки. Для отказоустойчивости задачи распределяют по
нескольким AZ (placement strategy spread у ECS, topology spread constraints у
Kubernetes), health check ALB отслеживает готовность приложения, а не только запуск
контейнера.

## Мини-практикум

**1.** Команда без опыта Kubernetes переносит монолит из docker-compose и не хочет
управлять серверами.
→ ECS на Fargate с ALB перед сервисом.

**2.** Поду в EKS нужен доступ к бакету, ключи в манифесте недопустимы.
→ IRSA: роль IAM, привязанная к service account через OIDC-провайдер кластера.

**3.** Пакетная обработка контейнерами занимает часы и может прерываться.
→ Fargate Spot или EC2 Spot в capacity provider, задания из очереди SQS.

**4.** Нужно сканировать образы на уязвимости при каждом пуше.
→ ECR с расширенным сканированием на базе Inspector, находки в Security Hub.

## Связь с другими главами

- Выбор между контейнерами и функциями — глава про Lambda.
- Балансировка HTTP-трафика и health checks — глава про балансировщики.
- Общее файловое хранилище для задач — глава про EFS и FSx.
- Права подов и задач без ключей — глава про IAM.
- Сканирование образов и защита периметра — глава про безопасность.

## Аудит банка

- {{q:591}} — спорный: для маршрутизации к микросервисам в EKS штатное решение это ALB,
  API Gateway обычно дороже.
- {{q:422}} — низкая уверенность: SQS с ECS Fargate против SQS с Lambda, решает размер
  моделей и время обработки.
