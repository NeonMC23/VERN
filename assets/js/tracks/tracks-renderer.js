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

  /* ------------------------------------------------- D3: validation engine
   * Two stages, deliberately separate and separately declared:
   *
   *   raw answer -> normalization (`normalize`) -> comparison (`compare`) -> bool
   *
   * Everything is declarative data. Nothing from the JSON is ever executed:
   * no regex, no expressions, no custom comparators.
   */

  // Defaults apply when `normalize` is absent OR partially specified.
  // `normalize: {}` therefore still trims and collapses — raw bytes require
  // { trim: false, collapse_ws: false } explicitly (D3).
  function normalizeValue(value, opts) {
    var out = String(value);
    var o = (opts && typeof opts === "object") ? opts : {};
    var trim = o.trim === false ? false : true;
    var collapse = o.collapse_ws === false ? false : true;
    if (collapse) out = out.replace(/\s+/g, " ");
    if (trim) out = out.trim();
    return out;
  }

  var COMPARE_MODES = ["exact", "ci", "numeric", "contains"];

  function compareMode(value, fallback) {
    return COMPARE_MODES.indexOf(value) === -1 ? fallback : value;
  }

  function toNumber(str) {
    var t = String(str).trim();
    if (t === "") return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  // Returns true when `answer` matches ANY entry of `accepts` (OR-list).
  function checkAnswer(answer, accepts, mode, normOpts, tolerance) {
    var list = Array.isArray(accepts) ? accepts.filter(isUsableAccept) : [];
    if (!list.length) return false;

    var a = normalizeValue(answer, normOpts);

    if (mode === "numeric") {
      var an = toNumber(a);
      if (an === null) return false;                       // invalid -> incorrect
      var tol = (typeof tolerance === "number" && isFinite(tolerance)) ? Math.abs(tolerance) : 0;
      return list.some(function (acc) {
        var bn = toNumber(normalizeValue(acc, normOpts));
        return bn !== null && Math.abs(an - bn) <= tol;
      });
    }

    if (mode === "contains") {
      // Always case-insensitive; there is no case-sensitive substring mode.
      var hay = a.toLowerCase();
      return list.some(function (acc) {
        return hay.indexOf(normalizeValue(acc, normOpts).toLowerCase()) !== -1;
      });
    }

    if (mode === "ci") {
      var lc = a.toLowerCase();
      return list.some(function (acc) {
        return normalizeValue(acc, normOpts).toLowerCase() === lc;
      });
    }

    // exact
    return list.some(function (acc) { return normalizeValue(acc, normOpts) === a; });
  }

  // An accept value is usable when it is a string or a finite number.
  function isUsableAccept(v) {
    if (typeof v === "number") return isFinite(v);
    return typeof v === "string" && v !== "";
  }

  function usableAccepts(accepts) {
    return Array.isArray(accepts) ? accepts.filter(isUsableAccept) : [];
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

  /* --------------------------------------------------- exercise scaffolding
   * Shared by choice / text_input / fill_blank. Builds the common shell:
   * optional stem (leaf blocks only), prompt, body, actions row, hint, and a
   * polite live region for the verdict.
   *
   * All state is transient DOM state. Nothing is recorded, counted or stored.
   */

  var exerciseSeq = 0;   // renderer-controlled DOM ids; authored ids are never used

  function nextExerciseId() { exerciseSeq += 1; return "ex-" + exerciseSeq; }

  function buildExercise(block, opts) {
    var wrap = el("section", { className: "exercise" });

    // Stem: Tier 2 leaf blocks only, via the existing B1 dispatch.
    if (Array.isArray(block.stem)) {
      var stem = el("div", { className: "exercise__stem" });
      if (appendLeaves(stem, block.stem)) wrap.appendChild(stem);
    }

    // Prompt (string or D1 inline). For choice this becomes the <legend>.
    var promptNode = null;
    if (hasInline(block.prompt)) {
      promptNode = el(opts.promptTag || "p", { className: "exercise__prompt" });
      appendInline(promptNode, block.prompt);
    }

    var body = el("div", { className: "exercise__body" });
    var actions = el("p", { className: "exercise__actions" });
    var result = el("div", { className: "exercise__result" });
    // Verdict is announced politely; never role="alert".
    result.setAttribute("aria-live", "polite");

    var check = el("button", {
      className: "btn btn--ghost exercise__check",
      text: "Check",
      attrs: { type: "button" }
    });
    actions.appendChild(check);

    // Hint: on demand only, never revealed automatically.
    if (hasInline(block.hint)) {
      var hintBox = el("p", { className: "exercise__hint" });
      hintBox.setAttribute("hidden", "");
      appendInline(hintBox, block.hint);
      var hintBtn = el("button", {
        className: "btn btn--ghost exercise__hint-btn",
        text: "Show hint",
        attrs: { type: "button", "aria-expanded": "false" }
      });
      hintBtn.addEventListener("click", function () {
        var shown = !hintBox.hasAttribute("hidden");
        if (shown) { hintBox.setAttribute("hidden", ""); }
        else { hintBox.removeAttribute("hidden"); }
        hintBtn.setAttribute("aria-expanded", shown ? "false" : "true");
        hintBtn.textContent = shown ? "Show hint" : "Hide hint";
      });
      actions.appendChild(hintBtn);
      wrap.__hint = hintBox;
    }

    return {
      wrap: wrap, promptNode: promptNode, body: body,
      actions: actions, result: result, check: check
    };
  }

  // Renders the verdict + optional specific/generic feedback + explanation.
  // `specific` wins over the generic verdict text when the author supplied it.
  function showResult(result, ok, block, specific) {
    clear(result);
    result.className = "exercise__result " + (ok ? "is-correct" : "is-incorrect");

    // Text verdict — never colour alone. A symbol plus a word.
    var verdict = el("p", { className: "exercise__verdict" });
    verdict.appendChild(el("span", {
      className: "exercise__mark",
      text: ok ? "\u2713" : "\u2715",
      attrs: { "aria-hidden": "true" }
    }));
    verdict.appendChild(document.createTextNode(ok ? "Correct." : "Incorrect."));
    result.appendChild(verdict);

    var added = false;
    if (hasInline(specific)) {
      var sp = el("p", { className: "exercise__feedback" });
      appendInline(sp, specific);
      result.appendChild(sp);
      added = true;
    }

    // Generic feedback still shows when no per-option feedback applied.
    var generic = block.feedback && typeof block.feedback === "object"
      ? (ok ? block.feedback.correct : block.feedback.incorrect)
      : null;
    if (!added && hasInline(generic)) {
      var gp = el("p", { className: "exercise__feedback" });
      appendInline(gp, generic);
      result.appendChild(gp);
    }

    // Explanation is teaching content: shown on BOTH outcomes.
    if (hasInline(block.explanation)) {
      var ex = el("div", { className: "exercise__explanation" });
      var ep = el("p");
      appendInline(ep, block.explanation);
      ex.appendChild(ep);
      result.appendChild(ex);
    }
  }

  function showNotice(result, message) {
    clear(result);
    result.className = "exercise__result is-notice";
    result.appendChild(el("p", { className: "exercise__verdict", text: message }));
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

  /* ---------------------------------------------------------- D4: choice */

  function choiceWidget(b) {
    // `multiple` is REQUIRED and explicit; never inferred from answer.length.
    if (typeof b.multiple !== "boolean") return null;

    var options = Array.isArray(b.options) ? b.options.filter(function (o) {
      return o && typeof o === "object" && isStr(o.id) && hasInline(o.text);
    }) : [];
    if (options.length < 2) return null;

    // Duplicate option ids are an ambiguous grading target -> skip.
    var ids = options.map(function (o) { return o.id; });
    if (new Set(ids).size !== ids.length) return null;

    // Duplicate ids WITHIN answer are harmless: de-duplicate, then re-check.
    var answer = Array.isArray(b.answer) ? b.answer.filter(isStr) : [];
    answer = Array.from(new Set(answer));
    if (!answer.length) return null;
    if (!b.multiple && answer.length !== 1) return null;
    if (answer.some(function (id) { return ids.indexOf(id) === -1; })) return null;

    var ex = buildExercise(b, { promptTag: "legend" });
    var name = nextExerciseId();
    var fs = el("fieldset", { className: "choice" });
    // <fieldset>/<legend> group natively: no redundant radiogroup ARIA.
    fs.appendChild(ex.promptNode || el("legend", { className: "exercise__prompt", text: "Choose:" }));

    if (b.multiple) {
      fs.appendChild(el("p", { className: "choice__note", text: "Select all that apply." }));
    }

    var inputs = [];
    options.forEach(function (o, i) {
      var inputId = name + "-o" + i;
      var input = el("input", {
        attrs: {
          type: b.multiple ? "checkbox" : "radio",
          name: name,
          id: inputId,
          value: o.id
        }
      });
      var label = el("label", { className: "choice__option", attrs: { for: inputId } });
      var span = el("span", { className: "choice__text" });
      appendInline(span, o.text);
      var row = el("div", { className: "choice__row", children: [input, label] });
      label.appendChild(span);
      fs.appendChild(row);
      inputs.push({ input: input, opt: o });
    });

    ex.body.appendChild(fs);

    ex.check.addEventListener("click", function () {
      var selected = inputs.filter(function (x) { return x.input.checked; });
      if (!selected.length) {
        showNotice(ex.result, "Select an answer first.");
        return;
      }
      var chosen = selected.map(function (x) { return x.opt.id; });
      var ok = chosen.length === answer.length &&
               chosen.every(function (id) { return answer.indexOf(id) !== -1; });

      // Per-option feedback has priority; only meaningful for a single pick.
      var specific = null;
      if (selected.length === 1 && hasInline(selected[0].opt.feedback)) {
        specific = selected[0].opt.feedback;
      }
      showResult(ex.result, ok, b, specific);
    });

    ex.wrap.appendChild(ex.body);
    ex.wrap.appendChild(ex.actions);
    if (ex.wrap.__hint) ex.wrap.appendChild(ex.wrap.__hint);
    ex.wrap.appendChild(ex.result);
    return ex.wrap;
  }

  /* ------------------------------------------------------ text_input */

  function textInputWidget(b) {
    var accepts = usableAccepts(b.accept);
    if (!accepts.length) return null;                     // unanswerable -> skip

    var mode = compareMode(b.compare, "ci");              // widget default: ci
    var ex = buildExercise(b, {});
    var id = nextExerciseId();

    var input = el("input", {
      className: "exercise__input",
      attrs: { type: "text", id: id }
    });
    if (b.input === "number") input.setAttribute("inputmode", "numeric");
    if (isStr(b.placeholder)) input.setAttribute("placeholder", b.placeholder);

    // Every input needs a real label.
    var label;
    if (ex.promptNode) {
      label = el("label", { className: "exercise__prompt", attrs: { "for": id } });
      while (ex.promptNode.firstChild) label.appendChild(ex.promptNode.firstChild);
      ex.promptNode = label;
    } else {
      label = el("label", { className: "exercise__prompt", text: "Your answer", attrs: { "for": id } });
      ex.promptNode = label;
    }

    var submit = function () {
      if (!input.value.trim()) { showNotice(ex.result, "Enter an answer first."); return; }
      var ok = checkAnswer(input.value, accepts, mode, b.normalize, b.tolerance);
      showResult(ex.result, ok, b, null);
    };
    ex.check.addEventListener("click", submit);
    // Enter submits; no form element, so no reload or navigation is possible.
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
    });

    ex.body.appendChild(ex.promptNode);
    ex.body.appendChild(input);
    ex.wrap.appendChild(ex.body);
    ex.wrap.appendChild(ex.actions);
    if (ex.wrap.__hint) ex.wrap.appendChild(ex.wrap.__hint);
    ex.wrap.appendChild(ex.result);
    return ex.wrap;
  }

  /* ------------------------------------------------- D2: fill_blank
   * The content array is walked directly. Strings stay literal, so
   * `__init__` and `user_name` are preserved exactly. Nothing is parsed.
   */

  function isBlank(item) {
    return item && typeof item === "object" && item.blank === true;
  }

  function fillBlankWidget(b) {
    var content = Array.isArray(b.content) ? b.content : [];
    var blanks = content.filter(isBlank);
    if (!blanks.length) return null;                        // no blank -> not an exercise
    // Every blank must be answerable, otherwise skip the whole block.
    if (blanks.some(function (bl) { return !usableAccepts(bl.accept).length; })) return null;

    var ex = buildExercise(b, {});
    var id = nextExerciseId();
    var total = blanks.length;

    var host = isStr(b.language)
      ? el("pre", { className: "codeblock fill-blank__pre" })
      : el("p", { className: "fill-blank__flow" });
    if (isStr(b.language)) host.setAttribute("data-language", b.language);

    var fields = [];
    var index = 0;
    content.forEach(function (item) {
      if (typeof item === "string") {
        if (item !== "") host.appendChild(document.createTextNode(item));
        return;
      }
      if (!isBlank(item)) return;
      index += 1;
      var input = el("input", {
        className: "fill-blank__input",
        // Renderer-controlled DOM id; authored `id` is never used as a DOM id.
        attrs: {
          type: "text",
          id: id + "-b" + index,
          "aria-label": "Blank " + index + " of " + total
        }
      });
      var size = parseInt(item.size, 10);
      if (isFinite(size) && size > 0) input.setAttribute("size", String(size));
      host.appendChild(input);
      var status = el("span", { className: "fill-blank__status" });
      status.setAttribute("aria-live", "polite");
      host.appendChild(status);
      fields.push({ input: input, spec: item, status: status, n: index });
    });

    ex.body.appendChild(host);
    if (ex.promptNode) ex.body.insertBefore(ex.promptNode, host);

    // One Check validates all blanks; each blank reports its own result.
    var submit = function () {
      var allOk = true, answered = 0;
      fields.forEach(function (f) {
        var mode = compareMode(f.spec.compare, "exact");   // fill_blank default: exact
        if (f.input.value.trim()) answered += 1;
        var ok = checkAnswer(f.input.value, f.spec.accept, mode, f.spec.normalize, f.spec.tolerance);
        if (!ok) allOk = false;
        f.input.className = "fill-blank__input " + (ok ? "is-correct" : "is-incorrect");
        clear(f.status);
        // Text, not colour: each blank states its own verdict.
        f.status.appendChild(el("span", {
          className: "fill-blank__badge",
          text: ok ? "\u2713 correct" : "\u2715 incorrect"
        }));
      });
      if (!answered) { showNotice(ex.result, "Fill in the blanks first."); return; }
      showResult(ex.result, allOk, b, null);
    };
    ex.check.addEventListener("click", submit);
    fields.forEach(function (f) {
      f.input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); submit(); }
      });
    });

    ex.wrap.appendChild(ex.body);
    ex.wrap.appendChild(ex.actions);
    if (ex.wrap.__hint) ex.wrap.appendChild(ex.wrap.__hint);
    ex.wrap.appendChild(ex.result);
    return ex.wrap;
  }

  // Exercises are Tier 0 only: never reachable from a container or a stem.
  var EXERCISES = {
    choice: choiceWidget,
    text_input: textInputWidget,
    fill_blank: fillBlankWidget
  };

  // Tier 0 dispatch: leaf blocks and containers. Unknown types are skipped.
  function renderBlock(block) {
    if (!block || typeof block !== "object") return null;
    if (EXERCISES[block.type]) return EXERCISES[block.type](block);
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
