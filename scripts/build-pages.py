#!/usr/bin/env python3
"""Generates the static HTML shells so navbar/footer stay identical everywhere.
Output files are plain static HTML committed to the repo; this script is a local
authoring convenience only and is never needed at runtime.

BASE PATH
---------
Every URL emitted here is RELATIVE (no leading slash). A tiny inline bootstrap
in <head> computes the site root at runtime and installs <base href="...">, so
the same files work at a domain root and under a project subpath such as
/VERN/. Nothing is hardcoded.
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISCORD = "https://discord.gg/dcFYVAqVs"
GITHUB = "https://github.com/neonmc23/VERN"

# Top-level sections of the site. Used by the runtime base detection: whatever
# precedes one of these segments in the URL is the site root.
SECTIONS = ["library", "tracks", "tools", "about"]

NAV = [("Tracks", "tracks/"), ("Library", "library/"),
       ("Tools", "tools/"), ("About", "about/")]


def brand(href="", extra=""):
    """`>_ VΞRN`. The underscore is its own element so the cursor can blink
    between `>_` and `>` — no other character is ever introduced."""
    cls = "brand" + (" " + extra if extra else "")
    return (f'<a class="{cls}" href="{href}">'
            f'<span class="brand__mark" aria-hidden="true">'
            f'<span class="brand__chevron">&gt;</span>'
            f'<span class="brand__cursor">_</span>'
            f'</span>'
            f'<span class="brand__name">V\u039eRN</span></a>')


# Discord wordmark glyph, inlined (no CDN, no icon library, no image request).
# aria-hidden: the adjacent "Discord" label already names the link.
DISCORD_ICON = ('<svg class="btn__icon" viewBox="-0.6 -0.8 25.2 19.6" aria-hidden="true" focusable="false">'
                '<path fill="currentColor" d="M20.317 1.492A19.79 19.79 0 0 0 15.432 0a13.9 13.9 0 0 0-.63 1.28'
                'a18.3 18.3 0 0 0-5.606 0A13 13 0 0 0 8.56 0a19.7 19.7 0 0 0-4.886 1.496C.567 6.093-.32 10.575.124 14.994'
                'a19.9 19.9 0 0 0 6.002 3.03 14.4 14.4 0 0 0 1.285-2.077 13 13 0 0 1-2.023-.966c.17-.123.335-.25.495-.374'
                'a14.2 14.2 0 0 0 12.234 0c.162.132.327.259.494.374a13 13 0 0 1-2.027.968 14.3 14.3 0 0 0 1.286 2.075'
                'a19.9 19.9 0 0 0 6.005-3.029c.522-5.124-.892-9.565-3.558-13.503M8.02 12.276c-1.183 0-2.157-1.069-2.157-2.38'
                'S6.816 7.513 8.02 7.513s2.176 1.078 2.156 2.382c0 1.312-.953 2.381-2.156 2.381m7.975 0c-1.183 0-2.157-1.069-2.157-2.38'
                's.952-2.383 2.157-2.383 2.174 1.078 2.153 2.382c0 1.312-.95 2.381-2.153 2.381"/>'
                '</svg>')

DISCORD_BTN = (f'<a class="btn btn--accent has-marker" href="{DISCORD}" rel="noopener noreferrer">'
               f'<span class="marker" aria-hidden="true">&gt;</span>'
               f'{DISCORD_ICON}'
               f'<span>Discord</span></a>')


def header(current):
    items = "\n".join(
        f'            <li><a class="has-marker" href="{href}"'
        + (' aria-current="page"' if href == current else "")
        + f'><span class="marker" aria-hidden="true">&gt;</span>'
        + f'<span>{label}</span></a></li>'
        for label, href in NAV)
    return f'''<header class="site-header">
  <div class="wrap site-header__inner">
    {brand()}
    <div class="nav-cluster">
      <div class="site-nav" id="site-nav">
        <nav aria-label="Main">
          <ul class="site-nav__list">
{items}
          </ul>
        </nav>
        <div class="site-nav__actions">
          {DISCORD_BTN}
        </div>
      </div>
      <button class="icon-btn" type="button" data-theme-toggle aria-pressed="false" aria-label="Switch to light theme">&#9728;</button>
      <button class="icon-btn nav-toggle" type="button" data-nav-toggle aria-expanded="false" aria-controls="site-nav" aria-label="Open navigation">&#9776;</button>
    </div>
  </div>
</header>'''


FOOTER = f'''<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__main">
      <div class="site-footer__identity">
        {brand()}
        <p class="site-footer__tagline">Learn &rarr; Explore &rarr; Build</p>
        <p class="site-footer__desc">An independent, open-source-oriented knowledge
        and learning platform. Static by design: no accounts, no tracking.</p>
      </div>
      <nav class="site-footer__nav" aria-label="Footer">
        <section class="footer-col">
          <h2>Explore</h2>
          <ul>
            <li><a href="tracks/">Tracks</a></li>
            <li><a href="library/">Library</a></li>
            <li><a href="tools/">Tools</a></li>
          </ul>
        </section>
        <section class="footer-col">
          <h2>Project</h2>
          <ul>
            <li><a href="about/">About</a></li>
            <li><a href="{GITHUB}" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="{DISCORD}" rel="noopener noreferrer">Discord</a></li>
          </ul>
        </section>
      </nav>
    </div>
    <div class="site-footer__base">
      <p>&copy; 2026 V\u039eRN</p>
      <p class="site-footer__note">Independent open-source project</p>
    </div>
  </div>
</footer>'''

# Runs before any relative URL is resolved. Keeps the site portable between
# https://host/ and https://host/VERN/ without hardcoding either.
BASE_BOOTSTRAP = '''<script>
(function () {
  var SECTIONS = %s;
  var parts = location.pathname.split("/");
  var base = location.pathname.replace(/[^/]*$/, "");
  for (var i = 1; i < parts.length; i++) {
    if (SECTIONS.indexOf(parts[i]) !== -1) { base = parts.slice(0, i).join("/") + "/"; break; }
  }
  var el = document.createElement("base");
  el.setAttribute("href", base);
  document.head.appendChild(el);
  // Favicon emitted here, with the base already applied, because the browser's
  // preload scanner resolves <link rel="icon"> against the DOCUMENT url, not
  // the injected <base>. On a deep route such as /VERN/library/fedora/ a plain
  // relative href would be requested as .../library/fedora/assets/icon/icon.png.
  var icon = document.createElement("link");
  icon.setAttribute("rel", "icon");
  icon.setAttribute("type", "image/png");
  icon.setAttribute("href", base + "assets/icon/icon.png");
  document.head.appendChild(icon);
})();
</script>''' % str(SECTIONS).replace("'", '"')

HEAD = '''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="color-scheme" content="dark light">
__BASE_BOOTSTRAP__
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="assets/css/vern.css">
</head>
<body>
<a class="skip-link" href="#{mount}">Skip to content</a>
'''

TAIL = '''
<script src="assets/js/vern-ui.js"></script>
{scripts}</body>
</html>
'''


def page(path, title, current, body, mount="main", scripts="", skip=None):
    # `skip` overrides the skip-link target. The Tracks page uses the hash for
    # routing, so it must not emit href="#tracks-app" (the router would read
    # that as a track id and show "Track not found").
    html = (HEAD.format(title=title, mount=(skip if skip is not None else mount))
            .replace("__BASE_BOOTSTRAP__", BASE_BOOTSTRAP)
            + header(current) + "\n"
            + body + "\n"
            + FOOTER
            + TAIL.format(scripts=scripts))
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full) or ".", exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(html)
    print("wrote", path)


def placeholder(title):
    return f'''<main id="main">
  <div class="wrap page stack">
    <div>
      <p class="eyebrow">V\u039eRN</p>
      <h1 class="page-title">{title}</h1>
    </div>
    <p class="note">This section has no content yet.</p>
  </div>
</main>'''


HOME = '''<main id="main">
  <div class="wrap page stack">
    <div>
      <p class="eyebrow">Learn &rarr; Explore &rarr; Build</p>
      <h1 class="page-title">V\u039eRN</h1>
      <p class="lede">A static, data-driven knowledge base. Library content is stored as JSON and rendered client-side.</p>
    </div>
    <ul class="cards">
      <li><a class="card card--link" href="library/">
        <h3 class="card__title"><span class="marker" aria-hidden="true">&gt;</span>Library</h3>
        <p class="card__text">Reference resources built from <span class="mono">data/library/*.json</span>.</p>
      </a></li>
      <li><a class="card card--link" href="tracks/">
        <h3 class="card__title"><span class="marker" aria-hidden="true">&gt;</span>Tracks</h3>
        <p class="card__text">No content yet.</p>
      </a></li>
      <li><a class="card card--link" href="tools/">
        <h3 class="card__title"><span class="marker" aria-hidden="true">&gt;</span>Tools</h3>
        <p class="card__text">No content yet.</p>
      </a></li>
    </ul>
  </div>
</main>'''

LIBRARY_INDEX = '''<main id="main">
  <div class="wrap page stack">
    <div>
      <p class="eyebrow">Library</p>
      <h1 class="page-title">Library</h1>
      <p class="lede">Resources are stored in <span class="mono">data/library/*.json</span>, the single source of truth.</p>
    </div>
    <div id="library-catalog"></div>
  </div>
</main>'''

TRACKS_INDEX = '''<!-- Generic mount point. Every Tracks view is built by the
     Tracks app from data/tracks/*.json — no per-Track or per-Lesson HTML. -->
<a id="tracks-top" tabindex="-1"></a>
<main id="tracks-app" class="tracks-app">
  <div class="wrap page stack">
    <p class="status">Loading Tracks\u2026</p>
  </div>
</main>'''

RESOURCE_SHELL = '''<!-- Generic mount point. All content is built by the Library Builder from JSON. -->
<main id="library-resource" class="wrap page"></main>'''


def main():
    page("index.html", "V\u039eRN", "", HOME)
    page("tracks/index.html", "Tracks \u2014 V\u039eRN", "tracks/", TRACKS_INDEX,
         mount="tracks-app", skip="tracks-top",
         scripts='<script src="assets/js/tracks/tracks-router.js"></script>\n'
                 '<script src="assets/js/tracks/tracks-data.js"></script>\n'
                 '<script src="assets/js/tracks/tracks-renderer.js"></script>\n'
                 '<script src="assets/js/tracks/tracks-app.js"></script>\n')
    page("tools/index.html", "Tools \u2014 V\u039eRN", "tools/", placeholder("Tools"))
    page("about/index.html", "About \u2014 V\u039eRN", "about/", placeholder("About"))
    page("library/index.html", "Library \u2014 V\u039eRN", "library/", LIBRARY_INDEX,
         scripts='<script src="assets/js/library-catalog.js"></script>\n')
    # 404.html is the single generic shell: real 404 page, GitHub Pages
    # fallback for /library/{id}/, and Cloudflare rewrite target.
    page("404.html", "Library \u2014 V\u039eRN", "library/", RESOURCE_SHELL,
         mount="library-resource",
         scripts='<script src="assets/js/library-builder.js"></script>\n')


if __name__ == "__main__":
    main()
