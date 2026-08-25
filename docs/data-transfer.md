---
id: data-transfer
title: Перенос данных: DataSync, Storage Gateway, Snow, Transfer Family
order: 15
svc: [DataSync, Storage Gateway, Snow Family, Transfer Family, DMS]
---

# Перенос и синхронизация данных

Вопросы этого блока решаются двумя параметрами: объём и наличие канала. Дальше
уточняется, разовый это перенос или постоянная гибридная работа, и какой протокол
нужен приложению.

## Быстрая матрица выбора

| Ситуация | Ответ |
|---|---|
| Сотни ТБ или ПБ, канала не хватает | Snowball Edge, при 100 ПБ — Snowmobile |
| Десятки ТБ, канал есть, разово или по расписанию | DataSync |
| Локальным приложениям нужен доступ к данным в облаке постоянно | Storage Gateway |
| Партнёры загружают файлы по SFTP/FTPS | Transfer Family |
| Перенос базы с минимальным простоем | DMS (плюс SCT при смене движка) |
| Непрерывный поток событий | Kinesis Data Firehose |
| Синхронизация S3 между регионами | S3 Replication |

Правило прикидки: 1 ТБ по каналу 1 Гбит/с в идеале идёт около 2.5 часов, реально
дольше. Если расчёт даёт недели, а срок — дни, ответ Snow.

## DataSync

Агент (или сервис без агента для облачных источников) переносит файлы между NFS, SMB,
HDFS, объектными хранилищами и сервисами AWS: S3, EFS, FSx. Умеет инкрементальную
синхронизацию, проверку целостности, фильтры, расписание, сохранение метаданных и
ACL, шифрование в передаче, работу через VPC endpoint. Скорость до десятков Гбит/с,
дросселирование настраивается.

Ответ на «перенести 50 ТБ файлов и потом синхронизировать ежедневно», «мигрировать
файловый сервер в FSx», «скопировать данные между регионами и аккаунтами с проверкой».

## Storage Gateway

Гибридное хранилище: локальный кэш, «бесконечный» объём в S3.

| Тип | Протокол локально | Где данные | Сценарий |
|---|---|---|---|
| S3 File Gateway | NFS, SMB | объекты в S3 | файловый доступ к объектам, архив документов |
| FSx File Gateway | SMB | FSx for Windows | локальный кэш для файловых шар Windows |
| Volume Gateway (cached) | iSCSI | основные данные в S3, горячие локально | расширение дискового пространства |
| Volume Gateway (stored) | iSCSI | основные данные локально, копии в S3 | бэкап с быстрым локальным доступом |
| Tape Gateway | iSCSI VTL | S3 и Glacier | замена ленточных библиотек, backup-софт без изменений |

Подсказки в тексте: «backup software writes to tape» — Tape Gateway; «need low-latency
access to recently used data with unlimited cloud storage» — cached Volume Gateway или
File Gateway; «Windows file shares with AD» — FSx File Gateway.

## Snow Family

- Snowcone — до 8 или 14 ТБ, портативное устройство, может работать в поле;
- Snowball Edge Storage Optimized — около 80 ТБ полезного объёма;
- Snowball Edge Compute Optimized — меньше места, но есть vCPU, память и GPU для
  обработки на месте (edge-вычисления, предобработка перед отправкой);
- Snowmobile — контейнер на грузовике, десятки петабайт.

Данные шифруются KMS, устройство отслеживается, обратная отправка через перевозчика.
Snowball также используют для миграции «в один конец» перед закрытием дата-центра и
для сбора данных там, где связи нет вовсе.

## Transfer Family

Управляемые endpoints SFTP, FTPS, FTP и AS2 поверх S3 и EFS. Пользователи и их ключи
хранятся в сервисе, в Directory Service или в собственном провайдере через Lambda.
Ответ на «партнёры годами шлют файлы по SFTP, менять их процесс нельзя, но сервер
поддерживать не хотим».

## S3-механики переноса

- Multipart upload и Transfer Acceleration для больших файлов через интернет;
- S3 Batch Operations — массовые действия над миллионами объектов (копирование,
  смена класса, вызов Lambda);
