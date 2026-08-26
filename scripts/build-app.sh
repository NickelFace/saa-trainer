#!/usr/bin/env bash
# Сборка веб-части для мобильного приложения: то же приложение, что и на сайте,
# но с картинками рядом, с рантаймом Capacitor и без service worker —
# офлайн внутри приложения обеспечивает сам APK.
#
#   bash scripts/build-app.sh [каталог-назначения]
set -euo pipefail

# скрипт вызывается и из корня репозитория, и из mobile/ через npm,
# поэтому пути считаем от самого скрипта, а не от текущего каталога
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OUT="${1:-mobile/www}"
case "$OUT" in /*) ;; *) OUT="$ROOT/$OUT" ;; esac
CAP="$ROOT/mobile/node_modules/@capacitor"

rm -rf "$OUT"
mkdir -p "$OUT/images"
cp -r web/. "$OUT/"
cp -r images/exhibits "$OUT/images/exhibits"

# в приложении ассеты лежат в корне webDir
echo 'window.SAA_CONFIG = { exhibits: "images/exhibits/" };' > "$OUT/config.js"

# service worker внутри приложения не нужен и только мешает обновлению сборки
rm -f "$OUT/sw.js"

# Приложение собирается без бандлера, поэтому рантайм Capacitor и плагин App
# подключаются обычными <script>. На сайте этих файлов нет и они не нужны.
if [ -f "$CAP/core/dist/capacitor.js" ] && [ -f "$CAP/app/dist/plugin.js" ]; then
  mkdir -p "$OUT/capacitor"
  cp "$CAP/core/dist/capacitor.js" "$OUT/capacitor/capacitor.js"
  cp "$CAP/app/dist/plugin.js" "$OUT/capacitor/app.js"
  sed -i 's|<script src="config.js"></script>|<script src="capacitor/capacitor.js"></script>\n<script src="capacitor/app.js"></script>\n<script src="config.js"></script>|' "$OUT/index.html"
  grep -q 'capacitor/app.js' "$OUT/index.html"
else
  # код 3 отличает «нет зависимостей» от настоящей ошибки сборки:
  # scripts/check.sh на этом коде проверяет копирование, но не валит проверку целиком
  echo "рантайм Capacitor не найден — выполните npm ci в mobile/" >&2
  exit 3
fi

du -sh "$OUT"
