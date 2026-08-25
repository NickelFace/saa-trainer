# SAA-C03 Trainer

Offline practice app and study notes for the AWS Certified Solutions Architect –
Associate (SAA-C03) exam. 1019 audited questions, a 22-chapter handbook, exam
simulation by blueprint weights. Pure HTML/CSS/JS — no build step, no CDN, no backend.
Opens straight from the file system or from GitHub Pages.

> The question bank is derived from a third-party exam dump and is for personal study
> only. Keep this repository private.

## Quick start

```bash
python3 -m http.server 8101   # then open http://localhost:8101/web/
```

Or just open `web/index.html` in a browser — everything works over `file://`,
including progress saved in localStorage.

## Features

- **Practice** — filter by domain, service, status (unseen / wrong / flagged /
  corrected key / disputed), instant feedback and explanation, keyboard shortcuts.
- **Exam** — 65 questions sampled by blueprint weights (SEC 20, RES 17, PERF 15,
  COST 13), 130-minute timer, resumable, per-domain score, full review afterwards.
- **Handbook** — 22 chapters in Russian, searchable, linked to the bank by service
  tags: one click jumps from a chapter to its questions.
- **Audit transparency** — the 18 corrected answer keys show the original dump answer
  and the reason; the 15 disputed questions show the alternative and the argument.
- **Progress** — stored in localStorage, per-domain accuracy, exam history,
  export/import as JSON.

## Repository layout

```
data/
  raw.txt                 pdftotext -layout output of the source PDF
  build/                  intermediate pipeline artefacts (git-ignored)
  questions.json          curated bank, 1019 questions
  overlay.json            audit overlay: corrected keys, disputed notes, exhibits
  dom-overrides.json      manual domain assignment with a reason, for the 347 questions
                          the classifier rules could not place confidently
  meta.json               domains, blueprint weights, audit index
  audit.json              per-question audit status
  audit-log.md            audit reasoning in full
  theory/                 chapters compiled to JSON for the app
docs/                     the same chapters as Markdown (readable on GitHub)
images/exhibits/          13 exhibit images for 7 questions
web/                      the application (index.html, css/, js/, generated data/)
scripts/                  the data pipeline
```

## Data pipeline

```bash
python3 scripts/parse.py           # raw.txt        -> data/build/questions.parsed.json
python3 scripts/classify.py        # + domain, services, multi flag
python3 scripts/apply-audit.py     # + overlay.json -> data/questions.json
python3 scripts/build-theory.py    # docs/*.md      -> data/theory/*.json
python3 scripts/build-web-data.py  # JSON           -> web/data/*.js
python3 scripts/validate.py        # acceptance checks, non-zero exit on failure
```

The pipeline is reproducible: running it on a clean clone rebuilds `data/questions.json`
byte-for-byte. Audit findings live in `overlay.json`, never in the parser, so a new dump
can be re-parsed without losing them.

To regenerate `data/raw.txt` from the source PDF:

```bash
pdftotext -layout SAA-C03-1019QA.pdf data/raw.txt
```

## Question schema

```json
{
  "id": 96,
  "question": "text with newlines preserved",
  "options": [{"l": "A", "t": "option text", "img": "q477-A.png"}],
  "answer": "C",
  "answer_original": "B",
  "fix_note": "why the dump key was wrong",
  "disputed_alt": "D",
  "disputed_note": "the argument for the alternative",
  "defect": "option A missing in source PDF",
  "note": "relabelled option",
  "exhibits": ["q96.png"],
  "dom": "SEC", "dom_conf": "manual", "dom_why": "why this domain was chosen",
  "svc": ["EC2", "IAM"],
  "multi": false
}
```

`dom`: SEC / RES / PERF / COST. `dom_conf`: `strong` (672 — unambiguous markers in the
stem) or `manual` (347 — reviewed by hand, with the reason in `dom_why`). Every question
the rules could not place confidently was read and classified individually; nothing is
left on a default or a weak-marker guess.

## Bank statistics

| Domain | Questions | Blueprint weight | Questions in a mock exam |
|---|--:|--:|--:|
| SEC — Design Secure Architectures | 324 | 30% | 20 |
| RES — Design Resilient Architectures | 209 | 26% | 17 |
| PERF — Design High-Performing Architectures | 259 | 24% | 15 |
| COST — Design Cost-Optimized Architectures | 227 | 20% | 13 |

Bank shares deliberately differ from blueprint weights; the exam mode samples by the
blueprint, not by the bank.

Domain counts in `meta.json` are recomputed by the pipeline, never edited by hand.

Audit: 18 corrected keys, 15 disputed, 6 low-confidence, 3 source-PDF defects,
7 questions with exhibits.

Russian version of this document: [README.ru.md](README.ru.md).
