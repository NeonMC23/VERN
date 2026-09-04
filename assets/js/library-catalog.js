/* VΞRN — Library catalog (/library/).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  THE ONLY MANUAL STEP WHEN ADDING A RESOURCE
 * ─────────────────────────────────────────────────────────────────────────
 *  Drop data/library/<id>.json, then add its id to the list below.
 *
 *  This list holds IDS ONLY — never documentation, never resource content.
 *  data/library/<id>.json remains the single source of truth: every value
 *  displayed on a card is read from that file at runtime.
 *
 *  It is NOT used for routing. /library/<id>/ works purely because
 *  data/library/<id>.json exists — see library-builder.js. An id missing
 *  from this list simply does not appear in the catalog.
 * ─────────────────────────────────────────────────────────────────────────
 */

var LIBRARY_RESOURCES = [
  "fedora"
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

  function humanize(s) { return String(s).replace(/[_-]+/g, " "); }

  // The whole card is the anchor: the entire surface is clickable and focusable.
  function card(id, data) {
    var a = el("a", { className: "card card--link", attrs: { href: LIBRARY_BASE + id + "/" } });

    a.appendChild(el("h3", {
      className: "card__title",
      children: [
        el("span", { className: "marker", text: "\u003e", attrs: { "aria-hidden": "true" } }),
        document.createTextNode(data && typeof data.name === "string" ? data.name : id)
      ]
    }));

    if (data && typeof data.summary === "string") {
      a.appendChild(el("p", { className: "card__text", text: data.summary }));
    }

    var meta = el("ul", { className: "pill-row card__meta" });
    if (data && typeof data.type === "string") {
      meta.appendChild(el("li", {
        children: [el("span", { className: "badge badge--accent", text: humanize(data.type) })]
      }));
    }
    if (data && typeof data.status === "string") {
      meta.appendChild(el("li", { children: [el("span", { className: "badge", text: data.status })] }));
    }
    if (meta.childNodes.length) a.appendChild(meta);

    return el("li", { children: [a] });
  }

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

    // Each card's data comes from that resource's own JSON.
    Promise.all(ids.map(function (id) {
      return fetch(DATA_BASE + id + ".json", { cache: "no-cache" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; })
        .then(function (data) { return { id: id, data: data }; });
    })).then(function (entries) {
      clear(mount);
      var found = entries.filter(function (e) { return e.data; });
      if (!found.length) {
        mount.appendChild(el("p", { className: "status", text: "No resources available." }));
        return;
      }
      var ul = el("ul", { className: "cards" });
      found.forEach(function (e) { ul.appendChild(card(e.id, e.data)); });
      mount.appendChild(ul);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
