/*
 * Lara Rey — 18+ admission gate (every page, direct URLs included).
 *
 * What it is: the website's own admission step. A visitor sees no page
 * content until they state they are 18 or older. The answer lives in a
 * SESSION cookie (gone when the browser session ends) and is valid for at
 * most 12 hours even inside a session. "Under 18" locks the site for the
 * rest of the session.
 *
 * What it is not: proof of age. Nothing restricted is served by this site:
 * chats, memberships and payments happen inside Telegram, where Lara's own
 * 18+ step and server-side rights apply to the Telegram account. The
 * browser's answer is never passed to Telegram.
 *
 * No birth date, no document, no personal data, no tracking.
 */
(function (root) {
  "use strict";
  var NAME = "lr_age";
  var MAX_MS = 12 * 60 * 60 * 1000;

  /** The admission state in a cookie string at `now` (ms): "adult", "minor" or "ask". */
  function decide(cookieString, now) {
    var parts = String(cookieString || "").split(";");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].trim().split("=");
      if (kv[0] !== NAME || kv.length < 2) continue;
      var m = /^(a|m)\.(\d{10,16})$/.exec(kv[1]);
      if (!m) return "ask";
      var at = Number(m[2]);
      if (!(at > 0) || at > now + 60000) return "ask"; // a stamp from the future is not trusted
      if (m[1] === "m") return "minor";
      return now - at <= MAX_MS ? "adult" : "ask";
    }
    return "ask";
  }

  /** The cookie to set for an answer ("a" adult, "m" minor) at `now`. */
  function cookieFor(answer, now, secure) {
    return NAME + "=" + answer + "." + Math.floor(now) + "; Path=/; SameSite=Lax" + (secure ? "; Secure" : "");
  }

  function show(id) {
    var ids = ["gate", "minor", "content-root"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) el.hidden = ids[i] !== id;
    }
  }

  function render() {
    var root = document.getElementById("content-root");
    var tpl = document.getElementById("content");
    if (root && tpl && !root.hasChildNodes()) root.appendChild(tpl.content.cloneNode(true));
    show("content-root");
    document.documentElement.classList.remove("gated");
    // page scripts (the membership checkout) start only after admission
    document.dispatchEvent(new Event("lara:admitted"));
  }

  function start() {
    var state = decide(document.cookie, Date.now());
    var secure = location.protocol === "https:";
    if (state === "adult") return render();
    if (state === "minor") return show("minor");
    show("gate");
    var yes = document.getElementById("age-yes");
    var no = document.getElementById("age-no");
    if (yes) yes.addEventListener("click", function () {
      document.cookie = cookieFor("a", Date.now(), secure);
      render();
      var h = document.querySelector("#content-root h1, #content-root h2");
      if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    });
    if (no) no.addEventListener("click", function () {
      document.cookie = cookieFor("m", Date.now(), secure);
      show("minor");
    });
  }

  var api = { decide: decide, cookieFor: cookieFor, MAX_MS: MAX_MS, NAME: NAME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    root.LaraGate = api;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})(typeof window !== "undefined" ? window : this);
