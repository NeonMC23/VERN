# MTrack2-A — Lesson Widget Inventory & Design

**Status: design proposal. Nothing here is implemented or frozen.**
This document defines the *pedagogical vocabulary* of VΞRN TRACKS so the lesson
schema can be frozen in MTrack2-B with confidence.

Baseline (MTrack1, shipped and verified): the renderer dispatches on
`block.type` only, and **unknown types are skipped rather than throwing**
(`var fn = BLOCKS[block.type]; return fn ? fn(block) : null;`). That single
property is what allows widgets to be added incrementally without breaking
lessons authored against an older renderer. Every proposal below preserves it.

Currently implemented: `heading`, `text`, `code`, `list` (4 leaf renderers,
~60 lines total — the calibration point for the complexity estimates).

---

## 1. Summary table

| Widget | Category | Necessary | Interactive | Nesting | Complexity |
|---|---|---|---|---|---|
| `heading` | content | yes — **shipped** | no | no | low |
| `text` | content | yes — **shipped** | no | no | low |
| `list` | content | yes — **shipped** | no | no | low |
| `code` | content | yes — **shipped** | no | no | low |
| `callout` | content | yes | no | **container** | low |
| `definition` | content | yes | no | no | low |
| `table` | content | yes | no | no | medium |
| `image` | media | yes | no | no | low |
| `accordion` | structure | yes | native | **container** | low‑medium |
| `steps` | structure | yes | no | **container** | medium |
| `choice` | exercise | yes | yes | stem only | medium |
| `text_input` | exercise | yes | yes | stem only | medium |
| `fill_blank` | exercise | yes | yes | no | medium‑high |
| `tabs` | structure | **defer** | yes | container | high |
| `matching` | exercise | **defer** | yes | no | high |
| `ordering` | exercise | **defer** | yes | no | high |
| `quote` | content | **defer** | no | no | low |
| `code_example` | content | **reject** | — | — | — |
| `true_false` | exercise | **reject** | — | — | — |
| `select` | exercise | **reject** | — | — | — |
| `number_input` | exercise | **reject** | — | — | — |
| `multi_select` | exercise | **reject** (folded) | — | — | — |
| `multiple_choice` | exercise | **reject** (renamed) | — | — | — |
| `key_points` | content | **reject** (folded) | — | — | — |
| `link` | content | **reject** (folded) | — | — | — |
| `divider` | content | **reject** | — | — | — |
| `video` / `audio` | media | **reject** | — | — | — |

**Core set: 13 widgets** (8 content/media, 2 structure, 3 exercise) — down from
the ~30 in the hypothesis. Four deferred, eleven rejected or folded.

---

## 2. Rejected — and why

Each rejection removes renderer surface without removing teaching capability.

| Rejected | Reason | Do this instead |
|---|---|---|
| `code_example` | Pure duplicate. `code` already displays static code; a second type with identical data would be two code paths for one job. | `code` |
| `true_false` | `choice` with two options. Sugar, not capability. | `choice` with `["True","False"]` |
| `select` | Same data as `choice`, worse pedagogy — a dropdown *hides* the distractors, and reading the wrong answers is part of the learning. | `choice` |
| `number_input` | Not a widget, a **validation mode**. | `text_input` with `match: "numeric"` |
| `multi_select` | Same data, same feedback, same validation as `multiple_choice`; only the cardinality differs. | `choice` with `multiple: true` |
| `multiple_choice` | Renamed → **`choice`**, absorbing the four types above. Four widgets collapse into one. | `choice` |
| `key_points` | A styled summary list. Distinct type = distinct renderer for zero new capability. | `callout` with `variant: "key-points"` |
| `link` | A block-level link is pedagogically weak; links belong *inline in a sentence* or in a closing resource list. A standalone type encourages neither. | `list` of links, once inline markup is decided (§9, Q1) |
| `divider` | Purely presentational, zero semantics. Sections are created by `heading`; a divider is a symptom of a missing heading. | `heading` |
| `video`, `audio` | **Deliberate rejection on privacy grounds.** External video means a YouTube/Vimeo iframe, i.e. third-party tracking on a site that advertises *no telemetry* — a direct contradiction of the project's stated position. Self-hosting means a media pipeline VΞRN has no infrastructure for, and the brief forbids a general iframe widget. | Text + `code` + `image`; link out to a video as a plain external link |

