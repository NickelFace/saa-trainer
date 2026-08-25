#!/usr/bin/env python3
"""JSON -> web/data/*.js.

file:// запрещает fetch локальных файлов, поэтому веб-приложение получает данные
обычными <script>-тегами. Источник истины остаётся в data/*.json.
"""
import json
import os
import re

OUT = "web/data"
os.makedirs(OUT, exist_ok=True)

QREF = re.compile(r"\{\{q:([0-9,\s]+)\}\}")


def qrefs(text):
    """{{q:126}} -> кликабельная ссылка на вопросы, как в главах учебника."""
    def sub(m):
        ids = [x.strip() for x in m.group(1).split(",") if x.strip()]
        label = ", ".join("#" + i for i in ids)
        return f'<a class="qref" data-q="{",".join(ids)}" href="#">{label}</a>'
    return QREF.sub(sub, text)


bank = json.load(open("data/questions.json", encoding="utf-8"))
meta = json.load(open("data/meta.json", encoding="utf-8"))

NOTE_FIELDS = ("fix_note", "disputed_note", "dom_why", "note", "defect")
for q in bank:
    for field in NOTE_FIELDS:
        if field in q:
            q[field] = qrefs(q[field])

payload = {"meta": meta, "questions": bank}
with open(os.path.join(OUT, "bank.js"), "w", encoding="utf-8") as f:
    f.write("window.SAA_DATA=")
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

expl = {}
if os.path.exists("data/explanations.json"):
    expl = json.load(open("data/explanations.json", encoding="utf-8"))
    for e in expl.values():
        if "key" in e:
            e["key"] = qrefs(e["key"])
        for letter, text in (e.get("opts") or {}).items():
            e["opts"][letter] = qrefs(text)
with open(os.path.join(OUT, "explain.js"), "w", encoding="utf-8") as f:
    f.write("window.SAA_EXPLAIN=")
    json.dump(expl, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

chapters = []
idx_path = "data/theory/index.json"
if os.path.exists(idx_path):
    for c in json.load(open(idx_path, encoding="utf-8"))["chapters"]:
        chapters.append(json.load(open(f"data/theory/{c['id']}.json", encoding="utf-8")))
with open(os.path.join(OUT, "theory.js"), "w", encoding="utf-8") as f:
    f.write("window.SAA_THEORY=")
    json.dump({"chapters": chapters}, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

kb = lambda p: os.path.getsize(p) // 1024
print(f"web/data/bank.js   {kb(os.path.join(OUT, 'bank.js'))} КБ, вопросов {len(bank)}")
print(f"web/data/theory.js {kb(os.path.join(OUT, 'theory.js'))} КБ, глав {len(chapters)}")
print(f"web/data/explain.js {kb(os.path.join(OUT, 'explain.js'))} КБ, разборов {len(expl)} из {len(bank)}")
