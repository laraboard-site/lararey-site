/* lararey.com/owner/ — registers THIS browser as the owner's, so GoatCounter stops counting its visits and clicks.
   The link comes from Model Control (WEBSITE ANALYTICS -> Owner browsers): /owner/#<payload>.<signature>.
   The token is in the fragment, so it never reaches a server, a log or GoatCounter. It is checked here with the
   public key Model Control published (ECDSA P-256, WebCrypto), its expiry and the current generation.
   A valid link sends one "owner-registered-<id>" event (so Model Control can see the registration happened),
   then sets GoatCounter's own exclusion (localStorage skipgc=t) and the registration record (lr_owner).
   Revoking in Model Control raises the generation; analytics.js then turns counting back on. No IP is used. */
(function () {
  'use strict';
  var box = document.getElementById('owner');
  var out = document.getElementById('owner-status');
  if (!box || !out) return;
  var KEY = box.getAttribute('data-owner-key') || '';
  var GEN = parseInt(box.getAttribute('data-owner-gen') || '-1', 10);
  function say(t, good) { out.textContent = t; out.className = good ? 'owner-ok' : 'owner-no'; }
  function bytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var b = atob(s), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return u;
  }
  var store = null;
  try { store = window.localStorage; store.setItem('lr_probe', '1'); store.removeItem('lr_probe'); } catch (e) { store = null; }
  var cur = null;
  try { cur = store && JSON.parse(store.getItem('lr_owner') || 'null'); } catch (e) { cur = null; }
  var registered = !!(cur && cur.gen === GEN);
  // a second link pasted into the same tab only changes the fragment: start again with it
  window.addEventListener('hashchange', function () { if (location.hash.length > 1) location.reload(); });
  var token = location.hash.replace(/^#/, '');
  if (token && history.replaceState) history.replaceState(null, '', location.pathname);   // the token leaves the address bar and history
  if (!token) {
    say(registered ? 'This browser is registered as the owner’s browser (' + cur.label + '). Its visits and clicks are not counted.'
                   : 'This browser is not registered. Open a registration link from Model Control.', registered);
    return;
  }
  if (!store) { say('This browser cannot remember the registration (private window, or site data blocked). Use a normal window.'); return; }
  if (!KEY || !window.crypto || !crypto.subtle || !window.TextEncoder) { say('This browser cannot check the link.'); return; }
  var parts = token.split('.');
  if (parts.length !== 2) { say('This link is not valid.'); return; }
  var payload;
  try { payload = JSON.parse(new TextDecoder().decode(bytes(parts[0]))); } catch (e) { say('This link is not valid.'); return; }
  crypto.subtle.importKey('raw', bytes(KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    .then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k, bytes(parts[1]), new TextEncoder().encode(parts[0])); })
    .then(function (ok) {
      if (!ok || payload.v !== 1 || !payload.i) return say('This link is not valid.');
      if (payload.g !== GEN) return say('This link was revoked. Make a new one in Model Control.');
      if (payload.e * 1000 < Date.now()) return say('This link has expired. Make a new one in Model Control.');
      var used = [];
      try { used = JSON.parse(store.getItem('lr_owner_used') || '[]'); } catch (e) { used = []; }
      if (registered) return say('This browser is already registered as the owner’s browser (' + cur.label + '). Nothing changed.', true);
      if (used.indexOf(payload.i) > -1) return say('This link was already used.');
      var finish = function (seen) {
        store.setItem('skipgc', 't');   // GoatCounter's own exclusion (count.js stops pageviews and click events)
        store.setItem('lr_owner', JSON.stringify({ gen: GEN, id: payload.i, label: payload.l, at: new Date().toISOString() }));
        used.push(payload.i);
        store.setItem('lr_owner_used', JSON.stringify(used.slice(-20)));
        say('Done: this browser (' + payload.l + ') is registered as the owner’s browser. From now on its visits and clicks on lararey.com are not counted.' +
            (seen ? '' : ' (Model Control could not be told: the counter did not load. The exclusion works anyway.)'), true);
      };
      var tries = 0;
      (function wait() {   // GoatCounter's script loads asynchronously; the one registration event goes before the exclusion
        if (window.goatcounter && window.goatcounter.count) {
          window.goatcounter.count({ path: 'owner-registered-' + payload.i, title: payload.l, event: true });
          return setTimeout(function () { finish(true); }, 300);
        }
        if (++tries > 50) return finish(false);
        setTimeout(wait, 100);
      })();
    })
    .catch(function () { say('This link is not valid.'); });
})();
