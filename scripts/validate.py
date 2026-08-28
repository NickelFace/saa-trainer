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
check(set(conf) <= {"strong", "manual"}, f"допустимые значения dom_conf: {dict(conf)}")
check(conf["fallback"] == 0, "не осталось вопросов с доменом по умолчанию")
check(conf["weak"] == 0, "не осталось вопросов со слабой разметкой: все проверены вручную")
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
check(corrected == meta["corrected"], f"исправленные ключи совпадают с meta.json ({len(corrected)})")
check(disputed == meta["disputed"], f"спорные совпадают с meta.json ({len(disputed)})")
check(all("fix_note" in q for q in bank if "answer_original" in q), "у исправленных есть fix_note")
check(all("disputed_note" in q for q in bank if "disputed_alt" in q), "у спорных есть аргумент")
check(not meta["low_conf"], f"не осталось вопросов с низкой уверенностью ({meta['low_conf']})")
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
    main = [c for c in idx if c["order"] <= 22]
    check(len(main) == 22, f"22 основные главы (сейчас {len(main)})")
    thin = [c["id"] for c in main if c["lines"] < 150]
    check(not thin, f"каждая глава от 150 строк (тонкие: {thin})")
    no_json = [c["id"] for c in idx if not os.path.exists(os.path.join(THEORY, c["id"] + ".json"))]
    check(not no_json, f"у каждой главы есть json ({no_json})")
    no_md = [c["id"] for c in idx if not os.path.exists(os.path.join(DOCS, c["id"] + ".md"))]
    check(not no_md, f"у каждой главы есть markdown ({no_md})")
    orphan = [c["id"] for c in main if not c["questions"]]
    check(not orphan, f"каждая глава связана с вопросами ({orphan})")
    # обязательная структура главы: без этих блоков глава не готова, см. CLAUDE.md
    required = ("что спрашивают", "числа, которые надо помнить", "практикум", "аудит банка")
    incomplete = {}
    for c in main:
        text = open(os.path.join(DOCS, c["id"] + ".md"), encoding="utf-8").read().lower()
        missing = [r for r in required if r not in text]
        if missing:
            incomplete[c["id"]] = missing
    check(not incomplete, f"в каждой главе есть обязательные блоки ({incomplete})")
else:
    check(False, "data/theory/index.json не собран — запусти scripts/build-theory.py")

print("разборы вопросов:")
expl_path = "data/explanations.json"
if os.path.exists(expl_path):
    expl = json.load(open(expl_path, encoding="utf-8"))
    by_id = {q["id"]: q for q in bank}
    bad_id = [k for k in expl if not k.isdigit() or int(k) not in by_id]
    check(not bad_id, f"все id разборов есть в банке ({bad_id})")
    no_key = [k for k, v in expl.items() if not v.get("key")]
    check(not no_key, f"у каждого разбора есть объяснение ключа ({no_key})")
    bad_letter = [f"{k}:{l}" for k, v in expl.items() if k.isdigit() and int(k) in by_id
                  for l in v.get("opts", {})
                  if l not in {o["l"] for o in by_id[int(k)]["options"]}]
    check(not bad_letter, f"буквы вариантов в разборах существуют ({bad_letter[:5]})")
    missing_wrong = [k for k, v in expl.items() if k.isdigit() and int(k) in by_id
                     and [o["l"] for o in by_id[int(k)]["options"]
                          if o["l"] not in by_id[int(k)]["answer"] and o["l"] not in v.get("opts", {})]]
    check(not missing_wrong, f"у каждого неверного варианта есть объяснение ({missing_wrong[:5]})")
    # банк разобран полностью, и это состояние закрепляем: новый вопрос без разбора роняет сборку
    unexplained = [q["id"] for q in bank if str(q["id"]) not in expl]
    check(not unexplained, f"разобраны все вопросы банка (без разбора: {unexplained[:5]})")
    print(f"  инфо  разборов {len(expl)} из {len(bank)} ({round(100 * len(expl) / len(bank), 1)}%)")
else:
    print("  инфо  разборов пока нет")

print("билингва (английский слой):")
expl_en_path = "data/explanations.en.json"
if os.path.exists(expl_en_path):
    expl_en = json.load(open(expl_en_path, encoding="utf-8"))
    by_id = {q["id"]: q for q in bank}
    bad_id_en = [k for k in expl_en if not k.isdigit() or int(k) not in by_id]
    check(not bad_id_en, f"EN: все id разборов есть в банке ({bad_id_en[:5]})")
    no_key_en = [k for k, v in expl_en.items() if not v.get("key")]
    check(not no_key_en, f"EN: у каждого EN-разбора есть объяснение ключа ({no_key_en[:5]})")
    bad_letter_en = [f"{k}:{l}" for k, v in expl_en.items() if k.isdigit() and int(k) in by_id
                      for l in v.get("opts", {})
                      if l not in {o["l"] for o in by_id[int(k)]["options"]}]
    check(not bad_letter_en, f"EN: буквы вариантов в разборах существуют ({bad_letter_en[:5]})")
    print(f"  инфо  EN-разборов {len(expl_en)} из {len(bank)} ({round(100 * len(expl_en) / len(bank), 1)}%)")
else:
    print("  инфо  data/explanations.en.json пока нет — EN-режим падает на RU-разборы")

dom_ov = json.load(open("data/dom-overrides.json", encoding="utf-8"))
why_en_count = sum(1 for v in dom_ov.values() if v.get("why_en"))
print(f"  инфо  dom-overrides why_en: {why_en_count} из {len(dom_ov)}")

overlay = json.load(open("data/overlay.json", encoding="utf-8"))
overlay_en_fields = sum(1 for v in overlay.values() for k in v if k.endswith("_en"))
print(f"  инфо  overlay.json полей *_en: {overlay_en_fields}")

en_docs = "docs/en"
if os.path.isdir(en_docs):
    ru_ids = {os.path.splitext(f)[0] for f in os.listdir(DOCS) if f.endswith(".md")}
    en_ids = {os.path.splitext(f)[0] for f in os.listdir(en_docs) if f.endswith(".md")}
    missing_en = sorted(ru_ids - en_ids)
    check(not missing_en, f"EN: у каждой RU-главы есть перевод в docs/en/ ({missing_en})")
    extra_en = sorted(en_ids - ru_ids)
    check(not extra_en, f"EN: в docs/en/ нет лишних файлов без RU-пары ({extra_en})")
    idx_en_path = os.path.join(THEORY, "en", "index.json")
    if os.path.exists(idx_en_path):
        idx_en = json.load(open(idx_en_path, encoding="utf-8"))["chapters"]
        main_en = [c for c in idx_en if c["order"] <= 22]
        print(f"  инфо  EN: {len(main_en)} основных глав собрано из docs/en/")
else:
    print("  инфо  docs/en/ пока нет — EN-режим учебника падает на RU-главы")

print()
if fails:
    print(f"ПРОВАЛЕНО проверок: {len(fails)}")
    sys.exit(1)
print("все проверки пройдены")
