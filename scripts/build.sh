#!/usr/bin/env bash
# Полная пересборка: банк -> учебник -> данные приложения -> проверки.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/parse.py
python3 scripts/classify.py
python3 scripts/apply-audit.py
python3 scripts/build-theory.py
python3 scripts/build-web-data.py
python3 scripts/validate.py
