#!/usr/bin/env python3
"""docs/*.md -> data/theory/*.json + data/theory/index.json (Russian, canonical).
   docs/en/*.md -> data/theory/en/*.json + data/theory/en/index.json (English, if present).

Markdown конвертируется в HTML здесь, чтобы веб-приложение оставалось без
зависимостей и работало офлайн с file://. Поддерживается подмножество разметки:
заголовки, абзацы, списки, таблицы, блоки кода, цитаты, inline-форматирование.

Английская версия — параллельный перевод docs/en/*.md (тот же id/order/svc,
переведённый title и текст). Если docs/en/ отсутствует или неполон, английская
сборка просто пропускает отсутствующие главы — приложение падает на RU по
каждой главе отдельно (см. web/js/theory.js).
"""
import html
import json
import os
import re
import sys

BANK = "data/questions.json"

INLINE_CODE = re.compile(r"`([^`]+)`")
BOLD = re.compile(r"\*\*([^*]+)\*\*")
ITALIC = re.compile(r"(?<![\*\w])\*([^*\n]+)\*(?!\*)")
LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
QREF = re.compile(r"\{\{q:([\d,\s-]+)\}\}")

TEXT = {
    "ru": {
        "qref_label": "вопросы {ids}",
        "heading": "Домены вопросов этой главы",
        "intro": ("Блок собирается автоматически при сборке учебника из размеченного банка. "
                   "Столбец «вручную» показывает, сколько вопросов главы получили домен не по правилам "
                   "<code>classify.py</code>, а после разбора формулировки."),
        "th_code": "Код", "th_domain": "Домен", "th_count": "Вопросов", "th_share": "Доля главы", "th_manual": "Вручную",
        "total_line": "Всего вопросов главы: <b>{total}</b>. Написан подробный разбор: <b>{covered}</b>.",
        "reasons_intro": "<p>Примеры ручных решений по вопросам этой главы:</p>",
        "not_built": "нет каталога {docs}",
    },
    "en": {
        "qref_label": "questions {ids}",
        "heading": "Domain breakdown for this chapter's questions",
        "intro": ("This block is generated automatically when the handbook is built, from the classified "
                   "bank. The “manual” column shows how many of the chapter's questions got their "
                   "domain not from the <code>classify.py</code> rules but from a by-hand reading of the "
                   "wording."),
        "th_code": "Code", "th_domain": "Domain", "th_count": "Questions", "th_share": "Share of chapter", "th_manual": "Manual",
        "total_line": "Total questions in this chapter: <b>{total}</b>. With a written walkthrough: <b>{covered}</b>.",
        "reasons_intro": "<p>Examples of manual domain calls for this chapter's questions:</p>",
        "not_built": "no {docs} directory",
    },
}


def inline(text, lang):
    out = html.escape(text, quote=False)
    holes = []

    def stash(fragment):
        holes.append(fragment)
        return f"\x00{len(holes) - 1}\x00"

    out = INLINE_CODE.sub(lambda m: stash(f"<code>{m.group(1)}</code>"), out)
    out = LINK.sub(lambda m: stash(f'<a href="{m.group(2)}" target="_blank" rel="noopener">{m.group(1)}</a>'), out)
    out = QREF.sub(lambda m: stash(
        f'<a class="qref" data-q="{m.group(1).strip()}" href="#">' +
        TEXT[lang]["qref_label"].format(ids=m.group(1).strip()) + "</a>"), out)
    out = BOLD.sub(r"<strong>\1</strong>", out)
    out = ITALIC.sub(r"<em>\1</em>", out)
    for i, frag in enumerate(holes):
        out = out.replace(f"\x00{i}\x00", frag)
    return out


def md_to_html(lines, lang):
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
            code_lang = stripped[3:].strip()
            body, i = [], i + 1
            while i < n and not lines[i].strip().startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            cls = f' class="lang-{code_lang}"' if code_lang else ""
            out.append(f"<pre><code{cls}>" + html.escape("\n".join(body)) + "</code></pre>")
            continue

        # заголовок
        m = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if m:
            lvl = len(m.group(1))
            out.append(f"<h{lvl}>{inline(m.group(2), lang)}</h{lvl}>")
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
            th = "".join(f"<th>{inline(c, lang)}</th>" for c in head)
            tb = "".join("<tr>" + "".join(f"<td>{inline(c, lang)}</td>" for c in r) + "</tr>" for r in rows)
            out.append(f"<div class='table-wrap'><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>")
            continue

        # цитата / callout
        if stripped.startswith(">"):
            body = []
            while i < n and lines[i].strip().startswith(">"):
                body.append(lines[i].strip().lstrip(">").strip())
                i += 1
            out.append(f"<blockquote>{inline(' '.join(body), lang)}</blockquote>")
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
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x, lang)}</li>" for x in items) + f"</{tag}>")
            continue

        # абзац
        body = []
        while i < n and lines[i].strip() and not re.match(r"^(#{1,4}\s|```|\||>|[-*]\s|\d+\.\s)", lines[i].strip()):
            body.append(lines[i].strip())
            i += 1
        out.append(f"<p>{inline(' '.join(body), lang)}</p>")
    return "\n".join(out)


