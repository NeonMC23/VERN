# MTrack2-A — Lesson Widget Inventory & Design

> ## **MTrack2-A — DESIGN FROZEN / READY FOR MTrack2-B**
>
> The lesson schema defined here is **frozen**. D1–D6 (§13) are authoritative
> and binding on the MTrack2-B implementation. Every question in the register
> (§12) is resolved.
>
> **Frozen means specified, not built.** No widget described here is implemented
> yet; MTrack2-B writes the code *against* this document. Changing a frozen
> decision requires an explicit new milestone, not an edit in passing.

This document defines the *pedagogical vocabulary* of VΞRN TRACKS.

**Revision 3** — design frozen. §13 holds the binding decisions **D1–D6**
(inline content, fill_blank representation, validation semantics, choice
semantics, provenance, schema_version). §13 is authoritative where it conflicts
with an earlier section.

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
| `text` | content | yes — **shipped** | no | inline (D1) | low |
| `list` | content | yes — **shipped** | no | inline (D1) | low |
| `code` | content | yes — **shipped** | no | no | low |
| `callout` | content | yes | no | **container** | low |
| `definition` | content | yes | no | no | low |
| `table` | content | yes | no | no | medium |
| `image` | media | yes | no | no | low |
| `accordion` | structure | yes | native | **container** | low‑medium |
| `steps` | structure | yes | no | **container** | medium |
| `choice` | exercise | yes | yes | stem only | medium |
| `text_input` | exercise | yes | yes | stem only | medium |
| `fill_blank` | exercise | yes | yes | structured (D2) | medium‑high |
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

**Unchanged by the D1–D6 design lock.** The six decisions refine the *shape* of
existing widgets; they add no widget and remove none. `inline_code`, `strong`,
`emphasis` and `link` (D1) are **inline content within blocks**, not blocks, and
`source_ref` / `sources` (D5) are metadata, not widgets. The count stays 13.

---

## 2. Rejected — and why

Each rejection removes renderer surface without removing teaching capability.

| Rejected | Reason | Do this instead |
|---|---|---|
| `code_example` | Pure duplicate. `code` already displays static code; a second type with identical data would be two code paths for one job. | `code` |
| `true_false` | `choice` with two options. Sugar, not capability. | `choice` with `["True","False"]` |
| `select` | Same data as `choice`, worse pedagogy — a dropdown *hides* the distractors, and reading the wrong answers is part of the learning. | `choice` |
| `number_input` | Not a widget, a **validation mode**. | `text_input` with `compare: "numeric"` |
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

### `text` *(shipped, extended by D1)*
- **Purpose** — the default. Most of a lesson should be this.
- **Data** — either the shipped string form `{ type, text }` **or** the locked
  inline form `{ type, content: [ inline… ] }`. See **D1 (§13.1)** for the
  inline model, which is now closed.
- **Rendering** — `<div class="prose"><p>…</p></div>`.
  String form: blank lines split paragraphs (already implemented).
  Inline form: **one `content` array = exactly one paragraph.**
- **Nesting** — none at block level.

### `list` *(shipped)*
- **Purpose** — enumerate short parallel items.
- **Data** — `{ type, items: [ string | inline[] ], ordered?: boolean }`.
- **Rendering** — `<ul class="bullets">` / `<ol>`. An item is either a plain
  string or an inline array (D1); a list of *rich blocks* is `steps`.
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
- **Data** — `{ type, variant, title?: string | inline[], content: [leaf blocks] }`
  (`title` accepts an inline array per D1 §13.1.)
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
- **Data** — `{ type, items: [{ term: string | inline[], definition: string | inline[] }] }`
  (Both fields accept an inline array per D1 §13.1.)
- **Rendering** — `<dl>` / `<dt>` / `<dd>`. Native semantics, no ARIA needed.
- **Nesting** — no block nesting. `term` and `definition` are a string or an
  inline array (D1); never blocks.

