#!/usr/bin/env bash
# Прогон всего, что проверяет CI, но локально и за секунды.
# Именно этот скрипт вызывает хук pre-push, поэтому падать он должен там же,
# где упал бы workflow.
#
#   bash scripts/check.sh
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fails=0

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  ok   %s\n' "$1"; }
bad()  { printf '  FAIL %s\n' "$1"; fails=$((fails + 1)); }

# 1. Банк, учебник и данные приложения — тот же шаг, что и в workflow сайта.
step "данные и учебник (scripts/build.sh)"
if bash scripts/build.sh > "$TMP/build.log" 2>&1; then
  ok "пайплайн и validate.py прошли"
else
  bad "пайплайн упал, последние строки:"
  tail -20 "$TMP/build.log" | sed 's/^/       /'
fi

# 2. Сборочные артефакты в репозитории должны совпадать с пересобранными:
#    иначе в main уезжает банк, не соответствующий исходникам.
step "артефакты в git не отстают от исходников"
drift="$(git status --porcelain -- data web/data docs 2>/dev/null)"
if [ -z "$drift" ]; then
  ok "data/, web/data/ и docs/ совпадают с пересборкой"
else
  bad "после пересборки изменились файлы — добавьте их в коммит:"
  echo "$drift" | sed 's/^/       /'
fi

# 3. Синтаксис JS: приложение собирается без сборщика, ошибка вылезет только в браузере.
step "синтаксис javascript"
if command -v node > /dev/null; then
  bad_js=""
  for f in web/js/*.js web/sw.js web/config.js; do
    node --check "$f" > /dev/null 2>&1 || bad_js="$bad_js $f"
  done
  [ -z "$bad_js" ] && ok "все файлы разбираются" || bad "не разбираются:$bad_js"
else
  ok "node не найден, шаг пропущен"
fi

# 4. Сборка сайта — как в workflow Pages.
step "сборка сайта (scripts/build-site.sh)"
if bash scripts/build-site.sh "$TMP/site" check > "$TMP/site.log" 2>&1; then
  ok "site собран, версия кеша подставлена"
else
  bad "сборка сайта упала:"
  tail -10 "$TMP/site.log" | sed 's/^/       /'
fi

# 5. Сборка веб-части приложения — ровно так, как её вызывает CI: из каталога mobile.
#    Именно на этом отличии рабочего каталога однажды упал workflow APK.
step "веб-часть приложения (npm run www из mobile/)"
if [ -d mobile/node_modules/@capacitor ]; then
  if (cd mobile && bash ../scripts/build-app.sh > "$TMP/app.log" 2>&1); then
    grep -q 'capacitor/app.js' mobile/www/index.html \
      && ok "www собран, рантайм Capacitor подключён" \
      || bad "в www/index.html нет тегов рантайма Capacitor"
  else
    bad "сборка веб-части упала:"
    tail -10 "$TMP/app.log" | sed 's/^/       /'
  fi
else
  ok "mobile/node_modules нет, шаг пропущен (npm ci в mobile/ включит его)"
fi

# 6. Лок-файл приложения: в CI стоит npm ci, он падает при рассинхроне с package.json.
step "mobile/package-lock.json в согласии с package.json"
if [ -f mobile/package-lock.json ]; then
  if node -e '
      const fs = require("fs");
      const pkg = JSON.parse(fs.readFileSync("mobile/package.json"));
      const lock = JSON.parse(fs.readFileSync("mobile/package-lock.json"));
      const root = (lock.packages && lock.packages[""]) || {};
      const want = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      const have = Object.assign({}, root.dependencies, root.devDependencies);
      const bad = Object.keys(want).filter(k => have[k] !== want[k]);
      if (bad.length) { console.error(bad.join(", ")); process.exit(1); }
  ' 2> "$TMP/lock.log"; then
    ok "зависимости совпадают"
  else
    bad "разошлись пакеты: $(cat "$TMP/lock.log") — выполните npm install в mobile/"
  fi
else
  bad "mobile/package-lock.json отсутствует, npm ci в CI не сработает"
fi

printf '\n'
if [ "$fails" -gt 0 ]; then
  printf '\033[31mпровалено проверок: %s\033[0m\n' "$fails"
  exit 1
fi
printf '\033[32mвсе проверки пройдены — можно пушить\033[0m\n'
