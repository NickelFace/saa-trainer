#!/usr/bin/env bash
# Сборка статики сайта из web/ и images/. Ничего не копируется руками:
# и workflow, и локальная проверка запускают именно этот скрипт.
#
#   bash scripts/build-site.sh [каталог-назначения] [версия-кеша]
#
# версия-кеша попадает в web/sw.js и меняет имя кеша при каждом деплое,
# поэтому у пользователя не остаётся старая сборка.
set -euo pipefail

OUT="${1:-site}"
VERSION="${2:-$(date -u +%Y%m%d%H%M%S)}"

rm -rf "$OUT"
mkdir -p "$OUT/images"
cp -r web/. "$OUT/"
cp -r images/exhibits "$OUT/images/exhibits"

# на сайте приложение лежит в корне, поэтому путь к экспонатам другой, чем локально
echo 'window.SAA_CONFIG = { exhibits: "images/exhibits/" };' > "$OUT/config.js"
sed -i "s/^var VERSION = \".*\";/var VERSION = \"$VERSION\";/" "$OUT/sw.js"

echo 'saa.maks.top' > "$OUT/CNAME"
printf 'User-agent: *\nDisallow: /\n' > "$OUT/robots.txt"
touch "$OUT/.nojekyll"

grep -q "var VERSION = \"$VERSION\";" "$OUT/sw.js"
du -sh "$OUT"