### `table` — *new*
- **Purpose** — genuine two-dimensional comparison (protocol vs protocol,
  option vs option). Not layout.
- **Data** — `{ type, caption?: string, columns: [string], rows: [[string | inline[]]] }`
  **Cells accept an inline array** (D1 §13.1) — a comparison table routinely
  needs `inline_code` in a cell. `caption` and `columns` stay **plain strings**
  deliberately: headers are short labels, and keeping them simple limits the
  renderer surface without costing expressiveness.
- **Validation at render** — rows whose length ≠ `columns.length` are **skipped**,
  not padded, so malformed data cannot silently misalign a comparison.
- **Rendering** — `<table>` + `<caption>` + `<thead>` with
  `<th scope="col">` + `<tbody>`; wrapped in a horizontally scrollable
  container that is focusable.
- **Accessibility** — `scope` on every header; `<caption>` strongly recommended.
  Cells hold a string or an inline array — **no nested blocks**, no colspan/rowspan.
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
    prompt, stem?,
    multiple: false,                        // REQUIRED, explicit
    options: [ { id, text, feedback? } ],
    answer: [ id, ... ],
    hint?, explanation? }
  ```
- **Rendering** — `<fieldset>` + `<legend>` (the prompt) + native
  `<input type="radio">` (or `checkbox` when `multiple`) with real `<label>`s,
  plus a **Check** `<button type="button">`.
- **Validation** — set equality between selected `id`s and `answer`.
  `multiple` is **explicit and required** — never inferred from `answer.length`.
  Full rules, including malformed `answer`, duplicates and unknown ids: **D4 (§13.4)**.
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
    compare?: "exact" | "ci" | "numeric" | "contains",   // default "ci"
    normalize?: { trim?: bool, collapse_ws?: bool },     // separate stage, see D3
    tolerance?: number,                                   // numeric only
    placeholder?, hint?, explanation?, feedback? }
  ```
- **`match` is renamed `compare`**, and normalisation is a separate `normalize`
  object — the two stages never hide inside one another (**D3, §13.3**).
- **`accept` is always an array** — one uniform shape for "one right answer" and
  "several acceptable phrasings", which removes a whole class of authoring error.
- **Rendering** — `<label>` + `<input>` (+ `inputmode="numeric"` when
  `input: "number"`) + Check button. Submitting via Enter must also work.

### 5.4 `fill_blank` *(representation locked by D2)*
- **Purpose** — the strongest widget for syntax and precise vocabulary: the
  learner produces the answer instead of recognising it, but within a scaffold.
- **Representation** — the `____` marker template is **withdrawn**; `_` is a
  legal identifier character (`__init__`, `user_name`). Replaced by a structured
  `content` array. Full schema and semantics: **D2 (§13.2)**.
- **Complexity** — still the highest of the three, but the parsing risk is gone:
  there is nothing to parse, only an array to walk.

### 5.5 Not implemented now
`matching` and `ordering` — see §2.

---

## 6. Validation system

**Superseded in detail by D3 (§13.3), which is authoritative.** Summary:

Answer checking is a two-stage pipeline, and the stages are **named separately
and never implied by one another**:

```
user answer -> normalization (declared in `normalize`) -> comparison (declared in `compare`)
```

Comparison modes: `exact`, `ci`, `numeric`, `contains` (+ implicit `set` for
`choice`). Normalisation options: `trim`, `collapse_ws`.

**Deliberately excluded:** regex (ReDoS risk, and authors get it wrong),
boolean expression trees, cross-question dependencies, partial credit.
Partial credit in particular is a scoring concept and belongs with progression,
not here.

**Every rule is declarative data.** No JSON field ever contains executable code.

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
- **Inline content (D1) is a closed tagged union.** An unknown inline `type` is
  rendered as its `text` in plain form, never as markup. `inline_link.href`
  goes through the same https-only allowlist as `image.src`.
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

