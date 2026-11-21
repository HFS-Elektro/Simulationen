/* HFS-Simulationen – gemeinsame Funktionen für Startseiten und Apps.
   Geräteerkennung, Teilen/QR-Code, Offline (Service Worker), Versionshinweis, Lösungssperre.
   Idee und Design: Pablo Disson · umgesetzt mit Claude (KI von Anthropic) · CC BY-NC-SA 4.0 */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var LS = {
    get: function (k) { try { return localStorage.getItem(k) } catch (e) { return null } },
    set: function (k, v) { try { localStorage.setItem(k, v) } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k) } catch (e) {} }
  };
  function el(tag, attrs, kids) {
    var e = doc.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'cls') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c) });
    return e;
  }
  var WEB = /^https?:$/.test(location.protocol);

  /* ---------- Geräteerkennung ---------- */
  var ua = navigator.userAgent || '', touch = (navigator.maxTouchPoints || 0) > 0;
  var iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  var iPhone = /iPhone|iPod/.test(ua);
  var android = /Android/.test(ua);
  var phone = iPhone || (android && /Mobile/.test(ua)) || (/Mobi/.test(ua) && !iPad);
  var tablet = !phone && (iPad || android || (touch && window.matchMedia && matchMedia('(pointer:coarse)').matches && !/Windows NT|CrOS/.test(ua)));
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var device = {
    ios: iPad || iPhone, ipad: iPad, iphone: iPhone, android: android, phone: phone, tablet: tablet,
    desktop: !phone && !tablet, touch: touch, standalone: standalone,
    edge: /Edg\//.test(ua), chrome: /Chrome\//.test(ua) && !/Edg\//.test(ua), firefox: /Firefox\//.test(ua),
    safari: /Safari\//.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|Android/.test(ua)
  };
  ['ios', 'ipad', 'phone', 'tablet', 'desktop', 'touch', 'standalone'].forEach(function (k) { if (device[k]) root.classList.add('hfs-' + k) });

  /* ---------- Hinweis-Toast ---------- */
  var toastT;
  function toast(msg) {
    var t = doc.querySelector('.hfs-toast');
    if (!t) { t = el('div', { cls: 'hfs-toast', role: 'status' }); doc.body.appendChild(t) }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true }, 2200);
  }

  /* ---------- Link kopieren ---------- */
  function copy(text) {
    function fallback() {
      var ta = el('textarea', { readonly: '' }); ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      doc.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      var ok = false; try { ok = doc.execCommand('copy') } catch (e) {}
      ta.remove();
      if (ok) toast('Link kopiert'); else window.prompt('Link zum Kopieren:', text);
    }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(function () { toast('Link kopiert') }, fallback);
    else fallback();
  }

  /* ---------- QR-Bibliothek erst bei Bedarf laden ---------- */
  var qrLib;
  function loadQR() {
    if (window.QRCode) return Promise.resolve();
    if (!qrLib) qrLib = new Promise(function (res, rej) {
      var s = el('script', { src: 'qrcode.min.js' }); s.onload = res; s.onerror = rej; doc.head.appendChild(s);
    });
    return qrLib;
  }

  /* ---------- Teilen-Dialog: QR-Code, Link kopieren, Teilen, Bild, Drucken ---------- */
  function cleanUrl(u) { var a = new URL(u || location.href, location.href); a.hash = ''; a.search = ''; return a.href }
  function share(url, title) {
    url = cleanUrl(url); title = title || doc.title;
    var old = doc.querySelector('.hfs-ov'); if (old) old.remove();
    var box = el('div', { cls: 'hfs-qr', 'aria-label': 'QR-Code' });
    var inp = el('input', { cls: 'hfs-url', readonly: '', 'aria-label': 'Link' }); inp.value = url;
    inp.addEventListener('focus', function () { inp.select() });
    var btnPng = el('button', { cls: 'hfs-b', type: 'button', text: 'QR als Bild', disabled: '' });
    var row = el('div', { cls: 'hfs-row' }, [
      el('button', { cls: 'hfs-b hfs-pri', type: 'button', text: 'Link kopieren', onclick: function () { copy(url) } }),
      navigator.share ? el('button', { cls: 'hfs-b', type: 'button', text: 'Teilen …', onclick: function () {
        navigator.share({ title: title, url: url }).catch(function () {});
      } }) : null,
      btnPng,
      el('button', { cls: 'hfs-b', type: 'button', text: 'Drucken', onclick: function () {
        doc.body.classList.add('hfs-printing'); window.print();
        setTimeout(function () { doc.body.classList.remove('hfs-printing') }, 500);
      } }),
      el('button', { cls: 'hfs-b', type: 'button', text: 'Schließen', onclick: close })
    ]);
    var dlg = el('div', { cls: 'hfs-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Teilen' }, [
      el('h2', { text: title }),
      el('p', { text: 'Scanne den QR-Code mit der Kamera oder teile den Link.' }),
      box, inp, row
    ]);
    var ov = el('div', { cls: 'hfs-ov' }, [dlg]);
    ov.addEventListener('click', function (e) { if (e.target === ov) close() });
    function esc(e) { if (e.key === 'Escape') close() }
    function close() { ov.remove(); doc.removeEventListener('keydown', esc) }
    doc.addEventListener('keydown', esc);
    doc.body.appendChild(ov);
    if (!WEB) { box.textContent = 'QR-Code gibt es nur auf der Webseite (nicht in der Offline-Datei).'; box.style.fontSize = '13px'; return }
    box.textContent = '…';
    loadQR().then(function () {
      box.textContent = '';
      new window.QRCode(box, { text: url, width: 512, height: 512, colorDark: '#13202A', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
      var cv = box.querySelector('canvas');
      if (cv) {
        btnPng.disabled = false;
        btnPng.onclick = function () {
          var a = el('a', { href: cv.toDataURL('image/png'), download: 'QR_' + title.replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 60) + '.png' });
          doc.body.appendChild(a); a.click(); a.remove();
        };
      }
    }).catch(function () { box.textContent = 'QR-Code konnte nicht geladen werden.' });
  }

  /* ---------- Offline: Service Worker ---------- */
  if (WEB && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}) });
  }

  /* ---------- App-Kennung (vom Build gesetzt) ---------- */
  var meta = doc.querySelector('meta[name="hfs-app"]');
  var APP = { id: '', bereich: '', ver: '' };
  if (meta) { var p = String(meta.content || '').split('|'); APP = { id: p[0] || '', bereich: p[1] || '', ver: p[2] || '' } }

  /* ---------- Hinweis bei neuer Fassung ---------- */
  if (WEB && APP.ver) {
    fetch('version.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null }).then(function (v) {
      var neu = v && v.apps && typeof v.apps[APP.id] === 'string' ? v.apps[APP.id] : '';
      if (!neu || neu === APP.ver) return;
      doc.body.appendChild(el('div', { cls: 'hfs-upd', role: 'status' }, [
        'Es gibt eine neue Fassung dieser Seite.',
        el('button', { cls: 'hfs-b hfs-pri', type: 'button', text: 'Neu laden', onclick: function () { location.reload() } })
      ]));
    }).catch(function () {});
  }

  /* ---------- Knöpfe der Kopfleiste ---------- */
  function initBar() {
    var b = doc.querySelector('#hfs-bar .hfs-share');
    if (b) { b.hidden = false; b.addEventListener('click', function () { share(location.href, doc.title) }) }
    var bar = doc.getElementById('hfs-bar'), tab = bar && bar.querySelector('.hfs-tab');
    if (tab) {
      var setOpen = function (on) { bar.classList.toggle('hfs-open', on); tab.setAttribute('aria-expanded', on ? 'true' : 'false') };
      tab.addEventListener('click', function (e) { e.stopPropagation(); setOpen(!bar.classList.contains('hfs-open')) });
      doc.addEventListener('click', function (e) { if (!bar.contains(e.target)) setOpen(false) }, true);
      // Spiele fangen Tasten ab: Klicks in der Leiste nicht an das Spiel weitergeben
      ['keydown', 'pointerdown', 'touchstart', 'mousedown'].forEach(function (t) { bar.addEventListener(t, function (e) { e.stopPropagation() }) });
    }
  }

  /* ---------- Lösungssperre: Lösung erst nach abgegebener Antwort ---------- */
  function splitNumbered(html, n) {
    // teilt "1. … 2. … 3. …" in n Teile; nur fortlaufende Nummern zählen
    var parts = [], pos = 0, starts = [];
    for (var k = 1; k <= n; k++) {
      var re = new RegExp('(^|[\\s>(])' + k + '\\.\\s', 'g'); re.lastIndex = pos;
      var m = re.exec(html); if (!m) return null;
      var at = m.index + m[1].length; starts.push({ at: at, body: at + String(k).length + 1 }); pos = at + 2;
    }
    if (html.slice(0, starts[0].at).replace(/<[^>]*>/g, '').trim()) return null;   // Text vor "1." → nicht eindeutig
    for (var i = 0; i < n; i++) parts.push(html.slice(starts[i].body, i + 1 < n ? starts[i + 1].at : html.length).trim());
    return parts;
  }
  function tidy(h) {   // offene/geschlossene <p>-Reste nach dem Teilen glätten
    h = h.replace(/^(\s*<\/p>)+/i, '').replace(/(<p[^>]*>\s*)+$/i, '');
    var o = (h.match(/<p[\s>]/gi) || []).length, c = (h.match(/<\/p>/gi) || []).length;
    for (; c < o; c++) h += '</p>';
    for (; o < c; o++) h = '<p>' + h;
    return h;
  }

  function initSolutions() {
    var all = [].slice.call(doc.querySelectorAll('details')).filter(function (d) {
      var s = d.querySelector('summary'); return s && /^\s*Lösung/i.test(s.textContent);
    });
    if (!all.length || !APP.id) return;
    var KEY = 'hfs_antw_' + APP.id, store = {};
    try { store = JSON.parse(LS.get(KEY)) || {} } catch (e) { store = {} }
    function save() { LS.set(KEY, JSON.stringify(store)) }
    var tasks = [];   // {key, frage, ans}

    function solBox(html) {
      var b = el('div', { cls: 'hfs-sol' }); b.innerHTML = '<b class="hfs-sol-h">Musterlösung</b>' + html; return b;   // html stammt aus der eigenen Seite
    }
    function answerBlock(key, frage, solHtml, needAll) {
      var st = store[key] || {};
      var ta = el('textarea', { placeholder: 'Deine Antwort …', 'aria-label': 'Deine Antwort zu: ' + frage.slice(0, 80) });
      ta.value = st.t || '';
      var btn = el('button', { cls: 'hfs-b hfs-pri', type: 'button', text: 'Antwort abgeben' });
      var edit = el('button', { cls: 'hfs-b', type: 'button', text: 'Antwort ändern' });
      var hint = el('span', { cls: 'hfs-hint' });
      var sol = solBox(solHtml); var wrap = el('div', { cls: 'hfs-ans' }, [ta, el('div', { cls: 'hfs-row' }, [btn, edit, hint])]);
      wrap.appendChild(sol);
      function show() {
        var done = !!st.d;
        ta.readOnly = done; btn.hidden = done; edit.hidden = !done;
        var allDone = !needAll || tasks.every(function (t) { return store[t.key] && store[t.key].d });
        sol.hidden = !solHtml || !(done && allDone);
        hint.textContent = !done ? 'Die Musterlösung erscheint, nachdem du deine Antwort abgegeben hast.'
          : (allDone ? '' : 'Beantworte noch die übrigen Aufgaben, dann erscheint die Musterlösung.');
      }
      btn.addEventListener('click', function () {
        if (ta.value.replace(/\s/g, '').length < 3) { hint.textContent = 'Schreib zuerst eine Antwort (mindestens ein paar Wörter).'; ta.focus(); return }
        st = store[key] = { t: ta.value, d: 1 }; save(); refresh();
      });
      edit.addEventListener('click', function () { st.d = 0; store[key] = st; save(); refresh(); ta.focus() });
      ta.addEventListener('input', function () { st.t = ta.value; store[key] = st; save() });
      tasks.push({ key: key, frage: frage, ta: ta, show: show });
      return wrap;
    }
    function refresh() { tasks.forEach(function (t) { t.show() }) }

    all.forEach(function (det, di) {
      var parent = det.parentNode;
      var body = [].slice.call(det.childNodes).filter(function (n) { return !(n.nodeType === 1 && n.tagName === 'SUMMARY') })
        .map(function (n) { return n.nodeType === 1 ? n.outerHTML : (n.textContent || '') }).join('').trim();
      // Fall A: Liste von Arbeitsaufträgen davor, Lösungen nummeriert in einem Block
      var ol = null, prev = det.previousElementSibling;
      while (prev) { if (prev.tagName === 'OL') { ol = prev; break } prev = prev.previousElementSibling }
      if (ol) {
        var lis = [].slice.call(ol.children).filter(function (x) { return x.tagName === 'LI' });
        var inner = body.replace(/^\s*<p[^>]*>/i, '').replace(/<\/p>\s*$/i, '');
        var olSol = det.querySelector('ol');
        var parts = olSol && olSol.children.length === lis.length ? [].map.call(olSol.children, function (x) { return x.innerHTML })
          : splitNumbered(inner, lis.length);
        if (parts) {
          lis.forEach(function (li, i) { li.appendChild(answerBlock(di + '.' + i, li.textContent.trim(), '<p>' + tidy(parts[i]) + '</p>', false)) });
        } else {
          lis.forEach(function (li, i) { li.appendChild(answerBlock(di + '.' + i, li.textContent.trim(), '', true)) });
          var last = tasks[tasks.length - 1]; // gesamte Lösung unter die letzte Aufgabe
          var all2 = solBox(body); var lastWrap = lis[lis.length - 1].querySelector('.hfs-ans');
          lastWrap.replaceChild(all2, lastWrap.querySelector('.hfs-sol'));
          var oldShow = last.show; last.show = function () { oldShow(); all2.hidden = !tasks.every(function (t) { return store[t.key] && store[t.key].d }) };
        }
        parent.insertBefore(tools(), det);
      } else {
        // Fall B: eine Lösung je Aufgabe (z. B. <div class="task"><p>Frage</p><details>…)
        var q = det.previousElementSibling, frage = q ? q.textContent.trim() : 'Aufgabe ' + (di + 1);
        parent.insertBefore(answerBlock(di + '.0', frage, body, false), det);
        if (di === all.length - 1) {
          var host = parent.parentNode; host.parentNode.insertBefore(tools(), host.nextSibling);
        }
      }
      det.remove();
    });
    refresh();

    function tools() {
      return el('div', { cls: 'hfs-tools' }, [
        el('button', { cls: 'hfs-b', type: 'button', text: 'Antworten als Datei speichern', onclick: exportTxt }),
        el('button', { cls: 'hfs-b', type: 'button', text: 'Antworten löschen', onclick: function () {
          if (!confirm('Alle Antworten auf dieser Seite löschen?')) return;
          store = {}; LS.del(KEY); tasks.forEach(function (t) { t.ta.value = '' }); refresh();
        } }),
        el('span', { text: 'Deine Antworten bleiben nur auf diesem Gerät gespeichert.' })
      ]);
    }
    function exportTxt() {
      var d = new Date(), lines = [doc.title, 'Antworten vom ' + d.toLocaleDateString('de-DE') + ', ' + d.toLocaleTimeString('de-DE').slice(0, 5), ''];
      tasks.forEach(function (t, i) { lines.push('Aufgabe ' + (i + 1) + ': ' + t.frage.replace(/\s+/g, ' '), 'Antwort: ' + (t.ta.value.trim() || '–'), '') });
      lines.push('Quelle: ' + cleanUrl(location.href));
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
      var a = el('a', { href: URL.createObjectURL(blob), download: 'Antworten_' + doc.title.replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 50) + '.txt' });
      doc.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove() }, 1000);
    }
  }

  /* ---------- Zuordnen: „Lösung zeigen“ erst nach „Prüfen“ ---------- */
  function initZuordnen() {
    var solve = doc.getElementById('solve'); if (!solve) return;
    function lock(on) { solve.disabled = on; solve.classList.toggle('hfs-solve-locked', on); solve.title = on ? 'Erst „Prüfen“ drücken' : '' }
    lock(true);
    doc.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('button') : null; if (!t) return;
      if (t.id === 'check') setTimeout(function () { lock(false) }, 0);
      else if (t.id === 'shuffle' || (t.parentNode && t.parentNode.id === 'chips')) setTimeout(function () { lock(true) }, 0);
    }, true);
  }

  /* ---------- Lernkartei: optional erst eigene Antwort tippen, dann umdrehen ---------- */
  function initLernkartei() {
    var flip = doc.getElementById('flip'), q = doc.getElementById('qTxt'), stage = flip && flip.closest('.stage');
    if (!flip || !q || !stage) return;
    var ta = el('textarea', { placeholder: 'Deine Antwort (freiwillig) – erst überlegen, dann umdrehen …', 'aria-label': 'Deine Antwort zur Karte' });
    ta.style.minHeight = '64px';
    var mine = el('div', { cls: 'hfs-sol' }); mine.style.borderLeftColor = '#0089C4'; mine.style.background = '#E3F3FA';
    var mineH = el('b', { cls: 'hfs-sol-h', text: 'Deine Antwort' }); mineH.style.color = '#006A98';
    var mineT = el('div'); mineT.style.whiteSpace = 'pre-line';
    mine.appendChild(mineH); mine.appendChild(mineT); mine.hidden = true;
    var box = el('div', { cls: 'hfs-ans' }, [ta]);
    stage.parentNode.insertBefore(box, stage);
    stage.parentNode.insertBefore(mine, stage.nextSibling);
    function sync() {
      var shown = flip.classList.contains('show'), t = ta.value.trim();
      mineT.textContent = t; mine.hidden = !(shown && t); box.hidden = shown;
    }
    new MutationObserver(sync).observe(flip, { attributes: true, attributeFilter: ['class'] });
    var lastQ = q.textContent;
    new MutationObserver(function () { if (q.textContent !== lastQ) { lastQ = q.textContent; ta.value = ''; sync() } })
      .observe(q, { childList: true, characterData: true, subtree: true });
  }

  function start() {
    initBar();
    try { initSolutions() } catch (e) { if (window.console) console.warn('Lösungssperre:', e) }
    if (APP.id === 'zuordnen') initZuordnen();
    if (APP.id === 'lernkartei') initLernkartei();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();

  window.HFS = { device: device, share: share, copy: copy, toast: toast, web: WEB, store: LS };
})();
