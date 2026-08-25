#!/usr/bin/env python3
"""SAA-C03 dump parser: raw pdftotext -> data/questions.json"""
import json
import re
import sys

RAW = "data/raw.txt"
OUT = "data/build/questions.parsed.json"

txt = open(RAW, encoding="utf-8").read()
txt = txt.replace("\f", "\n")
lines = txt.split("\n")

Q_RE = re.compile(r"^\s*Question:\s*(\d+)\s*$")
A_RE = re.compile(r"^\s*Answer:\s*([A-F](?:\s*,?\s*[A-F])*)\s*$")
OPT_RE = re.compile(r"^\s{1,}([A-F])[\.\)]\s*(.*)$")

# split into blocks by question header
blocks = []
cur = None
for ln in lines:
    m = Q_RE.match(ln)
    if m:
        if cur:
            blocks.append(cur)
        cur = {"id": int(m.group(1)), "lines": []}
    elif cur is not None:
        cur["lines"].append(ln)
if cur:
    blocks.append(cur)

questions = []
problems = []
for b in blocks:
    stem, opts, answer = [], [], None
    cur_opt = None
    for ln in b["lines"]:
        ma = A_RE.match(ln)
        if ma:
            answer = re.sub(r"[^A-F]", "", ma.group(1))
            break
        mo = OPT_RE.match(ln)
        if mo:
            cur_opt = {"letter": mo.group(1), "text": mo.group(2).strip()}
            opts.append(cur_opt)
        elif cur_opt is not None:
            if ln.strip():
                cur_opt["text"] += " " + ln.strip()
        else:
            if ln.strip():
                stem.append(ln.strip())

    q = {
        "id": b["id"],
        "question": "\n".join(stem).strip(),
        "options": [{"l": o["letter"], "t": re.sub(r"\s+", " ", o["text"]).strip()} for o in opts],
        "answer": answer,
    }
    if not answer or len(opts) < 2 or not q["question"]:
        problems.append(b["id"])
    questions.append(q)

questions.sort(key=lambda x: x["id"])
json.dump(questions, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

ids = [q["id"] for q in questions]
print(f"parsed: {len(questions)}")
print(f"id range: {min(ids)}..{max(ids)}  unique: {len(set(ids))}")
print(f"missing ids: {[i for i in range(1, max(ids)+1) if i not in set(ids)][:20]}")
print(f"problem blocks: {len(problems)} -> {problems[:20]}")
from collections import Counter
print("options count:", Counter(len(q["options"]) for q in questions))
print("answer len:", Counter(len(q["answer"] or "") for q in questions))
