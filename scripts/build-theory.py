#!/usr/bin/env python3
"""docs/*.md -> data/theory/*.json + data/theory/index.json.

Markdown конвертируется в HTML здесь, чтобы веб-приложение оставалось без
зависимостей и работало офлайн с file://. Поддерживается подмножество разметки:
заголовки, абзацы, списки, таблицы, блоки кода, цитаты, inline-форматирование.
"""
import html
import json
import os
import re
import sys

DOCS = "docs"
OUT = "data/theory"
BANK = "data/questions.json"

INLINE_CODE = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
ITALIC = re.compile(r"(?<![\*\w])\*([^*\n]+)\*(?!\*)")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
QREF = re.compile(r"\{\{q:([\d,\s-]+)\}\}")


def inline(text):
    out = html.escape(text, quote=False)
    holes = []

    def stash(fragment):
        holes.append(fragment)
        return f"\x00{len(holes) - 1}\x00"

    out = INLINE_CODE.sub(lambda m: stash(f"<code>{m.group(1)}</code>"), out)
    out = LINK.sub(lambda m: stash(f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>'), out)
    out = QREF.sub(lambda m: stash(f'<a class="qref" data-q="{m.group(1).strip()}" href="#">вопросы {m.group(1).strip()}</a>'), out)
    out = BOLD.sub(r"<strong>\1</strong>", out)
    out = ITALIC.sub(r"<em>\1</em>", out)
    for i, frag in enumerate(holes):
        out = out.replace(f"\x00{i}\x00", frag)
    return out


def md_to_html(lines):
    """Строчный конвертер: на входе список строк главы без frontmatter."""
    out, i, n = [], 0, len(lines)
    while i < n:
        ln = lines[i]
        stripped = ln.strip()

        if not stripped:
            i += 1
            continue

        # блок кода
        if stripped.startswith("```"):
            lang = stripped[3:].strip()
            body, i = [], i + 1
            while i < n and not lines[i].strip().startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            cls = f' class="lang-{lang}"' if lang else ""
            out.append(f"<pre><code{cls}>" + html.escape("\n".join(body)) + "</code></pre>")
            continue

        # заголовок
        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2))}</h{lvl}>")
            i += 1
            continue

        # таблица
        if stripped.startswith("|") and i + 1 < n and re.match(r"^\s*\|[\s:|-]+\|\s*$", lines[i + 1]):
            head = [c.strip() for c in stripped.strip("|").split("|")]
            i += 2
            rows = []
            while i < n and lines[i].strip().startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")])
                i += 1
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            tb = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
            out.append(f"<div class='table-wrap'><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>")
            continue

        # цитата / callout
        if stripped.startswith(">"):
            body = []
            while i < n and lines[i].strip().startswith(">"):
                body.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(f"<blockquote>{inline(' '.join(body))}</blockquote>")
            continue

        # списки
        if re.match(r"^([-*]|\d+\.)\s+", stripped):
            ordered = bool(re.match(r"^\d+\.\s+", stripped))
            items, cur = [], None
            while i < n:
                s = lines[i].strip()
                if not s:
                    if i + 1 < n and re.match(r"^\s{2,}\S", lines[i + 1] or ""):
                        i += 1
                        continue
                    break
                m2 = re.match(r"^([-*]|\d+\.)\s+(.*)$", s)
                if m2 and not lines[i].startswith("  "):
                    if cur is not None:
                        items.append(cur)
                    cur = m2.group(2)
                elif cur is not None and lines[i].startswith("  "):
                    cur += " " + s
                else:
                    break
                i += 1
            if cur is not None:
                items.append(cur)
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>")
            continue

        # абзац
        body = []
        while i < n and lines[i].strip() and not re.match(r"^(#{1,4}\s|```|\||>|[-*]\s|\d+\.\s)", lines[i].strip()):
            body.append(lines[i].strip())
            i += 1
        out.append(f"<p>{inline(' '.join(body))}</p>")
    return "\n".join(out)


