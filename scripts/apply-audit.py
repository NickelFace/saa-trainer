#!/usr/bin/env python3
"""Сборка курируемого банка: разметка + оверлей аудита -> data/questions.json.

Оверлей data/overlay.json — доказательная часть аудита: исправленные ключи
(с сохранением answer_original), спорные вопросы, дефекты PDF, экспонаты.
Оверлей data/dom-overrides.json — ручная разметка домена для вопросов, где правила
classify.py не нашли маркеров (dom_conf становится manual).
Скрипт идемпотентен: результат зависит только от входных файлов.
"""
import json
import sys
from collections import Counter

SRC = "data/build/questions.classified.json"
OVERLAY = "data/overlay.json"
DOM_OVERRIDES = "data/dom-overrides.json"
META = "data/meta.json"
OUT = "data/questions.json"

# порядок ключей в записи вопроса
# поля *_en — английский перевод соответствующего аннотационного поля (см. glossary
# в scratch и data/overlay.json / data/dom-overrides.json); необязательны, RU остаётся
# каноническим источником, web/js/quiz.js падает на RU, если _en отсутствует.
ORDER = ["id", "question", "options", "answer", "answer_original", "fix_note", "fix_note_en",
         "disputed_alt", "disputed_note", "disputed_note_en", "defect", "defect_en",
         "note", "note_en", "exhibits",
         "dom", "svc", "multi", "dom_conf", "dom_why", "dom_why_en"]

qs = json.load(open(SRC, encoding="utf-8"))
ov = json.load(open(OVERLAY, encoding="utf-8"))

applied = {"answer": 0, "relabel": 0, "option_img": 0, "meta": 0}
unknown = [k for k in ov if not k.isdigit()]
if unknown:
    sys.exit(f"overlay: нечисловые ключи {unknown}")

by_id = {q["id"]: q for q in qs}
missing = [k for k in ov if int(k) not in by_id]
if missing:
    sys.exit(f"overlay: id нет в банке {missing}")

for key, patch in ov.items():
    q = by_id[int(key)]

    # 1) дефекты PDF: буквы вариантов правятся по позиции
    for idx, letter in patch.get("relabel", {}).items():
        q["options"][int(idx)]["l"] = letter
        applied["relabel"] += 1

    # 2) вариант-картинка
    for letter, img in patch.get("option_img", {}).items():
        for o in q["options"]:
            if o["l"] == letter:
                o["img"] = img
                applied["option_img"] += 1

    # 3) исправленный ключ — оригинал сохраняем как доказательство
    if "answer" in patch:
        if patch["answer"] != q["answer"]:
            q["answer_original"] = q["answer"]
            q["answer"] = patch["answer"]
            q["multi"] = len(q["answer"]) > 1
            applied["answer"] += 1

    # 4) остальные поля аудита (включая английские переводы *_en, если есть)
    for k in ("answer_original", "fix_note", "fix_note_en", "disputed_alt",
              "disputed_note", "disputed_note_en", "defect", "defect_en",
              "note", "note_en", "exhibits"):
        if k in patch:
            q[k] = patch[k]
            applied["meta"] += 1

# 5) ручная разметка домена вместо fallback-правила
dom_ov = json.load(open(DOM_OVERRIDES, encoding="utf-8"))
codes = {"SEC", "RES", "PERF", "COST"}
bad = {k: v for k, v in dom_ov.items() if v.get("dom") not in codes or not v.get("why")}
if bad:
    sys.exit(f"dom-overrides: некорректные записи {list(bad)[:5]}")
missing = [k for k in dom_ov if int(k) not in by_id]
if missing:
    sys.exit(f"dom-overrides: id нет в банке {missing}")
for key, patch in dom_ov.items():
    q = by_id[int(key)]
    q["dom"] = patch["dom"]
    q["dom_why"] = patch["why"]
    if "why_en" in patch:
        q["dom_why_en"] = patch["why_en"]
    q["dom_conf"] = "manual"

out = [{k: q[k] for k in ORDER if k in q} for q in sorted(qs, key=lambda x: x["id"])]
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# счётчики доменов в meta.json пересчитываются по факту, а не правятся руками
meta = json.load(open(META, encoding="utf-8"))
counts = Counter(q["dom"] for q in out)
for d in meta["domains"]:
    d["count"] = counts[d["code"]]
json.dump(meta, open(META, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"банк собран: {len(out)} вопросов -> {OUT}")
print(f"оверлей: {len(ov)} записей, применено {applied}")
print(f"ручная разметка домена: {len(dom_ov)} вопросов")
print("домены:", dict(counts))
print("уверенность:", dict(Counter(q["dom_conf"] for q in out)))
