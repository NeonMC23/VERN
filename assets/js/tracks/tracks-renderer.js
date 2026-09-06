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
      if (!isStr(b.text)) return null;
      var box = el("div", { className: "prose" });
      String(b.text).split(/\n{2,}/).forEach(function (p) {
        if (p.trim()) box.appendChild(el("p", { text: p.trim() }));
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
      var items = Array.isArray(b.items) ? b.items.filter(isStr) : [];
      if (!items.length) return null;
      var ul = el("ul", { className: "bullets" });
      items.forEach(function (t) { ul.appendChild(el("li", { text: t })); });
      return ul;
    }
  };

  function renderBlock(block) {
    if (!block || typeof block !== "object") return null;
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
