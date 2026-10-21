# VΞRN — development

## Adding a Library resource

```text
1. Create:
   data/library/firefox.json

2. Add:
   "firefox"
   to LIBRARY_RESOURCES in assets/js/library-catalog.js

3. Push

That's it.
```

No HTML file, no build step, no GitHub Action. Nothing in the builder has to be touched for a
resource to render: a `content` key missing from `SECTION_TITLES` falls back to the humanised key
name. One optional line in that table is what gives a section an approved English heading.

### Section headings (`SECTION_TITLES`)

`content` keys are structural: they are quoted by the audits under `research/verify/` and the
conformity measure classifies a section by its key name. Headings are display text, produced at
one place in `assets/js/library-builder.js` from a table keyed by section name.

- Key present in `SECTION_TITLES` → the table string is rendered.
- Key absent → `humanize(key)`: underscores become spaces, first letter capitalised, a question
  phrasing gets its mark. That is the historical behaviour, and it raises no error: an
  untranslated key simply shows its humanised name.

Procedure when a heading must be added or changed:

1. add or edit **one** entry in `SECTION_TITLES`, keyed by the exact JSON key (lowercase,
   underscores, ASCII);
2. leave `data/library/*.json` alone: never rename a `content` key to fix a heading, and never
   add a heading field to the data for that purpose;
3. check the syntax (`node --check assets/js/library-builder.js`) and read the rendered heading
   back from the DOM of `/library/{id}/` — a passing build is not a rendered page;
4. remember the entry applies to every resource using that key, and that a new key name can move
   a thematic count in the measure: re-run the measure after adding a resource.

Step 2 is only what makes the resource appear on `/library/`. It is **not**
required for routing: `/library/firefox/` works the moment
`data/library/firefox.json` exists.

The list holds **ids only** — never documentation. Every value shown on a
catalog card is read from that resource's own JSON at runtime.

### Component roles (`operating_system_kernel`, `upstream_base`)

`role` on a `components` entry is a free-form string. There is no enum, no schema and no
automatic check of its value: it is humanised for display and nothing else reads it, so a wrong
role raises no error — it simply states something false on the page. The convention below is
therefore editorial, and it is applied by reading sources, not by trusting a field name.

- `operating_system_kernel` — the kernel the documented system actually runs or ships: a
  software component built or packaged by that system.
- `upstream_base` — a system or base upstream from which the documented system derives. It is
  not the kernel of the documented system, even when that upstream also publishes a kernel.

Four rules follow:

1. An upstream distribution or system is **not** automatically the kernel used by its
   derivative. The kernel of the derivative is whatever that derivative builds or ships.
2. A source tree that bundles the kernel with drivers, libraries and utilities is not a kernel.
   Calling it `operating_system_kernel` requires evidence that the entry designates the kernel
   itself, not the tree that contains it.
3. A `relations` entry (`upstream_base`, `upstream`, `downstream_of`…) neither turns a base into
   a kernel nor settles how a component is classified: the two fields answer different
   questions, and both have to be right.
4. Verify what the component really is — project documentation, build or packaging
   documentation, source repository — before choosing a role. A project name, a repository name
   or a filename is not proof of what the entry designates.

Examples, illustrating the distinction at one point in time rather than acting as a rule of
their own: OmniOS builds its system from its own fork `illumos-omnios`, SmartOS from
`illumos-joyent` (which carries the core kernel, libraries and user commands), while
`illumos-gate` is a source tree that *contains* the kernel alongside drivers and utilities. The
same word can therefore name an upstream base in one context and something of another nature
next to it; only the documentation of the system at hand decides, case by case.

Two prohibitions: never change a role merely to make labels look uniform, and never resolve an
uncertain case by picking a role anyway. When the sources do not settle the question, leave the
uncertainty visible and report it instead of asserting a classification they do not support.

### `operating_system_core` (VΞRN convention)

`operating_system_core` designates the core software set of an operating system: the kernel
together with essential userland components — device drivers, core libraries and system
utilities, for instance — when they are built and treated as one coherent set. It applies to a
source tree or a software set of that nature, and neither to the kernel alone nor to the complete
operating system.

