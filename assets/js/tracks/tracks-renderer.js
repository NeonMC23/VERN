/* VΞRN — Tracks renderer (MTrack1)
 *
 * Single responsibility: state + data -> DOM. No fetching, no routing.
 *
 * Everything is built with createElement / textContent. JSON values are always
 * treated as data, never as markup: innerHTML is never used.
 *
 * The lesson renderer dispatches on block.type only. There is deliberately no
 * per-track or per-lesson branch anywhere in this file.
 */
window.VernTracksRenderer = (function () {
  "use strict";

  /* ------------------------------------------------------------ hash hrefs
   * A bare "#id" href is resolved by the browser against <base href> — which
   * the site sets to the ROOT (e.g. /VERN/) — not against the current page.
   * On /VERN/tracks/ that turned "#programming" into /VERN/#programming.
   * Prefixing with the Tracks page URL keeps every link on /tracks/ and works
   * unchanged at a domain root and under a project subpath.
   */
  function siteBase() {
    var b = document.querySelector("base");
    if (b) return new URL(b.getAttribute("href"), location.href).pathname;
    return location.pathname.replace(/[^/]*$/, "");
  }

  var TRACKS_URL = siteBase() + "tracks/";

  // hash: "" -> the Tracks view, "programming", or "programming/variables".
  function trackHref(hash) {
    return TRACKS_URL + "#" + hash;
  }

  function el(tag, opts) {
    var n = document.createElement(tag);
    opts = opts || {};
    if (opts.text != null) n.textContent = String(opts.text);
    if (opts.className) n.className = opts.className;
    if (opts.attrs) {
      Object.keys(opts.attrs).forEach(function (k) { n.setAttribute(k, String(opts.attrs[k])); });
    }
    (opts.children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function isStr(v) { return typeof v === "string" && v.trim() !== ""; }

  // Every view exposes exactly one <h1 tabindex="-1"> so focus can move to it.
  function pageTitle(text) {
    return el("h1", { className: "page-title", text: text, attrs: { tabindex: "-1" } });
  }

  // `hash` is a bare route value ("" | "trackId" | "trackId/lessonId").
  function backLink(hash, label) {
    return el("p", {
      children: [el("a", { className: "tracks-back", attrs: { href: trackHref(hash) }, text: "\u2190 " + label })]
    });
  }

  /* -------------------------------------------------------------- D1: URLs
   * Frozen policy (design doc §9). Stricter than the Library helper: only
   * https is allowed, plus http on localhost for development. Everything else
   * — javascript:, data:, blob:, vbscript:, protocol-relative "//" — is
   * rejected. Parsing is delegated to the URL constructor so that tricks such
   * as "java\tscript:" or leading control characters cannot slip through a
   * regex.
   */
  function safeUrl(value) {
    if (!isStr(value)) return null;
    var raw = value.trim();
    if (/^\/\//.test(raw)) return null;            // protocol-relative
    var u;
    try { u = new URL(raw, document.baseURI); } catch (e) { return null; }
    if (u.protocol === "https:") return u.href;
    if (u.protocol === "http:" &&
        (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")) {
      return u.href;
    }
    return null;
  }

  /* ----------------------------------------------------------- D1: inline
   * The closed union is exactly: string | inline_code | strong | emphasis |
   * link. One reusable renderer, used by every widget that accepts inline
   * content. Inline data is never interpreted as markup.
   */
  var INLINE_TAG = { inline_code: "code", strong: "strong", emphasis: "em" };

  function inlineNode(item) {
    if (typeof item === "string") {
      return item === "" ? null : document.createTextNode(item);
    }
    if (!item || typeof item !== "object") return null;
    if (!isStr(item.text)) return null;             // missing/non-string text -> skip

    if (item.type === "link") {
      var href = safeUrl(item.href);
      // Invalid URL degrades to plain text so the sentence stays readable.
      if (!href) return document.createTextNode(item.text);
      return el("a", {
        text: item.text,
        attrs: { href: href, rel: "noopener noreferrer" }
      });
    }

    var tag = INLINE_TAG[item.type];
    // Unknown inline type with valid text -> plain text (forward compatible).
    if (!tag) return document.createTextNode(item.text);
    return el(tag, { text: item.text });
  }

  // Accepts a plain string or an inline array; returns a DocumentFragment.
  // One inline array renders exactly one paragraph's worth of content.
  function inlineFrag(value) {
    var frag = document.createDocumentFragment();
    if (isStr(value)) {
      frag.appendChild(document.createTextNode(value));
      return frag;
    }
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        var n = inlineNode(item);
        if (n) frag.appendChild(n);
      });
    }
    return frag;
  }

  function hasInline(value) {
    return isStr(value) || (Array.isArray(value) && inlineFrag(value).childNodes.length > 0);
  }

  // Appends inline content into `parent`; returns true when anything was added.
  function appendInline(parent, value) {
    var frag = inlineFrag(value);
    if (!frag.childNodes.length) return false;
    parent.appendChild(frag);
    return true;
  }

  /* ------------------------------------------------------------ transient */

  function loading(mount, message) {
    clear(mount);
    mount.setAttribute("aria-busy", "true");
    mount.appendChild(el("div", {
      className: "wrap page stack",
      children: [el("p", { className: "status", text: message })]
    }));
  }

  // `actions` is an optional list of { label, onClick } — real <button>s.
  function errorView(mount, title, detail, actions) {
    clear(mount);
    mount.removeAttribute("aria-busy");

    var box = el("div", { className: "error" });
    box.appendChild(pageTitle(title));
    if (detail) box.appendChild(el("p", { text: detail }));

    var row = el("p");
    (actions || []).forEach(function (a) {
      var b = el("button", { className: "btn btn--ghost", text: a.label, attrs: { type: "button" } });
      b.addEventListener("click", a.onClick);
      row.appendChild(b);
    });
    row.appendChild(el("a", { className: "tracks-back", attrs: { href: trackHref("") }, text: "\u2190 Back to Tracks" }));
    box.appendChild(row);

    mount.appendChild(el("div", { className: "wrap page stack", children: [box] }));
    return box.querySelector("h1");
  }

  /* ---------------------------------------------------------- tracks view */

  function tracksView(mount, tracks) {
    clear(mount);
    mount.removeAttribute("aria-busy");

    var head = el("div", {
      children: [
        el("p", { className: "eyebrow", text: "Learn \u2192 Explore \u2192 Build" }),
        pageTitle("Tracks"),
        el("p", { className: "lede", text: "Structured learning paths. Each track is a short sequence of lessons." })
      ]
    });

    var list = el("ul", { className: "cards" });
    tracks.forEach(function (t) {
      var a = el("a", { className: "card card--link", attrs: { href: trackHref(t.id) } });
      a.appendChild(el("h2", {
        className: "card__title",
        children: [
          el("span", { className: "marker", text: "\u003e", attrs: { "aria-hidden": "true" } }),
          document.createTextNode(t.name)
        ]
      }));
      if (isStr(t.description)) a.appendChild(el("p", { className: "card__text", text: t.description }));
      a.appendChild(el("ul", {
        className: "pill-row card__meta",
        children: [el("li", {
          children: [el("span", {
            className: "badge",
            text: t.lessons.length + (t.lessons.length === 1 ? " lesson" : " lessons")
          })]
        })]
      }));
      list.appendChild(el("li", { children: [a] }));
    });

    mount.appendChild(el("div", { className: "wrap page stack", children: [head, list] }));
    return head.querySelector("h1");
  }

  /* ----------------------------------------------------------- track view */

  function trackView(mount, track) {
    clear(mount);
    mount.removeAttribute("aria-busy");

    var head = el("div", {
      children: [
        backLink("", "Back to Tracks"),
        el("p", { className: "eyebrow", text: "Track" }),
        pageTitle(track.name),
        isStr(track.description) ? el("p", { className: "lede", text: track.description }) : null
      ].filter(Boolean)
    });

    var body;
    if (!track.lessons.length) {
      body = el("p", { className: "note", text: "This track has no lessons yet." });
    } else {
      body = el("ol", { className: "lesson-list" });
      track.lessons.forEach(function (l, i) {
        var a = el("a", {
          className: "lesson-item",
          attrs: { href: trackHref(track.id + "/" + l.id) }
        });
        a.appendChild(el("span", { className: "lesson-item__index", text: String(i + 1), attrs: { "aria-hidden": "true" } }));
        var textCol = el("span", { className: "lesson-item__body" });
        textCol.appendChild(el("span", { className: "lesson-item__title", text: l.title }));
        if (isStr(l.description)) {
          textCol.appendChild(el("span", { className: "lesson-item__desc", text: l.description }));
        }
        a.appendChild(textCol);
        a.appendChild(el("span", { className: "lesson-item__go", text: "\u003e", attrs: { "aria-hidden": "true" } }));
        body.appendChild(el("li", { children: [a] }));
      });
    }

    mount.appendChild(el("div", { className: "wrap page stack", children: [head, body] }));
    return head.querySelector("h1");
  }

  /* -------------------------------------------------- generic lesson blocks
   * Dispatch is on block.type only. Unknown types are skipped rather than
   * crashing, so new block types can be added to the data without breaking
   * an older renderer.
   */
  var BLOCKS = {
    heading: function (b) {
      return isStr(b.text) ? el("h2", { className: "block__title", text: b.text }) : null;
    },
    text: function (b) {
      var box = el("div", { className: "prose" });
      // Inline form (D1): one content array renders exactly one paragraph.
      if (Array.isArray(b.content)) {
        var p = el("p");
        if (!appendInline(p, b.content)) return null;
        box.appendChild(p);
        return box;
      }
      if (!isStr(b.text)) return null;
      String(b.text).split(/\n{2,}/).forEach(function (para) {
        if (para.trim()) box.appendChild(el("p", { text: para.trim() }));
      });
      return box.childNodes.length ? box : null;
    },
    code: function (b) {
      var source = isStr(b.code) ? b.code : (isStr(b.text) ? b.text : null);
      if (!source) return null;
      var code = el("code", { text: source });
      if (isStr(b.language)) code.setAttribute("data-language", b.language);
      var pre = el("pre", { className: "codeblock", children: [code] });
      // Scrollable regions must be reachable by keyboard.
      pre.setAttribute("tabindex", "0");
      pre.setAttribute("role", "group");
      pre.setAttribute("aria-label", isStr(b.language) ? b.language + " code example" : "Code example");
      return pre;
    },
    list: function (b) {
      // Items are a plain string or a D1 inline array.
      var items = Array.isArray(b.items) ? b.items.filter(hasInline) : [];
      if (!items.length) return null;
      var ul = el(b.ordered === true ? "ol" : "ul", { className: "bullets" });
      items.forEach(function (t) {
        var li = el("li");
        appendInline(li, t);
        ul.appendChild(li);
      });
      return ul;
    },

    /* --------------------------------------------------------- definition */
    definition: function (b) {
      var items = Array.isArray(b.items) ? b.items : [];
      var dl = el("dl", { className: "deflist" });
      items.forEach(function (it) {
        if (!it || typeof it !== "object") return;
        if (!hasInline(it.term) || !hasInline(it.definition)) return;
        var dt = el("dt");
        appendInline(dt, it.term);
        var dd = el("dd");
        appendInline(dd, it.definition);
        dl.appendChild(dt);
        dl.appendChild(dd);
      });
      return dl.childNodes.length ? dl : null;
    },

    /* -------------------------------------------------------------- table
     * caption and columns are plain strings; cells accept D1 inline arrays.
     * Rows whose length differs from columns.length are skipped so malformed
     * data can never silently misalign a comparison.
     */
    table: function (b) {
      var columns = Array.isArray(b.columns) ? b.columns.filter(isStr) : [];
      if (!columns.length || columns.length !== (b.columns || []).length) return null;
      var rows = Array.isArray(b.rows) ? b.rows : [];

      var table = el("table", { className: "data-table" });
      if (isStr(b.caption)) table.appendChild(el("caption", { text: b.caption }));

      var htr = el("tr");
      columns.forEach(function (c) {
        htr.appendChild(el("th", { text: c, attrs: { scope: "col" } }));
      });
      table.appendChild(el("thead", { children: [htr] }));

      var tbody = el("tbody");
      rows.forEach(function (row) {
        if (!Array.isArray(row) || row.length !== columns.length) return;  // skipped
        var tr = el("tr");
        row.forEach(function (cell) {
          var td = el("td");
          appendInline(td, cell);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      if (!tbody.childNodes.length) return null;
      table.appendChild(tbody);

      // Horizontally scrollable region must be keyboard reachable.
      var wrap = el("div", { className: "table-wrap", children: [table] });
      wrap.setAttribute("tabindex", "0");
      wrap.setAttribute("role", "group");
      wrap.setAttribute("aria-label", isStr(b.caption) ? b.caption : "Table");
      return wrap;
    },

    /* -------------------------------------------------------------- image */
    image: function (b) {
      var src = safeUrl(b.src);
      if (!src || !isStr(b.alt)) return null;      // both required

      var img = el("img", {
        attrs: { src: src, alt: b.alt, loading: "lazy", decoding: "async" }
      });
      var fig = el("figure", { className: "figure", children: [img] });

      // <figcaption> only when there is meaningful content.
      if (isStr(b.caption) || isStr(b.credit)) {
        var cap = el("figcaption");
        if (isStr(b.caption)) cap.appendChild(document.createTextNode(b.caption));
        if (isStr(b.credit)) {
          cap.appendChild(el("span", { className: "figure__credit", text: b.credit }));
        }
        fig.appendChild(cap);
      }
      return fig;
    }
  };

  /* ------------------------------------------------------- nesting tiers
   * Frozen tier model (design doc §8):
   *   Tier 0  lesson.content[]   -> any block
   *   Tier 1  containers         -> leaf blocks only
   *   Tier 2  leaf blocks
   * Containers dispatch through LEAF only, so container-in-container is
   * structurally impossible rather than merely discouraged. There is no
   * generic recursive DOM system here.
   */
  var LEAF = ["heading", "text", "list", "code", "definition", "image", "table"];

  function renderLeaf(block) {
    if (!block || typeof block !== "object") return null;
    if (LEAF.indexOf(block.type) === -1) return null;   // containers/exercises skipped
    return BLOCKS[block.type](block);
  }

  // Renders an array of leaf blocks into `parent`; returns the count appended.
  function appendLeaves(parent, blocks) {
    var n = 0;
    (Array.isArray(blocks) ? blocks : []).forEach(function (b) {
      var node = renderLeaf(b);
      if (node) { parent.appendChild(node); n++; }
    });
    return n;
  }

  /* --------------------------------------------------------- containers */

  var CALLOUT_VARIANTS = {
    note: "Note",
    tip: "Tip",
    warning: "Warning",
    "key-points": "Key points"
  };

  var CONTAINERS = {
    /* Variant is never conveyed by colour alone: a callout always carries a
     * visible text label, either the author's title or the variant name.
     * Not role="alert" — it is not a live region.
     */
    callout: function (b) {
      var variant = CALLOUT_VARIANTS[b.variant] ? b.variant : "note";
      var aside = el("aside", { className: "callout callout--" + variant });

      var label = el("p", { className: "callout__title" });
      if (!appendInline(label, b.title)) {
        label.appendChild(document.createTextNode(CALLOUT_VARIANTS[variant]));
      }
      aside.appendChild(label);

      var body = el("div", { className: "callout__body" });
      if (!appendLeaves(body, b.content)) return null;
      aside.appendChild(body);
      return aside;
    },

    /* Native <details>/<summary>: keyboard operation, focus and expanded-state
     * announcement are correct for free. No scripted disclosure, no ARIA role.
     */
    accordion: function (b) {
      var items = Array.isArray(b.items) ? b.items : [];
      var box = el("div", { className: "accordion" });
      items.forEach(function (it) {
        if (!it || typeof it !== "object" || !isStr(it.title)) return;
        var body = el("div", { className: "accordion__body" });
        if (!appendLeaves(body, it.content)) return;
        var d = el("details", {
          children: [el("summary", { text: it.title }), body]
        });
        if (it.open === true) d.setAttribute("open", "");
        box.appendChild(d);
      });
      return box.childNodes.length ? box : null;
    },

    /* Step numbers come from the native <ol>; authors never hand-number. */
    steps: function (b) {
      var items = Array.isArray(b.items) ? b.items : [];
      var ol = el("ol", { className: "steps" });
      items.forEach(function (it) {
        if (!it || typeof it !== "object") return;
        var li = el("li", { className: "steps__item" });
        if (isStr(it.title)) {
          li.appendChild(el("p", { className: "steps__title", text: it.title }));
        }
        var body = el("div", { className: "steps__body" });
        if (!appendLeaves(body, it.content)) return;
        li.appendChild(body);
        ol.appendChild(li);
      });
      return ol.childNodes.length ? ol : null;
    }
  };

  // Tier 0 dispatch: leaf blocks and containers. Unknown types are skipped.
  function renderBlock(block) {
    if (!block || typeof block !== "object") return null;
    if (CONTAINERS[block.type]) return CONTAINERS[block.type](block);
    var fn = BLOCKS[block.type];
    return fn ? fn(block) : null;
  }

  function lessonView(mount, track, meta, lesson) {
    clear(mount);
    mount.removeAttribute("aria-busy");

    var title = isStr(lesson && lesson.title) ? lesson.title : meta.title;
    var desc = isStr(lesson && lesson.description) ? lesson.description : meta.description;

    var head = el("div", {
      children: [
        backLink(track.id, "Back to " + track.name),
        el("p", { className: "eyebrow", text: track.name }),
        pageTitle(title),
        isStr(desc) ? el("p", { className: "lede", text: desc }) : null
      ].filter(Boolean)
    });

    var article = el("article", { className: "lesson" });
    var blocks = (lesson && Array.isArray(lesson.content)) ? lesson.content : [];
    blocks.forEach(function (b) {
      var node = renderBlock(b);
      if (node) article.appendChild(node);
    });
    if (!article.childNodes.length) {
      article.appendChild(el("p", { className: "note", text: "This lesson has no content yet." }));
    }

    var nav = el("p", {
      children: [el("a", { className: "tracks-back", attrs: { href: trackHref(track.id) }, text: "\u2190 Back to " + track.name })]
    });

    mount.appendChild(el("div", { className: "wrap page stack", children: [head, article, nav] }));
    return head.querySelector("h1");
  }

  return {
    loading: loading,
    error: errorView,
    tracks: tracksView,
    track: trackView,
    lesson: lessonView
  };
})();
