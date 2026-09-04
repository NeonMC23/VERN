# VΞRN

VΞRN is a static, self-hosted knowledge site about technology: operating systems, desktop environments, protocols, tools and the concepts around them. It documents rather than advertises.

The project follows one idea:

```
Learn → Explore → Build
```

Three pillars carry it:

| Pillar | Purpose | Status |
| --- | --- | --- |
| **TRACKS** | Guided learning paths through a subject. | Page exists, content not written yet. |
| **LIBRARY** | Reference documentation, one entry per technology. | Implemented and JSON-driven. |
| **TOOLS** | Practical utilities and resources. | Page exists, content not written yet. |

Only the Library is functionally implemented. Tracks and Tools are placeholder pages.

---

## 2. Project architecture

```
/
├── index.html              # Home
├── tracks/index.html       # Tracks (placeholder)
├── library/index.html      # Library catalog — the ONLY file in library/
├── tools/index.html        # Tools (placeholder)
├── about/index.html        # About (placeholder)
├── assets/
│   ├── css/vern.css        # Entire design system, single stylesheet
│   └── js/
│       ├── vern-ui.js          # Nav toggle, theme toggle, header scroll state
│       ├── library-catalog.js  # Renders /library/ from LIBRARY_RESOURCES
│       └── library-builder.js  # Generic renderer for /library/{id}/
├── data/
│   └── library/*.json      # Library source of truth, one file per resource
├── scripts/
│   ├── dev-server.py       # Official local dev server (dynamic routing)
│   ├── start-dev.sh        # Convenience wrapper
│   ├── build-pages.py      # Generates the 6 static HTML pages
│   └── diagnose.py         # Environment/route diagnostics
├── 404.html                # Real 404 + fallback shell for /library/{id}/
├── _redirects              # Cloudflare Pages routing rule
├── .nojekyll               # Disables Jekyll processing on GitHub Pages
└── README.md
```

Important: **the six HTML pages are generated.** Edit `scripts/build-pages.py` and re-run it; do not hand-edit `index.html`, `tracks/index.html`, `library/index.html`, `tools/index.html`, `about/index.html` or `404.html`.

```bash
python3 scripts/build-pages.py
```

The site is:

- **static** — plain files, no server-side execution
- **vanilla** — HTML, CSS and ES5-compatible JavaScript, no framework, no build step, no npm
- **JSON-driven** — Library content lives in JSON, never in markup
- **no backend, no database, no accounts, no authentication**
- **no telemetry, no analytics**
- **no localStorage, no sessionStorage** — nothing is persisted client-side
- **no icon library and no CDN-hosted JavaScript** — icons are inline SVG
- typography is limited to **Inter and JetBrains Mono**, loaded from Google Fonts (the only external request the site makes); the CSS declares system fallbacks, so the layout holds if it is blocked

---

## 3. Library architecture

This is the core design of the project.

```
data/library/{id}.json        JSON = source of truth
        ↓
assets/js/library-builder.js  generic JavaScript builder
        ↓
dynamic DOM                   built with createElement / textContent
        ↓
/library/{id}/                dynamic route
```

A Library resource has **no HTML file of its own**. This file:

```
data/library/fedora.json
```

produces this route:

```
/library/fedora/
```

entirely through the generic builder.

### Never create per-resource HTML

```
library/fedora/index.html     ← MUST NEVER BE CREATED
library/{anything}/index.html ← MUST NEVER BE CREATED
```

`library/` contains exactly one file, `index.html`, which is the catalog page. Creating a per-resource HTML file would fork the source of truth and break the model.

### How the route resolves

`/library/{id}/` is not a directory. It is resolved at request time:

| Environment | Mechanism |
| --- | --- |
| Local | `scripts/dev-server.py` matches the route and serves `404.html` as the shell |
| GitHub Pages | Unknown paths fall back to root `404.html` (URL preserved, HTTP status 404) |
| Cloudflare Pages | `_redirects`: `/library/:id/ → /404.html 200` |

