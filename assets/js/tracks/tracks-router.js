/* VΞRN — Tracks router (MTrack1)
 *
 * Single responsibility: URL hash -> application state.
 *
 * It never fetches, never touches the DOM, and knows nothing about any
 * particular track or lesson. It only understands the shape of the hash:
 *
 *   ""                        -> { view: "tracks" }
 *   "#programming"            -> { view: "track",  trackId }
 *   "#programming/variables"  -> { view: "lesson", trackId, lessonId }
 *   anything else             -> { view: "invalid", hash }
 */
window.VernTracksRouter = (function () {
  "use strict";

  // Same id grammar as the rest of the site (see library-builder.js).
  var ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function parse(rawHash) {
    var hash = String(rawHash || "");
    if (hash.charAt(0) === "#") hash = hash.slice(1);

    // Tolerate a trailing slash and an accidental leading slash.
    hash = hash.replace(/^\/+/, "").replace(/\/+$/, "");

    if (hash === "") return { view: "tracks" };

    var parts = hash.split("/");
    if (parts.length > 2) return { view: "invalid", hash: hash };

    var trackId;
    try {
      trackId = decodeURIComponent(parts[0]).toLowerCase();
    } catch (e) {
      return { view: "invalid", hash: hash };
    }
    if (!ID_PATTERN.test(trackId)) return { view: "invalid", hash: hash };

    if (parts.length === 1) return { view: "track", trackId: trackId };

    var lessonId;
    try {
      lessonId = decodeURIComponent(parts[1]).toLowerCase();
    } catch (e2) {
      return { view: "invalid", hash: hash };
    }
    if (!ID_PATTERN.test(lessonId)) return { view: "invalid", hash: hash };

    return { view: "lesson", trackId: trackId, lessonId: lessonId };
  }

  function current() { return parse(window.location.hash); }

  // Calls back with the new state on every hash change. Browser Back /
  // Forward therefore work for free — no history manipulation needed.
  function start(onChange) {
    window.addEventListener("hashchange", function () { onChange(current()); });
    onChange(current());
  }

  return { parse: parse, current: current, start: start };
})();
