#!/usr/bin/env python3
"""Проверка критериев готовности из HANDOFF.md. Ненулевой код возврата — провал."""
import json
import os
import random
import sys
from collections import Counter

BANK = "data/questions.json"
META = "data/meta.json"
THEORY = "data/theory"
DOCS = "docs"

fails = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        fails.append(msg)


bank = json.load(open(BANK, encoding="utf-8"))
meta = json.load(open(META, encoding="utf-8"))

print("банк:")
check(len(bank) == 1019, f"1019 вопросов (сейчас {len(bank)})")
check(all(q.get("answer") for q in bank), "у всех непустой answer")
check(all(q.get("dom") for q in bank), "у всех есть dom")
no_svc = [q["id"] for q in bank if not q.get("svc")]
check(not no_svc, f"у всех непустой svc (без сервисов: {no_svc})")
check(sorted(q["id"] for q in bank) == list(range(1, 1020)), "id 1..1019 без пропусков")
check(all(set(q["answer"]) <= {o["l"] for o in q["options"]} for q in bank),
      "буквы ответа существуют среди вариантов")

print("разметка доменов:")
conf = Counter(q["dom_conf"] for q in bank)
check(set(conf) <= {"strong", "weak", "manual"}, f"допустимые значения dom_conf: {dict(conf)}")
check(conf["fallback"] == 0, "не осталось вопросов с доменом по умолчанию")
no_why = [q["id"] for q in bank if q["dom_conf"] == "manual" and not q.get("dom_why")]
check(not no_why, f"у каждой ручной разметки есть обоснование ({no_why})")
ov_dom = json.load(open("data/dom-overrides.json", encoding="utf-8"))
manual = {q["id"] for q in bank if q["dom_conf"] == "manual"}
check({int(k) for k in ov_dom} == manual, "оверлей доменов совпадает с банком")
check(all(bank_q["dom"] == ov_dom[str(bank_q["id"])]["dom"]
          for bank_q in bank if bank_q["dom_conf"] == "manual"), "домены применены из оверлея")
check(sum(d["count"] for d in meta["domains"]) == len(bank), "счётчики доменов в meta.json сходятся")
check(all(d["count"] == Counter(q["dom"] for q in bank)[d["code"]] for d in meta["domains"]),
      "счётчики доменов в meta.json актуальны")

print("аудит:")
corrected = [q["id"] for q in bank if "answer_original" in q]
disputed = [q["id"] for q in bank if "disputed_alt" in q]
check(corrected == meta["corrected"], f"18 исправленных ключей ({len(corrected)})")
check(disputed == meta["disputed"], f"15 спорных ({len(disputed)})")
check(all("fix_note" in q for q in bank if "answer_original" in q), "у исправленных есть fix_note")
check([q["id"] for q in bank if "exhibits" in q] == meta["exhibits"], "7 вопросов с экспонатами")
missing_png = [f for q in bank for f in q.get("exhibits", []) if not os.path.exists(f"images/exhibits/{f}")]
missing_png += [o["img"] for q in bank for o in q["options"]
                if o.get("img") and not os.path.exists(f"images/exhibits/{o['img']}")]
check(not missing_png, f"все картинки на месте ({missing_png})")

print("экзаменационная выборка:")
plan = {d["code"]: d["exam"] for d in meta["domains"]}
check(sum(plan.values()) == 65, f"план 65 вопросов: {plan}")
rnd = random.Random(42)
by_dom = {}
for q in bank:
    by_dom.setdefault(q["dom"], []).append(q)
sample = [q for code, n in plan.items() for q in rnd.sample(by_dom[code], n)]
dist = Counter(q["dom"] for q in sample)
check(dict(dist) == plan, f"фактическое распределение {dict(dist)}")
check(len({q['id'] for q in sample}) == 65, "в выборке нет повторов")

print("учебник:")
idx_path = os.path.join(THEORY, "index.json")
if os.path.exists(idx_path):
    idx = json.load(open(idx_path, encoding="utf-8"))["chapters"]
    check(len(idx) == 22, f"22 главы (сейчас {len(idx)})")
    thin = [c["id"] for c in idx if c["lines"] < 150]
    check(not thin, f"каждая глава от 150 строк (тонкие: {thin})")
    no_json = [c["id"] for c in idx if not os.path.exists(os.path.join(THEORY, c["id"] + ".json"))]
    check(not no_json, f"у каждой главы есть json ({no_json})")
    no_md = [c["id"] for c in idx if not os.path.exists(os.path.join(DOCS, c["id"] + ".md"))]
    check(not no_md, f"у каждой главы есть markdown ({no_md})")
    orphan = [c["id"] for c in idx if not c["questions"]]
    check(not orphan, f"каждая глава связана с вопросами ({orphan})")
else:
    check(False, "data/theory/index.json не собран — запусти scripts/build-theory.py")

print()
if fails:
    print(f"ПРОВАЛЕНО проверок: {len(fails)}")
    sys.exit(1)
print("все проверки пройдены")