In all three cases the same shell loads `library-builder.js`, which reads the resource ID from `location.pathname`, fetches the matching JSON and builds the page.

### The builder is generic

`library-builder.js` contains **zero resource-specific logic**. There is no `if (id === "fedora")`, no `renderFedora()`, no per-resource branch. It renders by *shape*: strings become paragraphs, short string arrays become pills, longer ones become bullet lists, objects become nested sub-sections, arrays of objects become repeated blocks. Any schema-conformant document therefore renders without touching the code.

Data is inserted with `createElement` and `textContent` only — never `innerHTML` — so JSON content cannot inject markup.

---

## 3b. Catalog search, filters and sorting

`/library/` loads the JSON of every ID declared in `LIBRARY_RESOURCES` **once**, keeps the parsed documents in an in-memory array for the page session, and runs search, filtering and sorting entirely against that array. No network request is made while typing, and **no index file is generated** — `data/library/*.json` remains the only source of truth.

- **Search** matches `name`, `summary`, `tags`, `type`, `status`, `license`, `platforms` and the `content` body. Matching is case- and diacritic-insensitive, and each token must match the **start of a word**, so `secur` finds "security" while `test` does not match "lightest". Multiple words are combined with AND.
- **Filters** (Type, Status, Tags, Platforms, License) are generated from the loaded dataset, so an option only appears when some resource actually uses it. Logic is **OR within a category, AND between categories**.
- **Sorting**: default (the `LIBRARY_RESOURCES` order), name A→Z / Z→A, and recently / oldest verified using the real `last_verified` field.
- The filter panel is **collapsed by default**, toggled by a `Filters` button that carries `aria-expanded` and `aria-controls`. State is in-memory only: no localStorage, sessionStorage or cookies.

### Type accents

Each card derives a subtle secondary colour from its `type` through a small `TYPE_ACCENTS` map in `library-catalog.js`, applied only to the type badge and a 2px card edge. Unknown or newly added schema types fall back to a neutral grey with no code change required. This is a **presentation mapping only** — it never affects how content is rendered, and VΞRN pink remains the sole brand/interaction colour.

## 4. Adding a Library resource

### Step 1 — create the JSON

```
data/library/firefox.json
```

The filename must equal the `id` field inside the file.

### Step 2 — add the ID to the catalog list

In `assets/js/library-catalog.js`:

```js
var LIBRARY_RESOURCES = [
  "fedora",
  "firefox"
];
```

### Step 3 — test locally

```bash
./scripts/start-dev.sh
```

Then open `http://127.0.0.1:5500/library/firefox/` and `http://127.0.0.1:5500/library/`.

### Step 4 — commit and push

That is the whole workflow.

- the JSON is the source of truth
- `LIBRARY_RESOURCES` contains **IDs only** — never titles, summaries or content
- **no HTML file** is needed
- **no resource-specific JavaScript** is needed
- **no build step** is required (`build-pages.py` only matters if you changed the page shell)
- **no GitHub Action** is required

### The catalog list does not control routing

`LIBRARY_RESOURCES` decides only what appears on `/library/`. The direct route resolves from the JSON alone: if `data/library/firefox.json` exists, `/library/firefox/` works even when the ID is absent from the list. The builder never consults the catalog.

---

## 5. Library JSON schema

