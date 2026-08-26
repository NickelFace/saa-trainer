#!/usr/bin/env bash
# Однократная настройка репозитория после клонирования: включить хуки из .githooks.
# core.hooksPath — локальная настройка, она не приезжает с клоном, поэтому её
# приходится ставить руками ровно один раз.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "хуки включены: core.hooksPath = $(git config --get core.hooksPath)"
echo "перед пушем теперь автоматически запускается scripts/check.sh"
