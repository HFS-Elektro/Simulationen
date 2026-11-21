/* HFS-Simulationen – Startseite: Suche, Teilen, Installieren, Offline-Vorabspeicher */
(function () {
  'use strict';
  var H = window.HFS, doc = document, $ = function (id) { return doc.getElementById(id) };
  var CACHE = 'hfs-' + (doc.body.getAttribute('data-bereich') || 'sim');
  if (!H.web) doc.documentElement.classList.add('offline-datei');

  /* Teilen: ganze Seite und einzelne Kacheln */
  $('teilen').addEventListener('click', function () { H.share(location.href, doc.title.replace(/ · HFS$/, '')) });
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-share],[data-copy]'); if (!b) return;
    var url = new URL(b.getAttribute('data-share') || b.getAttribute('data-copy'), location.href).href;
    if (b.hasAttribute('data-share')) H.share(url, b.getAttribute('data-title') || '');
    else H.copy(url);
  });

  /* Suche */
  var tiles = [].slice.call(doc.querySelectorAll('.tile'));
  var groups = [].slice.call(doc.querySelectorAll('.gruppe'));
  function norm(s) { return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/\s+/g, ' ') }
  function filter() {
    var q = norm($('suche').value).trim().split(' ').filter(Boolean), any = false;
    tiles.forEach(function (t) {
      var hay = norm(t.textContent + ' ' + (t.getAttribute('data-such') || ''));
      var hit = q.every(function (w) { return hay.indexOf(w) >= 0 });
      t.hidden = !hit; if (hit) any = true;
    });
    groups.forEach(function (g) { g.hidden = !g.querySelector('.tile:not([hidden])') });
    $('leer').hidden = any;
  }
  $('suche').addEventListener('input', filter);

  /* Installieren: passende Anleitung aufklappen */
  var d = H.device, inst = $('install');
  var key = d.ios ? 'ios' : d.android ? 'android' : 'desktop';
  [].forEach.call(doc.querySelectorAll('.howto'), function (h) {
    var k = h.getAttribute('data-dev');
    if (k === key) h.classList.add('on');
    if (k === 'zip' && (d.ios || d.android || d.phone)) h.hidden = true;     // ZIP nur am Rechner sinnvoll
  });
  var box = doc.querySelector('.howto.on'); if (box) box.parentNode.insertBefore(box, box.parentNode.querySelector('.howto'));
  if (!H.web) {
    $('install-t').textContent = 'Offline-Fassung';
    $('install-lead').textContent = 'Du nutzt die Offline-Fassung von deinem Rechner. Alles funktioniert ohne Internet. QR-Codes und Teilen gibt es nur auf der Webseite.';
    [].forEach.call(doc.querySelectorAll('.howto'), function (h) { h.hidden = true });
  } else if (d.standalone) {
    $('install-t').textContent = 'Hilfe zur App';
    $('install-lead').textContent = 'Du nutzt diese Seite bereits als App. Neue Fassungen werden automatisch geladen, sobald du mit Internet startest.';
  } else if (!(function () { try { return localStorage.getItem('hfs_install_zu') } catch (e) { return 1 } })()) {
    inst.open = d.touch;        // auf iPad/Handy beim ersten Besuch aufgeklappt
  }
  inst.addEventListener('toggle', function () { if (!inst.open) H.store.set('hfs_install_zu', '1') });

  var deferred = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e; $('install-btn').hidden = false;
  });
  $('install-btn').addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; $('install-btn').hidden = true });
  });
  window.addEventListener('appinstalled', function () { H.toast('App installiert'); $('install-btn').hidden = true });

  /* Offline: alle Seiten vorab speichern, Status je Kachel */
  function markOffline() {
    if (!window.caches) return;
    caches.open(CACHE).then(function (c) {
      var n = 0;
      return Promise.all(tiles.map(function (t) {
        var href = t.querySelector('.tile-main').getAttribute('href');
        return c.match(href, { ignoreSearch: true }).then(function (m) {
          var s = t.querySelector('.off'); if (m) n++;
          if (s) { s.hidden = !m; }
        });
      })).then(function () {
        $('offline-status').textContent = n === tiles.length
          ? '✓ Alle ' + n + ' Seiten in diesem Bereich sind auf dem Gerät gespeichert und funktionieren offline.'
          : n + ' von ' + tiles.length + ' Seiten sind offline verfügbar. Die übrigen werden beim nächsten Besuch mit Internet gespeichert.';
      });
    }).catch(function () {});
  }
  if (H.web && 'serviceWorker' in navigator && window.caches) {
    navigator.serviceWorker.ready.then(function () {
      var files = (doc.body.getAttribute('data-precache') || '').split(' ').filter(Boolean);
      return caches.open(CACHE).then(function (c) {
        // einzeln laden, damit eine fehlende Datei nicht alles abbricht
        return Promise.all(files.map(function (f) {
          return c.match(f).then(function (m) { return m || c.add(f).catch(function () {}) });
        }));
      });
    }).then(markOffline).catch(function () {});
    markOffline();
  }
})();