### Required fields

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Must match the filename and `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| `name` | string | Display name |
| `type` | string | One of the allowed types in section 7 |
| `summary` | string | One or two sentences |
| `tags` | string[] | Short keywords |
| `status` | string | e.g. `active`, `maintained`, `experimental`, `discontinued` |
| `content` | object | The documentation body; keys become sections |
| `sources` | array | Where the information comes from |
| `last_verified` | string | `YYYY-MM-DD` |

A document missing any required field is rejected by the builder with a visible error instead of rendering half a page.

### Optional fields

| Field | Type | Rendered as |
| --- | --- | --- |
| `platforms` | string[] | Metadata badge in the header |
| `license` | string | Metadata badge in the header |
| `components` | array | "Components" section — reference cards |
| `relations` | array | "Related / Alternatives" section — reference cards |
| `variants` | array | "Variants" section — one block per variant |
| `links` | object or array | "Links" section |
| `articles` | array | "Articles" section |

Keys inside `content` are free-form: any key becomes a section, its name humanised (`who_is_it_for` → "Who is it for?"). Common ones are `introduction`, `what_is_it`, `how_does_it_work`, `advantages`, `disadvantages`, `who_is_it_for`, `who_is_it_not_for`, `verdict`.

Unknown *top-level* fields are also rendered generically as an extra section, so the schema degrades gracefully rather than dropping data.

---

## 6. Complete JSON example

```json
{
  "id": "example-resource",
  "name": "Example Resource",
  "type": "technology",
  "summary": "A short, neutral description of what this technology is and what it is used for.",
  "tags": ["example", "documentation"],
  "status": "active",
  "platforms": ["Linux", "Windows", "macOS"],
  "license": "Apache-2.0",
  "content": {
    "introduction": "An opening paragraph.\n\nA blank line starts a new paragraph.",
    "what_is_it": "A plain-language explanation aimed at a reader who has never met this technology.",
    "how_does_it_work": {
      "overview": "Nested objects become sub-sections.",
      "steps": ["First step", "Second step", "Third step"]
    },
    "advantages": ["Well documented", "Widely supported"],
    "disadvantages": ["Steep learning curve"],
    "who_is_it_for": ["Developers evaluating the schema"],
    "who_is_it_not_for": ["Readers wanting a tutorial"],
    "verdict": "A short, contextual conclusion rather than a recommendation."
  },
  "components": [
    { "id": "other-resource", "name": "Other Resource", "role": "library" }
  ],
  "relations": [
    { "id": "some-alternative", "name": "Some Alternative", "relation": "alternative" }
  ],
  "links": {
    "homepage": "https://example.org/",
    "documentation": "https://example.org/docs"
  },
  "sources": [
    {
      "title": "Official documentation",
      "url": "https://example.org/docs",
      "type": "documentation"
    }
  ],
  "last_verified": "2026-09-04"
}
```

---

## 7. Allowed resource types

```
operating_system      distribution          desktop_environment
window_manager        kernel                package_manager
package_format        init_system           filesystem
display_protocol      protocol              technology
application           service               library
framework             hardware              security_technology
privacy_technology    concept               project
repository
```

---

## 8. Editorial rules

Library content must be:

- **beginner-readable** — assume no prior knowledge of the subject
- **accurate** — verifiable against the cited sources
- **neutral** — document, do not advertise; no marketing tone
- free of **unnecessary repetition**
- free of **unexplained jargon** — define a term the first time it appears
- **balanced** — real advantages *and* real disadvantages
- **contextual** — conclusions explain *for whom* and *when*, instead of declaring a winner

Conceptual precision matters:

- **privacy and security are different concepts** and must not be conflated
- **open source does not automatically mean private or secure**
- **anonymity is a separate concept** from both privacy and security

### Source hierarchy

Prefer sources in this order:

1. official documentation
2. official repositories and specifications
3. academic sources
4. audits and security research
5. reputable technical organisations
6. reputable journalism
7. community sources, where appropriate and identified as such

---

## 9. Components and relations

Both fields reference **other Library resources by ID**:

```json
"components": [
  { "id": "test-desktop", "name": "Test Desktop", "role": "desktop_environment" }
],
"relations": [
  { "id": "test-tool", "name": "Test Tool", "relation": "alternative" }
]
```

`role`, `type`, `relation` and `note` are optional qualifiers shown on the card. Relation types are rendered **generically** — the humanised value is displayed as-is, so `based_on` shows "Based on". Adding a new relation type requires no code change.

**Never duplicate the referenced resource's documentation.** A reference is a pointer, not a copy.

### When a referenced ID does not exist

The builder verifies each reference by fetching its JSON. If the file is absent:

- the builder **does not invent a resource**
- the card is **downgraded to inert, non-clickable text** (marked "Not documented yet")
- **rendering continues normally** — a dangling reference is never an error

This is deliberate: a resource may legitimately name components that have not been documented yet.

---

## 10. Local development

Start the project's own server:

```bash
./scripts/start-dev.sh          # defaults to port 5500
python3 scripts/dev-server.py 5500 --host 0.0.0.0   # equivalent, LAN-accessible
```

Then open:

```
http://127.0.0.1:5500/
```

Diagnostics:

```bash
python3 scripts/diagnose.py 5500
```

### Do not use VS Code Live Server / Live Preview for Library routes

```
/library/fedora/
```

is a **dynamic route with no physical directory**. Live Server and Live Preview only serve files that exist on disk, so they return "Not found" for every resource route. `scripts/dev-server.py` reproduces the production fallback and is the authoritative local environment. Live Server is fine for the static pages, but it is not a project dependency and must never be required.

If `./scripts/start-dev.sh` reports "Permission denied", restore the executable bit:

```bash
chmod +x scripts/start-dev.sh scripts/dev-server.py scripts/diagnose.py
```

---

## 11. GitHub Pages deployment

The site is deployed as a **project page**:

```
https://neonmc23.github.io/VERN/
```

### Base path handling

Because the site lives under `/VERN/` rather than a domain root, root-relative URLs such as `/assets/css/vern.css` would break. The project therefore contains **no hardcoded `/VERN/`**.

Instead, a small inline bootstrap in every `<head>`, before any `<link>` or `<script>`, inspects `location.pathname`, determines the site root, and injects a matching `<base href>`. All other URLs in the project are relative. Both JavaScript modules derive their data paths from that same `<base>`.

The result works unchanged at a domain root, under `/VERN/`, and on localhost.

### Dynamic route fallback

GitHub Pages supports neither redirects nor custom headers. The only available mechanism is the root `404.html`, which it serves for any unmatched path. VΞRN uses it as the shell for `/library/{id}/`: the browser keeps the requested URL, so the builder can read the ID and render the resource.

Note the trade-off: the response carries **HTTP status 404**, so resource routes are not indexed by search engines. This is a platform limitation, not a bug. Cloudflare Pages does not have it — `_redirects` maps the same route with status 200.

---

## 12. Development principles

- vanilla static site — HTML, CSS, JavaScript
- no framework (no React, Vue, Svelte, Next, Astro, Tailwind, Bootstrap)
- no backend, no database, no account system, no authentication
- no telemetry, no analytics
- no localStorage, no sessionStorage
- no Node/npm dependency, no mandatory build step, no GitHub Actions
- JSON-first Library: content never lives in markup
- one generic renderer, never per-resource code
- minimal dependencies and minimal files — reuse before adding
- no icon library, no CDN-hosted script; the webfonts are the single external request
- preserve accessibility: semantic HTML, keyboard navigation, visible focus, `prefers-reduced-motion`
- preserve responsive design across desktop, tablet and mobile

---

## Development test fixtures

`data/library/` contains six files prefixed `test-`:

| ID | Exercises |
| --- | --- |
| `test-tool` | Minimal valid resource — required fields only |
| `test-linux` | Multiple `components` pointing at existing resources |
| `test-framework` | Multiple `relations` with varied relation types |
| `test-project` | Rich nested content, arrays, pros/cons, audience, verdict, articles |
| `test-desktop` | Optional fields: `platforms`, `license`, `variants`, `links`, `articles` |
| `test-network` | Missing references that must remain inert |

These are **development fixtures, not real technologies**, and are tagged `test-fixture`. They exist to verify the renderer against varied document shapes. Removing them requires deleting the files and their IDs from `LIBRARY_RESOURCES` — nothing else.