def domain_block(qs, dom_names, expl, lang):
    """Генерируемая справка в конце главы: как распределены её вопросы по доменам.

    Разметка домена — не свойство дампа, а результат анализа, поэтому глава показывает
    и распределение, и долю вопросов, размеченных вручную, и покрытие разборами.
    """
    if not qs:
        return ""
    t = TEXT[lang]
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
    why_field = "dom_why_en" if lang == "en" else "dom_why"
    why = [q for q in qs if q.get(why_field) or q.get("dom_why")]
    reasons = ""
    if why:
        sample = "".join(
            f"<li><b>#{q['id']}</b> — {q['dom']}: {q.get(why_field) or q.get('dom_why')}</li>" for q in why[:8])
        reasons = t["reasons_intro"] + f"<ul>{sample}</ul>"
    return (
        f"<h2>{t['heading']}</h2>"
        f"<p>{t['intro']}</p>"
        f"<div class='table-wrap'><table><thead><tr><th>{t['th_code']}</th><th>{t['th_domain']}</th>"
        f"<th>{t['th_count']}</th><th>{t['th_share']}</th><th>{t['th_manual']}</th></tr></thead>"
        f"<tbody>{''.join(rows)}</tbody></table></div>"
        f"<p>{t['total_line'].format(total=total, covered=covered)}</p>" + reasons)


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


def build(docs_dir, out_dir, lang, bank, expl, dom_names):
    if not os.path.isdir(docs_dir):
        print(f"{TEXT[lang]['not_built'].format(docs=docs_dir)} — пропуск ({lang})")
        return []
    os.makedirs(out_dir, exist_ok=True)

    chapters = []
    for fn in sorted(os.listdir(docs_dir)):
        if not fn.endswith(".md") or fn.lower() in ("readme.md", "index.md"):
            continue
        text = open(os.path.join(docs_dir, fn), encoding="utf-8").read()
        meta, body = frontmatter(text)
        cid = meta.get("id") or os.path.splitext(fn)[0]
        svc = meta.get("svc") or []
        if isinstance(svc, str):
            svc = [s.strip() for s in svc.split(",") if s.strip()]
        qids = sorted(q["id"] for q in bank if set(q.get("svc", [])) & set(svc))
        chapter_qs = [q for q in bank if q["id"] in set(qids)]
        stats = domain_block(chapter_qs, dom_names, expl, lang)
        chapter = {
            "id": cid,
            "title": meta.get("title", cid),
            "order": int(meta.get("order", 999)),
            "svc": svc,
            "questions": qids,
            "html": md_to_html(body, lang) + stats,
            "text": re.sub(r"\s+", " ", re.sub(r"[#*`>|-]", " ", "\n".join(body)))[:20000],
        }
        json.dump(chapter, open(os.path.join(out_dir, f"{cid}.json"), "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
        chapters.append({k: chapter[k] for k in ("id", "title", "order", "svc")} |
                        {"questions": len(qids), "lines": len(body)})

    chapters.sort(key=lambda c: c["order"])
    json.dump({"chapters": chapters}, open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    return chapters


def main():
    bank = json.load(open(BANK, encoding="utf-8"))
    expl_ru = {}
    if os.path.exists("data/explanations.json"):
        expl_ru = json.load(open("data/explanations.json", encoding="utf-8"))
    dom_names = {d["code"]: d["name"] for d in json.load(open("data/meta.json", encoding="utf-8"))["domains"]}

    chapters = build("docs", "data/theory", "ru", bank, expl_ru, dom_names)
    if not chapters:
        sys.exit(f"нет каталога docs")
    main_ch = [c for c in chapters if c["order"] <= 22]
    print(f"RU: глав собрано: {len(chapters)} (основных {len(main_ch)}, приложений {len(chapters) - len(main_ch)})")
    for c in chapters:
        flag = "  ПУСТАЯ" if c["lines"] < 20 else ""
        print(f"  {c['order']:2}. {c['id']:22} {c['lines']:4} строк, вопросов {c['questions']:4}{flag}")

    expl_en = {}
    if os.path.exists("data/explanations.en.json"):
        expl_en = json.load(open("data/explanations.en.json", encoding="utf-8"))
    chapters_en = build("docs/en", "data/theory/en", "en", bank, expl_en or expl_ru, dom_names)
    if chapters_en:
        main_en = [c for c in chapters_en if c["order"] <= 22]
        print(f"EN: глав собрано: {len(chapters_en)} (основных {len(main_en)}, приложений {len(chapters_en) - len(main_en)})")


if __name__ == "__main__":
    main()