def domain_block(qs, dom_names, expl):
    """Генерируемая справка в конце главы: как распределены её вопросы по доменам.

    Разметка домена — не свойство дампа, а результат анализа, поэтому глава показывает
    и распределение, и долю вопросов, размеченных вручную, и покрытие разборами.
    """
    if not qs:
        return ""
    total = len(qs)
    rows = []
    for code, name in dom_names.items():
        sub = [q for q in qs if q["dom"] == code]
        if not sub:
            continue
        manual = sum(1 for q in sub if q.get("dom_conf") == "manual")
        rows.append(
            f"<tr><td>{code}</td><td>{name}</td><td>{len(sub)}</td>"
            f"<td>{round(100 * len(sub) / total)}%</td><td>{manual}</td></tr>")
    covered = sum(1 for q in qs if str(q["id"]) in expl)
    why = [q for q in qs if q.get("dom_why")]
    reasons = ""
    if why:
        sample = "".join(
            f"<li><b>#{q['id']}</b> — {q['dom']}: {q['dom_why']}</li>" for q in why[:8])
        reasons = ("<p>Примеры ручных решений по вопросам этой главы:</p>"
                   f"<ul>{sample}</ul>")
    return (
        "<h2>Домены вопросов этой главы</h2>"
        "<p>Блок собирается автоматически при сборке учебника из размеченного банка. "
        "Столбец «вручную» показывает, сколько вопросов главы получили домен не по правилам "
        f"<code>classify.py</code>, а после разбора формулировки.</p>"
        "<div class='table-wrap'><table><thead><tr><th>Код</th><th>Домен</th>"
        "<th>Вопросов</th><th>Доля главы</th><th>Вручную</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></div>"
        f"<p>Всего вопросов главы: <b>{total}</b>. Написан подробный разбор: "
        f"<b>{covered}</b>.</p>" + reasons)


def frontmatter(text):
    if not text.startswith("---"):
        return {}, text.split("\n")
    end = text.index("\n---", 3)
    meta = {}
    for line in text[3:end].strip().split("\n"):
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip().strip('"') for x in v[1:-1].split(",") if x.strip()]
        meta[k.strip()] = v
    return meta, text[end + 4:].split("\n")


def main():
    if not os.path.isdir(DOCS):
        sys.exit(f"нет каталога {DOCS}")
    os.makedirs(OUT, exist_ok=True)
    bank = json.load(open(BANK, encoding="utf-8"))
    expl = {}
    if os.path.exists("data/explanations.json"):
        expl = json.load(open("data/explanations.json", encoding="utf-8"))
    dom_names = {d["code"]: d["name"] for d in json.load(open("data/meta.json", encoding="utf-8"))["domains"]}

    chapters = []
    for fn in sorted(os.listdir(DOCS)):
        if not fn.endswith(".md") or fn.lower() in ("readme.md", "index.md"):
            continue
        text = open(os.path.join(DOCS, fn), encoding="utf-8").read()
        meta, body = frontmatter(text)
        cid = meta.get("id") or os.path.splitext(fn)[0]
        svc = meta.get("svc") or []
        if isinstance(svc, str):
            svc = [s.strip() for s in svc.split(",") if s.strip()]
        qids = sorted(q["id"] for q in bank if set(q.get("svc", [])) & set(svc))
        chapter_qs = [q for q in bank if q["id"] in set(qids)]
        stats = domain_block(chapter_qs, dom_names, expl)
        chapter = {
            "id": cid,
            "title": meta.get("title", cid),
            "order": int(meta.get("order", 999)),
            "svc": svc,
            "questions": qids,
            "html": md_to_html(body) + stats,
            "text": re.sub(r"\s+", " ", re.sub(r"[#*`>|-]", " ", "\n".join(body)))[:20000],
        }
        json.dump(chapter, open(os.path.join(OUT, f"{cid}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        chapters.append({k: chapter[k] for k in ("id", "title", "order", "svc")} |
                        {"questions": len(qids), "lines": len(body)})

    chapters.sort(key=lambda c: c["order"])
    json.dump({"chapters": chapters}, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    main = [c for c in chapters if c["order"] <= 22]
    print(f"глав собрано: {len(chapters)} (основных {len(main)}, приложений {len(chapters) - len(main)})")
    for c in chapters:
        flag = "  ПУСТАЯ" if c["lines"] < 20 else ""
        print(f"  {c['order']:2}. {c['id']:22} {c['lines']:4} строк, вопросов {c['questions']:4}{flag}")


if __name__ == "__main__":
    main()
