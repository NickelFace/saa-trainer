#!/usr/bin/env python3
"""JSON -> web/data/*.js.

file:// запрещает fetch локальных файлов, поэтому веб-приложение получает данные
обычными <script>-тегами. Источник истины остаётся в data/*.json.

Английские артефакты (explain.en.js, theory.en.js) собираются из
data/explanations.en.json и data/theory/en/*.json, если они есть — RU-фолбэк по
каждому id/каждой главе делает web/js/quiz.js и web/js/theory.js на лету, здесь
собираются только сами артефакты.
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

NOTE_FIELDS = ("fix_note", "fix_note_en", "disputed_note", "disputed_note_en",
               "dom_why", "dom_why_en", "note", "note_en", "defect", "defect_en")
for q in bank:
    for field in NOTE_FIELDS:
        if field in q:
            q[field] = qrefs(q[field])

payload = {"meta": meta, "questions": bank}
with open(os.path.join(OUT, "bank.js"), "w", encoding="utf-8") as f:
    f.write("window.SAA_DATA=")
    json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")


def build_explain(src_path, out_name, global_name):
    expl = {}
    if os.path.exists(src_path):
        expl = json.load(open(src_path, encoding="utf-8"))
        for e in expl.values():
            if "key" in e:
                e["key"] = qrefs(e["key"])
            for letter, text in (e.get("opts") or {}).items():
                e["opts"][letter] = qrefs(text)
    with open(os.path.join(OUT, out_name), "w", encoding="utf-8") as f:
        f.write(f"window.{global_name}=")
        json.dump(expl, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    return expl


expl = build_explain("data/explanations.json", "explain.js", "SAA_EXPLAIN")
expl_en = build_explain("data/explanations.en.json", "explain.en.js", "SAA_EXPLAIN_EN")


def build_theory(idx_path, chapters_dir, out_name, global_name):
    chapters = []
    if os.path.exists(idx_path):
        for c in json.load(open(idx_path, encoding="utf-8"))["chapters"]:
            chapters.append(json.load(open(f"{chapters_dir}/{c['id']}.json", encoding="utf-8")))
    with open(os.path.join(OUT, out_name), "w", encoding="utf-8") as f:
        f.write(f"window.{global_name}=")
        json.dump({"chapters": chapters}, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    return chapters


chapters = build_theory("data/theory/index.json", "data/theory", "theory.js", "SAA_THEORY")
chapters_en = build_theory("data/theory/en/index.json", "data/theory/en", "theory.en.js", "SAA_THEORY_EN")

kb = lambda p: os.path.getsize(p) // 1024
print(f"web/data/bank.js      {kb(os.path.join(OUT, 'bank.js'))} КБ, вопросов {len(bank)}")
print(f"web/data/theory.js    {kb(os.path.join(OUT, 'theory.js'))} КБ, глав {len(chapters)}")
print(f"web/data/theory.en.js {kb(os.path.join(OUT, 'theory.en.js'))} КБ, глав {len(chapters_en)}")
print(f"web/data/explain.js   {kb(os.path.join(OUT, 'explain.js'))} КБ, разборов {len(expl)} из {len(bank)}")
print(f"web/data/explain.en.js {kb(os.path.join(OUT, 'explain.en.js'))} КБ, разборов {len(expl_en)} из {len(bank)}")