## 12. Question register — all resolved

No question remains open. Q1, Q2, Q4, Q7 became **D1–D6** (§13). Q8 and Q9 are
closed here as **contract decisions** because they bind the implementation. Q3,
Q5, Q6 and Q10 are scope/policy: they change *what gets built and when*, not the
shape of any field.

| # | Question | Resolution | Kind |
|---|---|---|---|
| Q1 | Inline markup in `text` | **D1 (§13.1)** — structured inline array, 4 types | contract |
| Q2 | Fold the 4 choice types | **D4 (§13.4)** — folded into `choice`, `multiple` explicit | contract |
| Q3 | Drop `video`/`audio` | **Dropped.** Re-open only with a privacy-respecting, non-iframe answer. Not in MTrack2-B. | policy |
| Q4 | `stem` instead of `code_exercise` | **Stem retained.** No `code_exercise` type. | contract |
| Q5 | Defer `tabs`, `matching`, `ordering` | **Deferred** past MTrack2-B (~46% of code, ~90% of a11y risk). | scope |
| Q6 | Answers visible in client JSON | **Accepted and documented** (§9). TRACKS is a learning aid, not an exam. | policy |
| Q7 | `schema_version` | **D6 (§13.6)** — optional integer, current value `1`, lessons only | contract |
| Q8 | Flat `content[]` vs `sections[]` | **CLOSED: flat `content[]`**, as shipped. The lesson root holds `content`; `heading` provides structure. No `sections` key exists. Binding on the renderer, hence a contract decision. | contract |
| Q9 | Flag unknown block types? | **CLOSED: silent skip in production.** Confirms MTrack1's shipped behaviour and is the mechanism every "block skipped" rule in §13 depends on. An offline validator may be added later; it is not part of the renderer. | contract |
| Q10 | Migrate the 4 MTrack1 fixtures | **No.** They remain valid under D6 (absent `schema_version` = `1`). Migration is content work. | scope |

## 13. Locked design decisions (MTrack2-A addendum)

These six decisions are **frozen**. Where they conflict with an earlier section,
this section wins.

---

### 13.1 — D1: Inline content model

**Decision.** Adopt a structured inline array. No Markdown, no HTML, no marker
syntax inside strings. Exactly **four** inline object types.

**Schema.** An *inline array* is an ordered list whose items are either a plain
string (literal text) or an inline object:

```
inline      := string | inline_object
inline_object :=
    { "type": "inline_code", "text": string }
  | { "type": "strong",      "text": string }
  | { "type": "emphasis",    "text": string }
  | { "type": "link",        "text": string, "href": string }
```

Accepted by: `text.content`, `list.items[]`, `table` cells, `callout` titles,
`definition.definition`, and every exercise `prompt`. **One inline array renders
exactly one paragraph** — inline objects never nest, and there is no inline array
inside an inline object.

**Rendering.**

| Item | Element |
|---|---|
| `string` | text node via `textContent` |
| `inline_code` | `<code>` |
| `strong` | `<strong>` |
| `emphasis` | `<em>` |
| `link` | `<a href rel="noopener noreferrer">` |

**Validation.**
- `text` is required and must be a non-empty string; otherwise the item is skipped.
- Unknown `type` → **render `text` as a plain text node** (forward compatible,
  never markup, never dropped silently if text exists).
- `link` without a valid https `href` (§9 allowlist) → **degrades to plain text**,
  keeping the sentence readable rather than dropping a word from it.
- No item is ever passed to `innerHTML`.

**Valid.**
```json
{
  "type": "text",
  "content": [
    "Utilisez ",
    { "type": "inline_code", "text": "ls" },
    " pour afficher le contenu du répertoire. Voir la ",
    { "type": "link", "text": "documentation", "href": "https://example.org/ls" },
    "."
  ]
}
```

