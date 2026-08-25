#!/usr/bin/env python3
"""Сборка курируемого банка: разметка + оверлей аудита -> data/questions.json.

Оверлей data/overlay.json — доказательная часть аудита: исправленные ключи
(с сохранением answer_original), спорные вопросы, дефекты PDF, экспонаты.
Скрипт идемпотентен: результат зависит только от входных файлов.
"""
import json
import sys

SRC = "data/build/questions.classified.json"
OVERLAY = "data/overlay.json"
OUT = "data/questions.json"

# порядок ключей в записи вопроса
ORDER = ["id", "question", "options", "answer", "answer_original", "fix_note",
         "disputed_alt", "disputed_note", "defect", "note", "exhibits",
         "dom", "svc", "multi", "dom_conf"]

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

    # 4) остальные поля аудита
    for k in ("answer_original", "fix_note", "disputed_alt", "disputed_note",
              "defect", "note", "exhibits"):
        if k in patch:
            q[k] = patch[k]
            applied["meta"] += 1

out = [{k: q[k] for k in ORDER if k in q} for q in sorted(qs, key=lambda x: x["id"])]
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print(f"банк собран: {len(out)} вопросов -> {OUT}")
print(f"оверлей: {len(ov)} записей, применено {applied}")
