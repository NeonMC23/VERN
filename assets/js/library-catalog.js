/* VΞRN — Library catalog (/library/).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THE ONLY MANUAL STEP WHEN ADDING A RESOURCE
 * ─────────────────────────────────────────────────────────────────────────
 *  Drop data/library/<id>.json, then add its id to the list below.
 *
 *  This list holds IDS ONLY — never documentation, never resource content.
 *  data/library/<id>.json remains the single source of truth: every value
 *  displayed, searched, filtered or sorted here is read from that file at
 *  runtime. There is no generated index and no duplicated metadata.
 *
 *  It is NOT used for routing. /library/<id>/ works purely because
 *  data/library/<id>.json exists — see library-builder.js. An id missing
 *  from this list simply does not appear in the catalog.
 * ─────────────────────────────────────────────────────────────────────────
 */

var LIBRARY_RESOURCES = [
  "fedora",
  // Development test fixtures — not real technologies. Safe to remove.
  "test-linux",
  "test-desktop",
  "test-network",
  "test-tool",
  "test-project",
  "test-framework"
];

(function () {
  "use strict";

  // Site root, shared with the <base> element installed by the inline
  // bootstrap in <head>. Works at a domain root and under a project subpath
  // such as /VERN/ — nothing is hardcoded.
  function siteBase() {
    var el = document.querySelector("base");
    if (el) return new URL(el.getAttribute("href"), location.href).pathname;
    return location.pathname.replace(/[^/]*$/, "");
  }

  var BASE = siteBase();
  var DATA_BASE = BASE + "data/library/";
  var LIBRARY_BASE = BASE + "library/";
  var ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  /* ------------------------------------------------------------ type accents
   * Generic presentation mapping: resource.type → a visual token, resolved to
   * a colour by CSS custom properties. Purely cosmetic — it never affects how
   * content is rendered, and an unknown/new type simply falls back to
   * "neutral", so schema types can appear without any UI code change.
   */
  var TYPE_ACCENTS = {
    operating_system: "blue",
    distribution: "blue",
    kernel: "slate",
    init_system: "slate",
    filesystem: "slate",
    desktop_environment: "violet",
    window_manager: "violet",
    display_protocol: "cyan",
    protocol: "cyan",
    package_manager: "amber",
    package_format: "amber",
    security_technology: "amber",
    privacy_technology: "green",
    application: "cyan",
    service: "teal",
    technology: "teal",
    library: "violet",
    framework: "violet",
    hardware: "orange",
    concept: "neutral",
    project: "green",
    repository: "slate"
  };

  function accentFor(type) {
    return (typeof type === "string" && TYPE_ACCENTS[type]) || "neutral";
  }

  /* ----------------------------------------------------------------- utils */

  function el(tag, opts) {
    var n = document.createElement(tag);
    opts = opts || {};
    if (opts.text != null) n.textContent = String(opts.text);
    if (opts.className) n.className = opts.className;
    if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) { n.setAttribute(k, opts.attrs[k]); });
    (opts.children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function humanize(s) {
    var t = String(s).replace(/[_-]+/g, " ").trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function isStr(v) { return typeof v === "string" && v.trim() !== ""; }

  // Diacritic-insensitive, case-insensitive comparison key.
  function fold(v) {
    var s = String(v).toLowerCase();
    if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return s;
  }

  function uniqueSorted(values) {
    var seen = Object.create(null);
    var out = [];
    values.forEach(function (v) {
      if (!isStr(v)) return;
      var k = fold(v);
      if (seen[k]) return;
      seen[k] = true;
      out.push(v);
    });
    return out.sort(function (a, b) { return fold(a).localeCompare(fold(b)); });
  }

  /* --------------------------------------------------------- search corpus
   * Built once per resource from STRUCTURED JSON fields — never from rendered
   * HTML. Content prose is included so a query like "linux" can match a
   * resource that only mentions it in its documentation body.
   */
  function collectText(value, depth, out) {
    if (depth > 4 || value == null) return;
    if (typeof value === "string" || typeof value === "number") { out.push(String(value)); return; }
    if (Array.isArray(value)) { value.forEach(function (v) { collectText(v, depth + 1, out); }); return; }
    if (typeof value === "object") {
      Object.keys(value).forEach(function (k) { collectText(value[k], depth + 1, out); });
    }
  }

  function buildEntry(id, data) {
    var parts = [id, data.name, data.summary, data.type, data.status, data.license];
    if (Array.isArray(data.tags)) parts = parts.concat(data.tags);
    if (Array.isArray(data.platforms)) parts = parts.concat(data.platforms);
    collectText(data.content, 0, parts);

    return {
      id: id,
      data: data,
      name: isStr(data.name) ? data.name : id,
      type: isStr(data.type) ? data.type : "",
      status: isStr(data.status) ? data.status : "",
      license: isStr(data.license) ? data.license : "",
      tags: Array.isArray(data.tags) ? data.tags.filter(isStr) : [],
      platforms: Array.isArray(data.platforms) ? data.platforms.filter(isStr) : [],
      verified: isStr(data.last_verified) ? data.last_verified : "",
      haystack: fold(parts.filter(function (p) { return p != null && p !== ""; }).join(" "))
    };
  }

  /* ------------------------------------------------------------------ state
   * In-memory only, for the current page session. No localStorage, no
   * sessionStorage, no cookies, no persistence of any kind.
   */
  var ALL = [];
  var state = {
    query: "",
    type: [],
    status: [],
    tags: [],
    platforms: [],
    license: [],
    sort: "default"
  };

  // A token matches when it starts a word in the corpus, so "secur" still
  // finds "security" (prefix search) while "test" no longer matches inside
  // "lightest". Every token must match (AND), which makes multi-word queries
  // such as "open source" behave as a user expects.
  function tokenMatches(hay, token) {
    var i = hay.indexOf(token);
    while (i !== -1) {
      if (i === 0 || !/[a-z0-9]/.test(hay.charAt(i - 1))) return true;
      i = hay.indexOf(token, i + 1);
    }
    return false;
  }

  function matchesQuery(entry, query) {
    if (!query) return true;
    var tokens = fold(query).split(/\s+/).filter(Boolean);
    return tokens.every(function (t) { return tokenMatches(entry.haystack, t); });
  }

  // OR within a category, AND between categories.
  function matchesCategory(selected, values) {
    if (!selected.length) return true;
    var have = values.map(fold);
    return selected.some(function (s) { return have.indexOf(fold(s)) !== -1; });
  }

  function visibleEntries() {
    var out = ALL.filter(function (e) {
      return matchesQuery(e, state.query)
        && matchesCategory(state.type, e.type ? [e.type] : [])
        && matchesCategory(state.status, e.status ? [e.status] : [])
        && matchesCategory(state.tags, e.tags)
        && matchesCategory(state.platforms, e.platforms)
        && matchesCategory(state.license, e.license ? [e.license] : []);
    });

    var byName = function (a, b) { return fold(a.name).localeCompare(fold(b.name)); };
    if (state.sort === "name-asc") out.sort(byName);
    else if (state.sort === "name-desc") out.sort(function (a, b) { return byName(b, a); });
    else if (state.sort === "verified-desc") out.sort(function (a, b) { return (b.verified || "").localeCompare(a.verified || "") || byName(a, b); });
    else if (state.sort === "verified-asc") out.sort(function (a, b) { return (a.verified || "").localeCompare(b.verified || "") || byName(a, b); });
    // "default" keeps LIBRARY_RESOURCES order — intentional and stable.
    return out;
  }

  function activeFilterCount() {
    return state.type.length + state.status.length + state.tags.length
      + state.platforms.length + state.license.length;
  }

  /* ------------------------------------------------------------------ cards */

  function card(entry) {
    var a = el("a", {
      className: "card card--link",
      attrs: { href: LIBRARY_BASE + entry.id + "/", "data-type-accent": accentFor(entry.type) }
    });

    a.appendChild(el("h3", {
      className: "card__title",
      children: [
        el("span", { className: "marker", text: "\u003e", attrs: { "aria-hidden": "true" } }),
        document.createTextNode(entry.name)
      ]
    }));

    if (isStr(entry.data.summary)) {
      a.appendChild(el("p", { className: "card__text", text: entry.data.summary }));
    }

    var meta = el("ul", { className: "pill-row card__meta" });
    if (entry.type) {
      meta.appendChild(el("li", {
        children: [el("span", { className: "badge badge--type", text: humanize(entry.type) })]
      }));
    }
    if (entry.status) {
      meta.appendChild(el("li", { children: [el("span", { className: "badge", text: entry.status })] }));
    }
    if (meta.childNodes.length) a.appendChild(meta);

    return el("li", { children: [a] });
  }

  /* ------------------------------------------------------------------- UI */

  var refs = {};

  function chip(group, value, label) {
    var input = el("input", {
      attrs: { type: "checkbox", value: value, "data-group": group }
    });
    input.checked = state[group].indexOf(value) !== -1;
    input.addEventListener("change", function () {
      var list = state[group];
      var i = list.indexOf(value);
      if (input.checked && i === -1) list.push(value);
      else if (!input.checked && i !== -1) list.splice(i, 1);
      render();
    });
    return el("label", { className: "chip", children: [input, el("span", { text: label })] });
  }

  function filterGroup(legend, group, values, humanizeLabel) {
    if (!values.length) return null; // only expose a filter when data supports it
    var box = el("div", { className: "filters__options" });
    values.forEach(function (v) {
      box.appendChild(chip(group, v, humanizeLabel ? humanize(v) : v));
    });
    return el("fieldset", {
      className: "filters__group",
      children: [el("legend", { text: legend }), box]
    });
  }

  function buildControls(mount) {
    var controls = el("div", { className: "catalog__controls" });

    // --- search -----------------------------------------------------------
    var input = el("input", {
      className: "input",
      attrs: {
        type: "search", id: "library-search", autocomplete: "off",
        placeholder: "Search the library\u2026",
        "aria-describedby": "library-count"
      }
    });
    var label = el("label", {
      className: "visually-hidden",
      attrs: { "for": "library-search" },
      text: "Search the library"
    });
    // Input events already fire per keystroke on already-loaded data; no
    // network request and no re-fetch is involved.
    input.addEventListener("input", function () { state.query = input.value; render(); });

    controls.appendChild(label);
    controls.appendChild(el("div", {
      className: "catalog__search",
      children: [
        el("span", { className: "field-icon", text: "\u003e", attrs: { "aria-hidden": "true" } }),
        input
      ]
    }));

    // --- filters toggle + count ------------------------------------------
    refs.badge = el("span", { className: "filter-count", attrs: { "aria-hidden": "true" } });
    refs.toggle = el("button", {
      className: "btn btn--ghost",
      attrs: {
        type: "button", "aria-expanded": "false", "aria-controls": "library-filters"
      },
      children: [
        el("span", { text: "Filters" }),
        refs.badge,
        el("span", { className: "btn__caret", text: "\u25be", attrs: { "aria-hidden": "true" } })
      ]
    });
    refs.count = el("p", {
      className: "catalog__count",
      attrs: { id: "library-count", role: "status", "aria-live": "polite" }
    });

    refs.toggle.addEventListener("click", function () {
      var open = refs.toggle.getAttribute("aria-expanded") === "true";
      refs.toggle.setAttribute("aria-expanded", String(!open));
      refs.panel.hidden = open;
    });

    controls.appendChild(el("div", {
      className: "catalog__bar",
      children: [refs.toggle, refs.count]
    }));

    // --- filter panel (collapsed by default) ------------------------------
    var types = uniqueSorted(ALL.map(function (e) { return e.type; }));
    var statuses = uniqueSorted(ALL.map(function (e) { return e.status; }));
    var tags = uniqueSorted(ALL.reduce(function (acc, e) { return acc.concat(e.tags); }, []));
    var platforms = uniqueSorted(ALL.reduce(function (acc, e) { return acc.concat(e.platforms); }, []));
    var licenses = uniqueSorted(ALL.map(function (e) { return e.license; }));

    var sort = el("select", {
      className: "select",
      attrs: { id: "library-sort" }
    });
    [
      ["default", "Default order"],
      ["name-asc", "Name A \u2192 Z"],
      ["name-desc", "Name Z \u2192 A"],
      ["verified-desc", "Recently verified"],
      ["verified-asc", "Oldest verification"]
    ].forEach(function (o) {
      sort.appendChild(el("option", { text: o[1], attrs: { value: o[0] } }));
    });
    sort.value = state.sort;
    sort.addEventListener("change", function () { state.sort = sort.value; render(); });

    var grid = el("div", { className: "filters__grid" });
    [
      filterGroup("Type", "type", types, true),
      filterGroup("Status", "status", statuses, true),
      filterGroup("Tags", "tags", tags, false),
      filterGroup("Platforms", "platforms", platforms, false),
      filterGroup("License", "license", licenses, false),
      el("div", {
        className: "filters__group",
        children: [
          el("h3", { children: [el("label", { text: "Sort", attrs: { "for": "library-sort" } })] }),
          sort
        ]
      })
    ].forEach(function (g) { if (g) grid.appendChild(g); });

    refs.reset = el("button", {
      className: "btn btn--ghost", attrs: { type: "button" }, text: "Clear filters"
    });
    refs.reset.addEventListener("click", function () { resetAll(); });

    refs.panel = el("div", {
      className: "filters",
      attrs: { id: "library-filters", "aria-label": "Advanced filters" },
      children: [grid, el("div", { className: "filters__footer", children: [refs.reset] })]
    });
    refs.panel.hidden = true;

    controls.appendChild(refs.panel);
    mount.appendChild(controls);

    refs.input = input;
    refs.results = el("div");
    mount.appendChild(refs.results);
  }

  function resetAll() {
    state.query = "";
    state.type = []; state.status = []; state.tags = [];
    state.platforms = []; state.license = [];
    state.sort = "default";
    if (refs.input) refs.input.value = "";
    if (refs.panel) {
      Array.prototype.forEach.call(refs.panel.querySelectorAll("input[type=checkbox]"), function (c) { c.checked = false; });
      var sel = refs.panel.querySelector("select");
      if (sel) sel.value = "default";
    }
    render();
  }

  /* --------------------------------------------------------------- render */

  function render() {
    var list = visibleEntries();
    var total = ALL.length;
    var n = activeFilterCount();

    refs.badge.textContent = n ? String(n) : "";
    refs.badge.style.display = n ? "" : "none";

    var filtering = !!state.query || n > 0;
    refs.count.textContent = "";
    if (filtering) {
      refs.count.appendChild(el("b", { text: String(list.length) }));
      refs.count.appendChild(document.createTextNode(" of " + total + " resources"));
    } else {
      refs.count.appendChild(el("b", { text: String(total) }));
      refs.count.appendChild(document.createTextNode(total === 1 ? " resource" : " resources"));
    }

    clear(refs.results);
    if (!list.length) {
      var again = el("button", { className: "btn btn--ghost", attrs: { type: "button" }, text: "Clear filters" });
      again.addEventListener("click", resetAll);
      refs.results.appendChild(el("div", {
        className: "catalog__empty",
        children: [el("p", { text: "No resources match your search." }), again]
      }));
      return;
    }
    var ul = el("ul", { className: "cards" });
    list.forEach(function (e) { ul.appendChild(card(e)); });
    refs.results.appendChild(ul);
  }

  /* ------------------------------------------------------------------ init */

  function init() {
    var mount = document.getElementById("library-catalog");
    if (!mount) return;

    var ids = (Array.isArray(LIBRARY_RESOURCES) ? LIBRARY_RESOURCES : [])
      .filter(function (id) { return typeof id === "string" && ID_PATTERN.test(id); });

    if (!ids.length) {
      mount.appendChild(el("p", { className: "status", text: "No resources yet." }));
      return;
    }

    mount.appendChild(el("p", { className: "status", text: "Loading catalog\u2026" }));

    // Each resource's JSON is fetched exactly once and kept in memory for the
    // page session; search/filter/sort then operate purely on that array.
    Promise.all(ids.map(function (id) {
      return fetch(DATA_BASE + id + ".json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (data) { return { id: id, data: data }; });
    })).then(function (entries) {
      clear(mount);
      ALL = entries
        .filter(function (e) { return e.data && typeof e.data === "object"; })
        .map(function (e) { return buildEntry(e.id, e.data); });

      if (!ALL.length) {
        mount.appendChild(el("p", { className: "status", text: "No resources available." }));
        return;
      }
      buildControls(mount);
      render();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