**Invalid → degraded, never fatal.**
```json
{
  "type": "text",
  "content": [
    "Lancez ",
    { "type": "link", "text": "ce script", "href": "javascript:alert(1)" },
    " puis ",
    { "type": "blink", "text": "attention" },
    { "type": "inline_code" }
  ]
}
```
Renders: `Lancez ce script puis attention` — the `javascript:` link becomes plain
text, the unknown `blink` becomes plain text, the `inline_code` without `text` is
skipped. **Nothing executes and the sentence stays readable.**

**Rationale.** Two representations of a paragraph now exist (`text` string and
`content` array), which is a real cost — but the string form is already shipped
and is the right tool for plain prose. Keeping both avoids a pointless migration,
and the renderer branch is one `if`. A Markdown subset was rejected: it means
shipping a parser and re-introducing the escaping problem the design exists to
avoid.

---

### 13.2 — D2: `fill_blank` representation

**Decision.** Withdraw the `____` marker template. Use a structured `content`
array in which blanks are objects. Code is preserved **exactly as written**,
because it is never parsed.

**Schema.**
```
{ "type": "fill_blank",
  "prompt"?:   string | inline[],
  "language"?: string,
  "content":   [ string | blank ],
  "explanation"?: string | inline[] }

blank := { "blank": true,
           "id"?: string,
           "accept": [ string, ... ],
           "compare"?: "exact" | "ci" | "numeric" | "contains",   // default "exact"
           "normalize"?: { trim?: bool, collapse_ws?: bool },
           "size"?: integer,
           "hint"?: string }
```

Strings are literal text rendered verbatim (inside `<pre>` when `language` is
set). Each `blank` becomes one `<input>`. Order is positional — array order is
answer order. Multiple blanks are naturally supported.

**Note the default:** `compare` defaults to **`exact`** here (code is
case-sensitive), unlike `text_input` where it defaults to `ci`.

**Rendering.** `<pre class="codeblock">` when `language` is set, otherwise inline
flow. Literal runs are text nodes; each blank is
`<input type="text" size aria-label="Blank 1 of 2">`. A single **Check** button
validates all blanks; each blank reports its own result.

**Validation.**
- `content` must contain at least one `blank`, otherwise the block is skipped.
- A `blank` with a missing or empty `accept` array → block skipped (it would be
  unanswerable).
- `id` is optional and used only for feedback wiring; duplicates are ignored.

**Valid.**
```json
{
  "type": "fill_blank",
  "language": "python",
  "prompt": "Complétez la boucle.",
  "content": [
    "for i in ",
    { "blank": true, "accept": ["range"] },
    "(3):\n    print(user_name)"
  ]
}
```
`user_name` and a hypothetical `__init__` are preserved literally — the exact
failure the marker template caused.

**Invalid.**
```json
{ "type": "fill_blank",
  "content": ["for i in range(3):"] }
```
No `blank` object → **skipped**. It is a `code` block, not an exercise.

**Rationale.** No marker means no escaping rule, no ambiguity with `_`, and no
templating language. The representation is the same shape as D1, so authors learn
one pattern.

---

### 13.3 — D3: Validation semantics

**Decision.** Normalisation and comparison are **two separate, separately
declared stages**. `exact` means exact *on the normalised value*, and the
normalisation applied is always visible in the JSON — never silent.

**Pipeline.**
```
raw user answer
      ↓  stage 1: normalization   (from `normalize`; applied to BOTH sides)
normalised answer + normalised accept[]
      ↓  stage 2: comparison      (from `compare`)
boolean
```

**Stage 1 — normalization.** Explicit object, applied identically to the learner's
answer and to every `accept` value.

| Option | Default | Effect |
|---|---|---|
| `trim` | `true` | Strip leading/trailing whitespace |
| `collapse_ws` | `true` | Collapse internal whitespace runs to one space |

