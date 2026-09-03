#!/usr/bin/env python3
"""Generates the static HTML shells so navbar/footer stay identical everywhere.
Output files are plain static HTML committed to the repo; this script is a local
authoring convenience only and is never needed at runtime."""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DISCORD = "https://discord.gg/dcFYVAqVs"

NAV = [("Tracks", "/tracks/"), ("Library", "/library/"),
       ("Tools", "/tools/"), ("About", "/about/")]


def brand(href="/"):
    return (f'<a class="brand" href="{href}">'
            f'<span class="brand__mark" aria-hidden="true">&gt;_</span>'
            f'<span class="brand__name">V\u039eRN</span></a>')


DISCORD_BTN = (f'<a class="btn btn--accent" href="{DISCORD}" rel="noopener noreferrer">'
               f'Discord</a>')


def header(current):
    items = "\n".join(
        f'            <li><a href="{href}"{" aria-current=\"page\"" if href == current else ""}>{label}</a></li>'
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
    <div class="site-footer__top">
      {brand()}
      <p class="site-footer__tagline">Learn &rarr; Explore &rarr; Build</p>
    </div>
    <div class="site-footer__grid">
      <section class="footer-col">
        <h2>Explore</h2>
        <ul>
          <li><a href="/tracks/">Tracks</a></li>
          <li><a href="/library/">Library</a></li>
          <li><a href="/tools/">Tools</a></li>
        </ul>
      </section>
      <section class="footer-col">
        <h2>Project</h2>
        <ul>
          <li><a href="/about/">About</a></li>
          <li><a href="{DISCORD}" rel="noopener noreferrer">Discord</a></li>
        </ul>
      </section>
    </div>
    <div class="site-footer__base">
      <p>&copy; V\u039eRN</p>
      <p class="site-footer__note">Independent knowledge platform</p>
    </div>
  </div>
</footer>'''

HEAD = '''<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="color-scheme" content="dark light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/assets/css/vern.css">
</head>
<body>
<a class="skip-link" href="#{mount}">Skip to content</a>
'''

TAIL = '''
<script src="/assets/js/vern-ui.js"></script>
{scripts}</body>
</html>
'''


def page(path, title, current, body, mount="main", scripts=""):
    html = (HEAD.format(title=title, mount=mount)
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
      <li><a class="card card--link" href="/library/">
        <h3 class="card__title">Library</h3>
        <p class="card__text">Reference resources built from <span class="mono">data/library/*.json</span>.</p>
      </a></li>
      <li><a class="card card--link" href="/tracks/">
        <h3 class="card__title">Tracks</h3>
        <p class="card__text">No content yet.</p>
      </a></li>
      <li><a class="card card--link" href="/tools/">
        <h3 class="card__title">Tools</h3>
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

RESOURCE_SHELL = '''<!-- Generic mount point. All content is built by the Library Builder from JSON. -->
<main id="library-resource" class="wrap page"></main>'''


def main():
    page("index.html", "V\u039eRN", "/", HOME)
    page("tracks/index.html", "Tracks \u2014 V\u039eRN", "/tracks/", placeholder("Tracks"))
    page("tools/index.html", "Tools \u2014 V\u039eRN", "/tools/", placeholder("Tools"))
    page("about/index.html", "About \u2014 V\u039eRN", "/about/", placeholder("About"))
    page("library/index.html", "Library \u2014 V\u039eRN", "/library/", LIBRARY_INDEX,
         scripts='<script src="/assets/js/library-catalog.js"></script>\n')
    # 404.html is the single generic shell: real 404 page, GitHub Pages
    # fallback for /library/{id}/, and Cloudflare rewrite target.
    page("404.html", "Library \u2014 V\u039eRN", "/library/", RESOURCE_SHELL,
         mount="library-resource",
         scripts='<script src="/assets/js/library-builder.js"></script>\n')


if __name__ == "__main__":
    main()
