/* VΞRN — Tracks application (MTrack1)
 *
 * Single responsibility: orchestration. It wires the router, the data layer
 * and the renderer together, and owns focus management and error states.
 */
(function () {
  "use strict";

  var Router = window.VernTracksRouter;
  var Data = window.VernTracksData;
  var View = window.VernTracksRenderer;

  var mount = null;
  // Guards against a slow fetch resolving after the user navigated away.
  var renderToken = 0;

  // Focus the new view's <h1> so keyboard and screen-reader users land in the
  // right place — but not on first paint, which would steal focus on load.
  var isFirstRender = true;

  function focusHeading(h1) {
    if (!h1) return;
    if (isFirstRender) { isFirstRender = false; return; }
    h1.focus();
  }

  function show(fn) {
    focusHeading(fn());
  }

  function renderTracks(token) {
    if (token !== renderToken) return;
    show(function () { return View.tracks(mount, Data.getTracks()); });
  }

  function renderTrack(token, state) {
    if (token !== renderToken) return;
    var track = Data.findTrack(state.trackId);
    if (!track) {
      show(function () {
        return View.error(mount, "Track not found.",
          "No track matches \u201c" + state.trackId + "\u201d.");
      });
      return;
    }
    show(function () { return View.track(mount, track); });
  }

  function renderLesson(token, state) {
    if (token !== renderToken) return;

    var track = Data.findTrack(state.trackId);
    if (!track) {
      show(function () {
        return View.error(mount, "Track not found.",
          "No track matches \u201c" + state.trackId + "\u201d.");
      });
      return;
    }

    var meta = Data.findLesson(state.trackId, state.lessonId);
    if (!meta) {
      show(function () {
        return View.error(mount, "Lesson not found.",
          "No lesson matches \u201c" + state.lessonId + "\u201d in " + track.name + ".");
      });
      return;
    }

    View.loading(mount, "Loading lesson\u2026");

    // Lazy: the lesson JSON is fetched only now, when the view is opened.
    Data.loadLesson(state.trackId, state.lessonId).then(function (lesson) {
      if (token !== renderToken) return;
      show(function () { return View.lesson(mount, track, meta, lesson); });
    }).catch(function () {
      if (token !== renderToken) return;
      show(function () {
        return View.error(mount, "Unable to load this lesson.",
          "The lesson data could not be loaded. Check your connection and try again.",
          [{ label: "Try again", onClick: function () { handle(Router.current()); } }]);
      });
    });
  }

  function handle(state) {
    var token = ++renderToken;

    if (state.view === "invalid") {
      show(function () {
        return View.error(mount, "Page not found.",
          "\u201c#" + state.hash + "\u201d is not a valid Tracks address.");
      });
      return;
    }

    // Every view needs the index first; it is fetched once and then reused.
    if (!Data.getTracks().length) View.loading(mount, "Loading Tracks\u2026");

    Data.loadIndex().then(function () {
      if (token !== renderToken) return;
      if (state.view === "tracks") return renderTracks(token);
      if (state.view === "track") return renderTrack(token, state);
      if (state.view === "lesson") return renderLesson(token, state);
    }).catch(function () {
      if (token !== renderToken) return;
      show(function () {
        return View.error(mount, "Unable to load Tracks.",
          "The tracks index could not be loaded. Check your connection and try again.",
          [{ label: "Try again", onClick: function () { handle(Router.current()); } }]);
      });
    });
  }

  function init() {
    mount = document.getElementById("tracks-app");
    if (!mount || !Router || !Data || !View) return;
    // hashchange is wired here; Back / Forward therefore work natively.
    Router.start(handle);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