Defaults apply when `normalize` is absent. `"normalize": {}` is **not** "no
normalisation" — write `{ "trim": false, "collapse_ws": false }` for raw bytes.
Case is **never** handled here; casing belongs to `compare`.

**Stage 2 — comparison.** Closed set of four (plus `set`, implicit for `choice`).

| `compare` | Semantics | Case | Typical use |
|---|---|---|---|
| `exact` | normalised answer equals an `accept` value | sensitive | code, identifiers |
| `ci` | as `exact`, Unicode-lowercased both sides | insensitive | prose, terms (**default for `text_input`**) |
| `numeric` | both parsed as finite numbers, `abs(a-b) <= tolerance` (default `0`) | n/a | quantities |
| `contains` | normalised answer contains an `accept` value as substring, **both Unicode-lowercased first** | **always insensitive** | "mention the key idea" |
| `set` | selected id set == answer id set | n/a | `choice` only, implicit |

Success = a match against **any** entry of `accept` (`accept` is an OR-list).
`numeric` on an unparseable answer is simply incorrect, never an error.

**`contains` is always case-insensitive**, independently of `compare`'s other
modes — there is no case-sensitive substring mode:

```
normalized answer  ->  Unicode lowercase
normalized accept  ->  Unicode lowercase
                   ->  substring containment
```

The other comparators are unaffected: `exact` is case-sensitive, `ci` is
case-insensitive, `numeric` compares numbers within `tolerance`, and `set`
applies to `choice` only.

**Explicitly excluded:** regex, expression languages, scripting, partial credit,
cross-question dependencies, custom comparators.

**Valid.**
```json
{ "type": "text_input",
  "prompt": "Quelle commande liste un répertoire ?",
  "accept": ["ls", "ls -l"],
  "compare": "exact",
  "normalize": { "trim": true, "collapse_ws": true } }
```
`"  ls   -l  "` → normalised `"ls -l"` → **correct**. `"LS"` → **incorrect**
(`exact` is case-sensitive — and that is now unambiguous).

**Invalid.**
```json
{ "type": "text_input", "prompt": "…", "accept": [], "compare": "regex" }
```
Empty `accept` → block skipped (unanswerable). `compare: "regex"` is not in the
closed set → falls back to the default `ci`; regex is never supported.

**Rationale.** The earlier wording ("`exact` … after normalisation") was exactly
the ambiguity to remove. Separating the stages makes every check readable from
the JSON alone and keeps the engine deterministic and tiny.

---

### 13.4 — D4: `choice` semantics

**Decision.** `multiple` is a **required, explicit boolean**. It is never
inferred from `answer.length`.

**Schema.**
```
{ "type": "choice",
  "prompt": string | inline[],
  "stem"?: [ leaf blocks ],
  "multiple": boolean,                       // REQUIRED
  "options": [ { "id": string, "text": string | inline[], "feedback"?: … } ],
  "answer": [ string, ... ],
  "hint"?: …, "explanation"?: …, "feedback"?: { correct?, incorrect? } }
```

**Rendering.** `multiple: false` → `<input type="radio">`; `multiple: true` →
`<input type="checkbox">`. Both inside `<fieldset>` + `<legend>`.
When `multiple: true`, the UI states *"Select all that apply."*

**Validation rules.**

| Condition | Behaviour |
|---|---|
| `multiple` missing or not a boolean | **Block skipped.** No inference. Authoring error surfaced, not guessed. |
| `multiple: false` and `answer.length !== 1` | **Block skipped** — contradictory. |
| `multiple: true` and `answer.length < 1` | **Block skipped** — unanswerable. |
| `answer` contains an id absent from `options` | **Block skipped** — ungradeable (the correct answer cannot be selected). |
| duplicate ids **within `answer`** | De-duplicated, then rules re-applied. Harmless. |
| duplicate ids **across `options`** | **Block skipped** — ambiguous grading target. |
| `options.length < 2` | **Block skipped** — not a choice. |
| Learner submits nothing | Not graded; prompt to answer first. |