**Deferred** (valuable, but not required to prove the pedagogical model, and each
carries real a11y cost):

- **`tabs`** — genuinely useful for parallel alternatives (Windows / macOS / Linux).
  But a correct tablist needs roving `tabindex`, arrow-key handling, `aria-selected`,
  and panel wiring. `accordion` covers ~80% of the need at ~10% of the cost. Revisit
  once a real lesson demonstrably needs it.
- **`matching`** and **`ordering`** — pedagogically strong, but both need an accessible
  non-drag interaction (paired `<select>`s; up/down `<button>`s). Drag-and-drop is
  forbidden by the brief and is the only *obvious* implementation, so both need
  careful design. Defer to MTrack2-C.
- **`quote`** — real but rare in technical teaching; `callout` covers emphasis.
  Add when a lesson actually needs attributed external text.

---

## 3. Content widgets

### `heading` *(shipped)*
- **Purpose** — structure a lesson into scannable sections.
- **Data** — `{ type, text }`. Required: `text`.
- **Rendering** — `<h2 class="block__title">`. The lesson `<h1>` is the lesson
  title, owned by the view; blocks must never emit `<h1>`.
- **Accessibility** — one `<h1>` per view already enforced; headings must not skip
  levels. If sub-sections are ever needed, add an optional `level: 2|3` clamped
  to 2–3 rather than a free integer.
- **Nesting** — none.

### `text` *(shipped)*
- **Purpose** — the default. Most of a lesson should be this.
- **Data** — `{ type, text }`. Blank lines split paragraphs (already implemented).
- **Rendering** — `<div class="prose"><p>…</p></div>`, `textContent` per paragraph.
- **Open question** — inline emphasis / inline `code` / inline links. See §9 Q1.
  This is the single biggest unresolved question in the whole design.

### `list` *(shipped)*
- **Purpose** — enumerate short parallel items.
- **Data** — `{ type, items: [string], ordered?: boolean }`.
- **Rendering** — `<ul class="bullets">` / `<ol>`. Items are strings only; a list
  of rich blocks is `steps`.
- **Nesting** — none (deliberate: nested bullet trees signal a missing heading).

### `code` *(shipped)*
- **Purpose** — show code or terminal output. **Never executed.**
- **Data** — `{ type, code, language?, caption? }`.
- **Rendering** — `<pre class="codeblock" tabindex="0" role="group" aria-label="…">
  <code data-language>`. Already keyboard-scrollable.
- **Accessibility** — a scrollable region must be focusable (implemented).
  `language` is metadata only; **no syntax highlighter** — that is a dependency,
  and colour alone must never carry meaning.

### `callout` — *new, container*
- **Purpose** — set information apart from the main flow: a warning, a
  common mistake, a recap. The pedagogical justification over a plain paragraph
  is *visual triage* — a learner scanning a lesson should be able to spot
  "this is the thing that will bite you" without reading every word.
- **Data** — `{ type, variant, title?, content: [leaf blocks] }`
- **`variant`** — closed set: `note` | `tip` | `warning` | `key-points`.
  Unknown variants fall back to `note` (never fail).
- **Rendering** — `<aside class="callout callout--{variant}">`, optional
  `<p class="callout__title">`, then rendered child blocks.
- **Accessibility** — variant must be conveyed by a **text label**, not colour
  alone (e.g. a "Warning" title). Not `role="alert"` — it is not a live region.