- S3 Batch Replication — репликация уже существующих объектов;
- Import/Export через Snow, если объём делает сеть бессмысленной.

## Миграция серверов и баз

Application Migration Service (MGN) реплицирует целые серверы блочно и переключает
их в EC2 с минимальным простоем. Database Migration Service переносит данные СУБД
с CDC. Migration Hub показывает общий прогресс. Для оценки инвентаря и зависимостей —
Application Discovery Service.

## Что спрашивают на экзамене

1. «Перенести 500 ТБ за две недели, канал 500 Мбит/с» — Snowball Edge.
2. «Ежедневно копировать файлы NFS в S3 с проверкой целостности» — DataSync.
3. «Локальные приложения должны видеть S3 как файловую шару» — S3 File Gateway.
4. «Отказаться от ленточных библиотек, не меняя софт бэкапа» — Tape Gateway.
5. «Клиенты шлют файлы по SFTP» — Transfer Family.
6. «Перевезти Oracle в Aurora PostgreSQL» — SCT плюс DMS.
7. «Собрать данные с судна без связи» — Snowcone или Snowball с вычислениями.
8. «Синхронизировать S3 между регионами постоянно» — Cross-Region Replication,
   а не DataSync.

## Числа, которые надо помнить

- Snowcone до 8 или 14 ТБ, Snowball Edge около 80 ТБ полезного объёма, Snowmobile
  до 100 ПБ;
- Snow-устройство едет к вам и обратно, типовой цикл — около недели;
- DataSync ускоряет передачу в разы против обычного копирования и проверяет
  целостность каждого файла;
- Storage Gateway хранит локально кэш, а полный набор данных — в S3;
- Transfer Family тарифицируется за час работы протокольного endpoint и за переданные
  гигабайты;
- S3 Transfer Acceleration использует edge-сеть CloudFront и оплачивается отдельно.

## Как читать формулировку

| В тексте вопроса | Ответ |
|---|---|
| «petabytes, limited bandwidth, weeks deadline» | Snow Family |
| «ongoing incremental sync of NFS shares» | DataSync |
| «on-premises apps need low-latency access to cloud data» | Storage Gateway |
| «replace tape backups without changing software» | Tape Gateway |
| «partners upload via SFTP» | Transfer Family |
| «migrate database with minimal downtime» | DMS с CDC |
| «keep two buckets in sync across Regions» | S3 Replication |
| «collect data at a remote site with no connectivity» | Snowcone или Snowball Edge |

## Как выбрать за три шага

1. Посчитайте время передачи по каналу: объём делить на реальную пропускную способность.
   Если получается больше срока проекта, дальше рассматриваются только Snow-устройства.
2. Определите, разовый это перенос или постоянный процесс. Разовый — Snow или DataSync;
   постоянный гибридный доступ — Storage Gateway; постоянный обмен с партнёрами —
   Transfer Family.
3. Проверьте протокол приложения: NFS и SMB — DataSync или File Gateway, iSCSI —
   Volume Gateway, SFTP — Transfer Family, SQL — DMS.

## Мини-практикум

**1.** 600 ТБ архивов нужно перевезти в S3 за месяц, канал 200 Мбит/с.
→ Несколько Snowball Edge: по каналу передача заняла бы больше девяти месяцев.

**2.** Ежедневно 2 ТБ новых файлов с NFS-шары должны попадать в S3 с проверкой
целостности.
→ DataSync по расписанию с инкрементальной синхронизацией.

**3.** Локальное приложение пишет на iSCSI-том и должно продолжать работать, но данные
нужны в облаке.
→ Volume Gateway в режиме cached: горячие блоки локально, полный набор в S3.

**4.** Партнёры годами шлют файлы по SFTP, менять их процесс нельзя.
→ AWS Transfer Family поверх S3 с аутентификацией в каталоге или через Lambda.

## Аудит банка

- {{q:113}} — низкая уверенность: Snowball Edge с последующей обработкой Glue против
  Snowball с вычислениями на борту.