**Grading.** Set equality between selected ids and de-duplicated `answer`.
For `multiple: true` this means all correct options and no incorrect ones —
no partial credit (§6).

Skipped blocks are omitted from the lesson; they never throw and never blank the
page, consistent with MTrack1's unknown-type behaviour (Q9).

**Valid.**
```json
{ "type": "choice",
  "prompt": "Lesquels sont des gestionnaires de paquets ?",
  "multiple": true,
  "options": [
    { "id": "a", "text": "dnf" },
    { "id": "b", "text": "ext4", "feedback": "ext4 est un système de fichiers." },
    { "id": "c", "text": "apt" }
  ],
  "answer": ["a", "c"] }
```

**Invalid.**
```json
{ "type": "choice",
  "multiple": false,
  "options": [ { "id": "a", "text": "x" }, { "id": "a", "text": "y" } ],
  "answer": ["a", "z"] }
```
Three faults: duplicate option id `a`, `answer.length` 2 with `multiple: false`,
and unknown id `z`. → **Block skipped.**

**Rationale.** Inference made two fields able to disagree silently; an author
adding a second correct answer would have flipped the control type without
noticing. Explicit intent is checkable.

---

### 13.5 — D5: Lesson provenance / sources

**Decision — option C, asymmetric.** Lesson-level `sources` is the canonical
list. Blocks carry an optional lightweight **reference** (`source_ref`) — an id
pointing into that list, **never** duplicated metadata.

This is the only option that satisfies both stated requirements: cite the lesson
without repeating metadata (A alone), *and* attribute a specific factual block
when needed (B alone). Rejected: **A** cannot attribute a block; **B** duplicates
title/url across blocks and has no lesson-level list; a full citation system
(CSL/BibTeX) is far beyond need.

**Schema.**
```
// lesson root — OPTIONAL
"sources"?: [
  { "id": string,          // required, referenced by blocks
    "title": string,       // required
    "url"?: string,        // https allowlist (§9)
    "publisher"?: string,
    "accessed"?: "YYYY-MM-DD" } ]

// any block, optional
"source_ref": string | [ string, ... ]
```

**Rendering.**
- **`sources` is optional.** Absent, empty, or reduced to nothing after
  validation → **no `Sources` section is rendered at all** (never an empty
  heading) and **no error**. A lesson may legitimately cite nothing.
- When present and non-empty: a **Sources** section at the end of the lesson,
  listing every entry, numbered in array order.
- A block with `source_ref` gets a small superscript marker linking to the entry
  (`<sup><a href="#src-2">`), with an accessible name such as "Source 2".
- **Anchor rule (implementation, MTrack2-B).** The value of `source_ref` is
  authored data and must **never** be used directly as an HTML `id`, fragment, or
  selector. Anchors are generated **deterministically from the entry's position**
  in the validated `sources` array — `src-1`, `src-2`, `src-3` — so the DOM id
  space is fully controlled by the renderer. `source_ref` is used **only** to look
  up the matching entry; its resolved index then yields the anchor. This prevents
  id collisions, selector injection, and clashes with existing page ids
  (`tracks-app`, `tracks-top`). *Security/implementation note only — D5 itself is
  unchanged.*
- A `source_ref` pointing at an unknown id is **ignored**; the block still
  renders. Provenance never breaks content.
- A `sources` entry referenced by nobody still appears in the list (a lesson may
  cite generally).

**Validation.** `id` and `title` required; entries missing either are dropped.
Duplicate ids: first wins. `url` must pass the https allowlist, otherwise the
entry renders as text without a link.

**Valid.**
```json
{
  "id": "variables",
  "title": "Variables",
  "content": [
    { "type": "text", "text": "Python names are bound, not typed.",
      "source_ref": "pydocs" }
  ],
  "sources": [
    { "id": "pydocs", "title": "The Python Language Reference",
      "url": "https://docs.python.org/3/reference/", "accessed": "2026-09-04" }
  ]
}
```

