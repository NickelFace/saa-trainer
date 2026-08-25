# SAA-C03 Trainer

Offline practice app and study notes for the AWS Certified Solutions Architect –
Associate (SAA-C03) exam. 1019 audited questions, a 22-chapter handbook plus an
appendix on domain classification, written answer walkthroughs, exam simulation by
blueprint weights. Pure HTML/CSS/JS — no build step, no CDN, no backend.
Opens straight from the file system or from GitHub Pages.

> The question bank is derived from a third-party exam dump and is published for
> personal study only. `robots.txt` asks crawlers to stay out; the content is not
> mine to license.

Live site: **https://saa.maks.top** (built and deployed by
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`).

## Quick start

```bash
python3 -m http.server 8101   # then open http://localhost:8101/web/
```

Or just open `web/index.html` in a browser — everything works over `file://`,
including progress saved in localStorage.

## Features

- **Practice** — filter by domain, service, status (unseen / wrong / solved / flagged /
  corrected key / disputed), free-text search and jump-to-question-number, instant
  feedback and explanation, keyboard shortcuts.
- **Exam** — 65 questions sampled by blueprint weights (SEC 20, RES 17, PERF 15,
  COST 13), 130-minute timer, resumable, per-domain score, full review afterwards, and
  any past attempt can be reopened from the history and reviewed again.
- **Handbook** — 22 chapters in Russian plus an appendix on how question domains are
  decided, searchable, linked to the bank by service tags: one click jumps from a
  chapter to its questions. Every chapter ends with a generated table of the domains
  its questions fall into, including how many were classified by hand and why.
- **Answer walkthroughs** — every question in the bank has one: the review explains why
  the key is the key and, under every wrong option, why that option fails. Disputed
  questions get both readings instead of a verdict. Walkthroughs cross-link sibling
  questions, so a storage-class answer points at the near-identical question where the
  answer differs. All 1019 of 1019 questions; the layer lives in
  `data/explanations.json`.
- **Audit transparency** — the 28 corrected answer keys show the original dump answer
  and the reason; the 23 disputed questions show the alternative and the argument.
- **Progress** — stored in localStorage: per-domain accuracy, a weak-topics table that
  ranks services by your accuracy and opens practice on the one you click, exam history,
  export/import as JSON.
- **Offline** — opens straight from the file system, and the published site installs as a
  PWA: a service worker precaches the app, the bank and the handbook, so practice works
  with no network. The cache name carries the deploy id, so a new deploy never serves
  a stale build.

## Repository layout

```
data/
  raw.txt                 pdftotext -layout output of the source PDF
  build/                  intermediate pipeline artefacts (git-ignored)
  questions.json          curated bank, 1019 questions
  overlay.json            audit overlay: corrected keys, disputed notes, exhibits
  dom-overrides.json      manual domain assignment with a reason, for the 347 questions
                          the classifier rules could not place confidently
  explanations.json       written walkthroughs: why the key is right, why each wrong
                          option is wrong
  meta.json               domains, blueprint weights, audit index
  audit.json              per-question audit status
  audit-log.md            audit reasoning in full
  theory/                 chapters compiled to JSON for the app
docs/                     the same chapters as Markdown (readable on GitHub),
                          including appendix-domains.md on the classification method
images/exhibits/          13 exhibit images for 7 questions
web/                      the application (index.html, css/, js/, generated data/,
                          sw.js and manifest for offline use)
scripts/                  the data pipeline and the site build
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

## Deployment

The Pages workflow rebuilds the bank and the handbook from source, runs `validate.py`,
then calls `scripts/build-site.sh`, which assembles the `site/` directory: `web/` at the
root, `images/exhibits/` beside it, a `config.js` that points the app at the site-root
asset path, the commit id stamped into the service worker's cache name, `CNAME`,
`.nojekyll`, and a `robots.txt` that asks crawlers to stay out. Nothing published is
hand-copied — a failed check fails the deploy. The same script builds the site locally:

```bash
bash scripts/build-site.sh site local-check
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

Audit: 28 corrected keys, 23 disputed, no low-confidence questions left, 3 source-PDF
defects, 2 questions flagged as inaccurate or outdated, 7 questions with exhibits.
Written walkthroughs: all 1019 questions — every key argued, every wrong option
rebutted, every correction and dispute backed by its own reasoning.

Russian version of this document: [README.ru.md](README.ru.md).
