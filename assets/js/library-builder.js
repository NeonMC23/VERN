/* VΞRN — Library Builder
 * Generic, schema-aware renderer for data/library/{id}.json
 * Knows the VΞRN library schema and JSON shapes — never a specific resource.
 * Data is treated as data: createElement / textContent only, no innerHTML.
 */
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

  /* ------------------------------------------------------------------ URL */

  function resourceIdFromLocation(loc) {
    var q = new URLSearchParams(loc.search).get("id");
    if (q) return normalizeId(q);
    var parts = loc.pathname.split("/").filter(Boolean); // e.g. ["library","{id}"]
    var i = parts.lastIndexOf("library");
    if (i !== -1 && parts.length > i + 1) {
      return normalizeId(parts[i + 1].replace(/\.html$/, ""));
    }
    return null;
  }

  function normalizeId(raw) {
    var id = decodeURIComponent(raw).trim().toLowerCase();
    return ID_PATTERN.test(id) ? id : null;
  }

  /* -------------------------------------------------------------- helpers */

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

  function frag(nodes) {
    var f = document.createDocumentFragment();
    (nodes || []).forEach(function (n) { if (n) f.appendChild(n); });
    return f;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function isStr(v) { return typeof v === "string" && v.trim() !== ""; }
  function isArr(v) { return Array.isArray(v) && v.length > 0; }
  function isObj(v) { return !!v && typeof v === "object" && !Array.isArray(v); }
  function isScalar(v) { return typeof v === "string" || typeof v === "number" || typeof v === "boolean"; }
  function isStrArray(v) { return isArr(v) && v.every(isStr); }

  function humanize(key) {
    var s = String(key).replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    // "who is it for" reads better with a question mark when phrased as one.
    s = s.replace(/^./, function (c) { return c.toUpperCase(); });
    // Interrogative phrasing ("who is it for") reads better with a question mark.
    if (/^(what|who|how|why|when|where)\s+(is|are|was|were|does|do|did|can|should)\b/i.test(s)
        && !/[?.!]$/.test(s)) s += "?";
    return s;
  }

  function safeHref(url) {
    if (!isStr(url)) return null;
    var u = url.trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;
    if (/^\//.test(u) && !/^\/\//.test(u)) return u;
    return null;
  }

  function hostOf(url) {
    try { return new URL(url).host.replace(/^www\./, ""); } catch (e) { return null; }
  }

  /* ------------------------------------------------- primitive renderers */

  function paragraphs(text, className) {
    var box = el("div", { className: className || "prose" });
    String(text).split(/\n{2,}/).forEach(function (p) {
      if (p.trim()) box.appendChild(el("p", { text: p.trim() }));
    });
    return box.childNodes.length ? box : null;
  }

  function bulletList(values) {
    var ul = el("ul", { className: "bullets" });
    values.forEach(function (v) {
      if (isScalar(v)) ul.appendChild(el("li", { text: String(v) }));
    });
    return ul.childNodes.length ? ul : null;
  }

  function pillList(values) {
    var ul = el("ul", { className: "pill-row" });
    values.forEach(function (v) {
      ul.appendChild(el("li", { children: [el("span", { className: "badge", text: String(v) })] }));
    });
    return ul.childNodes.length ? ul : null;
  }

  // Short string arrays (feature names, technologies) read best as pills;
  // sentence-like entries read best as bullets. Purely shape-based.
  function stringArray(values) {
    var short = values.every(function (v) { return v.trim().length <= 28 && !/[.,;]/.test(v); });
    return short ? pillList(values) : bulletList(values);
  }

  /* ----------------------------------------------- recursive content tree */

  // Renders any JSON value into structured UI.
  // level 0 = top-level entry of `content` → card block with heading
  // level 1+ = nested field inside a block → sub-heading + body
  function renderNode(key, value, level) {
    if (value == null || value === "") return null;

    var label = key != null ? humanize(key) : null;

    if (isScalar(value)) {
      var text = String(value);
      if (label && text.length <= 90 && !/\n/.test(text) && level >= 1) {
        return el("div", {
          className: "field",
          children: [el("p", {
            className: "field__inline",
            children: [el("strong", { text: label + " — " }), document.createTextNode(text)]
          })]
        });
      }
      var body = paragraphs(text);
      if (!body) return null;
      return wrapField(label, body, level);
    }

    if (Array.isArray(value)) {
      var scalars = value.filter(isScalar);
      var body2;
      if (scalars.length === value.length) {
        body2 = isStrArray(value) ? stringArray(value) : bulletList(value);
      } else {
        var container = el("div", { className: "stack-tight" });
        value.forEach(function (v, i) {
          var node = renderNode(null, v, level + 1);
          if (node) container.appendChild(node);
        });
        body2 = container.childNodes.length ? container : null;
      }
      if (!body2) return null;
      return wrapField(label, body2, level);
    }

    if (isObj(value)) {
      var inner = el("div");
      Object.keys(value).forEach(function (k) {
        var child = renderNode(k, value[k], level + 1);
        if (child) inner.appendChild(child);
      });
      if (!inner.childNodes.length) return null;
      return wrapField(label, inner, level, true);
    }

    return null;
  }

  function wrapField(label, body, level, isBlock) {
    if (level === 0) {
      var block = el("section", { className: "block" });
      if (label) block.appendChild(el("h3", { className: "block__title", text: label }));
      block.appendChild(body);
      return block;
    }
    var field = el("div", { className: "field" });
    if (label) field.appendChild(el("h4", { className: "block__title--sub", text: label }));
    field.appendChild(body);
    return field;
  }

  // `content` root: each top-level entry becomes a block; simple text entries
  // and structured objects are laid out in a responsive grid where useful.
  function renderContent(content) {
    if (isScalar(content)) return paragraphs(content);
    if (Array.isArray(content)) return renderNode(null, content, 0);
    if (!isObj(content)) return null;

    var container = el("div");
    var buffer = [];

    function flushPair() {
      if (!buffer.length) return;
      if (buffer.length === 1) {
        container.appendChild(buffer[0]);
      } else {
        container.appendChild(el("div", { className: "block-grid", children: buffer }));
      }
      buffer = [];
    }

    Object.keys(content).forEach(function (k) {
      var value = content[k];
      var node = renderNode(k, value, 0);
      if (!node) return;
      // Short string arrays pair nicely side by side (e.g. pros / cons lists).
      var pairable = isStrArray(value) && value.length <= 8;
      if (pairable) {
        buffer.push(node);
        if (buffer.length === 2) flushPair();
      } else {
        flushPair();
        container.appendChild(node);
      }
    });
    flushPair();

    return container.childNodes.length ? container : null;
  }

  /* ------------------------------------------------ references & links */

  function refCard(ref) {
    var id = normalizeId(ref.id);
    var label = isStr(ref.name) ? ref.name : (isStr(ref.id) ? humanize(ref.id) : null);
    if (!label) return null;

    var qualifier = ["role", "type", "relation"]
      .map(function (k) { return isStr(ref[k]) ? humanize(ref[k]) : null; })
      .filter(Boolean).join(" · ");

    var children = [el("span", { className: "ref__name", text: label })];
    if (qualifier) children.push(el("span", { className: "ref__role", text: qualifier }));
    if (isStr(ref.note)) children.push(el("span", { className: "muted", text: ref.note }));

    // Optimistically a link; resolveReferences() downgrades it if no JSON exists.
    if (id) {
      return el("a", {
        className: "ref",
        attrs: { href: LIBRARY_BASE + id + "/", "data-ref-id": id },
        children: children
      });
    }
    return el("div", { className: "ref ref--inert", children: children });
  }

  function renderRefs(value) {
    var arr = Array.isArray(value) ? value : (isObj(value) ? [value] : null);
    if (!isArr(arr)) return null;
    var ul = el("ul", { className: "ref-grid" });
    arr.forEach(function (ref) {
      var card = isObj(ref) ? refCard(ref)
        : (isStr(ref) ? refCard({ id: ref }) : null);
      if (card) ul.appendChild(el("li", { children: [card] }));
    });
    return ul.childNodes.length ? ul : null;
  }

  function renderLinks(value) {
    // Accepts an array of entries or a map { label: url }.
    var arr;
    if (isObj(value)) {
      arr = Object.keys(value).map(function (k) {
        if (isStr(value[k])) return { label: humanize(k), url: value[k] };
        if (isObj(value[k])) {
          var o = Object.assign({}, value[k]);
          if (!isStr(o.label) && !isStr(o.title) && !isStr(o.name)) o.label = humanize(k);
          return o;
        }
        return null;
      }).filter(Boolean);
    } else {
      arr = value;
    }
    if (!isArr(arr)) return null;

    var ul = el("ul", { className: "linklist" });
    arr.forEach(function (item) {
      var li = el("li");

      if (isStr(item)) {
        var h0 = safeHref(item);
        li.appendChild(h0 ? el("a", { text: item, attrs: { href: h0, rel: "noopener noreferrer" } })
                          : document.createTextNode(item));
      } else if (isObj(item)) {
        var href = safeHref(item.url || item.href || item.link);
        var label = [item.title, item.label, item.name].find(isStr)
          || (href ? hostOf(href) || href : null);
        if (href && label) {
          li.appendChild(el("a", { text: label, attrs: { href: href, rel: "noopener noreferrer" } }));
          var host = hostOf(href);
          if (host && host !== label) li.appendChild(el("span", { className: "url", text: host }));
        } else if (label) {
          li.appendChild(el("span", { text: label }));
        }
        var extra = ["type", "publisher", "author", "date", "accessed", "note", "description"]
          .map(function (k) { return isStr(item[k]) ? item[k] : null; })
          .filter(Boolean).join(" · ");
        if (extra) li.appendChild(el("span", { className: "muted", text: extra }));
      }

      if (li.childNodes.length) ul.appendChild(li);
    });
    return ul.childNodes.length ? ul : null;
  }

  function renderVariants(value) {
    if (isStrArray(value)) return pillList(value);
    if (!isArr(value)) return renderNode(null, value, 0);
    var wrapper = el("div");
    value.forEach(function (v) {
      if (isStr(v)) { wrapper.appendChild(el("div", { className: "block", children: [el("p", { text: v })] })); return; }
      if (!isObj(v)) return;
      var name = [v.name, v.title, v.id].find(isStr);
      var block = el("section", { className: "block" });
      if (name) block.appendChild(el("h3", { className: "block__title", text: name }));
      Object.keys(v).forEach(function (k) {
        if (["name", "title"].indexOf(k) !== -1) return;
        var node = renderNode(k, v[k], 1);
        if (node) block.appendChild(node);
      });
      if (block.childNodes.length) wrapper.appendChild(block);
    });
    return wrapper.childNodes.length ? wrapper : null;
  }

  /* -------------------------------------------------------- schema layout */

  var SECTIONS = [
    { key: "content",    label: "Documentation",       render: renderContent },
    { key: "components", label: "Components",          render: renderRefs },
    { key: "relations",  label: "Related / Alternatives", render: renderRefs },
    { key: "variants",   label: "Variants",            render: renderVariants },
    { key: "links",      label: "Links",               render: renderLinks },
    { key: "articles",   label: "Articles",            render: renderLinks },
    { key: "sources",    label: "Sources",             render: renderLinks }
  ];

  var HEADER_KEYS = ["id", "name", "type", "summary", "tags", "status",
                     "platforms", "license", "last_verified"];

  function metaBadge(key, value, accent) {
    return el("li", {
      children: [el("span", {
        className: "badge" + (accent ? " badge--accent" : ""),
        children: [
          key ? el("span", { className: "badge__key", text: key }) : null,
          document.createTextNode(String(value))
        ].filter(Boolean)
      })]
    });
  }

  function renderHeader(data) {
    var header = el("header", { className: "resource__header" });

    if (isStr(data.type)) {
      header.appendChild(el("p", { className: "resource__kicker", text: humanize(data.type) }));
    }
    header.appendChild(el("h1", {
      className: "resource__title",
      text: isStr(data.name) ? data.name : data.id
    }));
    if (isStr(data.summary)) {
      header.appendChild(el("p", { className: "resource__summary", text: data.summary }));
    }

    var meta = el("ul", { className: "resource__meta", attrs: { "aria-label": "Metadata" } });
    if (isStr(data.status)) meta.appendChild(metaBadge("status", data.status, true));
    if (isStr(data.license)) meta.appendChild(metaBadge("license", data.license));
    if (isStrArray(data.platforms)) meta.appendChild(metaBadge("platforms", data.platforms.join(", ")));
    if (isStr(data.id)) meta.appendChild(metaBadge("id", data.id));
    if (isStr(data.last_verified)) meta.appendChild(metaBadge("verified", data.last_verified));
    if (meta.childNodes.length) header.appendChild(meta);

    if (isStrArray(data.tags)) {
      var tags = el("ul", { className: "pill-row resource__tags", attrs: { "aria-label": "Tags" } });
      data.tags.forEach(function (t) {
        tags.appendChild(el("li", { children: [el("span", { className: "badge", text: t })] }));
      });
      header.appendChild(tags);
    }

    return header;
  }

  function section(label, body, id) {
    var sec = el("section", { className: "resource__section" });
    var titleId = "sec-" + id;
    sec.setAttribute("aria-labelledby", titleId);
    sec.appendChild(el("h2", { className: "section-title", text: label, attrs: { id: titleId } }));
    sec.appendChild(body);
    return sec;
  }

  function renderResource(data) {
    var article = el("article", {
      className: "resource",
      attrs: { "data-resource-id": String(data.id || "") }
    });
    article.appendChild(renderHeader(data));

    SECTIONS.forEach(function (s) {
      var value = data[s.key];
      if (value == null || (Array.isArray(value) && !value.length)) return;
      var body = s.render(value);
      if (body) article.appendChild(section(s.label, body, s.key));
    });

    // Any further schema-conformant field is still rendered, generically.
    var known = HEADER_KEYS.concat(SECTIONS.map(function (s) { return s.key; }));
    Object.keys(data).forEach(function (k) {
      if (known.indexOf(k) !== -1) return;
      var body = renderNode(null, data[k], 0);
      if (body) article.appendChild(section(humanize(k), body, k));
    });

    return article;
  }

  /* ------------------------------------ reference resolution (no invention) */

  function resolveReferences(root) {
    Array.prototype.slice.call(root.querySelectorAll("a[data-ref-id]")).forEach(function (a) {
      var id = a.getAttribute("data-ref-id");
      fetch(DATA_BASE + id + ".json", { method: "GET", cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error("missing"); })
        .catch(function () {
          var inert = el("div", { className: "ref ref--inert" });
          inert.setAttribute("title", "Not documented yet");
          while (a.firstChild) inert.appendChild(a.firstChild);
          a.parentNode.replaceChild(inert, a);
        });
    });
  }

  /* ------------------------------------------------------------ validation */

  var REQUIRED = ["id", "name", "type", "summary", "tags", "status",
                  "content", "sources", "last_verified"];

  function missingRequired(data) {
    return REQUIRED.filter(function (k) {
      var v = data[k];
      if (v == null) return true;
      if (typeof v === "string") return v.trim() === "";
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === "object") return Object.keys(v).length === 0;
      return false;
    });
  }

  /* ----------------------------------------------------------------- mount */

  function showMessage(mount, title, detail) {
    clear(mount);
    mount.appendChild(el("div", {
      className: "error",
      children: [
        el("h1", { text: title }),
        detail ? el("p", { text: detail }) : null,
        el("p", { children: [el("a", { text: "\u2190 Back to Library", attrs: { href: LIBRARY_BASE } })] })
      ].filter(Boolean)
    }));
  }

  function build(mount) {
    var id = resourceIdFromLocation(window.location);
    if (!id) {
      showMessage(mount, "Resource not specified", "No valid library resource id in the URL.");
      return;
    }

    mount.setAttribute("aria-busy", "true");
    clear(mount);
    mount.appendChild(el("p", { className: "status", text: "Loading " + id + "\u2026" }));

    fetch(DATA_BASE + id + ".json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (text) {
        var data = JSON.parse(text);
        var missing = missingRequired(data);
        if (missing.length) throw new Error("missing required field(s): " + missing.join(", "));
        if (isStr(data.id) && data.id !== id) throw new Error("id mismatch: file declares '" + data.id + "'");

        clear(mount);
        var article = renderResource(data);
        mount.appendChild(article);
        document.title = (isStr(data.name) ? data.name : id) + " \u2014 V\u039eRN Library";
        resolveReferences(article);
      })
      .catch(function (err) {
        showMessage(mount, "Resource unavailable",
          "Could not build " + LIBRARY_BASE + id + "/ from " + DATA_BASE + id + ".json (" + err.message + ").");
      })
      .finally(function () { mount.removeAttribute("aria-busy"); });
  }

  function init() {
    var mount = document.getElementById("library-resource");
    if (mount) build(mount);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