This role is a **classification convention internal to this corpus**, added to close the case that
rule 2 above raises. It is not the official name of a category used by OpenIndiana or illumos: the
sources consulted describe the object in their own words, and no stable official term for it was
found. It must not be presented as an external standard, and it must not be reused for another
kind of object on the strength of its name alone.

How it relates to the roles already in use:

- `kernel` — a kernel, in the corpus's existing usage.
- `operating_system_kernel` — a component that is the kernel of an operating system, per the
  convention above.
- `operating_system_core` — a core set wider than the kernel alone, which may include essential
  userland components.
- `upstream_base` — an upstream system or distribution from which another system derives. It is not
  to be used merely because a source tree happens to be maintained upstream.
- `core_utilities`, `system_libraries` — narrower components; they must not be taken automatically
  for the core software set defined here.
- `build_system` — build infrastructure or a build system; it must not be confused with the product
  or with the source tree it builds.

Example: `openindiana:illumos-gate` applies the convention. The OpenIndiana documentation consulted
describes `illumos-gate` as including the illumos kernel along with many of the device drivers, core
libraries and system utilities, and the build documentation lists it as "Kernel and core userland
components". The entry is therefore `operating_system_core`, not `operating_system_kernel`. This
states nothing about the boundary between `illumos-gate` and `oi-userland`: the sources consulted do
not settle it at the level of individual files.

### Components and relations side by side (`upstream_base`)

A `components` entry describes an element of the documented system, and may describe the base that
system uses. A `relations` entry describes a link between the current resource and another
resource. Both can carry the value `upstream_base`, and that shared value does not make the two
entries interchangeable: the field they belong to is what says which question is answered.

Rule 3 above still applies: the two fields answer different questions, and both have to be right.
Their coexistence in one resource is legitimate when the two entries document different aspects —
for instance a component attesting what the base is for this system, next to a relation pointing to
the upstream resource. Coexistence is not required either: nothing here states that a component
`upstream_base` must be accompanied by a relation of the same value, or the reverse. Neither
direction has been turned into a rule, because the editorial intention behind individual resources
has not been formalised.

**What the current rendering does** — a description of the code as it stands, not a guarantee.
`assets/js/library-builder.js` qualifies every reference card through the same mechanism, reading
`role`, `type` and `relation` in that order and humanising the value it finds. A component and a
relation can therefore both display `Upstream base`. They are nevertheless rendered in two distinct
sections, "Components" and "Related / Alternatives", and a shared label does not by itself mean that
the two entries describe the same object. Nothing here promises that the labels will stay identical,
and nothing here is a compatibility contract. That shared mechanism is display only: `role`, `type`
and `relation` are not interchangeable at the semantic level — see *Relation fields* below.

**References whose target is not documented.** A reference id with no `data/library/<id>.json` is
served without an active link, and its card carries the tooltip `Not documented yet`. That
presentation says nothing about the correctness of the reference: it records that the target
resource does not exist in the corpus. It does not justify creating a resource on its own — a new
library resource follows the usual source-verification and documentation rules above, and is added
because it can be documented, not because a link looks missing.

**Editorial check before contributing.**

1. Verify that the component describes the element it names, and not the upstream system as a whole
   merely because the names coincide.
2. Verify that the relation describes the documented filiation or link, with sources to support it.
3. Ask whether the two entries bring different information. If they do, keeping both is allowed; if
   they do not, the duplication is a reason to go back to the sources, not a reason to delete either
   entry on the spot.
4. Check the ids against `data/library/` and the claims against the sources of the resource itself.
5. Never remove a component or a relation because its label resembles another entry's label.
6. Never rename two ids to make cards clickable before checking the structure and the meaning of
   each entry: pointing an id at an existing resource changes what the page links to.
7. When an ambiguity remains, document it and ask for an arbitration. The rendering cannot settle
   it, and no conclusion is inferred from a label alone.

