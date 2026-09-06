/* VΞRN — Tracks data layer (MTrack1)
 *
 * Single responsibility: fetch, parse, cache and look up track data.
 * No DOM, no routing.
 *
 * Caching is in-memory only, for the current page session. No localStorage,
 * no sessionStorage, no IndexedDB, no cookies — a refresh simply refetches.
 */
window.VernTracksData = (function () {
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
  var TRACKS_BASE = BASE + "data/tracks/";

  var indexPromise = null;   // in-flight or resolved index.json
  var indexCache = null;     // normalised index once loaded
  var lessonCache = {};      // lessonKey -> resolved lesson promise

  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error("invalid JSON");
      }
    });
  }

  function byOrder(a, b) {
    var ao = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    var bo = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    return ao - bo;
  }

  // Ordering comes from the data, never from hardcoded ids.
  function normalise(raw) {
    var tracks = (raw && Array.isArray(raw.tracks)) ? raw.tracks : [];
    return tracks
      .filter(function (t) { return t && typeof t.id === "string"; })
      .map(function (t) {
        var lessons = Array.isArray(t.lessons) ? t.lessons : [];
        return {
          id: t.id,
          name: typeof t.name === "string" ? t.name : t.id,
          description: typeof t.description === "string" ? t.description : "",
          order: t.order,
          lessons: lessons
            .filter(function (l) { return l && typeof l.id === "string"; })
            .map(function (l) {
              return {
                id: l.id,
                title: typeof l.title === "string" ? l.title : l.id,
                description: typeof l.description === "string" ? l.description : "",
                order: l.order,
                file: typeof l.file === "string" ? l.file : null
              };
            })
            .sort(byOrder)
        };
      })
      .sort(byOrder);
  }

  // One fetch of index.json for the page session; concurrent callers share it.
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = getJSON(TRACKS_BASE + "index.json").then(function (raw) {
        indexCache = normalise(raw);
        return indexCache;
      }).catch(function (err) {
        indexPromise = null; // allow "Try again" to retry
        throw err;
      });
    }
    return indexPromise;
  }

  function getTracks() { return indexCache || []; }

  function findTrack(trackId) {
    var list = getTracks();
    for (var i = 0; i < list.length; i++) if (list[i].id === trackId) return list[i];
    return null;
  }

  function findLesson(trackId, lessonId) {
    var track = findTrack(trackId);
    if (!track) return null;
    for (var i = 0; i < track.lessons.length; i++) {
      if (track.lessons[i].id === lessonId) return track.lessons[i];
    }
    return null;
  }

  // Lazy: only called when a lesson view is actually opened.
  function loadLesson(trackId, lessonId) {
    var meta = findLesson(trackId, lessonId);
    if (!meta) return Promise.reject(new Error("lesson not found"));

    var key = trackId + "/" + lessonId;
    if (lessonCache[key]) return lessonCache[key];

    // `file` is relative to data/tracks/; fall back to the conventional path.
    var rel = meta.file || (trackId + "/" + lessonId + ".json");
    var promise = getJSON(TRACKS_BASE + rel).catch(function (err) {
      delete lessonCache[key]; // a failed load must stay retryable
      throw err;
    });
    lessonCache[key] = promise;
    return promise;
  }

  return {
    base: TRACKS_BASE,
    loadIndex: loadIndex,
    getTracks: getTracks,
    findTrack: findTrack,
    findLesson: findLesson,
    loadLesson: loadLesson
  };
})();
