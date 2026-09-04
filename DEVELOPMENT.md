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

No HTML file, no builder change, no build step, no GitHub Action.

Step 2 is only what makes the resource appear on `/library/`. It is **not**
required for routing: `/library/firefox/` works the moment
`data/library/firefox.json` exists.

The list holds **ids only** — never documentation. Every value shown on a
catalog card is read from that resource's own JSON at runtime.

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