**What this section does not settle.** It does not say that resources carrying both entries contain
errors; it does not say that every coexistence is correct; it does not describe how the stylesheets
render two similar cards in every context, since the audit behind this section read the rendered
DOM and not the CSS; it does not ask for undocumented targets to be removed or completed; and it
does not settle the relation field names, which are described in *Relation fields* below. On the key
itself the convention is now stated: `relation` is the canonical key, and the entries written with
the historical `type` remain accepted until an explicit decision is taken on whether they are
converted. A key normalisation does not, by itself, justify changing a value. That question is
distinct from this section.

### Relation fields (`relation`, `type`)

A `relations` entry carries its qualifier under a key. Two keys exist in the corpus, and they do not
play the same role.

- `relation` — **the canonical key**. It is what a new entry is written with, and what any later
  normalisation explicitly authorised would use.
- `type` — the historical key for the same qualifier. Entries written with it are still accepted and
  still rendered: their presence is not an error the build can catch, and it is not treated as one
  here. It is not the convention to follow for anything new.

The corpus was not converted in one go, and no schedule is attached to the part that still uses
`type`. Whether those entries are converted is an explicit decision, taken on a named scope and
approved before it is applied. Nothing in this document announces or promises that conversion.

**A key and its value are two different questions.** Renaming a key does not alter the value it
carries, and settles nothing about that value's meaning or validity. Changing a value — mapping a
historical value onto another, reversing the direction of a filiation, merging two near-synonyms —
is a separate editorial decision, taken on sources and explicitly approved. A normalised entry must
be read as "same value, new key", never as "value approved".

**`type` exists at two levels, and they never meet.** At the top level of a resource, `type` is a
required field of the schema (`operating_system`, `project`…) rendered as the header kicker; it is
current and must be present. Inside a `components` or `relations` entry, `type` is the historical
name of the card qualifier described above. The two sit at different depths and are read by
different code: a statement about one says nothing about the other, and a rule about relation keys
never applies to a resource's own type — nor the reverse.

**A shared label is not a shared meaning.** The rendering can turn `role`, `type` and `relation`
into similar-looking labels on a card. That mechanism is display, not semantics: the three keys
answer different questions, and identical wording on two cards never establishes an equivalence
between what they designate.

Rules when writing or editing an entry:

1. Use `relation` for every new `relations` entry. Not `type`, even though the rendering reads both.
2. When a key is normalised, keep the value unchanged. A key change is not an occasion to reword a
   value, to adjust a note or to retarget an id.
3. Treat any change of value as a separate decision: it needs sources, an explicit approval, and a
   scope that names the entries concerned.
4. Mind the depth. A top-level field and a field inside a `relations` or `components` entry are
   different objects, even when they carry the same name.
5. Never infer a semantic equivalence from an identical rendered label, nor from an identical value
   string alone: check the entry, its target and the sources behind it.

## How `/library/{id}/` works

```text
/library/fedora/
        ↓  no file on disk → generic shell served, URL unchanged
404.html                       navbar, footer, empty mount point
        ↓
assets/js/library-builder.js   reads "fedora" from location.pathname
        ↓
/data/library/fedora.json      source of truth
        ↓
DOM built client-side
```

`404.html` is the single generic shell. It plays three roles at once: the real
404 page, the GitHub Pages fallback for `/library/{id}/`, and the Cloudflare
rewrite target. It contains no resource content.

| Environment      | Mechanism                                       |
| ---------------- | ----------------------------------------------- |
| GitHub Pages     | `404.html` fallback (URL preserved, status 404) |
| Cloudflare Pages | `_redirects` → `/library/:id/ /404.html 200`    |
| Local            | `scripts/dev-server.py`                          |

Note: GitHub Pages returns HTTP **404** while displaying the correct page.
Invisible to users; crawlers will not index those routes. Cloudflare Pages
returns a true 200.

### Base path

All URLs in the HTML and JS are **relative** — none start with `/`. A small
inline script in `<head>` computes the site root at runtime and installs
`<base href="…">`:

* served at a domain root  → `base = /`
* served under `/VERN/`    → `base = /VERN/`

It works by scanning `location.pathname` for the first known section segment
(`library`, `tracks`, `tools`, `about`); everything before it is the site root.
This matters because `404.html` is served at varying depths (e.g.
`/VERN/library/fedora/`), where fixed relative paths would break.