- **Nesting** — leaf blocks only (`text`, `list`, `code`, `definition`, `image`).
  No callout-in-callout, no exercises inside.

### `definition` — *new*
- **Purpose** — introduce vocabulary. Teaching a technical subject is largely
  teaching its words; a dedicated type makes terms consistently styled and, later,
  mechanically extractable into a glossary.
- **Data** — `{ type, items: [{ term, definition }] }`
- **Rendering** — `<dl>` / `<dt>` / `<dd>`. Native semantics, no ARIA needed.
- **Nesting** — none; `definition` values are plain strings.

### `table` — *new*
- **Purpose** — genuine two-dimensional comparison (protocol vs protocol,
  option vs option). Not layout.
- **Data** — `{ type, caption?, columns: [string], rows: [[string]] }`
- **Validation at render** — rows whose length ≠ `columns.length` are **skipped**,
  not padded, so malformed data cannot silently misalign a comparison.
- **Rendering** — `<table>` + `<caption>` + `<thead>` with
  `<th scope="col">` + `<tbody>`; wrapped in a horizontally scrollable
  container that is focusable.
- **Accessibility** — `scope` on every header; `<caption>` strongly recommended.
  Cells are `textContent` strings only — no nested blocks, no colspan/rowspan.
- **Responsive** — horizontal scroll on narrow screens. No card-collapse
  transformation: it reorders content unpredictably for screen readers.

### `image` — *new, intentionally minimal*
- **Purpose** — a diagram when a diagram genuinely helps. **Images are optional
  support, never the backbone of a lesson.**
- **Data** — `{ type, src, alt, caption?, credit? }`
- **Required** — `src` **and** `alt`. A block missing `alt` is **not rendered**.
  Making `alt` structurally mandatory is cheaper than auditing it later; for a
  purely decorative image, the correct action is to delete the block.
- **Rendering** — `<figure><img loading="lazy" decoding="async"><figcaption>`.
- **Security** — `src` must pass an https-only allowlist (§7).
- **Fallback** — no JS error handling needed; a broken `src` degrades to the
  browser's own broken-image state plus the visible `<figcaption>` and `alt`.

---

## 4. Structure widgets

### `accordion` — *new, container*
- **Why it exists** — progressive disclosure. Lets a lesson offer optional depth
  ("Why does this work?", "Full error output") without making the main line
  intimidating. This directly serves *progression*: the beginner reads the
  short path, the curious reader expands.
- **When NOT to use** — never hide information the learner *needs*. If every
  panel must be opened to follow the lesson, it should have been plain content.
  Also never use it purely to shorten a long page.
- **Data** — `{ type, items: [{ title, content: [leaf blocks], open?: bool }] }`
- **Rendering** — native `<details>` / `<summary>`. **This is why accordion is
  cheap and tabs are not**: keyboard operation, focus, and expanded-state
  announcement are all free and correct in the browser.
- **Accessibility** — no ARIA required. Do not add `role="button"` to `<summary>`.
- **Reduced motion** — no open/close animation at all; the global
  `prefers-reduced-motion` block already neutralises transitions.
- **Nesting** — leaf blocks only. No accordion-in-accordion.

### `steps` — *new, container*
- **Why it exists** — an ordered procedure where each step needs more than a
  sentence (a command, then output, then a caution). `list` cannot express this
  because its items are plain strings.
- **When NOT to use** — for unordered points (`list`) or for narrative prose.
- **Data** — `{ type, items: [{ title?, content: [leaf blocks] }] }`
- **Rendering** — `<ol>`; step number from the list itself, not hand-written
  into titles (so inserting a step never renumbers by hand).
- **Nesting** — leaf blocks only.

---

## 5. Exercises

### 5.1 The `code_exercise` question — resolved by composition

The brief asks whether `code_exercise` should exist. It should **not**, and the
reason generalises: *"What will this output?"* is not a new widget, it is a
**`code` block followed by a question**. Every example given —
predict the output, complete the line, spot the bug, choose the instruction —
decomposes into *some context* + *one of the three answer widgets*.