**Invalid → degraded.**
```json
{ "content": [ { "type": "text", "text": "…", "source_ref": "nope" } ],
  "sources": [ { "url": "https://example.org/" } ] }
```
The `sources` entry has no `id`/`title` → dropped. `source_ref: "nope"` resolves
to nothing → marker omitted, **text still renders**.

**Rationale.** Matches the Library's existing `sources` convention, so the two
halves of VΞRN describe provenance the same way. Referencing by id keeps authored
JSON small and makes a source correctable in one place.

---

### 13.6 — D6: `schema_version`

**Decision.** One integer field at the lesson root. Nothing else.

| Property | Value |
|---|---|
| Field name | `schema_version` |
| Type | **integer** (not a string, not semver) |
| Current value | `1` |
| Required | **No.** Absent is treated as `1`. |
| Scope | **Lesson files only.** Not `data/tracks/index.json`. |

**Why integer, not `"1.0.0"`.** Semver invites minor/patch negotiation, which
implies a compatibility matrix. An integer supports exactly one operation —
equality — which is all a static client-side renderer can honestly do.

**Why optional.** The four shipped MTrack1 fixtures have no such field, and Q10
leaves them unmigrated. Treating absent as `1` keeps them valid, so no content
changes and the field costs nothing today.

**Why lessons only.** `index.json` is a small track/lesson listing owned by the
site, loaded once, and not an authoring surface. Versioning it would add a second
version axis for a file containing no widget vocabulary. If its shape ever
changes, that is a site-wide change, not a content-compatibility problem.

**Renderer behaviour on an unsupported version.**

| Value | Behaviour |
|---|---|
| absent, or `1` | Render normally. |
| integer `> 1` (future) | **Do not attempt to render blocks.** Show a lesson-level message: *"This lesson requires a newer version of the site."* Reuse the existing error view — no new UI. |
| non-integer, `< 1`, or unparseable | Treat as invalid content → the existing *"Unable to load this lesson."* state. |

A future version is refused **whole-lesson**, never block-by-block: partially
rendering a lesson written against an unknown vocabulary would silently drop
content and mislead the learner. Failing visibly is the honest outcome.

**No migrations, no negotiation, no compatibility layer, no second schema.**
A version `2` would only ever be introduced by a future milestone that explicitly
decides how it is handled.

**Valid.**
```json
{
  "schema_version": 1,
  "id": "variables",
  "title": "Variables",
  "content": []
}
```

**Valid (legacy — absent is `1`).**
```json
{ "id": "variables", "title": "Variables", "content": [] }
```

**Refused — future version.**
```json
{ "schema_version": 2, "id": "variables", "title": "Variables", "content": [] }
```
→ *"This lesson requires a newer version of the site."* No blocks rendered.

**Refused — malformed.**
```json
{ "schema_version": "1.0", "id": "variables", "title": "Variables", "content": [] }
```
→ not an integer → *"Unable to load this lesson."*

---

## 14. Scope and status

**Status: DESIGN FROZEN — ready for MTrack2-B.**

Frozen refers to the *specification*. Nothing in this document is implemented:
D1–D6 are the contract MTrack2-B will build against, not code that exists.

MTrack1 is untouched and remains as verified: `/tracks/`,
`/tracks/#programming`, `/tracks/#programming/variables`, lazy loading, the
in-memory cache, the hash router, the error states and the `<base>`-aware link
fix. Library is untouched. The four lesson fixtures are unmodified and stay
valid under D6. No dependency, no storage, no backend, no code execution.

**Binding on MTrack2-B:** the 13-widget core set (§1), the nesting tiers (§8),
the security rules (§9), the accessibility rules (§10), and D1–D6 (§13).

**Next:** MTrack2-B implementation, on approval. Reopening any frozen decision
requires an explicit milestone.