`library-builder.js` and `library-catalog.js` read the same base and derive
`<base>data/library/{id}.json` from it. Nothing is hardcoded, so the repo can be
renamed or moved to a custom domain with no code change.

## Local server

```bash
./scripts/start-dev.sh            # http://127.0.0.1:5500/
./scripts/start-dev.sh 5510       # custom port
python3 scripts/diagnose.py       # which server owns port 5500?
```

In VS Code: **Terminal → Run Task… → `VΞRN Dev Server`**. Python 3 only — no
Node, no npm.

### DO NOT use VS Code Live Server / Live Preview for VΞRN. Use `scripts/start-dev.sh`.

A Library resource has no HTML file of its own. `/library/fedora/` is a
*rewritten route*, not a directory. Plain static servers answer
`Cannot GET /library/fedora/` or `Not found: /library/fedora`. That is a
limitation of those servers — never a reason to create per-resource HTML.

The dev server is a convenience only: the published site does not need it.

## Regenerating the static shells

`scripts/build-pages.py` regenerates the HTML pages so navbar and footer stay
identical everywhere. Optional — the generated files are committed.

## Language guard (`scripts/check-language.js`)

A read-only check that looks for French text in what a visitor would see. It runs the real
`assets/js/library-builder.js` over every Library resource in a minimal DOM (Node's standard
library only: `fs`, `path`, `vm`, `crypto`), then examines the rendered text, the section labels
produced by `SECTION_TITLES` and `humanize()`, the Tracks data, the fixed text of the seven HTML pages, and the
display strings (`text`, `label`, `title`, `placeholder`, `aria-label`, `emptyMessage`, `error`,
`heading`) of the six interface scripts. The dev tools under `scripts/` and the Markdown files are
not part of what a visitor sees, so they are not scanned. Nothing is written: the tool hashes the
137 files it reads before and after, and reports a mismatch instead of staying quiet.

```bash
node scripts/check-language.js                    # 110 resources, no options needed
node scripts/check-language.js --titles           # also the section-label register
node scripts/check-language.js --only debian      # one resource
node scripts/check-language.js --help             # options and documented limits
```

| State | Exit code | Meaning |
| --- | --- | --- |
| `CONFORME` | 0 | every target rendered, no French marker found |
| `DETECTION` | 1 | at least one string carries a French marker; the line shows the file, the key or the page, and the rule that fired |
| `NON_CONCLUANT` | 2 | missing or unreadable input, a diverging `LIBRARY_RESOURCES` list, a page that failed to render, a label table whose size no longer matches, an unexpected exception |

An incomplete run is never reported as `CONFORME`.

Procedure before a review of changes:

1. run `node scripts/check-language.js --titles` from the repository root;
2. on `DETECTION`, read the context of each line. Fix the wording in `data/library/<id>.json` or add
   one `SECTION_TITLES` entry — never rename a `content` key to hide a heading (see *Section
   headings* above);
3. on `NON_CONCLUANT`, repair the coverage first: the exit code says the check did not happen;
4. `CONFORME` is a text check, not a visual one, and not a proof that no French exists anywhere in
   the repository. Documentation and workshop scripts may hold French, and a French sentence built
   only from words English shares (`Filtrer les ressources`) is not detected — the lexicon needs an
   unambiguous word, an accent or an elision. Section labels are checked more strictly than prose,
   because they are a curated register where no accented proper name is expected.

Optional arguments: `--expect-titles N` (label-table size the check insists on, default 40),
`--approved-csv FILE` (compare the table with an approved register; asking for it and not finding it
gives `NON_CONCLUANT`), `--dom DIR` (read a rendered-text sweep), `--json FILE` (machine output — the
one write the tool can perform, and it is refused with `NON_CONCLUANT` if the path points inside the
repository), `--root DIR` (check another tree, used by the test campaigns).

Periodic complement, not a replacement: a browser sweep of the running site reads what
`library-catalog.js` and the Tracks widget produce at execution time. The hardened sweep used in
phases 110-112 lives at `research/verify/phase111/p111_sweep_dom.sh`; feed its output to
`node scripts/check-language.js --dom <dir>`. It needs the local server and a browser, so it is run
occasionally, while the check above is the one for every review.