So instead of a `code_exercise` type, **every exercise carries an optional
`stem`**: a short array of leaf blocks (typically one `code` block) rendered
above the question.

```
exercise
├── stem     (optional: code / text / image)
├── prompt   (the question)
└── answer widget
```

This yields code exercises for free, and also diagram exercises, table
exercises, and output-prediction exercises — with no widget per variety, and
**no code execution anywhere**. Answers are compared as text (§6).

### 5.2 `choice` — absorbs multiple_choice, multi_select, true_false, select
- **Data**
  ```
  { type: "choice",
    prompt, stem?, multiple?: false,
    options: [ { id, text, feedback? } ],
    answer: [ id, ... ],
    hint?, explanation? }
  ```
- **Rendering** — `<fieldset>` + `<legend>` (the prompt) + native
  `<input type="radio">` (or `checkbox` when `multiple`) with real `<label>`s,
  plus a **Check** `<button type="button">`.
- **Validation** — set equality between selected `id`s and `answer`. `multiple`
  is derived from `answer.length > 1` unless stated, so the two cannot disagree.
- **Per-option `feedback`** — the pedagogically valuable field: it explains why
  *that specific distractor* is wrong. This is what makes the exercise teach
  rather than merely grade.
- **Accessibility** — grouping via `fieldset`/`legend` (no `role="radiogroup"`
  needed); result announced in a polite live region; never colour alone —
  always a text verdict.

### 5.3 `text_input` — absorbs number_input
- **Data**
  ```
  { type: "text_input",
    prompt, stem?,
    input?: "text" | "number",
    accept: [ string, ... ],
    match?: "ci" | "exact" | "numeric" | "contains",
    normalize?: { trim?: true, collapse_ws?: true },
    tolerance?: number,          // numeric only
    placeholder?, hint?, explanation?, feedback? }
  ```
- **`accept` is always an array** — one uniform shape for "one right answer" and
  "several acceptable phrasings", which removes a whole class of authoring error.
- **Rendering** — `<label>` + `<input>` (+ `inputmode="numeric"` when
  `input: "number"`) + Check button. Submitting via Enter must also work.

### 5.4 `fill_blank`
- **Purpose** — the strongest widget for syntax and precise vocabulary: the
  learner produces the answer instead of recognising it, but within a scaffold.
- **Data**
  ```
  { type: "fill_blank",
    prompt?, language?,
    template: "for i in ____(3):",
    blanks: [ { id, accept: [...], match?, hint? } ],
    explanation? }
  ```
- **Template** — a literal marker (`____`) splits the text; the *n*-th marker
  binds to the *n*-th entry in `blanks`. If marker count ≠ `blanks.length`, the
  block is **skipped** rather than rendered half-wired.
- **Rendering** — the template split on the marker, with `<input>` elements
  inserted between the literal text runs, all inside `<pre>` when `language` is
  set. Every input needs an accessible name (`aria-label` such as "Blank 1 of 2").
- **Complexity** — the highest of the three; the parsing and per-blank state are
  what earn it "medium-high".

### 5.5 Not implemented now
`matching` and `ordering` — see §2.

---

## 6. Validation system

**The smallest declarative set that covers ordinary teaching.** No rule engine,
no expression language, no regex.

| Mode | Applies to | Behaviour |
|---|---|---|
| `set` | `choice` | Selected id set equals `answer` set. Implicit — not author-specified. |
| `ci` | text | Case-insensitive equality after normalisation. **Default.** |
| `exact` | text | Byte equality after normalisation. For case-sensitive code. |
| `numeric` | text | Parse both sides as numbers; equal within `tolerance` (default 0). Accepts `3`, `3.0`, `+3`. |
| `contains` | text | Normalised answer contains one of the `accept` strings. For "mention the key idea". |

