/* VΞRN — global chrome behaviour: mobile nav toggle + theme toggle.
 * No storage of any kind: the theme choice lives only in the current document.
 */
(function () {
  "use strict";

  function initNav() {
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.setAttribute("data-open", String(open));
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
      toggle.textContent = open ? "\u2715" : "\u2630";
    }

    setOpen(false);

    toggle.addEventListener("click", function () {
      setOpen(nav.getAttribute("data-open") !== "true");
    });

    // Close after following a link inside the mobile menu.
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.getAttribute("data-open") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  function initTheme() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    var root = document.documentElement;

    function apply(theme) {
      root.setAttribute("data-theme", theme);
      btn.textContent = theme === "light" ? "\u263E" : "\u2600";
      btn.setAttribute("aria-label",
        theme === "light" ? "Switch to dark theme" : "Switch to light theme");
      btn.setAttribute("aria-pressed", String(theme === "light"));
    }

    apply(root.getAttribute("data-theme") || "dark");

    btn.addEventListener("click", function () {
      apply(root.getAttribute("data-theme") === "light" ? "dark" : "light");
    });
  }

  function init() { initNav(); initTheme(); }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