Normalisation, applied before comparison, defaults to `{ trim: true,
collapse_ws: true }` — which is what makes free-text code answers usable
(`x  =  1` matches `x = 1`) without any language awareness.

**Deliberately excluded:** regex (ReDoS risk, and authors get it wrong),
boolean expression trees, cross-question dependencies, partial credit.
Partial credit in particular is a scoring concept and belongs with progression,
not here.

**Every rule is declarative data.** No JSON field ever contains executable code.

---

## 7. Feedback system

Four independent, all optional:

| Field | Shown | Purpose |
|---|---|---|
| `hint` | on demand, **before** answering | Unblocks without revealing. A "Show hint" `<button>`. |
| `feedback` (per option) | after answering, for the chosen option | *Why this specific answer is wrong.* The highest-value field. |
| `feedback.correct` / `.incorrect` | after answering | Generic verdict text when per-option feedback is absent. |
| `explanation` | after answering, either outcome | The actual teaching moment — shown even when correct, because being right for the wrong reason is common. |

Rules: never just "Incorrect." when the author supplied more; feedback is
rendered into a **polite live region** so screen-reader users hear the verdict;
the learner may retry — nothing is recorded. **No score, no XP, no badges, no
streaks, no confetti.** Feedback is entirely independent of any future
progression system, which is a precondition for adding progression later without
touching widgets.

---

## 8. Nesting rules

The governing principle: **JSON must not become a serialised DOM.** So nesting is
capped by *tier*, not by a depth counter.

```
Tier 0  lesson.content[]        — any block
Tier 1  containers              — callout, accordion, steps
Tier 2  leaf blocks only        — heading*, text, list, code, definition, image, table
```

Rules:
1. **Containers may contain leaf blocks only.** No container inside a container.
2. **Exercises are Tier 0 only.** They may carry a `stem` of leaf blocks.
   No exercise inside a callout/accordion/step, and no nested exercises.
3. **Maximum effective depth is 2.** Structurally impossible to exceed.
4. `heading` is discouraged inside containers (a container already has a title).
5. Unknown types at any level are skipped, never fatal (existing behaviour).

This is enough for every realistic lesson shape while keeping the renderer's
recursion a single level deep and its output predictable.

---

## 9. Security

Threat model: lesson JSON is repository content, but the renderer must behave as
if it were untrusted — that discipline is what keeps a future contributor's PR
from becoming an XSS vector.

- **No `innerHTML`, ever.** `createElement` / `textContent` / `setAttribute` /
  `appendChild` only — the rule MTrack1 already follows.
- **URL allowlist** — `image.src` and any link URL must match `^https:` (plus
  `http:` for localhost in dev). Explicitly rejected: `javascript:`, `data:`,
  `blob:`, `vbscript:`, protocol-relative `//`. A rejected URL means the block is
  not rendered. This mirrors `safeHref()` already in `library-builder.js`.
- **External links** — `rel="noopener noreferrer"`.
- **No iframe widget**, no arbitrary HTML, no `<script>`, no inline event
  attributes, no `style` from JSON.
- **`language` is metadata**, never used to select code to run.
- **Table/definition values are strings**, never markup.
- **Honest limitation:** answers ship in client JSON and are trivially visible in
  devtools. Acceptable — TRACKS is a learning aid, not an exam. This must be an
  explicit product decision (§10 Q6), because it forecloses graded assessment
  without a backend.

---

## 10. Accessibility

Per-widget requirements are listed above; the cross-cutting rules:

- **Semantic HTML first, ARIA only where HTML cannot express it.** `<details>`
  over a scripted disclosure; `<fieldset>`/`<legend>` over `role="radiogroup"`;
  `<table>`/`<th scope>` over a grid role.
- **Every input has a real label** — `<label for>`, or `aria-label` for
  `fill_blank` inputs where a visible label is impossible.
- **Buttons are `<button type="button">`**, never a clickable `<div>`.
- **Feedback is announced** via `aria-live="polite"`.
- **Never colour alone** — correct/incorrect and callout variants always carry
  text.
- **Focus is visible** — reuse the existing `--ring` token.
- **Keyboard-complete** — every exercise fully operable without a pointer; this
  is precisely why `matching`/`ordering` are deferred rather than shipped with
  drag-and-drop.
- **`prefers-reduced-motion`** — no reveal animations; the global `reduce` block
  already neutralises transitions site-wide.
- **Focus management** — the existing rule (focus the view `<h1>` on navigation)
  is unchanged; widgets must not steal focus on render.

---

## 11. Complexity estimate

Calibration: the 4 shipped leaf renderers ≈ 60 lines total.

| Group | Widgets | Est. renderer | Est. CSS |
|---|---|---|---|
| Content additions | callout, definition, table, image | ~120 lines | ~90 lines |
| Structure | accordion, steps | ~70 lines | ~60 lines |
| Exercises + validation + feedback | choice, text_input, fill_blank | ~260 lines | ~110 lines |
| **Total MTrack2-B** | **9 new widgets** | **~450 lines** | **~260 lines** |

Deferred work, for comparison: `tabs` ~120 lines (mostly keyboard handling),
`matching` ~130, `ordering` ~140. Deferring the three saves ~390 lines of the
most a11y-sensitive code in the system.

Suggested MTrack2-B split, if it should be smaller still:
**B1** content + structure (6 widgets, no interactivity) →
**B2** exercises + validation + feedback (3 widgets).

---

## 12. Decisions required before MTrack2-B

| # | Question | Options | My recommendation |
|---|---|---|---|
| **Q1** | **Inline markup in `text`** — how to express inline `code`, emphasis and links inside a sentence? Currently text is plain, which is a real limitation for teaching. | (a) stay plain; (b) an inline array `["Run ", {code:"ls"}, " now"]`; (c) a tiny safe Markdown subset (`` ` ``, `**`, links) | **(b)** — explicit, no parser, no injection surface. (c) means shipping a parser and re-introducing an escaping problem. **This is the most important open question.** |
| **Q2** | Fold the 4 choice types into one `choice`? | fold / keep separate | **Fold.** One widget, one validation path. |
| **Q3** | Drop `video`/`audio` permanently? | drop / revisit later | **Drop now.** Re-open only with a privacy-respecting, non-iframe answer. |
| **Q4** | Exercise `stem` instead of `code_exercise`? | stem / dedicated type | **Stem.** Composition beats a widget per question flavour. |
| **Q5** | Defer `tabs`, `matching`, `ordering`? | defer / include in 2-B | **Defer.** They are ~46% of the code and ~90% of the a11y risk. |
| **Q6** | Accept that answers are visible in client JSON? | accept / obfuscate / backend | **Accept and document.** Obfuscation is theatre; a backend is out of scope. |
| **Q7** | Add `schema_version` to lesson JSON now? | yes / no | **Yes** — one cheap field now; painful to retrofit later. |
| **Q8** | Lesson body: flat `content[]` or explicit `sections[]`? | flat / sections | **Flat**, as today. `heading` provides structure; sections add a tier for no gain. |
| **Q9** | Should an unknown block type be visibly flagged? | silent skip / dev-visible note | **Silent in production**, plus a small offline validator script later. |
| **Q10** | Are the 4 MTrack1 fixtures migrated in 2-B? | migrate / leave | **Leave.** They already validate; migration is content work, not schema work. |

---

## 13. Scope statement

Nothing in this document is implemented. MTrack1 is untouched: `/tracks/`,
`/tracks/#programming`, `/tracks/#programming/variables`, lazy loading, the
in-memory cache, the hash router, the error states and the `<base>`-aware link
fix all remain exactly as verified. Library is untouched. No new files beyond
this document. No dependency, no storage, no backend.

**Awaiting audit of §12 before MTrack2-B.**
