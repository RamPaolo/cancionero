/* Cancionero — parte 1: datos, estado y dibujo de la hoja */
(function () {
'use strict';
var C = window.Core;
var app = document.getElementById('app');
var sheetRoot = document.getElementById('sheet-root');
var toastEl = document.getElementById('toast');

/* ---------- utilidades ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function normShift(s) { var d = C.mod12(s); return d > 6 ? d - 12 : d; }
function shiftLabel(d) { return d === 0 ? 'original' : (d > 0 ? '+' : '−') + Math.abs(d); }
function newId(p) { return (p || 'u') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
var toastTimer;
function toast(msg, ms) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 2600);
}

var ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>', minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="currentColor"/>', pause: '<path d="M9 5v14M15 5v14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
  print: '<path d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  metro: '<path d="M8 21h8L14 4h-4L8 21zM12 15l5-8"/>', video: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>', chev: '<path d="M6 9l6 6 6-6"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  install: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', publish: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
  keys: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M13 4v16M18 4v16"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', rec: '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>', speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  add: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', upload: '<path d="M12 20V8M7 13l5-5 5 5M5 4h14"/>', text: '<path d="M4 18L9 6l5 12M5.8 14h6.4M15 18l3-7 3 7M15.9 16h4.2"/>'
};
function icon(n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[n] || '') + '</svg>'; }
function btnIcon(n, label, attrs, text) {
  return '<button type="button" class="iconbtn" aria-label="' + esc(label) + '" title="' + esc(label) + '" ' + (attrs || '') + '>' + icon(n) + (text ? '<span>' + esc(text) + '</span>' : '') + '</button>';
}

/* ---------- almacenamiento en este equipo ---------- */
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};
var prefs = Object.assign({ size: (window.innerWidth >= 900 ? 24 : 20), theme: 'auto', notation: 'en', spell: 'auto', align: 'center', chords: true, speed: 4, awake: true }, LS.get('cfp.prefs.v1', {}));
function savePrefs() { LS.set('cfp.prefs.v1', prefs); applyPrefs(); }
function applyPrefs() {
  var r = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') r.setAttribute('data-theme', prefs.theme); else r.removeAttribute('data-theme');
  r.style.setProperty('--fs', Math.max(13, Math.min(44, prefs.size)) + 'px');
  r.style.setProperty('--align', prefs.align === 'left' ? 'left' : 'center');
  var dark = prefs.theme === 'dark' || (prefs.theme === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#10142a' : '#ffffff');
}
applyPrefs();

/* ---------- cancioneros ----------
   «grupo»: el cancionero compartido. Se descarga de canciones.json y se guarda para usarlo sin internet.
   Los demás son cancioneros propios de cada persona, guardados solo en su equipo.
   En todos, los cambios de quien usa la app van en una capa aparte («local») sobre la base. */
var EMBED = null;
try { EMBED = JSON.parse(document.getElementById('cancionero-datos').textContent); } catch (e) { EMBED = null; }
var DEFAULT_GROUP = { id: 'nuevas', name: 'Canciones nuevas', color: '#737892' };
var PALETTE = ['#e8474f', '#6f77e0', '#b7800a', '#d9558f', '#d8680f', '#22897f', '#4a78d8', '#2f8553', '#8e5bd0', '#737892'];
var BOOKS = LS.get('cfp.books.v1', null);
if (!BOOKS || !Array.isArray(BOOKS.list)) BOOKS = { active: 'grupo', list: [] };
if (!BOOKS.list.some(function (b) { return b.id === 'grupo'; })) BOOKS.list.unshift({ id: 'grupo', kind: 'remote' });
function saveBooks() { LS.set('cfp.books.v1', BOOKS); }
function activeBook() {
  for (var i = 0; i < BOOKS.list.length; i++) if (BOOKS.list[i].id === BOOKS.active) return BOOKS.list[i];
  BOOKS.active = 'grupo'; return BOOKS.list[0];
}
function isGroup() { return activeBook().kind === 'remote'; }
function bk(k, id) { return 'cfp.b.' + (id || BOOKS.active) + '.' + k; }
function emptyLocal() { return { songs: {}, deleted: {}, setlists: {}, setDeleted: {}, groups: {} }; }
function emptyBook(name) {
  return { app: 'cancionero-fdp', type: 'cancionero', name: name || 'Mi cancionero', subtitle: '', version: new Date().toISOString(),
           songs: [], setlists: [], groups: [clone(DEFAULT_GROUP)] };
}
var DATA = null, GMAP = {}, GROUPS = [], local = emptyLocal(), viewState = {};
var dataState = { fromCopy: false, source: 'incluida' };
function setData(d) {
  d = (d && typeof d === 'object') ? clone(d) : emptyBook('Cancionero');
  d.songs = Array.isArray(d.songs) ? d.songs : [];
  d.setlists = Array.isArray(d.setlists) ? d.setlists : [];
  d.groups = Array.isArray(d.groups) && d.groups.length ? d.groups : [clone(DEFAULT_GROUP)];
  DATA = d; infoCache = {};
  rebuildGroups();
}
function rebuildGroups() {
  var lg = local.groups || {};
  var list = DATA.groups.map(function (g) { return clone(lg[g.id] || g); });
  Object.keys(lg).forEach(function (id) { if (!list.some(function (g) { return g.id === id; })) list.push(clone(lg[id])); });
  if (!list.some(function (g) { return g.id === 'nuevas'; })) list.push(clone(DEFAULT_GROUP));
  GMAP = {}; GROUPS = list;
  list.forEach(function (g, i) { g.idx = i + 1; GMAP[g.id] = g; });
}
function saveLocal() { if (!LS.set(bk('local'), local)) toast('No se pudo guardar en este equipo (almacenamiento lleno o bloqueado).', 4000); }
function saveView() { LS.set(bk('view'), viewState); }
function bookTitle() {
  var b = activeBook();
  return b.kind === 'remote' ? (DATA.name || 'Cancionero del grupo') : (b.name || DATA.name || 'Mi cancionero');
}
/* Abre el cancionero activo con lo que ya hay en el equipo: aparece al instante, sin esperar a internet. */
function openBookData() {
  var b = activeBook();
  local = Object.assign(emptyLocal(), LS.get(bk('local'), {}) || {});
  viewState = LS.get(bk('view'), {}) || {};
  if (b.kind === 'local') {
    setData(LS.get(bk('base'), null) || emptyBook(b.name));
    dataState = { fromCopy: false, source: 'equipo' };
    return;
  }
  var cached = LS.get(bk('cache'), null);
  if (cached && Array.isArray(cached.songs) && (!EMBED || !EMBED.version || String(cached.version) >= String(EMBED.version))) {
    setData(cached); dataState = { fromCopy: true, source: 'copia' };
  } else { setData(EMBED); dataState = { fromCopy: true, source: 'incluida' }; }
  applyPublished();
}
/* Pide la última versión de canciones.json. Sin internet, el service worker responde con la copia guardada. */
function fetchRemote() {
  if (!isGroup() || !/^https?:$/.test(location.protocol)) return Promise.resolve('sin-web');
  var bookId = BOOKS.active;
  return fetch('canciones.json', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var copy = r.headers.get('X-Cancionero-Copia') === '1';
    return r.json().then(function (d) { return { d: d, copy: copy }; });
  }).then(function (x) {
    if (BOOKS.active !== bookId) return 'otro';
    if (!x.d || !Array.isArray(x.d.songs)) throw new Error('formato');
    dataState = { fromCopy: x.copy, source: x.copy ? 'copia' : 'internet' };
    var changed = !DATA || x.d.version !== DATA.version;
    LS.set(bk('cache'), x.d);
    if (changed) { setData(x.d); applyPublished(); }
    return changed ? 'nuevo' : 'igual';
  }).catch(function () { dataState.fromCopy = true; return 'sin-red'; });
}
/* Cuando llega a este equipo la versión que se publicó desde aquí, se quitan de la capa local
   solo los cambios que ya van incluidos en ella; lo que se editó después de publicar se conserva. */
function markPublished(version) { LS.set(bk('pub'), { version: version, snap: clone(local) }); }
function applyPublished() {
  var p = LS.get(bk('pub'), null);
  if (!p || !DATA || p.version !== DATA.version) return;
  var snap = p.snap || {};
  ['songs', 'setlists', 'groups'].forEach(function (k) {
    Object.keys(snap[k] || {}).forEach(function (id) {
      if (local[k] && local[k][id] && JSON.stringify(local[k][id]) === JSON.stringify(snap[k][id])) delete local[k][id];
    });
  });
  ['deleted', 'setDeleted'].forEach(function (k) { Object.keys(snap[k] || {}).forEach(function (id) { if (local[k]) delete local[k][id]; }); });
  saveLocal(); LS.del(bk('pub')); rebuildGroups();
}

/* ---------- canciones y repertorios (base publicada + cambios de este equipo) ---------- */
var SONG_FIELDS = ['id', 'num', 'title', 'author', 'group', 'momento', 'page', 'src', 'refs', 'refText', 'key', 'play', 'style', 'bpm', 'timeline'];
function cleanSong(s) { var o = {}; SONG_FIELDS.forEach(function (f) { if (s[f] !== undefined && s[f] !== '' && s[f] !== null) o[f] = s[f]; }); if (!o.src) o.src = ''; return o; }
function allSongs() {
  var out = [], seen = {};
  DATA.songs.forEach(function (s) { if (local.deleted[s.id]) return; out.push(local.songs[s.id] || s); seen[s.id] = 1; });
  Object.keys(local.songs).forEach(function (id) { if (!seen[id] && !local.deleted[id]) out.push(local.songs[id]); });
  return out;
}
function baseSong(id) { for (var i = 0; i < DATA.songs.length; i++) if (DATA.songs[i].id === id) return DATA.songs[i]; return null; }
function getSong(id) { if (id && syncOverride[id]) return syncOverride[id]; if (!id || local.deleted[id]) return null; return local.songs[id] || baseSong(id); }
function allSetlists() {
  var out = [], seen = {};
  DATA.setlists.forEach(function (s) { if (local.setDeleted[s.id]) return; out.push(local.setlists[s.id] || s); seen[s.id] = 1; });
  Object.keys(local.setlists).forEach(function (id) { if (!seen[id] && !local.setDeleted[id]) out.push(local.setlists[id]); });
  return out;
}
function getSetlist(id) { var l = allSetlists(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function saveSetlist(sl) { local.setlists[sl.id] = clone(sl); saveLocal(); }
function localChangeCount() {
  return Object.keys(local.songs).length + Object.keys(local.deleted).length + Object.keys(local.setlists).length +
    Object.keys(local.setDeleted).length + Object.keys(local.groups || {}).length;
}
function songStatus(s) {
  if (local.songs[s.id]) return baseSong(s.id) ? 'editada' : 'nueva';
  return '';
}

var infoCache = {};
function keyFromStr(s) {
  if (!s) return null;
  var c = C.parseChord(String(s).trim());
  return c ? { pc: c.root, minor: C.isMinorQual(c.qual) } : null;
}
function info(song) {
  var sig = song.src + '\u0001' + (song.key || '');
  var c = infoCache[song.id];
  if (c && c.sig === sig) return c;
  var lines = C.parseSong(song.src), chords = C.chordsInSong(lines), seq = [];
  lines.forEach(function (l) { if (l.segs) l.segs.forEach(function (g) { if (g.c !== null && C.isChordTok(g.c)) seq.push(g.c); }); });
  var detected = C.detectKey(chords);
  var text = lines.map(function (l) { return l.segs ? l.segs.map(function (g) { return g.t; }).join('') : (l.text || ''); }).join('\n');
  var bpm = song.bpm || null;
  if (!bpm) { var m = /tempo[^:\n]*:\s*(\d{2,3})\s*bpm/i.exec(song.src); if (m) bpm = +m[1]; }
  c = { sig: sig, lines: lines, chords: chords, seq: seq, key: keyFromStr(song.key) || detected, detected: detected,
        plain: text, norm: C.normalize(text), bpm: bpm };
  infoCache[song.id] = c;
  return c;
}

/* ---------- tono y cejilla ---------- */
var ctx = { setlist: null, index: -1 };
function songShift(song, ignoreSet) {
  if (sync.role === 'sigue' && sync.songId === song.id && sync.sh != null) return sync.sh;     // el tono de quien guía
  if (!ignoreSet && ctx.setlist) {
    var it = ctx.setlist.items[ctx.index];
    if (it && it.id === song.id && it.shift != null) return it.shift;
  }
  var v = viewState[song.id];
  if (v && v.shift != null) return v.shift;
  return song.play || 0;
}
function songCapo(song) { var v = viewState[song.id]; return (v && v.capo) || 0; }
function setView(song, patch) { viewState[song.id] = Object.assign({}, viewState[song.id] || {}, patch); saveView(); }
function spellFor(key, shift) {
  if (prefs.spell === 'sharp' || prefs.spell === 'flat') return prefs.spell;
  return C.spellForKey(C.mod12(key.pc + shift), key.minor);
}
function keyLabel(key, shift) {
  return C.keyName({ pc: C.mod12(key.pc + shift), minor: key.minor }, spellFor(key, shift), prefs.notation);
}
/* Formateador de acordes para un desplazamiento dado (en semitonos respecto al original). */
function fmtFor(key, eff, nota) {
  var spell = spellFor(key, eff), keep = C.mod12(eff) === 0 && prefs.spell === 'auto', notation = nota || prefs.notation;
  if (notation === 'num') {
    var base = key.minor ? key.pc + 3 : key.pc;       // el número no cambia al transponer ni con cejilla
    return function (tok) {
      if (!C.isChordTok(tok)) return tok;
      var p = C.splitTok(tok), sc = C.simpleChord(p.core);
      return sc ? p.pre + C.numLabel(C.mod12(sc.root - base), sc.suf) + p.post : tok;
    };
  }
  return function (tok) { return C.transposeTok(tok, { shift: eff, spell: spell, notation: notation, keep: keep }); };
}
function songFmt(song) { var inf = info(song); return fmtFor(inf.key, songShift(song) - songCapo(song)); }

/* ---------- dibujo de la hoja: acordes anclados a la sílaba ---------- */
function anchorHTML(tok, fmt, n) {
  var ok = C.isChordTok(tok);
  return '<span class="a"><b class="ch' + (ok ? '' : ' x') + '"' +
    (ok ? ' tabindex="0" role="button" data-c="' + esc(tok) + '" data-i="' + n.i++ + '"' : '') + '>' +
    esc(ok ? fmt(tok) : tok) + '</b></span>';
}
function lyricHTML(line, fmt, n) {
  var hasCh = false, out = [], cur = null, pend = [];
  function flush() { if (cur) { out.push('<span class="w">' + cur.join('') + '</span>'); cur = null; } }
  line.segs.forEach(function (s) {
    if (s.c !== null) {
      hasCh = true;
      var a = anchorHTML(s.c, fmt, n);
      if (cur) cur.push(a); else pend.push(a);
    }
    if (!s.t) return;
    s.t.split(/(\s+)/).forEach(function (run) {
      if (!run) return;
      if (/^\s+$/.test(run)) { flush(); if (out.length) out.push(' '); return; }
      if (!cur) { cur = pend; pend = []; }
      cur.push(esc(run));
    });
  });
  if (pend.length) { cur = (cur || []).concat(pend); pend = []; }
  flush();
  while (out.length && out[out.length - 1] === ' ') out.pop();
  return '<p class="ln' + (hasCh ? ' hc' : '') + '">' + (out.join('') || '&nbsp;') + '</p>';
}
function instrHTML(line, fmt, n) {
  return '<p class="instr">' + line.segs.map(function (s) {
    var h = '';
    if (s.c !== null) {
      h = C.isChordTok(s.c)
        ? '<b class="ci" tabindex="0" role="button" data-c="' + esc(s.c) + '" data-i="' + n.i++ + '">' + esc(fmt(s.c)) + '</b>'
        : esc(s.c);
    }
    return h + esc(s.t);
  }).join('') + '</p>';
}
function bodyHTML(song, fmt) {
  var inf = info(song), h = [], n = { i: 0 }, lastGap = true;
  inf.lines.forEach(function (l) {
    if (l.type === 'blank') { if (!lastGap) h.push('<div class="gap"></div>'); lastGap = true; return; }
    lastGap = false;
    if (l.type === 'label') h.push('<h3 class="lbl">' + esc(C.sentenceCase(l.text)) + '</h3>');
    else if (l.type === 'note') h.push('<p class="note">' + esc(C.sentenceCase(l.text)) + '</p>');
    else if (l.type === 'instr') h.push(instrHTML(l, fmt, n));
    else h.push(lyricHTML(l, fmt, n));
  });
  return h.join('');
}
/* Si dos acordes vecinos se tocan, se abre el espacio justo necesario antes del segundo.
   El acorde nunca se mueve de su sílaba: solo la letra se separa un poco en ese punto.
   Si un acorde se sale por la derecha, esa línea usa menos ancho para que la palabra baje de renglón. */
function separateChords(ln) {
  var as = ln.querySelectorAll('.a'), prev = null, j;
  for (j = 0; j < as.length; j++) as[j].style.marginLeft = '';
  for (j = 0; j < as.length; j++) {
    var a = as[j], ch = a.firstChild, r = ch.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (prev && Math.abs(r.top - prev.top) < 4) {
      var gap = Math.max(4, r.height * 0.3);
      if (r.left < prev.right + gap) {
        // el empuje se conserva aunque la palabra baje de renglón: sus acordes siguen juntos allí
        a.style.marginLeft = (prev.right + gap - r.left).toFixed(1) + 'px';
        r = ch.getBoundingClientRect();
      }
    }
    prev = r;
  }
}
function chordOverflow(ln) {
  var R = ln.getBoundingClientRect().right, mx = -Infinity, cs = ln.querySelectorAll('.ch'), j;
  for (j = 0; j < cs.length; j++) { var r = cs[j].getBoundingClientRect(); if (r.width) mx = Math.max(mx, r.right); }
  return mx - R;
}
function fixCollisions(root) {
  if (!root) return;
  var lines = root.querySelectorAll('.ln.hc'), i;
  for (i = 0; i < lines.length; i++) { lines[i].style.paddingRight = ''; }
  for (i = 0; i < lines.length; i++) {
    var ln = lines[i];
    separateChords(ln);
    for (var tries = 0; tries < 6; tries++) {
      var o = chordOverflow(ln);
      if (o <= 0.5) break;
      ln.style.paddingRight = ((parseFloat(ln.style.paddingRight) || 0) + o * 2 + 2).toFixed(1) + 'px';
      separateChords(ln);
    }
  }
}

/* parte 2: pantallas (inicio, canción, repertorios) */
ICONS.fwd = '<path d="M9 5l7 7-7 7"/>';
ICONS.star = '<path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z"/>';
ICONS.user = '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c0-4.2 3.4-6.8 7.5-6.8s7.5 2.6 7.5 6.8"/>';
var homeState = { q: '', group: 'todas', scroll: 0 };
var route = { name: '' };
var current = { song: null, setlist: null };
var install = { evt: null };
/* «Ahora no» oculta el aviso de instalar 3 semanas (antes era para siempre, y al desinstalar no volvía a aparecer) */
function installSnoozed() { var t = +LS.get('cfp.installHideT', 0); return t > 0 && Date.now() - t < 21 * 864e5; }
function isStandalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
var live = document.createElement('div');
live.className = 'sr'; live.setAttribute('aria-live', 'polite'); document.body.appendChild(live);
function announce(msg) { live.textContent = ''; setTimeout(function () { live.textContent = msg; }, 30); }
function enc(s) { return encodeURIComponent(s); }

/* ---------- inicio ---------- */
function publishBannerHTML() {
  var h = '', n = localChangeCount();
  if (n && isGroup()) {
    h += '<div class="banner"><p>' + (n === 1 ? 'Hay 1 cambio guardado' : 'Hay ' + n + ' cambios guardados') +
      ' solo en este equipo. Publícalos para que todos los vean.</p>' +
      '<button type="button" class="btn primary" data-act="publish">' + icon('publish') + 'Publicar para todos</button></div>';
  }
  if (install.evt && !isStandalone() && !installSnoozed()) {
    h += '<div class="banner"><p>Instala el cancionero en este equipo: se abre como una app y funciona sin internet.</p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-act="install">' + icon('install') + 'Instalar</button>' +
      '<button type="button" class="btn" data-act="installhide">Ahora no</button></div></div>';
  }
  return h;
}
function groupOf(s) { return GMAP[s.group] ? s.group : 'nuevas'; }
function tabsHTML(songs) {
  var count = {};
  songs.forEach(function (s) { var g = groupOf(s); count[g] = (count[g] || 0) + 1; });
  return '<button type="button" class="tab" data-tab="todas" aria-pressed="' + (homeState.group === 'todas') + '">Todas</button>' +
    GROUPS.filter(function (g) { return count[g.id]; }).map(function (g) {
      return '<button type="button" class="tab" data-tab="' + esc(g.id) + '" aria-pressed="' + (homeState.group === g.id) + '" style="--g:' + g.color + '"><span class="dot"></span>' + esc(g.name) + '</button>';
    }).join('');
}
function subLine(s) {
  var p = [];
  if (s.momento) p.push('<span class="pill">' + esc(C.sentenceCase(s.momento)) + '</span>');
  var st = isGroup() ? songStatus(s) : ''; if (st) p.push('<span class="pill">' + st + '</span>');
  if (s.author) p.push(esc(C.nameCase(s.author)));
  return p.join(' ');
}
function rowHTML(s, sub) {
  var g = GMAP[groupOf(s)], inf = info(s);
  return '<li><a class="row" href="#/s/' + enc(s.id) + '" style="--g:' + g.color + '">' +
    '<span class="num">' + esc(s.num || '') + '</span>' +
    '<span class="txt"><span class="ttl">' + esc(C.sentenceCase(s.title)) + '</span>' +
    '<span class="sub">' + (sub != null ? sub : subLine(s)) + '</span></span>' +
    '<span class="key"><span class="sr">Tono </span>' + esc(keyLabel(inf.key, songShift(s, true))) + '</span></a></li>';
}
function snippet(plain, pos, len) {
  var a = Math.max(0, pos - 26), b = Math.min(plain.length, pos + len + 34);
  function clean(t) { return esc(t).replace(/\n+/g, ' / '); }
  return (a > 0 ? '…' : '') + clean(plain.slice(a, pos)) + '<mark>' + clean(plain.slice(pos, pos + len)) + '</mark>' + clean(plain.slice(pos + len, b)) + (b < plain.length ? '…' : '');
}
function searchSongs(songs, q) {
  var nq = C.normalize(q).replace(/\s+/g, ' ').trim(), words = nq.split(' '), res = [];
  songs.forEach(function (s) {
    var inf = info(s), t = C.normalize(s.title), a = C.normalize(s.author || ''), score = 0, sn = null, p;
    if (/^\d+$/.test(nq) && String(s.num) === nq) score = 100;
    else if (t.indexOf(nq) === 0) score = 80;
    else if (t.indexOf(nq) >= 0) score = 60;
    else if (words.every(function (w) { return t.indexOf(w) >= 0; })) score = 50;
    else if (a.indexOf(nq) >= 0) score = 30;
    else if ((p = inf.norm.indexOf(nq)) >= 0) { score = 20; sn = snippet(inf.plain, p, nq.length); }
    else if (words.length > 1 && words.every(function (w) { return inf.norm.indexOf(w) >= 0; })) score = 10;
    if (score) res.push({ s: s, score: score, sn: sn });
  });
  res.sort(function (x, y) { return y.score - x.score || ((+x.s.num || 999) - (+y.s.num || 999)); });
  return res;
}
function resultsHTML() {
  var songs = allSongs();
  if (homeState.q.trim()) {
    var r = searchSongs(songs, homeState.q);
    if (!r.length) return '<p class="empty">Ninguna canción tiene «' + esc(homeState.q.trim()) + '». Prueba con otra palabra de la letra o crea una <a href="#/e/nueva">canción nueva</a>.</p>';
    return '<ul class="list">' + r.map(function (x) { return rowHTML(x.s, x.sn); }).join('') + '</ul>';
  }
  if (!songs.length) {
    return '<div class="empty"><p>Este cancionero todavía no tiene canciones.</p><p><a class="btn primary" href="#/e/nueva">' + icon('add') +
      'Crear la primera canción</a></p><p>También puedes traer canciones de un archivo desde «Más opciones», en «Cancioneros».</p></div>';
  }
  var h = '';
  GROUPS.forEach(function (g) {
    if (homeState.group !== 'todas' && homeState.group !== g.id) return;
    var list = songs.filter(function (s) { return groupOf(s) === g.id; });
    if (!list.length) return;
    h += '<section><h2 class="grp-h" style="--g:' + g.color + '"><span class="bt">' + g.idx + '</span>' + esc(g.name) +
      '<small>' + list.length + (list.length === 1 ? ' canción' : ' canciones') + '</small></h2><ul class="list">' +
      list.map(function (s) { return rowHTML(s); }).join('') + '</ul></section>';
  });
  return h || '<p class="empty">Esta sección está vacía.</p>';
}
function versionText() {
  if (!isGroup()) return 'Cancionero guardado solo en este equipo.';
  var d = DATA.version ? new Date(DATA.version) : null, t = '';
  if (d && !isNaN(d)) t = 'Versión publicada el ' + d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' }) + '.';
  if (dataState.fromCopy && (dataState.source === 'copia' || navigator.onLine === false)) t += ' Sin conexión: usando la copia guardada en este equipo.';
  return t;
}
function renderHome() {
  leaveSong();
  var songs = allSongs();
  app.innerHTML = '<div class="home">' +
    '<header class="hero"><div class="grow"><h1>Cancionero</h1>' +
    '<button type="button" class="bookbtn" data-act="books" aria-label="Cancionero abierto: ' + esc(bookTitle()) + '. Cambiar de cancionero">' +
    '<span>' + esc(bookTitle()) + '</span>' + icon('chev') + '</button>' +
    (isGroup() && DATA.subtitle ? '<p class="sub">' + esc(DATA.subtitle) + '</p>' : '') + '</div>' +
    '<div class="hero-actions">' + btnIcon('list', 'Repertorios', 'data-go="#/r"') + btnIcon('more', 'Más opciones', 'data-act="homemenu"') + '</div></header>' +
    '<div id="pubslot">' + publishBannerHTML() + '</div>' + stuChipsHTML() +
    '<div class="searchbar"><label class="search">' + icon('search') + '<span class="sr">Buscar canción</span>' +
    '<input id="q" type="search" enterkeyhint="search" placeholder="Buscar por título, número o letra" autocomplete="off" value="' + esc(homeState.q) + '"></label></div>' +
    '<nav class="tabs" aria-label="Secciones del cancionero">' + tabsHTML(songs) + '</nav>' +
    '<div id="results">' + resultsHTML() + '</div>' +
    '<footer class="foot"><div class="btnrow"><a class="btn" href="#/e/nueva">' + icon('add') + 'Nueva canción</a>' +
    '<a class="btn" href="#/r">' + icon('list') + 'Repertorios</a>' +
    '<a class="btn" href="#/a">' + icon('user') + 'Modo alumno</a>' +
    '<button type="button" class="btn" data-act="help">Cómo se usa</button></div>' +
    '<p id="vtext">' + songs.length + (songs.length === 1 ? ' canción. ' : ' canciones. ') + esc(versionText()) + '</p></footer></div>';
  var q = document.getElementById('q');
  q.addEventListener('input', debounce(function () {
    homeState.q = q.value;
    document.getElementById('results').innerHTML = resultsHTML();
  }, 110));
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { var first = app.querySelector('#results .row'); if (first) location.hash = first.getAttribute('href'); }
  });
  var y = homeState.scroll || 0;
  requestAnimationFrame(function () { window.scrollTo(0, y); });
}
/* Acceso rápido a los alumnos de este equipo (si hay). */
function stuChipsHTML() {
  var l = stuData().list; if (!l.length) return '';
  return '<nav class="stu-chips" aria-label="Alumnos">' + l.map(function (pr) {
    return '<a class="chip" href="#/a/' + enc(pr.id) + '"><span class="avatar sm" style="--c:' + esc(pr.color) + '">' + esc(pr.name.charAt(0).toUpperCase()) + '</span>' + esc(pr.name) + '</a>';
  }).join('') + '<a class="chip more" href="#/a">' + icon('user') + 'Modo alumno</a></nav>';
}
function refreshChrome() {
  if (route.name !== 'home') return;
  var slot = document.getElementById('pubslot'); if (slot) slot.innerHTML = publishBannerHTML();
  var vt = document.getElementById('vtext');
  if (vt) { var n = allSongs().length; vt.textContent = n + (n === 1 ? ' canción. ' : ' canciones. ') + versionText(); }
}

/* ---------- canción ---------- */
function keyLineHTML(song) {
  var inf = info(song), sh = songShift(song), capo = songCapo(song);
  var s = C.mod12(sh) === 0 ? 'Tono original <b>' + esc(keyLabel(inf.key, 0)) + '</b>.'
    : 'Suena en <b>' + esc(keyLabel(inf.key, sh)) + '</b>, el original es ' + esc(keyLabel(inf.key, 0)) + '.';
  if (capo) s += ' Con cejilla ' + capo + ' tocas formas de <b>' + esc(keyLabel(inf.key, sh - capo)) + '</b>.';
  if (ctx.setlist) s += ' Tono guardado en «' + esc(ctx.setlist.name) + '».';
  return s;
}
function shortUrl(u) { return String(u).replace(/^https?:\/\/(www\.)?/, '').replace(/[?&]list=[^&]*/, '').slice(0, 42); }
function neighbor(dir) {
  if (!ctx.setlist) return -1;
  for (var i = ctx.index + dir; i >= 0 && i < ctx.setlist.items.length; i += dir) if (getSong(ctx.setlist.items[i].id)) return i;
  return -1;
}
function renderSong(id, setId, idx) {
  leaveSong();
  var song = getSong(id);
  if (!song) {
    app.innerHTML = '<div class="page"><div class="page-h">' + btnIcon('back', 'Volver', 'data-go="#/"') + '<h1>No encontrada</h1></div><p class="empty">Esta canción ya no está en el cancionero.</p></div>';
    return;
  }
  ctx.setlist = null; ctx.index = -1;
  if (setId) { var sl = getSetlist(setId); if (sl && sl.items[idx] && sl.items[idx].id === id) { ctx.setlist = sl; ctx.index = idx; } }
  current.song = song;
  var inf = info(song), g = GMAP[groupOf(song)], sh = songShift(song), capo = songCapo(song), kn = keyLabel(inf.key, sh), studs = stuData().list;
  var ctrl = '<div class="ctrl" role="toolbar" aria-label="Controles de la canción">' +
    btnIcon('back', ctx.setlist ? 'Volver al repertorio' : 'Volver a la lista', 'data-act="back"') +
    '<div class="keygroup">' +
      '<button type="button" data-act="down" aria-label="Bajar medio tono" title="Bajar medio tono">' + icon('minus') + '</button>' +
      '<button type="button" class="keybtn" data-act="key" aria-label="Tono ' + esc(kn) + '. Cambiar tono"><span class="k">' + esc(kn) + '</span><span class="d">' + shiftLabel(normShift(sh)) + '</span></button>' +
      '<button type="button" data-act="up" aria-label="Subir medio tono" title="Subir medio tono">' + icon('plus') + '</button>' +
    '</div>' +
    '<button type="button" class="capobtn' + (capo ? ' on' : '') + '" data-act="capo" aria-label="Cejilla en ' + capo + '. Cambiar cejilla">Cejilla<b>' + capo + '</b></button>' +
    '<span class="spacer"></span>' +
    btnIcon('text', 'Tamaño y vista', 'data-act="view"') +
    '<button type="button" class="iconbtn play' + (scroller.on ? ' on' : '') + '" data-act="scroll" aria-pressed="' + scroller.on + '" aria-label="Desplazamiento automático" title="Desplazamiento automático">' + icon(scroller.on ? 'pause' : 'play') + '</button>' +
    btnIcon('more', 'Más opciones', 'data-act="menu"') +
  '</div>';
  var head = '<header class="song-h" style="--g:' + g.color + '">' +
    (song.num ? '<span class="bt" title="Número en el cancionero">' + esc(song.num) + '</span>' : '') +
    '<h1>' + esc(C.sentenceCase(song.title)) + '</h1>' +
    ((song.author || song.momento) ? '<p class="meta">' + (song.momento ? '<span class="pill">' + esc(C.sentenceCase(song.momento)) + '</span>' : '') + esc(C.nameCase(song.author || '')) + '</p>' : '') +
    '<p class="keyline">' + keyLineHTML(song) + '</p>' +
    (inf.seq.length ? '<p class="lv-cta"><a class="btn primary" href="' + esc(liveHash()) + '">' + icon('keys') + 'Tocar en vivo</a>' +
      studs.map(function (pr) { return '<a class="btn stu-cta" href="#/a/' + enc(pr.id) + '/' + enc(song.id) + '" title="Tocar como ' + esc(pr.name) + ' (' + esc(PARTS[cfgNorm(pr).part]) + ')">' +
        '<span class="avatar sm" style="--c:' + esc(pr.color) + '">' + esc(pr.name.charAt(0).toUpperCase()) + '</span>' + esc(pr.name) + '</a>'; }).join('') +
      '<button type="button" class="btn ez-cta" data-act="easylive">' + icon('keys') + 'Modo fácil</button>' +
      (studs.length ? '' : '<button type="button" class="btn sz-cta" data-act="superlive">' + icon('keys') + 'Súper fácil</button>') + '</p>' : '') +
    ((song.style || song.bpm) ? '<p class="style">' + esc([song.style, song.bpm ? song.bpm + ' bpm' : ''].filter(Boolean).join(', ')) + '</p>' : '') +
  '</header>';
  var refs = song.refs || [];
  var foot = '<footer class="song-f">' +
    (refs.length ? '<div><b>Escuchar en YouTube</b>' + (song.refText ? ' (' + esc(C.sentenceCase(song.refText)) + ')' : '') + '<br>' +
      refs.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(shortUrl(u)) + '</a>'; }).join('<br>') + '</div>' : '') +
    (song.page ? '<div>Página ' + esc(song.page) + ' del cancionero en PDF.</div>' : '') +
    '<div class="btnrow"><a class="btn" href="#/e/' + enc(song.id) + '">' + icon('edit') + 'Editar</a>' +
    '<button type="button" class="btn" data-act="addset">' + icon('list') + 'Añadir a repertorio</button></div></footer>';
  var bar = '';
  if (ctx.setlist) {
    var pi = neighbor(-1), ni = neighbor(1), items = ctx.setlist.items;
    var pS = pi >= 0 ? getSong(items[pi].id) : null, nS = ni >= 0 ? getSong(items[ni].id) : null;
    bar = '<nav class="setbar" aria-label="Repertorio ' + esc(ctx.setlist.name) + '">' +
      '<button type="button" data-act="prev"' + (pS ? '' : ' disabled') + ' aria-label="Canción anterior">' + icon('back') + '<span>' + (pS ? esc(C.sentenceCase(pS.title)) : 'Inicio') + '</span></button>' +
      '<span class="pos">' + (ctx.index + 1) + '/' + items.length + '</span>' +
      '<button type="button" class="next" data-act="next"' + (nS ? '' : ' disabled') + ' aria-label="Canción siguiente"><span>' + (nS ? esc(C.sentenceCase(nS.title)) : 'Fin') + '</span>' + icon('fwd') + '</button></nav>';
  }
  app.innerHTML = ctrl + '<article class="song-wrap' + (prefs.chords ? '' : ' nochords') + '">' + head +
    '<div class="song" id="song-body">' + bodyHTML(song, fmtFor(inf.key, sh - capo)) + '</div>' + foot + '</article>' + bar;
  document.body.classList.toggle('has-setbar', !!ctx.setlist);
  fixCollisions(document.getElementById('song-body'));
  keepAwake(true);
}
function refreshSong(flash) {
  var song = current.song;
  if (!song || (route.name !== 'song' && route.name !== 'setsong')) return;
  var inf = info(song), sh = songShift(song), capo = songCapo(song), kn = keyLabel(inf.key, sh);
  var kb = app.querySelector('.keybtn');
  if (kb) { kb.querySelector('.k').textContent = kn; kb.querySelector('.d').textContent = shiftLabel(normShift(sh)); kb.setAttribute('aria-label', 'Tono ' + kn + '. Cambiar tono'); }
  var cb = app.querySelector('.capobtn');
  if (cb) { cb.classList.toggle('on', !!capo); cb.querySelector('b').textContent = capo; cb.setAttribute('aria-label', 'Cejilla en ' + capo + '. Cambiar cejilla'); }
  var kl = app.querySelector('.keyline'); if (kl) kl.innerHTML = keyLineHTML(song);
  var wrap = app.querySelector('.song-wrap'); if (wrap) wrap.classList.toggle('nochords', !prefs.chords);
  var body = document.getElementById('song-body');
  if (body) {
    body.innerHTML = bodyHTML(song, fmtFor(inf.key, sh - capo));
    fixCollisions(body);
    if (flash) Array.prototype.forEach.call(body.querySelectorAll('.ch:not(.x), .ci'), function (el) { el.classList.add('flash'); });
  }
}
function setShift(song, sh) {
  sh = normShift(sh);
  if (ctx.setlist) {
    var sl = clone(ctx.setlist); sl.items[ctx.index].shift = sh; saveSetlist(sl);
    ctx.setlist = getSetlist(sl.id);
  } else setView(song, { shift: sh });
}
function transpose(delta) {
  var song = current.song; if (!song) return;
  setShift(song, songShift(song) + delta);
  refreshSong(true);
  announce('Tono ' + keyLabel(info(song).key, songShift(song)));
}

/* ---------- repertorios ---------- */
function renderSetlists() {
  leaveSong();
  var sets = allSetlists();
  app.innerHTML = '<div class="page"><div class="page-h">' + btnIcon('back', 'Volver a la lista', 'data-go="#/"') + '<h1>Repertorios</h1>' +
    '<button type="button" class="btn primary" data-act="newset">' + icon('add') + 'Nuevo</button></div>' +
    (sets.length ? '<ul class="list">' + sets.map(function (sl) {
      var tag = local.setlists[sl.id] && isGroup() ? '<span class="pill">' + (DATA.setlists.some(function (x) { return x.id === sl.id; }) ? 'editado' : 'nuevo') + '</span>' : '';
      return '<li><a class="row" href="#/r/' + enc(sl.id) + '"><span class="txt"><span class="ttl">' + esc(sl.name) + '</span><span class="sub">' + tag +
        sl.items.length + (sl.items.length === 1 ? ' canción' : ' canciones') + '</span></span>' + icon('fwd') + '</a></li>';
    }).join('') + '</ul>'
    : '<p class="empty">Un repertorio es la lista de canciones de un día, cada una en el tono en que la van a tocar. Crea el del sábado con «Nuevo».</p>') +
  '</div>';
}
function renderSetlist(id) {
  leaveSong();
  var sl = getSetlist(id);
  if (!sl) { location.hash = '#/r'; return; }
  current.setlist = sl;
  var rows = sl.items.map(function (it, i) {
    var s = getSong(it.id), tools = btnIcon('up', 'Subir', 'data-act="setup" data-i="' + i + '"' + (i === 0 ? ' disabled' : '')) +
      btnIcon('down', 'Bajar', 'data-act="setdown" data-i="' + i + '"' + (i === sl.items.length - 1 ? ' disabled' : '')) +
      btnIcon('trash', 'Quitar del repertorio', 'data-act="setdel" data-i="' + i + '"');
    if (!s) return '<li class="setitem"><span class="ttl">Canción eliminada</span>' + tools + '</li>';
    var inf = info(s), sh = it.shift != null ? it.shift : songShift(s, true);
    return '<li class="setitem"><span class="key"><span class="sr">Tono </span>' + esc(keyLabel(inf.key, sh)) + '</span>' +
      '<a class="ttl" href="#/r/' + enc(sl.id) + '/' + i + '">' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) +
      '<small>' + (it.shift != null ? 'Tono elegido para este repertorio' : 'Tono de la canción') + '</small></a>' + tools + '</li>';
  }).join('');
  app.innerHTML = '<div class="page"><div class="page-h">' + btnIcon('back', 'Volver a repertorios', 'data-go="#/r"') + '<h1>' + esc(sl.name) + '</h1>' +
    btnIcon('more', 'Opciones del repertorio', 'data-act="setmenu"') + '</div>' +
    '<div class="btnrow" style="margin:.3rem 0 1rem">' + (sl.items.length ? '<a class="btn primary" href="#/r/' + enc(sl.id) + '/0">' + icon('play') + 'Tocar</a>' : '') +
    '<button type="button" class="btn" data-act="setadd">' + icon('add') + 'Añadir canciones</button></div>' +
    (sl.items.length ? '<ol class="list" style="padding:0">' + rows + '</ol>'
      : '<p class="empty">Todavía no tiene canciones. Añádelas con el botón de arriba o desde cada canción con «Añadir a repertorio».</p>') +
  '</div>';
}
function mutateSet(fn) {
  var sl = clone(current.setlist); fn(sl); saveSetlist(sl); renderSetlist(sl.id);
}

/* parte 3: paneles, piano, metrónomo, desplazamiento */
var sheetState = null;
function openSheet(title, body, onMount, opts) {
  closeSheet(true);
  var prev = document.activeElement;
  sheetRoot.innerHTML = '<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '" tabindex="-1">' +
    '<div class="grab"></div><div class="sheet-h"><h2>' + esc(title) + '</h2>' + btnIcon('close', 'Cerrar', 'data-close="1"') + '</div>' +
    '<div class="sheet-b">' + body + '</div></div></div>';
  var el = sheetRoot.querySelector('.sheet');
  sheetState = { prev: prev, onClose: opts && opts.onClose };
  el.focus({ preventScroll: true });
  if (onMount) onMount(el);
  return el;
}
function closeSheet(silent) {
  if (!sheetRoot.firstChild) return;
  var st = sheetState; sheetRoot.innerHTML = ''; sheetState = null;
  if (st && st.onClose) st.onClose();
  if (!silent && st && st.prev && document.contains(st.prev)) { try { st.prev.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
}
sheetRoot.addEventListener('click', function (e) {
  if (e.target.classList.contains('sheet-back') || e.target.closest('button[data-close]')) closeSheet();
});
function setting(label, control) { return '<div class="setting"><span>' + esc(label) + '</span>' + control + '</div>'; }
function seg(name, opts, val) {
  return '<div class="seg" role="group" aria-label="' + esc(name) + '" data-seg="' + name + '">' + opts.map(function (o) {
    return '<button type="button" data-val="' + esc(o[0]) + '" aria-pressed="' + (String(o[0]) === String(val)) + '">' + esc(o[1]) + '</button>';
  }).join('') + '</div>';
}
function confirmSheet(title, msg, okLabel, onOk, danger) {
  openSheet(title, '<p class="help">' + msg + '</p><div class="btnrow"><button type="button" class="btn ' + (danger ? 'danger' : 'primary') + '" data-x="ok">' + esc(okLabel) +
    '</button><button type="button" class="btn" data-close="1">Cancelar</button></div>', function (el) {
    el.querySelector('[data-x="ok"]').addEventListener('click', function () { closeSheet(true); onOk(); });
  });
}
function promptSheet(title, label, value, okLabel, onOk) {
  openSheet(title, '<div class="field"><label for="pr-in">' + esc(label) + '</label><input id="pr-in" value="' + esc(value || '') + '"></div>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="ok">' + esc(okLabel) + '</button><button type="button" class="btn" data-close="1">Cancelar</button></div>', function (el) {
    var inp = el.querySelector('#pr-in');
    setTimeout(function () { inp.focus(); inp.select(); }, 30);
    function ok() { var v = inp.value.trim(); if (!v) { inp.focus(); return; } closeSheet(true); onOk(v); }
    el.querySelector('[data-x="ok"]').addEventListener('click', ok);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') ok(); });
  });
}
function showText(title, text) {
  openSheet(title, '<p class="help">Mantén presionado el texto (o selecciónalo) y cópialo.</p><div class="field"><textarea readonly rows="12">' + esc(text) + '</textarea></div>', function (el) {
    var ta = el.querySelector('textarea'); setTimeout(function () { ta.focus(); ta.select(); }, 50);
  });
}

/* ---------- tono ---------- */
function openKeySheet() {
  var song = current.song; if (!song) return;
  var inf = info(song), sh = C.mod12(songShift(song)), btns = '';
  for (var pc = 0; pc < 12; pc++) {
    var s = C.mod12(pc - inf.key.pc), d = normShift(s);
    btns += '<button type="button" data-shift="' + d + '" aria-pressed="' + (s === sh) + '"' + (s === 0 ? ' class="orig"' : '') + '><b>' +
      esc(keyLabel(inf.key, s)) + '</b><small>' + (s === 0 ? 'original' : shiftLabel(d)) + '</small></button>';
  }
  var play = song.play || 0, now = keyLabel(inf.key, sh);
  var body = '<p class="help">Elige el tono. Los acordes cambian en su mismo lugar sobre la letra.</p><div class="keys">' + btns + '</div><div class="btnrow">' +
    (sh !== 0 ? '<button type="button" class="btn" data-k="orig">Volver al original (' + esc(keyLabel(inf.key, 0)) + ')</button>' : '') +
    (play && C.mod12(play) !== sh ? '<button type="button" class="btn" data-k="group">Tono del grupo (' + esc(keyLabel(inf.key, play)) + ')</button>' : '') +
    (C.mod12(play) !== sh ? '<button type="button" class="btn primary" data-k="fix">Fijar ' + esc(now) + ' como tono del grupo</button>' : '') +
    '</div><p class="help">' + (ctx.setlist ? 'El tono que elijas aquí se guarda en el repertorio «' + esc(ctx.setlist.name) + '». ' : '') +
    'El tono del grupo es el tono con el que la canción se abre para todos cuando publicas los cambios.</p>';
  openSheet('Tono', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-shift')) setShift(song, +b.getAttribute('data-shift'));
      else if (b.getAttribute('data-k') === 'orig') setShift(song, 0);
      else if (b.getAttribute('data-k') === 'group') setShift(song, play);
      else if (b.getAttribute('data-k') === 'fix') {
        var fixed = normShift(songShift(song)), s2 = clone(song);
        if (fixed) s2.play = fixed; else delete s2.play;
        local.songs[s2.id] = cleanSong(s2); saveLocal();
        if (viewState[s2.id]) { delete viewState[s2.id].shift; saveView(); }
        current.song = getSong(s2.id);
        closeSheet(); refreshSong(false);
        toast(isGroup() ? 'Guardado. Publica los cambios para que todos lo vean.' : 'Guardado.');
        return;
      } else return;
      closeSheet(); refreshSong(true); announce('Tono ' + keyLabel(inf.key, songShift(song)));
    });
  });
}

/* ---------- cejilla ---------- */
function openCapoSheet() {
  var song = current.song; if (!song) return;
  var inf = info(song), sh = songShift(song), capo = songCapo(song), sug = C.suggestCapo(inf.chords, sh), btns = '';
  for (var c = 0; c <= 9; c++) {
    btns += '<button type="button" data-capo="' + c + '" aria-pressed="' + (c === capo) + '"><b>' + c + '</b><small>' + esc(keyLabel(inf.key, sh - c)) + '</small></button>';
  }
  var body = '<p class="help">La canción sigue sonando en <b>' + esc(keyLabel(inf.key, sh)) + '</b>. La cejilla solo cambia los acordes que ves en tu pantalla, para tocar la guitarra con formas más fáciles. El piano no la usa, y al copiar o imprimir salen los acordes que suenan. Debajo de cada número está la tonalidad de las formas.</p>' +
    '<div class="keys capos">' + btns + '</div>' +
    (sug !== capo ? '<div class="btnrow"><button type="button" class="btn primary" data-capo="' + sug + '">Usar la sugerida: cejilla ' + sug + ', formas de ' + esc(keyLabel(inf.key, sh - sug)) + '</button></div>'
      : '<p class="help">Para este tono, la cejilla actual es la más cómoda.</p>');
  openSheet('Cejilla', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-capo]'); if (!b) return;
      setView(song, { capo: +b.getAttribute('data-capo') }); closeSheet(); refreshSong(true);
    });
  });
}

/* ---------- vista y ajustes ---------- */
function openViewSheet() {
  var body = setting('Tamaño de letra', '<div class="seg"><button type="button" data-v="size-" aria-label="Letra más pequeña">A−</button><button type="button" disabled id="v-size">' + prefs.size + '</button><button type="button" data-v="size+" aria-label="Letra más grande">A+</button></div>') +
    setting('Acordes', seg('chords', [['1', 'Mostrar'], ['0', 'Solo letra']], prefs.chords ? '1' : '0')) +
    setting('Alineación', seg('align', [['center', 'Centro'], ['left', 'Izquierda']], prefs.align)) +
    setting('Tema', seg('theme', [['auto', 'Auto'], ['light', 'Papel'], ['dark', 'Escenario']], prefs.theme)) +
    setting('Nombres de notas', seg('notation', [['en', 'C D E'], ['es', 'Do Re Mi'], ['num', '1 4 5']], prefs.notation)) +
    setting('Alteraciones', seg('spell', [['auto', 'Auto'], ['sharp', 'C#'], ['flat', 'Db']], prefs.spell)) +
    setting('Velocidad al desplazar', '<div class="seg"><button type="button" data-v="speed-" aria-label="Más lento">−</button><button type="button" disabled id="v-speed">' + prefs.speed + '</button><button type="button" data-v="speed+" aria-label="Más rápido">+</button></div>') +
    setting('Pantalla encendida al tocar', seg('awake', [['1', 'Sí'], ['0', 'No']], prefs.awake ? '1' : '0')) +
    '<p class="help">«1 4 5» muestra los acordes en números según el tono (1 = la nota del tono), simplificados, como en el modo fácil: sirve para aprender.</p>' +
    '<p class="help">En «Auto» las alteraciones siguen la tonalidad: Fa y Sib se escriben con bemoles, Re y La con sostenidos. En el tono original se respeta lo que está escrito en el cancionero.</p>';
  openSheet('Vista', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var v = b.getAttribute('data-v'), sg = b.closest('[data-seg]');
      if (v === 'size-' || v === 'size+') { prefs.size = Math.max(13, Math.min(44, prefs.size + (v === 'size+' ? 2 : -2))); el.querySelector('#v-size').textContent = prefs.size; }
      else if (v === 'speed-' || v === 'speed+') { prefs.speed = Math.max(1, Math.min(10, prefs.speed + (v === 'speed+' ? 1 : -1))); el.querySelector('#v-speed').textContent = prefs.speed; }
      else if (sg) {
        var name = sg.getAttribute('data-seg'), val = b.getAttribute('data-val');
        prefs[name] = (name === 'chords' || name === 'awake') ? val === '1' : val;
        Array.prototype.forEach.call(sg.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      } else return;
      savePrefs();
      if (route.name === 'song' || route.name === 'setsong') refreshSong(false);
      else if (route.name === 'home') { var r = document.getElementById('results'); if (r) r.innerHTML = resultsHTML(); }
      if (!prefs.awake) keepAwake(false);
    });
  });
}

/* ---------- piano ---------- */
var AC = null, AC_OUT = null;
/* Salida común de los sonidos de la app (piano, clic, cuenta): un solo volumen. */
function audioOut() {
  var ac = audio(); if (!ac) return null;
  if (!AC_OUT) { AC_OUT = ac.createGain(); AC_OUT.gain.value = +LS.get('cfp.appVol', 0.8); AC_OUT.connect(ac.destination); }
  return AC_OUT;
}
function setAppVolume(v) { v = Math.max(0, Math.min(1, v)); LS.set('cfp.appVol', v); if (AC_OUT) AC_OUT.gain.value = v; }
function audio() {
  try {
    if (!AC) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; AC = new A(); }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) { return null; }
  return AC;
}
function playNotes(midis) {
  var ac = audio(); if (!ac) { toast('Este equipo no permite reproducir sonido aquí.'); return; }
  var t0 = ac.currentTime + 0.03;
  midis.forEach(function (m, i) {
    var t = t0 + i * 0.035, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o2.frequency.value = o.frequency.value * 2;
    var peak = 0.24 / Math.sqrt(midis.length);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0005, t + 1.8);
    var g2 = ac.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(audioOut() || ac.destination);
    o.start(t); o2.start(t); o.stop(t + 1.9); o2.stop(t + 1.9);
  });
}
/* Posición de cada tecla (en las unidades del dibujo): la usan el teclado y el rodillo, así las notas caen justo sobre su tecla. */
function kbLayout(lo, hi, minWhites, ww) {
  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }, W = ww || 30, BW = W * 0.6, x = 0, keys = {};
  while (C.mod12(lo) !== 0 && C.mod12(lo) !== 5) lo--;          // empezar en Do o Fa
  while (C.mod12(hi) !== 4 && C.mod12(hi) !== 11) hi++;         // terminar en Mi o Si
  var whitesIn = function (a, b) { var n = 0; for (var q = a; q <= b; q++) if (!BLACK[C.mod12(q)]) n++; return n; };
  while (whitesIn(lo, hi) < (minWhites || 14)) { hi++; while (C.mod12(hi) !== 4 && C.mod12(hi) !== 11) hi++; }
  for (var m = lo; m <= hi; m++) {
    if (!BLACK[C.mod12(m)]) { keys[m] = { x: x, w: W, black: false }; x += W; } else keys[m] = { x: x - BW / 2, w: BW, black: true };
  }
  return { lo: lo, hi: hi, width: x, keys: keys };
}
function pianoSVG(v, names, opts) {
  opts = opts || {};
  var right = v.right, left = opts.noBass ? null : v.left, all = right.concat(left !== null ? [left] : []);
  var H = 132, W = opts.ww || 30, BW = W * 0.6, BH = 82, f = opts.fs || 1, whites = [], blacks = [];   // f: letra más grande si el teclado es bajo
  var lay = kbLayout(opts.lo != null ? opts.lo : Math.min.apply(null, all), opts.hi != null ? opts.hi : Math.max.apply(null, all), opts.minWhites, W), x = lay.width;
  var fingers = v.fingers || (right.length === 3 ? [1, 3, 5] : right.length === 4 ? [1, 2, 3, 5] : right.length === 2 ? [1, 5] : [1, 2, 3, 4, 5]);
  for (var m = lay.lo; m <= lay.hi; m++) {
    var ri = right.indexOf(m), isL = left !== null && m === left, k = { m: m, cls: ri >= 0 ? (opts.allLeft ? 'lh' : 'rh') : (isL ? 'lh' : ''), f: ri >= 0 ? fingers[ri] : (isL ? 5 : ''), x: lay.keys[m].x };
    if (lay.keys[m].black) blacks.push(k); else whites.push(k);
  }
  var s = '<svg class="piano' + (opts.cls ? ' ' + opts.cls : '') + '" viewBox="0 0 ' + x + ' ' + (H + 2) + '" role="img" aria-label="' + esc(opts.label || 'Teclado del piano') + '">';
  whites.forEach(function (k) {
    s += '<rect class="wk' + (k.cls ? ' ' + k.cls : '') + '" data-m="' + k.m + '"' + (k.cls && opts.color ? ' style="fill:' + opts.color(k.m) + '"' : '') + ' x="' + (k.x + 0.5) + '" y="0.5" width="' + (W - 1) + '" height="' + H + '" rx="3"/>';
    if (k.cls) s += '<text class="lbl-w" x="' + (k.x + W / 2) + '" y="' + (H - (opts.noFingers ? 16 : 34)) + '" style="font-size:' + (opts.noFingers ? 17 : 14) * f + 'px">' + esc(names[k.m] || '') + '</text>' +
      (opts.noFingers ? '' : '<text class="lbl-w" x="' + (k.x + W / 2) + '" y="' + (H - 12) + '" style="font-size:' + 13 * f + 'px;opacity:.92">' + k.f + '</text>');
    else if (opts.allNums && opts.numOf) s += '<text x="' + (k.x + W / 2) + '" y="' + (H - 12) + '" fill="#8d93ad" style="font-size:' + 14 * f + 'px">' + esc(opts.numOf(k.m)) + '</text>';
    else if (!opts.noCLabel && C.mod12(k.m) === C.mod12(opts.homePc || 0)) s += '<text x="' + (k.x + W / 2) + '" y="' + (H - 12) + '" fill="#8d93ad" style="font-size:' + (opts.cLabel ? 15 : 12) * f + 'px">' + esc(opts.cLabel || (C.noteName(0, 'sharp', prefs.notation) + (k.m === 60 ? '4' : ''))) + '</text>';
  });
  blacks.forEach(function (k) {
    s += '<rect class="bk' + (k.cls ? ' ' + k.cls : '') + '" data-m="' + k.m + '"' + (k.cls && opts.color ? ' style="fill:' + opts.color(k.m) + '"' : '') + ' x="' + k.x + '" y="0.5" width="' + BW + '" height="' + BH + '" rx="2"/>';
    if (k.cls) s += '<text class="lbl-w" x="' + (k.x + BW / 2) + '" y="' + (BH - (opts.noFingers ? 10 : 26)) + '" style="font-size:' + 11 * f + 'px">' + esc(names[k.m] || '') + '</text>' +
      (opts.noFingers ? '' : '<text class="lbl-w" x="' + (k.x + BW / 2) + '" y="' + (BH - 9) + '" style="font-size:' + 12 * f + 'px">' + k.f + '</text>');
  });
  return s + '</svg>';
}
function latin(n) { return prefs.notation === 'es' && n ? C.LATIN[n[0]] + n.slice(1) : n; }
function openChordSheet(i) {
  var song = current.song; if (!song) return;
  var inf = info(song); if (!inf.seq.length) return;
  var st = { i: Math.max(0, Math.min(inf.seq.length - 1, i || 0)), v: null };
  function draw(el) {
    var tok = inf.seq[st.i], sh = songShift(song), capo = songCapo(song), spell = spellFor(inf.key, sh);
    var keep = C.mod12(sh) === 0 && prefs.spell === 'auto';
    var soundEn = C.splitTok(C.transposeTok(tok, { shift: sh, spell: spell, notation: 'en', keep: keep })).core;
    var shown = C.splitTok(fmtFor(inf.key, sh)(tok)).core, shape = C.splitTok(fmtFor(inf.key, sh - capo)(tok)).core;
    var v = C.pianoVoicing(soundEn), pc = C.parseChord(soundEn); st.v = v;
    var box = el.querySelector('#chord-box');
    if (!v || !pc) { box.innerHTML = '<p class="help">No reconozco el acorde «' + esc(tok) + '».</p>'; return; }
    // nombres de teclas coherentes con el acorde escrito: la fundamental y el bajo como aparecen en la hoja
    var names = {};
    v.right.forEach(function (m) { names[m] = latin(C.noteName(m, spell, 'en')); });
    names[v.right[0]] = latin(pc.rootName);
    names[v.left] = latin(pc.bassName || pc.rootName);
    var rn = v.right.map(function (m) { return names[m]; }).join(' ');
    box.innerHTML = '<div class="chordbig">' + esc(shown) + '</div>' +
      '<p class="chordnotes">Mano derecha <b>' + esc(rn) + '</b>. Mano izquierda <b>' + esc(names[v.left]) + '</b>.</p>' +
      (capo ? '<p class="chordnotes">En la guitarra, con cejilla ' + capo + ', es la forma de <b>' + esc(shape) + '</b>.</p>' : '') +
      pianoSVG(v, names) +
      '<div class="legend"><span><i style="background:#c8102e"></i>Mano derecha y sus dedos</span><span><i style="background:#3a43c4"></i>Mano izquierda (bajo)</span></div>' +
      '<p class="help" style="text-align:center">Acorde ' + (st.i + 1) + ' de ' + inf.seq.length + ' en esta canción.</p>';
  }
  var body = '<div id="chord-box"></div><div class="chordnav">' +
    '<button type="button" class="btn" data-n="-1">' + icon('back') + 'Anterior</button>' +
    '<button type="button" class="btn primary" data-n="play">' + icon('speaker') + 'Escuchar</button>' +
    '<button type="button" class="btn" data-n="1">Siguiente' + icon('fwd') + '</button></div>';
  openSheet('Acorde en el piano', body, function (el) {
    draw(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var n = b.getAttribute('data-n');
      if (n === 'play') { if (st.v) playNotes([st.v.left].concat(st.v.right)); return; }
      st.i = Math.max(0, Math.min(inf.seq.length - 1, st.i + (+n))); draw(el);
    });
  });
}

/* ---------- metrónomo ---------- */
var metro = { on: false, bpm: 100, beats: 4, beat: 0, next: 0, timer: 0, taps: [] };
function metroTick() {
  var ac = AC; if (!ac || !metro.on) return;
  while (metro.next < ac.currentTime + 0.12) {
    var acc = metro.beat % metro.beats === 0, t = metro.next, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = acc ? 1650 : 1050;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(acc ? 0.55 : 0.35, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(audioOut() || ac.destination); o.start(t); o.stop(t + 0.06);
    (function (b, when) { setTimeout(function () { metroDot(b); }, Math.max(0, (when - ac.currentTime) * 1000)); })(metro.beat % metro.beats, t);
    metro.next += 60 / metro.bpm; metro.beat++;
  }
}
function metroDot(b) {
  var d = document.getElementById('beats'); if (!d) return;
  Array.prototype.forEach.call(d.children, function (x, i) { x.className = i === b ? 'on' : ''; });
}
function metroStart() {
  var ac = audio(); if (!ac) { toast('Este equipo no permite reproducir sonido aquí.'); return; }
  metro.on = true; metro.beat = 0; metro.next = ac.currentTime + 0.08;
  clearInterval(metro.timer); metro.timer = setInterval(metroTick, 25);
}
function metroStop() { metro.on = false; clearInterval(metro.timer); metroDot(-1); }
function openMetroSheet() {
  var song = current.song, inf = song ? info(song) : null;
  if (!metro.on && inf && inf.bpm) metro.bpm = inf.bpm;
  function dots() { var h = ''; for (var i = 0; i < metro.beats; i++) h += '<span></span>'; return h; }
  var body = '<div class="metro"><button type="button" class="iconbtn" data-m="-" aria-label="Más lento">' + icon('minus') + '</button>' +
    '<output id="bpm" aria-live="polite">' + metro.bpm + '</output><button type="button" class="iconbtn" data-m="+" aria-label="Más rápido">' + icon('plus') + '</button></div>' +
    '<p class="help" style="text-align:center;margin-top:-.4rem">pulsos por minuto</p><div class="beats" id="beats">' + dots() + '</div>' +
    '<div class="btnrow" style="justify-content:center;margin-bottom:.8rem"><button type="button" class="btn primary" data-m="toggle">' + (metro.on ? 'Detener' : 'Empezar') + '</button>' +
    '<button type="button" class="btn" data-m="tap">Marcar el tempo</button></div>' +
    setting('Pulsos por compás', seg('beats', [['2', '2'], ['3', '3'], ['4', '4']], String(metro.beats))) +
    '<p class="help">Toca «Marcar el tempo» cuatro veces al ritmo de la canción y el metrónomo toma esa velocidad. Sigue sonando aunque cierres este panel.</p>';
  openSheet('Metrónomo', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var m = b.getAttribute('data-m'), sg = b.closest('[data-seg]');
      if (m === '-' || m === '+') metro.bpm = Math.max(30, Math.min(260, metro.bpm + (m === '+' ? 2 : -2)));
      else if (m === 'toggle') { if (metro.on) metroStop(); else metroStart(); b.textContent = metro.on ? 'Detener' : 'Empezar'; }
      else if (m === 'tap') {
        var now = performance.now(); metro.taps = metro.taps.filter(function (t) { return now - t < 2500; }); metro.taps.push(now);
        if (metro.taps.length >= 2) {
          var iv = []; for (var i = 1; i < metro.taps.length; i++) iv.push(metro.taps[i] - metro.taps[i - 1]);
          metro.bpm = Math.max(30, Math.min(260, Math.round(60000 / (iv.reduce(function (a, c) { return a + c; }, 0) / iv.length))));
        }
      } else if (sg) {
        metro.beats = +b.getAttribute('data-val'); metro.beat = 0;
        Array.prototype.forEach.call(sg.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        el.querySelector('#beats').innerHTML = dots();
      } else return;
      el.querySelector('#bpm').textContent = metro.bpm;
    });
  });
}

/* ---------- desplazamiento automático y pantalla encendida ---------- */
var scroller = { on: false, raf: 0, last: 0, acc: 0 };
function scrollStep(now) {
  if (!scroller.on) return;
  var dt = Math.min(0.1, (now - scroller.last) / 1000); scroller.last = now;
  scroller.acc += (6 + prefs.speed * 5) * dt;
  var d = Math.floor(scroller.acc);
  if (d >= 1) { scroller.acc -= d; window.scrollBy(0, d); }
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) { stopScroll(); return; }
  scroller.raf = requestAnimationFrame(scrollStep);
}
function startScroll() { scroller.on = true; scroller.last = performance.now(); scroller.acc = 0; scroller.raf = requestAnimationFrame(scrollStep); scrollBtn(); keepAwake(true); }
function stopScroll() { scroller.on = false; cancelAnimationFrame(scroller.raf); scrollBtn(); }
function scrollBtn() {
  var b = app.querySelector('[data-act="scroll"]'); if (!b) return;
  b.classList.toggle('on', scroller.on); b.setAttribute('aria-pressed', String(scroller.on)); b.innerHTML = icon(scroller.on ? 'pause' : 'play');
}
var wake = null;
function keepAwake(on) {
  if (!('wakeLock' in navigator)) return;
  if (on && prefs.awake && !wake) {
    navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () { /* el visor no lo permite */ });
  } else if (!on && wake) { wake.release().catch(function () {}); wake = null; }
}
function leaveSong() {
  stopScroll(); keepAwake(false);
  current.song = null; ctx.setlist = null; ctx.index = -1;
  document.body.classList.remove('has-setbar');
}

/* ---------- menús ---------- */
function menuSheet(title, items, extra) {
  var body = '<ul class="menu">' + items.map(function (it) {
    if (it.href) return '<li><a href="' + esc(it.href) + '"' + (it.ext ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + icon(it.icon) + esc(it.label) + (it.sub ? '<span class="sub">' + esc(it.sub) + '</span>' : '') + '</a></li>';
    return '<li><button type="button" data-m="' + it.id + '"' + (it.disabled ? ' disabled' : '') + '>' + icon(it.icon) + esc(it.label) + (it.sub ? '<span class="sub">' + esc(it.sub) + '</span>' : '') + '</button></li>';
  }).join('') + '</ul>' + (extra || '');
  return openSheet(title, body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-m]'); if (!b) return;
      var it = items.filter(function (x) { return x.id === b.getAttribute('data-m'); })[0];
      if (it && it.run) { closeSheet(true); it.run(); }
    });
    el.addEventListener('click', function (e) { if (e.target.closest('a[href^="#"]')) closeSheet(true); });
  });
}
function openSongMenu() {
  var song = current.song; if (!song) return;
  var inf = info(song);
  var items = [
    { href: liveHash(), icon: 'keys', label: 'Tocar en vivo (piano)', sub: 'acorde por acorde' },
    { id: 'wa', icon: 'copy', label: 'Copiar para WhatsApp', sub: 'en el tono actual', run: function () { copyText(songText(song, { wa: true }), 'Copiado. Pégalo en WhatsApp.'); } },
    { id: 'share', icon: 'copy', label: 'Compartir o copiar texto', run: function () { shareText(songText(song, {}), C.sentenceCase(song.title)); } },
    { id: 'nums', icon: 'share', label: 'Mandar en números (para practicar)', sub: 'con el mapa de la canción', run: function () { openNumsShare(song); } },
    { id: 'print', icon: 'print', label: 'Imprimir o guardar en PDF', run: function () { openPrintSheet([{ song: song, shift: songShift(song) }], '', fileName(song.title)); } },
    { id: 'piano', icon: 'keys', label: 'Ver los acordes en el piano', disabled: !inf.seq.length, run: function () { openChordSheet(0); } },
    { id: 'metro', icon: 'metro', label: metro.on ? 'Metrónomo (sonando)' : 'Metrónomo', run: openMetroSheet },
    { id: 'add', icon: 'list', label: 'Añadir a repertorio', run: function () { openAddToSet(song); } },
    { id: 'view', icon: 'gear', label: 'Vista y ajustes', run: openViewSheet },
    { href: '#/e/' + enc(song.id), icon: 'edit', label: 'Editar canción' }
  ];
  (song.refs || []).forEach(function (u, i) { items.push({ href: u, ext: true, icon: 'video', label: 'Escuchar en YouTube' + ((song.refs.length > 1) ? ' ' + (i + 1) : '') }); });
  menuSheet(C.sentenceCase(song.title), items);
}
function openHomeMenu() {
  var n = localChangeCount();
  var items = [
    { href: '#/e/nueva', icon: 'add', label: 'Nueva canción' },
    { href: '#/r', icon: 'list', label: 'Repertorios' },
    { href: '#/a', icon: 'user', label: 'Modo alumno', sub: 'partes, escalones y estrellas' },
    { id: 'books', icon: 'book', label: 'Cancioneros', sub: bookTitle(), run: openBooksSheet },
    { id: 'printall', icon: 'print', label: 'Imprimir el cancionero', sub: isGroup() ? 'en el tono del grupo' : '', run: function () {
      openPrintSheet(allSongs().map(function (s) { return { song: s, shift: s.play || 0 }; }), 'Cancionero ' + bookTitle(), fileName(bookTitle())); } },
    { id: 'backup', icon: 'download', label: 'Copias y archivos', sub: n ? n + (n === 1 ? ' cambio' : ' cambios') + ' en este equipo' : '', run: openBackupSheet },
    { id: 'view', icon: 'gear', label: 'Vista y ajustes', run: openViewSheet },
    { id: 'help', icon: 'text', label: 'Cómo se usa', run: openHelp },
    { id: 'ver', icon: 'download', label: 'Versión y actualizaciones', sub: 'versión ' + APP_VERSION, run: openVersionSheet }
  ];
  if (!isStandalone()) items.splice(3, 0, { id: 'install', icon: 'install', label: 'Instalar en este equipo', sub: 'funciona sin internet', run: openInstall });
  if (n && isGroup()) items.unshift({ id: 'pub', icon: 'publish', label: 'Publicar para todos', sub: n + (n === 1 ? ' cambio' : ' cambios'), run: openPublishSheet });
  menuSheet('Cancionero', items);
}
function openHelp() {
  openSheet('Cómo se usa', '<div class="help">' +
    '<p><b>Modo fácil (para aprender).</b> En cada canción, el botón verde «Modo fácil» abre el modo en vivo con los acordes en números (Do = 1), siempre en Do y simplificados. Arriba aparece cuánto transponer el teclado para sonar con la banda. Dentro del modo en vivo, el botón «Fácil» lo activa o lo cambia.</p>' +
    '<p><b>Cambiar de tono.</b> En cada canción usa − y + (medio tono) o toca el tono para elegirlo. Los acordes cambian en su mismo lugar sobre la letra.</p>' +
    '<p><b>Guitarra con cejilla.</b> Si el piano toca en un tono difícil para la guitarra, toca «Cejilla»: te sugiere el traste y te muestra las formas que debes tocar. El tono que suena no cambia.</p>' +
    '<p><b>Piano.</b> Toca cualquier acorde para ver qué teclas se presionan, con los dedos de la mano derecha y el bajo de la izquierda, y escucharlo.</p>' +
    '<p><b>Repertorios.</b> Arma la lista del día con el tono de cada canción y toca «Tocar» para pasar de una a otra con los botones de abajo.</p>' +
    '<p><b>Tocar en vivo.</b> En cada canción, «Tocar en vivo» muestra a pantalla completa el acorde que toca ahora con las dos manos en el piano (posiciones cercanas y dedos marcados) y el que viene después. Puede avanzar a mano (pantalla, flechas o pedal Bluetooth), solo con el recorrido grabado, junto con el video para practicar, o escuchando a la banda (en prueba). El recorrido se graba una vez por canción tocando «Cambio» al ritmo del video o de la banda.</p>' +
    '<p><b>Sin internet.</b> Instálala desde «Más opciones», en «Instalar en este equipo». Después de abrirla una vez con internet, funciona aunque no haya señal.</p>' +
    '<p><b>Canciones nuevas.</b> Escribe cada acorde entre corchetes antes de su sílaba, por ejemplo <code>Yo le al[D]abo</code>, o pega una canción de internet con los acordes encima.</p>' +
    '<p><b>Compartir cambios.</b> Lo que cambias se guarda en este equipo. Quien administra el cancionero lo publica para todos subiendo el archivo canciones.json a GitHub. Los demás le envían sus cambios como archivo.</p>' +
    '<p><b>Tu propio cancionero.</b> En «Cancioneros» puedes crear uno vacío o abrir uno que te envíen. Se guarda solo en tu equipo y lo compartes como archivo.</p></div>');
}

/* ---------- versión y actualizaciones ---------- */
function openVersionSheet() {
  openSheet('Versión y actualizaciones', '<p class="tl-res"><b style="font-size:1.6rem">' + esc(APP_VERSION) + '</b></p>' +
    '<p class="help">Esta es la versión del programa que tiene este equipo. Cuando subas una actualización a GitHub, con internet la app la busca sola y te avisa con «Hay una versión nueva». También puedes buscarla aquí.</p>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="upd">Buscar actualización</button></div><p class="help" id="upd-r"></p>', function (el) {
    el.querySelector('[data-x="upd"]').addEventListener('click', function () {
      var r = el.querySelector('#upd-r'); r.textContent = 'Buscando…';
      checkUpdate(true).then(function (v) { r.textContent = v ? 'Hay una versión nueva: ' + v + '. Toca «Actualizar» abajo.' : 'Ya tienes la última versión.'; })
        .catch(function () { r.textContent = 'Sin conexión: no se pudo buscar.'; });
    });
  });
}
/* Compara la versión de este equipo con la del servidor (sin cachés). Devuelve la versión nueva o null. */
function checkUpdate(manual) {
  if (!/^https?:$/.test(location.protocol)) return Promise.resolve(null);
  var reg = 'serviceWorker' in navigator ? navigator.serviceWorker.getRegistration().then(function (r) { return r && r.update().catch(function () {}); }).catch(function () {}) : Promise.resolve();
  return reg.then(function () { return fetch('index.html?v=' + Date.now(), { cache: 'no-store' }); })
    .then(function (res) { if (!res.ok) throw new Error('red'); return res.text(); })
    .then(function (t) {
      var m = /name="app-version" content="(\d{4}-\d\d-\d\d \d\d:\d\d)"/.exec(t) || /var APP_VERSION = '(\d{4}-\d\d-\d\d \d\d:\d\d)'/.exec(t);   // solo una fecha real
      if (m && m[1] !== APP_VERSION) { showUpdateBanner(m[1]); return m[1]; }
      return null;
    });
}
function showUpdateBanner(v) {
  if (document.getElementById('upd-banner')) return;
  var d = document.createElement('div');
  d.id = 'upd-banner'; d.className = 'upd-banner'; d.setAttribute('role', 'status');
  d.innerHTML = '<span>Hay una versión nueva de la app' + (v ? ' (' + esc(v) + ')' : '') + '.</span><button type="button" class="btn primary">Actualizar</button>';
  d.querySelector('button').addEventListener('click', function () { this.disabled = true; this.textContent = 'Actualizando…'; reloadFresh(); });
  document.body.appendChild(d);
}

/* Actualizar sin mezclar versiones: espera a que el equipo termine de guardar la versión nueva y recién recarga. */
function reloadFresh() {
  var go = function () { location.reload(); };
  if (!('serviceWorker' in navigator)) { go(); return; }
  navigator.serviceWorker.getRegistration().then(function (r) {
    if (!r) { go(); return; }
    var w = r.installing || r.waiting;
    if (!w) { r.update().then(function () { var w2 = r.installing || r.waiting; if (!w2) go(); else waitSw(w2, go); }).catch(go); return; }
    waitSw(w, go);
  }).catch(go);
  setTimeout(go, 12000);   // por si acaso: nunca se queda esperando
}
function waitSw(w, go) {
  if (w.state === 'activated') { go(); return; }
  w.addEventListener('statechange', function () { if (w.state === 'activated' || w.state === 'redundant') go(); });
}

/* parte 4: editor, archivos, impresión, compartir y publicar */
function fileName(t) { return C.normalize(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'cancion'; }
function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function defaultSetName() {
  var d = new Date(), s = new Date(d.getTime() + ((6 - d.getDay() + 7) % 7) * 864e5);
  return 'Sábado ' + s.getDate() + '/' + (s.getMonth() + 1);
}

/* ---------- texto para compartir ---------- */
function songText(song, o) {
  o = o || {};
  var inf = info(song), sh = o.shift != null ? o.shift : songShift(song), capo = o.capo != null ? o.capo : 0;
  var lines = inf.lines.map(function (l) { return (l.type === 'label' || l.type === 'note') ? { type: l.type, text: C.sentenceCase(l.text) } : l; });
  var body = C.songToText(lines, o.nums ? fmtFor(inf.key, 0, 'num') : fmtFor(inf.key, sh - capo));
  var title = (song.num ? song.num + '. ' : '') + C.sentenceCase(song.title);
  var keyl = 'Tono: ' + keyLabel(inf.key, sh) + (capo ? ' (cejilla ' + capo + ', formas de ' + keyLabel(inf.key, sh - capo) + ')' : '');
  if (o.nums) keyl = numsHeader(song, sh);
  if (o.wa) return '*' + title + '*\n' + keyl + '\n```\n' + body + '\n```';
  return title + '\n' + keyl + '\n\n' + body;
}
/* ---------- la canción en números, para practicar en casa ----------
   Los números no cambian de tono: el 1 es «la casa» de la canción (en menor, la casa es el 6m). En el teclado se toca en Do
   (o La menor) y el teclado transpone al tono de la banda. */
function numsTranspose(song, sh) {
  var inf = info(song), kpc = C.mod12(inf.key.pc + sh);
  return norm6(kpc - (inf.key.minor ? 9 : 0));
}
function numsHeader(song, sh) {
  var inf = info(song), k = numsTranspose(song, sh);
  return 'Tono de la banda: ' + keyLabel(inf.key, sh) + '. En números: en el teclado se toca en ' + (inf.key.minor ? 'La menor (6m)' : 'Do (1)') +
    (k ? ' y el teclado transpone ' + (k > 0 ? '+' : '−') + Math.abs(k) : ', sin transponer') + '.';
}
/* Mapa por partes: «Coro: 1 6m 4 5». Solo si la canción tiene partes marcadas. */
function numsMap(song) {
  var inf = info(song), fmt = fmtFor(inf.key, 0, 'num'), parts = [], cur = null;
  inf.lines.forEach(function (l) {
    if (l.type === 'label') { cur = { name: C.sentenceCase(l.text), ch: [] }; parts.push(cur); return; }
    if (!l.segs) return;
    l.segs.forEach(function (g) {
      if (g.c === null || !C.isChordTok(g.c)) return;
      if (!cur) { cur = { name: 'Inicio', ch: [] }; parts.push(cur); }
      var n = C.splitTok(fmt(g.c)).core; if (cur.ch[cur.ch.length - 1] !== n) cur.ch.push(n);
    });
  });
  if (!inf.lines.some(function (l) { return l.type === 'label'; })) return '';
  var seen = {}, out = [];
  parts.forEach(function (p) { if (!p.ch.length) return; var sig = p.name + ':' + p.ch.join(' '); if (seen[sig]) return; seen[sig] = 1; out.push(p.name + ': ' + p.ch.join(' ')); });
  return out.join('\n');
}
function appLink(song) { return /^https?:$/.test(location.protocol) ? location.href.split('#')[0] + '#/s/' + enc(song.id) : ''; }
function numsText(song, wa) {
  var sh = songShift(song), map = numsMap(song), link = appLink(song), t = songText(song, { nums: true, wa: wa });
  if (map) t += '\n\n' + (wa ? '*Mapa*\n```\n' + map + '\n```' : 'Mapa\n' + map);
  if (link) t += '\n\nÁbrela en la app (con el rodillo y los números): ' + link;
  return t;
}
function openNumsShare(song) {
  var text = numsText(song, false);
  openSheet('Mandar en números', '<p class="help">La misma canción, con números en vez de letras, el mapa de sus partes y el enlace para abrirla en la app. Para practicar en casa.</p>' +
    '<div class="field"><textarea readonly rows="10">' + esc(text) + '</textarea></div>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-n="wa">' + icon('copy') + 'Copiar para WhatsApp</button>' +
    '<button type="button" class="btn" data-n="share">' + icon('share') + 'Compartir</button>' +
    '<button type="button" class="btn" data-n="print">' + icon('print') + 'Imprimir en números</button></div>', function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]'); if (!b) return;
      var a = b.getAttribute('data-n');
      if (a === 'wa') copyText(numsText(song, true), 'Copiado. Pégalo en WhatsApp.');
      else if (a === 'share') shareText(numsText(song, false), C.sentenceCase(song.title) + ' (en números)');
      else { closeSheet(true); openPrintSheet([{ song: song, shift: songShift(song) }], '', fileName(song.title) + '-numeros', true); }
    });
  });
}
function copyText(text, ok) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta); ta.select();
    var done = false; try { done = document.execCommand('copy'); } catch (e) { done = false; }
    document.body.removeChild(ta);
    if (done) toast(ok || 'Copiado.'); else showText('Copia este texto', text);
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(ok || 'Copiado.'); }, fallback);
    else fallback();
  } catch (e) { fallback(); }
}
function shareText(text, title) {
  if (navigator.share) navigator.share({ title: title, text: text }).catch(function (e) { if (!e || e.name !== 'AbortError') copyText(text); });
  else copyText(text);
}

/* ---------- archivos ---------- */
/* En iPhone las descargas dentro de una app instalada fallan a menudo: allí se usa «Compartir» (guardar en Archivos, WhatsApp…). */
function canShareFiles() {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })); } catch (e) { return false; }
}
function downloadFile(name, data, mime) {
  try {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: (mime || 'text/plain') + ';charset=utf-8' }));
    a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast('Descargado: ' + name, 3500);
  } catch (e) { showText('Copia el contenido y guárdalo como «' + name + '»', String(data)); }
}
function shareFile(name, data, mime) {
  var file;
  try { file = new File([data], name, { type: mime || 'text/plain' }); } catch (e) { file = null; }
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: name }).then(function () { return true; }, function (e) {
      if (e && e.name === 'AbortError') return false;
      downloadFile(name, data, mime); return true;
    });
  }
  downloadFile(name, data, mime);
  return Promise.resolve(true);
}
function saveFile(name, data, mime) {
  if (isIOS() && canShareFiles()) return shareFile(name, data, mime);
  downloadFile(name, data, mime);
  return Promise.resolve(true);
}
function effectiveData(newVersion) {
  return {
    app: 'cancionero-fdp', type: 'cancionero',
    name: isGroup() ? (DATA.name || '') : bookTitle(), subtitle: isGroup() ? (DATA.subtitle || '') : '',
    version: newVersion ? new Date().toISOString() : (DATA.version || new Date().toISOString()),
    groups: GROUPS.map(function (g) { return { id: g.id, name: g.name, color: g.color }; }),
    songs: allSongs().map(cleanSong),
    setlists: allSetlists().map(function (sl) { return { id: sl.id, name: sl.name, items: sl.items.map(function (it) { return { id: it.id, shift: it.shift == null ? null : it.shift }; }) }; })
  };
}
function changesPayload() {
  return JSON.stringify({ app: 'cancionero-fdp', type: 'cambios', book: bookTitle(), base: DATA.version, exported: new Date().toISOString(),
    songs: local.songs, deleted: local.deleted, setlists: local.setlists, setDeleted: local.setDeleted, groups: local.groups }, null, 1);
}
function exportMine(share) {
  var name = 'cambios-' + fileName(bookTitle()) + '-' + today() + '.json';
  (share ? shareFile : saveFile)(name, changesPayload(), 'application/json');
}
function exportBook(share) {
  var name = fileName(bookTitle()) + '.json';
  (share ? shareFile : saveFile)(name, JSON.stringify(effectiveData(false), null, 1), 'application/json');
}
/* Unir canciones y repertorios de otro archivo a la capa local del cancionero abierto. */
function mergeIntoCurrent(o) {
  var ns = 0, nl = 0;
  var takeSong = function (s) {
    if (!s || !s.id || typeof s.src !== 'string' || !s.title) return;
    s = cleanSong(s); var b = baseSong(s.id);
    if (b && JSON.stringify(cleanSong(b)) === JSON.stringify(s)) return;
    if (s.group && !GMAP[s.group]) {
      var g = (o.groups || []).filter(function (x) { return x && x.id === s.group; })[0];
      if (g) local.groups[g.id] = { id: g.id, name: String(g.name || 'Sección'), color: g.color || PALETTE[Object.keys(local.groups).length % PALETTE.length] };
      else s.group = 'nuevas';
    }
    local.songs[s.id] = s; delete local.deleted[s.id]; ns++;
  };
  var takeSet = function (sl) {
    if (!sl || !sl.id || !Array.isArray(sl.items)) return;
    local.setlists[sl.id] = { id: String(sl.id), name: String(sl.name || 'Repertorio'),
      items: sl.items.filter(function (it) { return it && it.id; }).map(function (it) { return { id: String(it.id), shift: it.shift == null ? null : +it.shift }; }) };
    delete local.setDeleted[sl.id]; nl++;
  };
  if (o.type === 'cambios') {
    Object.keys(o.groups || {}).forEach(function (id) { var g = o.groups[id]; if (g && g.id) local.groups[g.id] = { id: g.id, name: String(g.name), color: g.color }; });
    rebuildGroups();
    Object.keys(o.songs || {}).forEach(function (id) { takeSong(o.songs[id]); });
    Object.keys(o.deleted || {}).forEach(function (id) { if (baseSong(id)) { local.deleted[id] = true; delete local.songs[id]; } });
    Object.keys(o.setlists || {}).forEach(function (id) { takeSet(o.setlists[id]); });
    Object.keys(o.setDeleted || {}).forEach(function (id) { local.setDeleted[id] = true; delete local.setlists[id]; });
  } else {
    o.songs.forEach(takeSong); (o.setlists || []).forEach(takeSet);
  }
  saveLocal(); rebuildGroups(); infoCache = {};
  toast('Agregado: ' + ns + (ns === 1 ? ' canción' : ' canciones') + ' y ' + nl + (nl === 1 ? ' repertorio.' : ' repertorios.'), 4000);
  render();
}
function importPayload(text, fname) {
  var t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) { toast('No hay nada que importar.'); return; }
  if (t[0] === '{') {
    var o; try { o = JSON.parse(t); } catch (e) { toast('Ese archivo no es un cancionero válido.', 4000); return; }
    if (o.type === 'cambios') { mergeIntoCurrent(o); return; }
    if (!Array.isArray(o.songs)) { toast('Ese archivo no es un cancionero válido.', 4000); return; }
    var name = String(o.name || (fname ? fname.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') || 'Cancionero importado');
    openSheet('Abrir cancionero', '<p class="help">«' + esc(name) + '» trae ' + o.songs.length + (o.songs.length === 1 ? ' canción' : ' canciones') +
      '. ¿Qué quieres hacer?</p><ul class="menu">' +
      '<li><button type="button" data-x="new">' + icon('book') + 'Abrirlo como un cancionero aparte<span class="sub">recomendado</span></button></li>' +
      '<li><button type="button" data-x="merge">' + icon('add') + 'Agregar sus canciones a «' + esc(bookTitle()) + '»</button></li></ul>', function (el) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-x]'); if (!b) return;
        closeSheet(true);
        if (b.getAttribute('data-x') === 'new') createBook(name, o); else mergeIntoCurrent(o);
      });
    });
    return;
  }
  var imp = C.importText(t);
  pendingImport = { src: imp.src, title: imp.meta.title || (fname ? fname.replace(/\.[^.]+$/, '') : ''), author: imp.meta.author, key: keyFromStr(imp.meta.key) ? imp.meta.key : '' };
  if (location.hash === '#/e/nueva') render(); else location.hash = '#/e/nueva';
}
function pickFile() {
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,.txt,.cho,.chordpro,.pro,application/json,text/plain'; inp.style.display = 'none';
  document.body.appendChild(inp);
  inp.addEventListener('change', function () {
    var f = inp.files && inp.files[0]; if (!f) { inp.remove(); return; }
    var r = new FileReader();
    r.onload = function () { inp.remove(); importPayload(r.result, f.name); };
    r.onerror = function () { inp.remove(); toast('No se pudo leer el archivo.'); };
    r.readAsText(f);
  });
  inp.click();
}
function openPasteImport() {
  openSheet('Pegar cancionero o canción', '<p class="help">Pega un cancionero o unos cambios (texto que empieza con «{»), o una canción con los acordes encima de la letra.</p>' +
    '<div class="field"><textarea id="pi-src" rows="10" spellcheck="false"></textarea></div><div class="btnrow"><button type="button" class="btn primary" data-x="ok">Importar</button></div>', function (el) {
    el.querySelector('[data-x="ok"]').addEventListener('click', function () { var v = el.querySelector('#pi-src').value; closeSheet(true); importPayload(v, ''); });
  });
}
function openBackupSheet() {
  var n = localChangeCount(), share = canShareFiles();
  var items = [
    { id: 'book', icon: 'download', label: 'Guardar una copia de este cancionero', sub: bookTitle(), run: function () { exportBook(false); } }
  ];
  if (share) items.push({ id: 'bookshare', icon: 'share', label: 'Enviar este cancionero', sub: 'WhatsApp, correo…', run: function () { exportBook(true); } });
  if (isGroup()) {
    items.push({ id: 'mine', icon: 'download', label: 'Guardar solo mis cambios', sub: n ? String(n) : 'ninguno', disabled: !n, run: function () { exportMine(false); } });
    if (share && n) items.push({ id: 'mineshare', icon: 'share', label: 'Enviar mis cambios', sub: 'a quien administra', run: function () { exportMine(true); } });
  }
  items.push({ id: 'imp', icon: 'upload', label: 'Abrir un archivo', sub: 'cancionero, cambios o canción', run: pickFile });
  items.push({ id: 'paste', icon: 'copy', label: 'Pegar un cancionero o una canción', run: openPasteImport });
  if (n && isGroup()) items.push({ id: 'discard', icon: 'trash', label: 'Descartar mis cambios', sub: 'volver a lo publicado', run: function () {
    confirmSheet('Descartar cambios', 'Se borran de este equipo las canciones nuevas o editadas y los repertorios que no se publicaron. No se puede deshacer.', 'Descartar', function () {
      local = emptyLocal(); saveLocal(); LS.del(bk('pub')); rebuildGroups(); infoCache = {}; render(); toast('Cambios descartados.');
    }, true);
  } });
  menuSheet('Copias y archivos', items, '<p class="help">Todo se guarda en este equipo. Con estos archivos haces copias de seguridad, pasas tus canciones a otro celular o las envías a otras personas.</p>');
}

/* ---------- impresión ---------- */
function printItemsHTML(items, title, nums) {
  return '<div class="p-cols">' + (title ? '<h1 class="p-title">' + esc(title) + '</h1>' : '') + items.map(function (it) {
    var s = it.song, inf = info(s), k = nums ? numsTranspose(s, it.shift) : 0;
    var meta = [s.momento ? esc(C.sentenceCase(s.momento)) : '', s.author ? esc(C.nameCase(s.author)) : '', 'Tono <b>' + esc(keyLabel(inf.key, it.shift)) + '</b>',
      nums ? 'En números: teclado en ' + (inf.key.minor ? 'La menor' : 'Do') + (k ? ', transpone ' + (k > 0 ? '+' : '−') + Math.abs(k) : '') : '']
      .filter(Boolean).map(function (x) { return '<span>' + x + '</span>'; }).join('');
    return '<section class="p-song"><h2>' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) + '</h2><p class="p-meta">' + meta + '</p>' +
      '<div class="song">' + bodyHTML(s, nums ? fmtFor(inf.key, 0, 'num') : fmtFor(inf.key, it.shift)) + '</div></section>';
  }).join('') + '</div>';
}
function preparePrint(items, title, nums) {
  var root = document.getElementById('print-root');
  root.innerHTML = printItemsHTML(items, title, nums);
  fixCollisions(root);
  return root;
}
/* los estilos de la app (desde oct 2026 viven en app.css): para el archivo de impresión */
function appCssText() {
  var el = document.getElementById('app-css'), out = '';
  if (el && el.tagName === 'STYLE') return el.textContent;
  try { var sh = el && el.sheet; if (sh) for (var i = 0; i < sh.cssRules.length; i++) out += sh.cssRules[i].cssText + '\n'; } catch (e) { out = ''; }
  return out;
}
function printDocument(inner, title) {
  var css = appCssText().replace(/url\(["']?([^"')]+\.woff2)["']?\)/g, function (m, u) {
    try { return "url('" + new URL(u, location.href).href + "')"; } catch (e) { return m; }
  });
  return '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>' + css + '\n#print-root{position:static;visibility:visible;width:auto;max-width:186mm;margin:0 auto;padding:6mm 4mm}' +
    '\n.hint{font:15px/1.45 var(--ui-font);background:#fff2f5;color:#1e2447;padding:10px 14px;border-radius:10px;margin:12px auto;max-width:186mm}\n@media print{.hint{display:none}}</style></head>' +
    '<body><p class="hint">Para imprimir o guardar como PDF, abre el menú del navegador y elige Imprimir.</p><div id="print-root">' + inner + '</div></body></html>';
}
function openPrintSheet(items, title, base, nums) {
  var body = '<p class="help">' + (items.length === 1 ? 'Se imprime la canción' : 'Se imprimen ' + items.length + ' canciones') +
    ' en el tono elegido, a dos columnas en hoja A4 y con cada acorde sobre su sílaba.</p>' +
    '<label class="chk"><input type="checkbox" id="p-nums"' + (nums ? ' checked' : '') + '> Acordes en números (para practicar en el teclado)</label>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-p="now">' + icon('print') + 'Imprimir ahora</button>' +
    '<button type="button" class="btn" data-p="file">' + icon('download') + 'Descargar para imprimir</button></div>' +
    '<p class="help">Si no se abre la ventana de impresión, usa «Descargar para imprimir»: guarda una página que abres en el navegador para imprimirla o guardarla como PDF.</p>';
  openSheet('Imprimir', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]'); if (!b) return;
      var nn = !!(el.querySelector('#p-nums') && el.querySelector('#p-nums').checked);
      var root = preparePrint(items, title, nn);
      if (b.getAttribute('data-p') === 'now') {
        closeSheet(true);
        setTimeout(function () { try { window.print(); } catch (x) { toast('Aquí no se puede imprimir directamente. Usa «Descargar para imprimir».', 5000); } }, 80);
      } else saveFile(base + '.html', printDocument(root.innerHTML, title || C.sentenceCase(items[0].song.title)), 'text/html');
    });
  });
}

/* ---------- repertorios: menús ---------- */
function openAddToSet(song) {
  if (!song) return;
  var sets = allSetlists(), sh = normShift(songShift(song));
  var body = '<p class="help">Se añade «' + esc(C.sentenceCase(song.title)) + '» en ' + esc(keyLabel(info(song).key, sh)) + '.</p><ul class="menu">' +
    sets.map(function (sl) { return '<li><button type="button" data-s="' + esc(sl.id) + '">' + icon('list') + esc(sl.name) + '<span class="sub">' + sl.items.length + '</span></button></li>'; }).join('') +
    '<li><button type="button" data-s="__new">' + icon('add') + 'Nuevo repertorio</button></li></ul>';
  openSheet('Añadir a repertorio', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-s]'); if (!b) return;
      var id = b.getAttribute('data-s');
      var add = function (sl) { var c = clone(sl); c.items.push({ id: song.id, shift: sh }); saveSetlist(c); toast('Añadida a «' + c.name + '».'); };
      closeSheet(true);
      if (id === '__new') promptSheet('Nuevo repertorio', 'Nombre', defaultSetName(), 'Crear', function (name) { add({ id: newId('r'), name: name, items: [] }); });
      else add(getSetlist(id));
    });
  });
}
function openSetAdd() {
  var sl = current.setlist; if (!sl) return;
  var body = '<label class="search" style="margin-bottom:.6rem">' + icon('search') + '<span class="sr">Buscar</span><input id="sa-q" type="search" placeholder="Buscar canción" autocomplete="off"></label><ul class="menu" id="sa-list"></ul>';
  openSheet('Añadir a «' + sl.name + '»', body, function (el) {
    var q = el.querySelector('#sa-q'), list = el.querySelector('#sa-list');
    function draw() {
      var now = getSetlist(sl.id), songs = allSongs(), v = q.value.trim();
      var arr = v ? searchSongs(songs, v).map(function (x) { return x.s; }) : songs;
      list.innerHTML = arr.slice(0, 90).map(function (s) {
        var inside = now.items.some(function (it) { return it.id === s.id; });
        return '<li><button type="button" data-add="' + esc(s.id) + '"><span class="key">' + esc(keyLabel(info(s).key, songShift(s, true))) + '</span>' +
          (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) + '<span class="sub">' + (inside ? 'ya está' : '') + '</span></button></li>';
      }).join('') || '<li class="empty">Sin resultados.</li>';
    }
    q.addEventListener('input', debounce(draw, 100)); draw();
    list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-add]'); if (!b) return;
      var c = clone(getSetlist(sl.id)); c.items.push({ id: b.getAttribute('data-add'), shift: null }); saveSetlist(c);
      current.setlist = getSetlist(c.id); toast('Añadida.'); draw();
    });
  }, { onClose: function () { if (route.name === 'set' && route.id === sl.id) renderSetlist(sl.id); } });
}
function setText(sl) {
  var n = 0;
  return '*' + sl.name + '*\n' + sl.items.map(function (it) {
    var s = getSong(it.id); if (!s) return null;
    var sh = it.shift != null ? it.shift : songShift(s, true);
    return (++n) + '. ' + C.sentenceCase(s.title) + ' (' + keyLabel(info(s).key, sh) + ')';
  }).filter(Boolean).join('\n');
}
function setItems(sl) {
  return sl.items.map(function (it) { var s = getSong(it.id); return s ? { song: s, shift: it.shift != null ? it.shift : songShift(s, true) } : null; }).filter(Boolean);
}
function openSetMenu() {
  var sl = current.setlist; if (!sl) return;
  menuSheet(sl.name, [
    { id: 'rn', icon: 'edit', label: 'Cambiar nombre', run: function () { promptSheet('Cambiar nombre', 'Nombre', sl.name, 'Guardar', function (v) { mutateSet(function (x) { x.name = v; }); }); } },
    { id: 'cp', icon: 'copy', label: 'Copiar la lista para WhatsApp', run: function () { copyText(setText(sl), 'Lista copiada.'); } },
    { id: 'cpall', icon: 'copy', label: 'Copiar todas las canciones', run: function () {
      copyText(setItems(sl).map(function (x) { return songText(x.song, { shift: x.shift, capo: 0 }); }).join('\n\n\n'), 'Canciones copiadas.'); } },
    { id: 'pr', icon: 'print', label: 'Imprimir el repertorio', run: function () { openPrintSheet(setItems(sl), sl.name, fileName(sl.name)); } },
    { id: 'del', icon: 'trash', label: 'Eliminar repertorio', run: function () {
      confirmSheet('Eliminar repertorio', '¿Eliminar «' + esc(sl.name) + '»? Las canciones no se borran.', 'Eliminar', function () {
        if (DATA.setlists.some(function (x) { return x.id === sl.id; })) local.setDeleted[sl.id] = true;
        delete local.setlists[sl.id]; saveLocal(); location.hash = '#/r';
      }, true); } }
  ]);
}

/* ---------- publicar para todos (GitHub Pages) ---------- */
/* Si la app está en usuario.github.io/repositorio, se arma el enlace directo a la página de subida del repositorio. */
function githubInfo() {
  var m = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  if (!m) return null;
  var owner = m[1], seg = location.pathname.split('/').filter(Boolean);
  var repo = seg.length && !/\.(html?|json)$/i.test(seg[0]) ? seg[0] : owner + '.github.io';
  return { owner: owner, repo: repo, upload: 'https://github.com/' + owner + '/' + repo + '/upload/main', repoUrl: 'https://github.com/' + owner + '/' + repo };
}
function preparePublish() {
  // Antes de publicar se trae la última versión publicada, para no borrar lo que otra persona haya subido.
  return fetchRemote().then(function (res) {
    if (res === 'sin-red') toast('Sin internet: no pude comprobar si hay una versión más nueva. Se usa la que tienes.', 5000);
    var data = effectiveData(true);
    markPublished(data.version);
    return saveFile('canciones.json', JSON.stringify(data, null, 1), 'application/json');
  });
}
function openPublishSheet() {
  var gh = githubInfo(), n = localChangeCount();
  var body = '<p class="help">' + (n === 1 ? 'Tienes 1 cambio guardado' : 'Tienes ' + n + ' cambios guardados') +
    ' solo en este equipo. Para que todos lo vean, se publica el cancionero completo en dos pasos.</p><ol class="steps">' +
    '<li><b>Descarga el cancionero actualizado.</b> Es el archivo canciones.json, con todas las canciones y tus cambios.' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="dl">' + icon('download') + 'Descargar canciones.json</button></div></li>' +
    '<li><b>Súbelo a GitHub</b> en lugar del anterior: arrastra el archivo a la página que se abre y toca «Commit changes».' +
    (gh ? '<div class="btnrow"><a class="btn" href="' + esc(gh.upload) + '" target="_blank" rel="noopener">' + icon('upload') + 'Abrir GitHub</a></div>'
        : '<div class="note-box">Abre tu repositorio en github.com y usa «Add file», luego «Upload files».</div>') + '</li></ol>' +
    '<div class="note-box">El archivo tiene que llamarse exactamente <b>canciones.json</b>. Si tu equipo lo guarda como «canciones (1).json», cámbiale el nombre antes de subirlo.</div>' +
    '<p class="help">En uno o dos minutos, quien abra la app con internet verá la versión nueva. Tus cambios siguen guardados en este equipo hasta que esa versión llegue aquí.</p>' +
    '<p class="help">¿No administras el cancionero? Envía tus cambios a quien lo administra: ' +
    '<button type="button" class="btn" data-x="send">' + icon(canShareFiles() ? 'share' : 'download') + (canShareFiles() ? 'Enviar mis cambios' : 'Guardar mis cambios') + '</button></p>';
  openSheet('Publicar para todos', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b || b.disabled) return;
      if (b.getAttribute('data-x') === 'dl') {
        b.disabled = true; b.textContent = 'Preparando…';
        preparePublish().then(function () { b.disabled = false; b.innerHTML = icon('download') + 'Descargar otra vez'; });
      } else if (b.getAttribute('data-x') === 'send') exportMine(canShareFiles());
    });
  });
}

/* ---------- cancioneros ---------- */
function bookDisplayName(b) {
  if (b.kind === 'local') return b.name || 'Mi cancionero';
  if (b.id === BOOKS.active) return DATA.name || 'Cancionero del grupo';
  var c = LS.get(bk('cache', b.id), null) || EMBED || {};
  return c.name || 'Cancionero del grupo';
}
function openBooksSheet() {
  var rows = BOOKS.list.map(function (b) {
    var on = b.id === BOOKS.active;
    return '<li class="bookrow"><span class="ttl">' + esc(bookDisplayName(b)) + '<small>' +
      (b.kind === 'remote' ? 'Compartido, se actualiza desde internet' : 'Propio, guardado solo en este equipo') + '</small></span>' +
      (on ? '<span class="on">Abierto</span>' : '<button type="button" class="btn" data-open="' + esc(b.id) + '">Abrir</button>') +
      (b.kind === 'local' ? btnIcon('edit', 'Cambiar nombre', 'data-ren="' + esc(b.id) + '"') + btnIcon('trash', 'Eliminar cancionero', 'data-del="' + esc(b.id) + '"') : '') + '</li>';
  }).join('');
  var body = '<ul class="booklist">' + rows + '</ul>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="new">' + icon('add') + 'Nuevo cancionero vacío</button>' +
    '<button type="button" class="btn" data-x="imp">' + icon('upload') + 'Abrir un archivo</button></div>' +
    '<p class="help">Un cancionero propio sirve para tus canciones o las de otro grupo. Se guarda solo en este equipo; para compartirlo, ábrelo y usa «Copias y archivos».</p>';
  openSheet('Cancioneros', body, function (el) {
    el.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.hasAttribute('data-open')) { closeSheet(true); switchBook(t.getAttribute('data-open')); }
      else if (t.hasAttribute('data-ren')) { var r = t.getAttribute('data-ren'); closeSheet(true); renameBook(r); }
      else if (t.hasAttribute('data-del')) { var d = t.getAttribute('data-del'); closeSheet(true); deleteBook(d); }
      else if (t.getAttribute('data-x') === 'new') { closeSheet(true); promptSheet('Nuevo cancionero', 'Nombre', 'Mi cancionero', 'Crear', function (name) { createBook(name, null); }); }
      else if (t.getAttribute('data-x') === 'imp') { closeSheet(true); pickFile(); }
    });
  });
}
function switchBook(id) {
  if (!BOOKS.list.some(function (b) { return b.id === id; })) return;
  leaveSong();
  BOOKS.active = id; saveBooks();
  openBookData();
  homeState = { q: '', group: 'todas', scroll: 0 };
  if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/'; else render();
  toast('Abierto: ' + bookTitle());
  fetchRemote().then(function (res) { if (res === 'nuevo') afterRemoteUpdate(); else refreshChrome(); });
}
function createBook(name, data) {
  var id = newId('b'), d = data ? clone(data) : emptyBook(name);
  d.name = name; d.type = 'cancionero'; d.app = 'cancionero-fdp';
  if (!Array.isArray(d.groups) || !d.groups.length) d.groups = [clone(DEFAULT_GROUP)];
  if (!LS.set(bk('base', id), d)) { toast('No hay espacio en este equipo para otro cancionero.', 4500); return; }
  BOOKS.list.push({ id: id, name: name, kind: 'local' }); saveBooks();
  switchBook(id);
}
function renameBook(id) {
  var b = BOOKS.list.filter(function (x) { return x.id === id; })[0]; if (!b || b.kind !== 'local') return;
  promptSheet('Cambiar nombre', 'Nombre del cancionero', b.name, 'Guardar', function (v) {
    b.name = v; saveBooks();
    var base = LS.get(bk('base', id), null); if (base) { base.name = v; LS.set(bk('base', id), base); }
    if (id === BOOKS.active) { DATA.name = v; render(); }
  });
}
function deleteBook(id) {
  var b = BOOKS.list.filter(function (x) { return x.id === id; })[0]; if (!b || b.kind !== 'local') return;
  confirmSheet('Eliminar cancionero', '¿Eliminar «' + esc(b.name) + '» de este equipo? Se borran sus canciones y repertorios. Si quieres conservarlo, guarda antes una copia desde «Copias y archivos».', 'Eliminar', function () {
    ['base', 'local', 'view', 'pub', 'cache'].forEach(function (k) { LS.del(bk(k, id)); });
    BOOKS.list = BOOKS.list.filter(function (x) { return x.id !== id; });
    var wasActive = BOOKS.active === id;
    if (wasActive) BOOKS.active = 'grupo';
    saveBooks();
    if (wasActive) switchBook('grupo');
    toast('Cancionero eliminado.');
  }, true);
}

/* ---------- instalar como app ---------- */
function openInstall() {
  if (isStandalone()) { toast('Ya estás usando la app instalada.'); return; }
  if (install.evt) {
    var ev = install.evt; install.evt = null;
    try { ev.prompt(); } catch (e) { /* nada */ }
    Promise.resolve(ev.userChoice).then(function (c) { if (c && c.outcome === 'accepted') toast('Instalando el cancionero…'); refreshChrome(); });
    return;
  }
  var ua = navigator.userAgent, edge = /Edg\//.test(ua), android = /Android/i.test(ua), steps;
  if (isIOS()) steps = '<ol class="steps"><li>Abre esta página en <b>Safari</b>.</li><li>Toca <b>Compartir</b> (el cuadrado con una flecha hacia arriba).</li><li>Elige <b>Agregar a inicio</b> y luego <b>Agregar</b>.</li></ol>';
  else if (android) steps = '<ol class="steps"><li>Abre esta página en <b>Chrome</b>. Si llegaste desde WhatsApp, toca el menú ⋮ y elige «Abrir en Chrome».</li>' +
      '<li>Toca el menú <b>⋮</b>, arriba a la derecha.</li><li>Elige <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.</li></ol>';
  else if (edge) steps = '<ol class="steps"><li>En <b>Edge</b>, toca el menú <b>⋯</b> (arriba a la derecha).</li><li>Elige <b>Aplicaciones</b> y luego <b>Instalar este sitio como aplicación</b>.</li>' +
      '<li>O toca el ícono de instalar que aparece en la barra de la dirección (una ventanita con un +).</li></ol>';
  else steps = '<ol class="steps"><li>En <b>Chrome</b> de la computadora, mira la barra de la dirección: a la derecha aparece un ícono de instalar (una pantalla con una flecha). Tócalo.</li>' +
      '<li>Si no aparece: menú <b>⋮</b> → <b>Transmitir, guardar y compartir</b> → <b>Instalar página como app</b> (en versiones anteriores: menú ⋮ → <b>Instalar Cancionero</b>).</li>' +
      '<li>Si ya la tenías instalada y la desinstalaste, puede pedir recargar la página una vez antes de mostrar la opción.</li></ol>';
  openSheet('Instalar en este equipo', '<p class="help">Instalado, el cancionero aparece con su ícono, se abre a pantalla completa y funciona sin internet después de abrirlo una vez con conexión.</p>' + steps +
    (location.protocol === 'file:' ? '<div class="note-box">Estás abriendo un archivo guardado en el equipo. Para instalarlo, ábrelo desde su dirección web, por ejemplo la de GitHub Pages.</div>' : ''));
}

/* parte 4b: editor de canciones (visual) */
var editorState = null, pendingImport = null;
var KEY_OPTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
var MOMENTOS = ['Entrada', 'Perdón', 'Gloria', 'Aleluya', 'Ofertorio', 'Santo', 'Cordero', 'Paz', 'Comunión', 'Acción de gracias', 'Final', 'Alabanza', 'Adoración'];
var QUALS = [['', 'Mayor'], ['m', 'menor'], ['7', '7'], ['m7', 'm7'], ['maj7', 'maj7'], ['sus4', 'sus4'], ['sus2', 'sus2'], ['6', '6'],
             ['m6', 'm6'], ['9', '9'], ['add9', 'add9'], ['dim', 'dim'], ['aug', 'aug'], ['m7b5', 'm7b5']];
var MODES = [['letra', 'Letra'], ['acordes', 'Acordes'], ['texto', 'Texto'], ['datos', 'Datos']];
function val(id) { var el = document.getElementById(id); return el ? el.value : ''; }
function $(id) { return document.getElementById(id); }
function groupOptionsHTML(sel) {
  return GROUPS.map(function (g) { return '<option value="' + esc(g.id) + '"' + (sel === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>'; }).join('') +
    '<option value="__new">+ Nueva sección…</option>';
}
function edFmt(c) { return C.transposeTok(c, { shift: 0, keep: true, notation: prefs.notation }); }

/* ---------- abrir el editor ---------- */
function renderEditor(id) {
  leaveSong();
  var isNew = id === 'nueva', orig = isNew ? null : getSong(id);
  if (!isNew && !orig) { location.hash = '#/'; return; }
  var s = isNew ? { id: newId('u'), title: '', group: 'nuevas', src: '' } : clone(orig);
  if (isNew && pendingImport) { Object.keys(pendingImport).forEach(function (k) { if (pendingImport[k]) s[k] = pendingImport[k]; }); pendingImport = null; }
  var keys = KEY_OPTS.slice(); if (s.key && keys.indexOf(s.key) < 0) keys.unshift(s.key);
  var edited = !isNew && local.songs[s.id] && baseSong(s.id);
  app.innerHTML = '<div class="ed">' +
    '<div class="page-h ed-top">' + btnIcon('back', 'Volver sin guardar', 'data-act="edcancel"') + '<h1>' + (isNew ? 'Nueva canción' : 'Editar canción') + '</h1>' +
      '<button type="button" class="btn primary" data-act="edsave">Guardar</button></div>' +
    '<div class="field ed-title"><label for="f-title">Título</label><input id="f-title" value="' + esc(s.title) + '" autocomplete="off" placeholder="Nombre de la canción"></div>' +
    '<div class="ed-tabs" role="tablist" aria-label="Partes del editor">' + MODES.map(function (m) {
      return '<button type="button" role="tab" id="tab-' + m[0] + '" data-mode="' + m[0] + '" aria-selected="false">' + m[1] + '</button>'; }).join('') + '</div>' +
    /* Letra */
    '<section class="ed-pane" id="pane-letra" hidden>' +
      '<div class="ed-ins">' +
        '<button type="button" class="btn" data-ins="[Coro]">+ Coro</button><button type="button" class="btn" data-ins="[Verso]">+ Verso</button>' +
        '<button type="button" class="btn" data-ins="[Intro]">+ Intro</button><button type="button" class="btn" data-ins="> ">+ Nota</button>' +
        '<button type="button" class="btn" data-act="edpaste">' + icon('copy') + 'Pegar con acordes encima</button></div>' +
      '<div class="field"><label for="f-letra">Letra</label><textarea id="f-letra" class="ed-letra" rows="16" spellcheck="true" autocapitalize="sentences" ' +
        'placeholder="Escribe un verso por línea.&#10;Deja una línea vacía entre estrofas.&#10;&#10;[Coro]&#10;Alabaré, alabaré…"></textarea></div>' +
      '<p class="help">Escribe un verso por línea y deja una línea vacía entre estrofas. Las secciones van entre corchetes, como <b>[Coro]</b>; los botones de arriba las ponen por ti. Después pasa a <b>Acordes</b> para colocarlos tocando la letra. Si cambias palabras de una línea que ya tiene acordes, cada acorde sigue a su sílaba.</p>' +
    '</section>' +
    /* Acordes */
    '<section class="ed-pane" id="pane-acordes" hidden>' +
      '<p class="help ed-lead">Toca la sílaba donde va el acorde y elígelo abajo. Toca un acorde para cambiarlo, moverlo o quitarlo. Se escriben en el tono original.</p>' +
      '<div class="song ed-song" id="ed-song"></div>' +
    '</section>' +
    /* Texto */
    '<section class="ed-pane" id="pane-texto" hidden>' +
      '<div class="guide">Modo avanzado: cada acorde va entre corchetes justo antes de su sílaba, como <code>Yo le al[D]abo</code>. ' +
      'Líneas especiales: <code># Coro 1</code> sección, <code>&gt; (De nuevo coro)</code> nota, <code>! Intro: [C] [G]</code> acordes sin letra.</div>' +
      '<div class="field"><label for="f-src">Letra y acordes</label><textarea id="f-src" spellcheck="false" autocapitalize="off" autocomplete="off" rows="16"></textarea></div>' +
      '<p class="preview-h">Vista previa</p><div class="preview"><div class="song" id="ed-prev"></div></div>' +
    '</section>' +
    /* Datos */
    '<section class="ed-pane" id="pane-datos" hidden>' +
      '<div class="grid2"><div class="field"><label for="f-num">Número</label><input id="f-num" inputmode="numeric" value="' + esc(s.num || '') + '"></div>' +
      '<div class="field"><label for="f-group">Sección del cancionero</label><select id="f-group">' + groupOptionsHTML(groupOf(s)) + '</select></div></div>' +
      '<div class="field"><label for="f-author">Autor o fuente</label><input id="f-author" value="' + esc(s.author || '') + '" autocomplete="off"></div>' +
      '<div class="grid2"><div class="field"><label for="f-key">Tono original</label><select id="f-key"><option value="">Detectar</option>' +
        keys.map(function (k) { return '<option' + (s.key === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="f-momento">Momento de la misa</label><input id="f-momento" list="momentos" value="' + esc(s.momento || '') + '" autocomplete="off"></div></div>' +
      '<datalist id="momentos">' + MOMENTOS.map(function (m) { return '<option value="' + m + '">'; }).join('') + '</datalist>' +
      '<div class="grid2"><div class="field"><label for="f-style">Ritmo o estilo</label><input id="f-style" value="' + esc(s.style || '') + '" placeholder="Twist, rock and roll, cumbia…" autocomplete="off"></div>' +
      '<div class="field"><label for="f-bpm">Tempo (bpm)</label><input id="f-bpm" inputmode="numeric" value="' + esc(s.bpm || '') + '"></div></div>' +
      '<div class="btnrow" style="margin-top:1rem">' + (edited ? '<button type="button" class="btn" data-act="edrestore">Restaurar original</button>' : '') +
      (!isNew ? '<button type="button" class="btn danger" data-act="eddelete">' + icon('trash') + 'Eliminar canción</button>' : '') + '</div>' +
    '</section>' +
    '<div class="edpanel" id="edpanel" hidden></div>' +
  '</div>';
  editorState = { s: s, isNew: isNew, model: C.srcToModel(s.src || ''), mode: null, undo: [], redo: [], sel: null, clip: null, letraBase: null, used: [], start: '' };
  wireEditor();
  setMode(isNew || !editorState.model.length ? 'letra' : 'acordes');
  editorState.start = JSON.stringify(readEditor());
}
function wireEditor() {
  var ed = app.querySelector('.ed');
  ed.querySelector('.ed-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (b) setMode(b.getAttribute('data-mode')); });
  ed.querySelector('.ed-ins').addEventListener('click', function (e) { var b = e.target.closest('[data-ins]'); if (b) insertInLetra(b.getAttribute('data-ins')); });
  $('ed-song').addEventListener('click', onSongTap);
  $('edpanel').addEventListener('click', onPanelTap);
  $('f-src').addEventListener('input', debounce(updatePreview, 180));
  $('f-key').addEventListener('change', function () { if (editorState.mode === 'acordes') renderPanel(); });
  var gsel = $('f-group'); gsel.setAttribute('data-prev', gsel.value);
  gsel.addEventListener('change', function () {
    if (gsel.value !== '__new') { gsel.setAttribute('data-prev', gsel.value); return; }
    gsel.value = gsel.getAttribute('data-prev') || 'nuevas';
    promptSheet('Nueva sección', 'Nombre de la sección', '', 'Crear', function (name) {
      var id = 'g' + Date.now().toString(36);
      local.groups[id] = { id: id, name: name, color: PALETTE[GROUPS.length % PALETTE.length] };
      saveLocal(); rebuildGroups();
      gsel.innerHTML = groupOptionsHTML(id); gsel.value = id; gsel.setAttribute('data-prev', id);
    });
  });
}

/* ---------- pestañas ---------- */
function setMode(m) {
  var st = editorState; if (!st || st.mode === m) return;
  syncFromMode();
  st.mode = m;
  MODES.forEach(function (x) {
    $('tab-' + x[0]).setAttribute('aria-selected', String(x[0] === m));
    $('pane-' + x[0]).hidden = x[0] !== m;
  });
  $('edpanel').hidden = m !== 'acordes';
  document.body.classList.toggle('ed-chords', m === 'acordes');
  if (m === 'letra') { st.letraBase = clone(st.model); $('f-letra').value = C.modelToLetra(st.model); }
  else if (m === 'texto') { $('f-src').value = C.modelToSrc(st.model); updatePreview(); }
  else if (m === 'acordes') { st.sel = null; renderChordEditor(); }
}
/* Pasa lo escrito en Letra o Texto al modelo de la canción. */
function syncFromMode() {
  var st = editorState; if (!st) return;
  var next = null;
  if (st.mode === 'letra') next = C.reconcile(st.letraBase || st.model, C.parseLetra($('f-letra').value));
  else if (st.mode === 'texto') next = C.srcToModel($('f-src').value.replace(/\r/g, ''));
  if (next && JSON.stringify(next) !== JSON.stringify(st.model)) { pushUndo(); st.model = next; }
  if (st.mode === 'letra') st.letraBase = clone(st.model);
}
function insertInLetra(txt) {
  var ta = $('f-letra'), v = ta.value, pos = ta.selectionStart == null ? v.length : ta.selectionStart;
  var ls = v.lastIndexOf('\n', pos - 1) + 1, le = v.indexOf('\n', pos); if (le < 0) le = v.length;
  var out, caret;
  if (!v.slice(ls, le).trim()) { out = v.slice(0, ls) + txt + v.slice(le); caret = ls + txt.length; }
  else { out = v.slice(0, le) + '\n' + txt + v.slice(le); caret = le + 1 + txt.length; }
  ta.value = out; ta.focus(); ta.setSelectionRange(caret, caret);
}

/* ---------- deshacer ---------- */
function pushUndo() {
  var st = editorState; st.undo.push(JSON.stringify(st.model));
  if (st.undo.length > 120) st.undo.shift();
  st.redo = [];
}
function undoEd() {
  var st = editorState; if (!st.undo.length) { toast('No hay nada que deshacer.'); return; }
  st.redo.push(JSON.stringify(st.model)); st.model = JSON.parse(st.undo.pop()); st.sel = null; refreshModeView();
}
function redoEd() {
  var st = editorState; if (!st.redo.length) return;
  st.undo.push(JSON.stringify(st.model)); st.model = JSON.parse(st.redo.pop()); st.sel = null; refreshModeView();
}
function refreshModeView() {
  var st = editorState;
  if (st.mode === 'acordes') renderChordEditor();
  else if (st.mode === 'letra') { st.letraBase = clone(st.model); $('f-letra').value = C.modelToLetra(st.model); }
  else if (st.mode === 'texto') { $('f-src').value = C.modelToSrc(st.model); updatePreview(); }
}

/* ---------- pestaña Acordes: dibujo ---------- */
function selIs(li, kind, k) {
  var s = editorState.sel;
  return !!s && s.li === li && s.kind === kind && (k === undefined || (kind === 'pos' ? s.i === k : (kind === 'chord' || kind === 'add') ? s.ci === k : s.k === k));
}
function edLyricHTML(l, li) {
  var byPos = {}, text = l.text, out = '', inWord = false, i;
  l.chords.forEach(function (c, ci) { var p = Math.max(0, Math.min(text.length, c.i)); (byPos[p] = byPos[p] || []).push(ci); });
  function anchors(p) {
    return (byPos[p] || []).map(function (ci) {
      var c = l.chords[ci];
      return '<span class="a"><b class="ch' + (C.isChordTok(c.c) ? '' : ' x') + (selIs(li, 'chord', ci) || selIs(li, 'add', ci) ? ' sel' : '') +
        '" data-li="' + li + '" data-ci="' + ci + '" role="button" tabindex="-1">' + esc(edFmt(c.c)) + '</b></span>';
    }).join('');
  }
  function charCls(p) { return selIs(li, 'pos', p) ? ' sel' : ''; }
  for (i = 0; i < text.length; i++) {
    var ch = text[i], sp = /\s/.test(ch);
    if (!sp && !inWord) { out += '<span class="w">'; inWord = true; }
    if (sp && inWord) { out += '</span>'; inWord = false; }
    out += anchors(i) + '<span class="c' + (sp ? ' sp' : '') + charCls(i) + '" data-li="' + li + '" data-i="' + i + '">' + (sp ? ' ' : esc(ch)) + '</span>';
  }
  if (!inWord) out += '<span class="w">';
  out += anchors(text.length) + '<span class="c end' + charCls(text.length) + '" data-li="' + li + '" data-i="' + text.length + '" title="Final de la línea">·</span></span>';
  return '<p class="ln hc" data-li="' + li + '">' + out + '</p>';
}
function edInstrHTML(l, li) {
  var h = '';
  l.segs.forEach(function (s, k) {
    if (s.c !== null) h += '<button type="button" class="chip' + (C.isChordTok(s.c) ? '' : ' x') + (selIs(li, 'seg', k) ? ' sel' : '') + '" data-li="' + li + '" data-seg="' + k + '">' + esc(edFmt(s.c)) + '</button>';
    if (s.t && s.t.trim()) h += '<span class="itxt">' + esc(s.t.trim()) + '</span>';
  });
  h += '<button type="button" class="chip add' + (selIs(li, 'append') ? ' sel' : '') + '" data-li="' + li + '" data-append="1" aria-label="Agregar un acorde a esta línea">+</button>';
  return '<div class="ed-instr" data-li="' + li + '"><span class="ed-instr-l">Acordes</span>' + h + '</div>';
}
function renderChordEditor() {
  var st = editorState, box = $('ed-song'); if (!box) return;
  if (!st.model.length) {
    box.innerHTML = '<div class="empty"><p>Todavía no hay letra.</p><p><button type="button" class="btn primary" data-edgo="letra">Escribir la letra</button></p>' +
      '<p><button type="button" class="btn" data-edgo="addinstr">Agregar una línea solo de acordes</button></p></div>';
  } else {
    box.innerHTML = st.model.map(function (l, li) {
      if (l.type === 'blank') return '<div class="gap" data-li="' + li + '"></div>';
      if (l.type === 'label') return '<h3 class="lbl" data-li="' + li + '">' + esc(C.sentenceCase(l.text)) + '</h3>';
      if (l.type === 'note') return '<p class="note" data-li="' + li + '">' + esc(C.sentenceCase(l.text)) + '</p>';
      if (l.type === 'instr') return edInstrHTML(l, li);
      return edLyricHTML(l, li);
    }).join('');
  }
  fixCollisions(box);
  renderPanel();
}
function updateSelectionUI() {
  var box = $('ed-song'), st = editorState, s = st.sel;
  Array.prototype.forEach.call(box.querySelectorAll('.sel'), function (el) { el.classList.remove('sel'); });
  if (s) {
    var el = null;
    if (s.kind === 'pos') el = box.querySelector('.c[data-li="' + s.li + '"][data-i="' + s.i + '"]');
    else if (s.kind === 'chord' || s.kind === 'add') el = box.querySelector('.ch[data-li="' + s.li + '"][data-ci="' + s.ci + '"]');
    else if (s.kind === 'seg') el = box.querySelector('.chip[data-li="' + s.li + '"][data-seg="' + s.k + '"]');
    else if (s.kind === 'append') el = box.querySelector('.chip[data-li="' + s.li + '"][data-append]');
    if (el) el.classList.add('sel');
  }
  renderPanel();
}
/* ---------- sílabas y varios acordes en un mismo lugar ---------- */
var sylCache = {};
function sylStarts(text) { return sylCache[text] || (sylCache[text] = C.syllableStarts(text)); }
function isLetter(ch) { return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(ch || ''); }
function bySyl() { return prefs.edUnit !== 'letter'; }
/* Inicio de la sílaba que contiene la letra i; si i no es una letra (espacio, signo, final), se queda ahí. */
function snapSyl(text, i) {
  if (i >= text.length || !isLetter(text[i])) return i;
  var st = sylStarts(text), best = i;
  for (var k = 0; k < st.length; k++) { if (st[k] <= i) best = st[k]; else break; }
  return best;
}
/* Sílaba anterior o siguiente dentro de la línea (el final de la línea cuenta como una posición más). */
function stepSyl(text, i, d) {
  var pts = sylStarts(text).concat([text.length]), k;
  if (d > 0) { for (k = 0; k < pts.length; k++) if (pts[k] > i) return pts[k]; return text.length; }
  for (k = pts.length - 1; k >= 0; k--) if (pts[k] < i) return pts[k];
  return 0;
}
function chordsAt(l, i) { var out = []; l.chords.forEach(function (c, k) { if (c.i === i) out.push(k); }); return out; }
function syllableAround(text, at, wr) {
  var starts = sylStarts(text).filter(function (x) { return x >= wr[0] && x < wr[1]; });
  if (!starts.length || starts[0] !== wr[0]) starts.unshift(wr[0]);
  var cur = -1; starts.forEach(function (x, k) { if (x <= at) cur = k; });
  return { starts: starts, cur: at < wr[1] ? cur : -1 };
}

function onSongTap(e) {
  var t = e.target, st = editorState, g = t.closest('[data-edgo]');
  if (g) { if (g.getAttribute('data-edgo') === 'letra') setMode('letra'); else addInstrLine(); return; }
  var ch = t.closest('.ch[data-ci]');
  if (ch) { st.sel = { li: +ch.getAttribute('data-li'), kind: 'chord', ci: +ch.getAttribute('data-ci') }; updateSelectionUI(); return; }
  var chip = t.closest('.chip[data-seg]');
  if (chip) { st.sel = { li: +chip.getAttribute('data-li'), kind: 'seg', k: +chip.getAttribute('data-seg') }; updateSelectionUI(); return; }
  var add = t.closest('.chip[data-append]');
  if (add) { st.sel = { li: +add.getAttribute('data-li'), kind: 'append' }; updateSelectionUI(); return; }
  var c = t.closest('.c[data-i]');
  if (!c) return;
  var li = +c.getAttribute('data-li'), i = +c.getAttribute('data-i'), l = st.model[li];
  // acordes justo en esa letra; si no hay y se trabaja por sílabas, se busca en el inicio de su sílaba
  var here = chordsAt(l, i);
  if (!here.length && bySyl()) { i = snapSyl(l.text, i); here = chordsAt(l, i); }
  if (here.length) {
    // tocar otra vez el mismo lugar pasa al siguiente acorde que está ahí
    var s = st.sel, pick = here[0];
    if (s && (s.kind === 'chord' || s.kind === 'add') && s.li === li) { var at = here.indexOf(s.ci); if (at >= 0) pick = here[(at + 1) % here.length]; }
    st.sel = { li: li, kind: 'chord', ci: pick };
  } else st.sel = { li: li, kind: 'pos', i: i };
  updateSelectionUI();
}

/* ---------- panel de acordes ---------- */
function edKey() {
  var k = keyFromStr(val('f-key')); if (k) return k;
  var ch = [];
  editorState.model.forEach(function (l) {
    (l.chords || []).forEach(function (c) { var p = C.parseChord(C.splitTok(c.c).core); if (p) ch.push(p); });
    (l.segs || []).forEach(function (s) { if (s.c !== null) { var p = C.parseChord(C.splitTok(s.c).core); if (p) ch.push(p); } });
  });
  return ch.length ? C.detectKey(ch) : { pc: 0, minor: false };
}
function edSpell(key) { return prefs.spell === 'sharp' || prefs.spell === 'flat' ? prefs.spell : C.spellForKey(key.pc, key.minor); }
function usedChords(exclude) {
  var seen = {}, out = [];
  editorState.model.forEach(function (l) {
    (l.chords || []).forEach(function (c) { var x = C.splitTok(c.c).core; if (C.isChordCore(x) && !seen[x]) { seen[x] = 1; out.push(x); } });
    (l.segs || []).forEach(function (s) { if (s.c !== null) { var x = C.splitTok(s.c).core; if (C.isChordCore(x) && !seen[x]) { seen[x] = 1; out.push(x); } } });
  });
  return out.filter(function (x) { return exclude.indexOf(x) < 0; });
}
function wordRange(text, i) {
  var a = Math.min(i, text.length), b;
  if (a === text.length || /\s/.test(text[a])) { var q = a - 1; while (q >= 0 && /\s/.test(text[q])) q--; if (q >= 0) a = q; else return [0, 0]; }
  while (a > 0 && !/\s/.test(text[a - 1])) a--;
  b = a; while (b < text.length && !/\s/.test(text[b])) b++;
  return [a, b];
}
function renderPanel() {
  var st = editorState, p = $('edpanel'); if (!p || st.mode !== 'acordes') return;
  var s = st.sel, key = edKey(), spell = edSpell(key), diat = C.diatonic(key, spell), used = usedChords(diat).slice(0, 12);
  var strip = '', hint, btns = '';
  var unitBtn = '<button type="button" class="ctxb" data-ep="unit" aria-label="Cambiar entre mover por sílabas o por letras">' + (bySyl() ? 'Por sílabas' : 'Por letras') + '</button>';
  if (s && (s.kind === 'pos' || s.kind === 'chord' || s.kind === 'add')) {
    var l = st.model[s.li], at = s.kind === 'pos' ? s.i : l.chords[s.ci].i, wr = wordRange(l.text, at), word = l.text.slice(wr[0], wr[1]), piece;
    if (bySyl()) {
      var sy = syllableAround(l.text, at, wr);
      sy.starts.forEach(function (x, k) {
        var end = k + 1 < sy.starts.length ? sy.starts[k + 1] : wr[1];
        strip += '<button type="button" class="lt syl' + (k === sy.cur ? ' on' : '') + '" data-ep="at" data-i="' + x + '" aria-label="Poner en la sílaba ' + esc(l.text.slice(x, end)) + '">' + esc(l.text.slice(x, end)) + '</button>';
      });
      piece = sy.cur >= 0 ? l.text.slice(sy.starts[sy.cur], sy.cur + 1 < sy.starts.length ? sy.starts[sy.cur + 1] : wr[1]) : 'final';
    } else {
      for (var i = wr[0]; i < wr[1]; i++) strip += '<button type="button" class="lt' + (i === at ? ' on' : '') + '" data-ep="at" data-i="' + i + '" aria-label="Poner en la letra ' + esc(l.text[i]) + '">' + esc(l.text[i]) + '</button>';
      piece = at < l.text.length ? l.text[at] : 'final';
    }
    if (wr[1] === l.text.length || wr[1] === wr[0]) strip += '<button type="button" class="lt end' + (at === l.text.length ? ' on' : '') + '" data-ep="at" data-i="' + l.text.length + '" aria-label="Al final de la línea">fin</button>';
    if (s.kind === 'pos') hint = 'Elige el acorde para «' + piece + '» de «' + word + '».';
    else if (s.kind === 'chord') {
      var nHere = chordsAt(l, at).length;
      hint = 'Acorde ' + edFmt(l.chords[s.ci].c) + (nHere > 1 ? ' (hay ' + nHere + ' aquí: toca otra vez para pasar al siguiente)' : '') + '. Elige otro para cambiarlo, muévelo con ‹ › o quítalo.';
      btns = '<button type="button" class="ctxb" data-ep="addhere">+ Otro aquí</button><button type="button" class="ctxb" data-ep="alt" aria-label="Poner o quitar paréntesis de alternativo">( )</button>';
    } else hint = 'Elige el acorde que va después de ' + edFmt(l.chords[s.ci].c) + ', en el mismo lugar.';
  } else if (s && s.kind === 'seg') {
    hint = 'Acorde ' + edFmt(st.model[s.li].segs[s.k].c) + ' de la línea de acordes: elige otro, muévelo con ‹ › o quítalo.';
    btns = '<button type="button" class="ctxb" data-ep="alt" aria-label="Poner o quitar paréntesis de alternativo">( )</button>';
  } else if (s && s.kind === 'append') hint = 'Elige los acordes en orden: se van agregando a la línea.';
  else hint = 'Toca una sílaba de la letra para poner ahí un acorde.';
  var chip = function (c) { return '<button type="button" class="chip" data-chord="' + esc(c) + '">' + esc(edFmt(c)) + '</button>'; };
  p.innerHTML =
    '<div class="ep-bar">' +
      '<button type="button" class="epb" data-ep="prev" aria-label="' + (bySyl() ? 'Sílaba anterior' : 'Letra anterior') + '">‹</button>' +
      '<div class="ep-strip">' + (strip || '<span class="ep-hint1">' + esc(hint) + '</span>') + '</div>' +
      '<button type="button" class="epb" data-ep="next" aria-label="' + (bySyl() ? 'Sílaba siguiente' : 'Letra siguiente') + '">›</button></div>' +
    (strip ? '<div class="ep-ctx"><p class="ep-hint">' + esc(hint) + '</p><div class="ep-cb">' + unitBtn + btns + '</div></div>'
           : (btns ? '<div class="ep-ctx"><p class="ep-hint"></p><div class="ep-cb">' + btns + '</div></div>' : '')) +
    '<div class="ep-row"><button type="button" class="chip keychip" data-ep="key" aria-label="Cambiar el tono de la paleta">Tono ' + esc(C.keyName(key, spell, prefs.notation)) + ' ▾</button>' + diat.map(chip).join('') + '</div>' +
    '<div class="ep-foot"><div class="ep-row">' + used.map(chip).join('') + '<button type="button" class="chip other" data-ep="other">Otro…</button></div>' +
      '<div class="ep-acts">' +
      '<button type="button" class="epb" data-ep="del" aria-label="Quitar el acorde">' + icon('trash') + '</button>' +
      '<button type="button" class="epb" data-ep="undo" aria-label="Deshacer"' + (st.undo.length ? '' : ' disabled') + '>↶</button>' +
      '<button type="button" class="epb" data-ep="more" aria-label="Más acciones">' + icon('more') + '</button></div></div>';
  var on = p.querySelector('.lt.on'), stp = p.querySelector('.ep-strip');
  if (on && stp) stp.scrollLeft = Math.max(0, on.offsetLeft - stp.offsetLeft - stp.clientWidth / 2 + on.offsetWidth / 2);
  var box = $('ed-song'); if (box) box.style.paddingBottom = (p.offsetHeight + 28) + 'px';
}
function onPanelTap(e) {
  var b = e.target.closest('button'); if (!b || b.disabled) return;
  var ch = b.getAttribute('data-chord');
  if (ch) { applyChord(ch); return; }
  var st = editorState;
  switch (b.getAttribute('data-ep')) {
    case 'prev': nudge(-1); break;
    case 'next': nudge(1); break;
    case 'del': deleteSel(); break;
    case 'undo': undoEd(); break;
    case 'more': openEdMore(); break;
    case 'key': openEdKey(); break;
    case 'other': openChordBuilder(); break;
    case 'at': moveTo(+b.getAttribute('data-i')); break;
    case 'unit': prefs.edUnit = bySyl() ? 'letter' : 'syl'; savePrefs(); renderPanel();
      toast(bySyl() ? 'Ahora se mueve por sílabas.' : 'Ahora se mueve por letras, para afinar.'); break;
    case 'addhere': if (st.sel && st.sel.kind === 'chord') { st.sel = { li: st.sel.li, kind: 'add', ci: st.sel.ci }; updateSelectionUI(); } break;
    case 'alt': toggleAlt(); break;
  }
}

/* ---------- acciones sobre acordes ---------- */
function reindexChord(l, obj) { l.chords = C.sortChords(l.chords); return l.chords.indexOf(obj); }
function applyChord(name) {
  var st = editorState, s = st.sel;
  if (!s) { toast('Primero toca la sílaba donde va el acorde.'); return; }
  var l = st.model[s.li]; pushUndo();
  if (s.kind === 'chord') l.chords[s.ci].c = name;
  else if (s.kind === 'add') {
    // va justo después del acorde elegido, en el mismo lugar
    l.chords.splice(s.ci + 1, 0, { i: l.chords[s.ci].i, c: name });
    st.sel = { li: s.li, kind: 'chord', ci: s.ci + 1 };
  } else if (s.kind === 'pos') {
    var obj = { i: s.i, c: name }; l.chords.push(obj);
    st.sel = { li: s.li, kind: 'chord', ci: reindexChord(l, obj) };
  } else if (s.kind === 'seg') l.segs[s.k].c = name;
  else if (s.kind === 'append') {
    var last = l.segs[l.segs.length - 1];
    if (l.segs.length === 1 && last.c === null && !last.t.trim()) l.segs = [{ c: name, t: ' ' }];
    else { if (last && last.t && !/\s$/.test(last.t)) last.t += ' '; if (last && !last.t) last.t = ' '; l.segs.push({ c: name, t: ' ' }); }
  }
  renderChordEditor();
}
/* Alternativos entre paréntesis: el acorde elegido y los que lo siguen en el mismo lugar, como «(A B7)». */
function wrapAlt(toks) {
  var first = C.splitTok(toks[0]), last = C.splitTok(toks[toks.length - 1]);
  var has = first.pre.indexOf('(') >= 0 && last.post.indexOf(')') >= 0;
  return toks.map(function (t, q) {
    var p = C.splitTok(t), pre = p.pre.replace(/\(/g, ''), post = p.post.replace(/\)/g, '');
    if (!has) { if (q === 0) pre = '(' + pre; if (q === toks.length - 1) post = post + ')'; }
    return pre + p.core + post;
  });
}
function toggleAlt() {
  var st = editorState, s = st.sel; if (!s) { toast('Toca primero un acorde.'); return; }
  var l = st.model[s.li];
  if (s.kind === 'seg') { pushUndo(); l.segs[s.k].c = wrapAlt([l.segs[s.k].c])[0]; renderChordEditor(); return; }
  if (s.kind !== 'chord') { toast('Toca primero un acorde.'); return; }
  var at = l.chords[s.ci].i, grp = chordsAt(l, at).filter(function (k) { return k >= s.ci; });
  pushUndo();
  var res = wrapAlt(grp.map(function (k) { return l.chords[k].c; }));
  grp.forEach(function (k, q) { l.chords[k].c = res[q]; });
  renderChordEditor();
}
function nudge(d) {
  var st = editorState, s = st.sel; if (!s) return;
  var l = st.model[s.li];
  if (s.kind === 'chord' || s.kind === 'add') {
    var c = l.chords[s.ci], ni = bySyl() ? stepSyl(l.text, c.i, d) : Math.max(0, Math.min(l.text.length, c.i + d));
    if (ni === c.i) return;
    pushUndo(); c.i = ni; st.sel = { li: s.li, kind: 'chord', ci: reindexChord(l, c) }; renderChordEditor();
  } else if (s.kind === 'pos') {
    s.i = bySyl() ? stepSyl(l.text, s.i, d) : Math.max(0, Math.min(l.text.length, s.i + d));
    var here = chordsAt(l, s.i); if (here.length) st.sel = { li: s.li, kind: 'chord', ci: here[0] };
    updateSelectionUI();
  } else if (s.kind === 'seg') {
    var idx = []; l.segs.forEach(function (x, k) { if (x.c !== null) idx.push(k); });
    var pos = idx.indexOf(s.k), to = idx[pos + d]; if (to === undefined) return;
    pushUndo(); var tmp = l.segs[s.k].c; l.segs[s.k].c = l.segs[to].c; l.segs[to].c = tmp; s.k = to; renderChordEditor();
  }
}
function moveTo(i) {
  var st = editorState, s = st.sel; if (!s) return;
  var l = st.model[s.li];
  if (s.kind === 'chord' || s.kind === 'add') { var c = l.chords[s.ci]; if (c.i === i) return; pushUndo(); c.i = i; st.sel = { li: s.li, kind: 'chord', ci: reindexChord(l, c) }; renderChordEditor(); }
  else { var here = chordsAt(l, i); st.sel = here.length ? { li: s.li, kind: 'chord', ci: here[0] } : { li: s.li, kind: 'pos', i: i }; updateSelectionUI(); }
}
function deleteSel() {
  var st = editorState, s = st.sel; if (!s) { toast('Toca primero el acorde que quieres quitar.'); return; }
  var l = st.model[s.li];
  if (s.kind === 'chord' || s.kind === 'add') { pushUndo(); var at = l.chords[s.ci].i; l.chords.splice(s.ci, 1); st.sel = { li: s.li, kind: 'pos', i: at }; renderChordEditor(); }
  else if (s.kind === 'pos') {
    var ex = -1; l.chords.forEach(function (x, k) { if (x.i === s.i) ex = k; });
    if (ex >= 0) { pushUndo(); l.chords.splice(ex, 1); renderChordEditor(); } else toast('Aquí no hay acorde.');
  } else if (s.kind === 'seg') {
    pushUndo(); var seg = l.segs[s.k];
    if (s.k > 0) { l.segs[s.k - 1].t += seg.t; l.segs.splice(s.k, 1); } else { seg.c = null; }
    st.sel = { li: s.li, kind: 'append' };
    if (!l.segs.some(function (x) { return x.c !== null || x.t.trim(); })) { st.model.splice(s.li, 1); st.sel = null; }
    renderChordEditor();
  }
}
function addInstrLine() {
  var st = editorState, at = st.sel ? st.sel.li + 1 : st.model.length;
  pushUndo(); st.model.splice(at, 0, { type: 'instr', segs: [{ c: null, t: '' }] });
  st.sel = { li: at, kind: 'append' }; renderChordEditor();
}
function stanzaOf(li) {
  var m = editorState.model, a = li, b = li, stop = function (l) { return l.type === 'blank' || l.type === 'label'; };
  if (stop(m[li])) return null;
  while (a > 0 && !stop(m[a - 1])) a--;
  while (b < m.length - 1 && !stop(m[b + 1])) b++;
  return [a, b];
}
function stanzaLyrics(r) { var out = []; for (var k = r[0]; k <= r[1]; k++) if (editorState.model[k].type === 'lyric') out.push(k); return out; }
function openEdMore() {
  var st = editorState, s = st.sel, r = s ? stanzaOf(s.li) : null, items = [];
  if (st.redo.length) items.push({ id: 'redo', icon: 'fwd', label: 'Rehacer', run: redoEd });
  if (r) {
    items.push({ id: 'copy', icon: 'copy', label: 'Copiar los acordes de esta estrofa', run: function () {
      st.clip = stanzaLyrics(r).map(function (k) { return clone(st.model[k]); });
      toast('Acordes copiados. Toca una línea de otra estrofa y elige «Pegar acordes».', 4500);
    } });
    if (st.clip) items.push({ id: 'paste', icon: 'add', label: 'Pegar acordes en esta estrofa', sub: 'por sílabas', run: function () {
      var dst = stanzaLyrics(r); pushUndo();
      dst.forEach(function (k, j) { if (st.clip[j]) st.model[k].chords = C.copyChordsBySyllable(st.clip[j], st.model[k].text); });
      renderChordEditor(); toast('Acordes pegados en ' + Math.min(dst.length, st.clip.length) + ' líneas. Revisa y ajusta si hace falta.', 4500);
    } });
    items.push({ id: 'clear', icon: 'trash', label: 'Quitar los acordes de esta estrofa', run: function () {
      pushUndo(); stanzaLyrics(r).forEach(function (k) { st.model[k].chords = []; }); st.sel = null; renderChordEditor();
    } });
  }
  if (s && (s.kind === 'chord' || s.kind === 'seg')) items.push({ id: 'alt', icon: 'edit', label: 'Alternativo, entre paréntesis', sub: 'poner o quitar', run: toggleAlt });
  items.push({ id: 'unit', icon: 'text', label: bySyl() ? 'Mover por letras' : 'Mover por sílabas', sub: bySyl() ? 'para afinar' : 'lo normal', run: function () { prefs.edUnit = bySyl() ? 'letter' : 'syl'; savePrefs(); renderPanel(); } });
  items.push({ id: 'instr', icon: 'add', label: 'Agregar una línea solo de acordes', sub: s ? 'debajo de la seleccionada' : 'al final', run: addInstrLine });
  if (s && st.model[s.li] && st.model[s.li].type === 'instr') items.push({ id: 'rminstr', icon: 'trash', label: 'Quitar esta línea de acordes', run: function () {
    pushUndo(); st.model.splice(s.li, 1); st.sel = null; renderChordEditor(); } });
  items.push({ id: 'help', icon: 'text', label: 'Cómo usar el editor', run: openEdHelp });
  menuSheet('Editor', items);
}
function openEdHelp() {
  openSheet('Cómo usar el editor', '<div class="help">' +
    '<p><b>Letra.</b> Escribe o pega la letra: un verso por línea, una línea vacía entre estrofas. Los botones ponen secciones como [Coro]. Si pegas una canción con los acordes en la línea de arriba, se convierten solos.</p>' +
    '<p><b>Acordes.</b> Toca la sílaba donde va el acorde y elígelo abajo. La fila grande muestra las sílabas de la palabra; con ‹ › el acorde salta de sílaba en sílaba. Si necesitas ponerlo en una letra exacta, toca «Por sílabas» para cambiar a «Por letras». Toca un acorde puesto para cambiarlo o quitarlo.</p>' +
    '<p><b>Varios acordes en un lugar.</b> Toca un acorde y luego «+ Otro aquí» para poner otro justo después, como «D (A)». Si ya hay varios, tocar otra vez el mismo lugar pasa de uno a otro. «( )» los marca como alternativos entre paréntesis, desde el acorde elegido hasta el último de ese lugar: «(A B7)».</p>' +
    '<p><b>Estrofas iguales.</b> Toca una línea de una estrofa, abre «Más acciones» (⋯) y copia sus acordes. Luego toca otra estrofa y pégalos: se ubican sílaba por sílaba.</p>' +
    '<p><b>Intro y final.</b> «Agregar una línea solo de acordes» crea una fila donde los acordes se agregan en orden.</p>' +
    '<p><b>Paleta.</b> Arriba están los acordes del tono de la canción; toca «Tono» para cambiarlo. Abajo, los que ya usaste y «Otro…» para armar cualquiera.</p></div>');
}
function openEdKey() {
  var cur = edKey(), btns = '';
  KEY_OPTS.forEach(function (k) {
    var p = keyFromStr(k), on = p.pc === cur.pc && p.minor === cur.minor;
    btns += '<button type="button" data-k="' + esc(k) + '" aria-pressed="' + on + '"><b>' + esc(C.keyName(p, C.spellForKey(p.pc, p.minor), prefs.notation)) + '</b><small>' + (p.minor ? 'menor' : 'mayor') + '</small></button>';
  });
  openSheet('Tono de la canción', '<p class="help">La paleta muestra los acordes de este tono. También queda como tono original de la canción.</p><div class="keys">' + btns + '</div>', function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var sel = $('f-key'), k = b.getAttribute('data-k');
      if (![].some.call(sel.options, function (o) { return o.value === k; })) { var o = document.createElement('option'); o.textContent = k; sel.appendChild(o); }
      sel.value = k; closeSheet(); renderPanel();
    });
  });
}
function openChordBuilder() {
  var st = editorState, key = edKey(), spell = edSpell(key), s = st.sel, init = null;
  if (s && s.kind === 'chord') init = st.model[s.li].chords[s.ci].c; else if (s && s.kind === 'seg') init = st.model[s.li].segs[s.k].c;
  var b = { root: key.pc, q: '', bass: null, alt: false };
  if (init) {
    var parts = C.splitTok(init), pc = C.parseChord(parts.core);
    if (pc) { b.root = pc.root; b.q = pc.qual; b.bass = pc.bass; b.alt = parts.pre === '(' && parts.post === ')'; }
  }
  function name(notation) {
    var n = C.noteName(b.root, spell, notation) + b.q + (b.bass !== null ? '/' + C.noteName(b.bass, spell, notation) : '');
    return b.alt ? '(' + n + ')' : n;
  }
  function draw(el) {
    var roots = '', quals = '', bass = '<button type="button" data-b="-1" aria-pressed="' + (b.bass === null) + '">—</button>';
    for (var pc = 0; pc < 12; pc++) {
      roots += '<button type="button" data-r="' + pc + '" aria-pressed="' + (b.root === pc) + '">' + esc(C.noteName(pc, spell, prefs.notation)) + '</button>';
      bass += '<button type="button" data-b="' + pc + '" aria-pressed="' + (b.bass === pc) + '">' + esc(C.noteName(pc, spell, prefs.notation)) + '</button>';
    }
    QUALS.forEach(function (q) { quals += '<button type="button" data-q="' + esc(q[0]) + '" aria-pressed="' + (b.q === q[0]) + '">' + esc(q[1]) + '</button>'; });
    el.querySelector('#cb-body').innerHTML =
      '<div class="chordbig" id="cb-prev">' + esc(name(prefs.notation)) + '</div>' +
      '<p class="cb-h">Nota</p><div class="cb-grid">' + roots + '</div>' +
      '<p class="cb-h">Tipo</p><div class="cb-grid">' + quals + '</div>' +
      '<p class="cb-h">Bajo (opcional)</p><div class="cb-grid">' + bass + '</div>' +
      '<label class="cb-alt"><input type="checkbox" id="cb-alt"' + (b.alt ? ' checked' : '') + '> Alternativo, entre paréntesis</label>';
  }
  openSheet('Armar un acorde', '<div id="cb-body"></div><div class="btnrow" style="margin-top:.8rem"><button type="button" class="btn primary" data-x="use">Usar este acorde</button><button type="button" class="btn" data-close="1">Cancelar</button></div>', function (el) {
    draw(el);
    el.addEventListener('click', function (e) {
      var t = e.target.closest('button');
      if (t && t.hasAttribute('data-r')) { b.root = +t.getAttribute('data-r'); draw(el); }
      else if (t && t.hasAttribute('data-q')) { b.q = t.getAttribute('data-q'); draw(el); }
      else if (t && t.hasAttribute('data-b')) { var v = +t.getAttribute('data-b'); b.bass = v < 0 ? null : v; draw(el); }
      else if (t && t.getAttribute('data-x') === 'use') {
        var n = name('en'); if (!C.isChordTok(n)) { toast('Ese acorde no se puede escribir así.'); return; }
        closeSheet(); if (!editorState.sel) toast('Primero toca la sílaba donde va el acorde.'); else applyChord(n);
      }
    });
    el.addEventListener('change', function (e) { if (e.target.id === 'cb-alt') { b.alt = e.target.checked; el.querySelector('#cb-prev').textContent = name(prefs.notation); } });
  });
}
document.addEventListener('keydown', function (e) {
  var st = editorState;
  if (!st || route.name !== 'edit' || st.mode !== 'acordes' || sheetRoot.firstChild) return;
  var tag = (e.target && e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redoEd(); else undoEd(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redoEd(); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(1); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); }
  else if (e.key === 'Escape') { st.sel = null; updateSelectionUI(); }
});

/* ---------- guardar ---------- */
function readEditor() {
  var st = editorState, s = clone(st.s), num = val('f-num').trim(), bpm = val('f-bpm').trim();
  s.title = val('f-title').trim(); s.author = val('f-author').trim(); s.group = val('f-group') === '__new' ? 'nuevas' : val('f-group');
  s.momento = val('f-momento').trim(); s.key = val('f-key'); s.style = val('f-style').trim();
  var model = st.model;
  if (st.mode === 'letra') model = C.reconcile(st.letraBase || st.model, C.parseLetra($('f-letra').value));
  else if (st.mode === 'texto') model = C.srcToModel($('f-src').value.replace(/\r/g, ''));
  s.src = C.modelToSrc(model);
  s.num = /^\d+$/.test(num) ? +num : (num || undefined);
  s.bpm = /^\d{2,3}$/.test(bpm) ? +bpm : undefined;
  return s;
}
function updatePreview() {
  if (!editorState) return;
  var src = $('f-src').value.replace(/\r/g, ''), s = { id: '__preview', src: src, key: val('f-key') };
  var inf = info(s), el = $('ed-prev'); if (!el) return;
  el.innerHTML = src.trim() ? bodyHTML(s, fmtFor(inf.key, 0)) : '<p class="empty">Aquí verás la canción mientras escribes.</p>';
  fixCollisions(el);
}
function saveEditor() {
  syncFromMode();
  var s = readEditor();
  if (!s.title) { toast('Escribe el título de la canción.'); $('f-title').focus(); return; }
  if (!s.src.trim()) { toast('La canción todavía no tiene letra.'); setMode('letra'); return; }
  s = cleanSong(s);
  if (kidSongSave(s)) return;
  var base = baseSong(s.id);
  if (base && JSON.stringify(cleanSong(base)) === JSON.stringify(s)) delete local.songs[s.id]; else local.songs[s.id] = s;
  delete local.deleted[s.id]; saveLocal(); delete infoCache[s.id];
  editorState = null; document.body.classList.remove('ed-chords');
  location.hash = '#/s/' + enc(s.id);
  toast(isGroup() ? 'Guardada. Publica los cambios para que todos la vean.' : 'Guardada.', 3500);
}
function cancelEditor() {
  var st = editorState;
  var go = function () { editorState = null; document.body.classList.remove('ed-chords'); location.hash = st && !st.isNew && getSong(st.s.id) ? '#/s/' + enc(st.s.id) : '#/'; };
  if (st && JSON.stringify(readEditor()) !== st.start) confirmSheet('Salir sin guardar', 'Se perderán los cambios que hiciste en esta canción.', 'Salir sin guardar', go, true);
  else go();
}
function deleteSong() {
  if (whoKid()) { toast('Solo quien dirige puede eliminar canciones.', 3500); return; }
  var s = editorState.s;
  confirmSheet('Eliminar canción', '¿Eliminar «' + esc(C.sentenceCase(s.title)) + '»?' + (baseSong(s.id) && isGroup() ? ' Se quita en este equipo, y para todos cuando publiques.' : ''), 'Eliminar', function () {
    if (baseSong(s.id)) local.deleted[s.id] = true;
    delete local.songs[s.id]; saveLocal(); editorState = null; document.body.classList.remove('ed-chords'); location.hash = '#/'; toast('Canción eliminada.');
  }, true);
}
function restoreSong() {
  var s = editorState.s;
  confirmSheet('Restaurar original', 'Se descartan tus cambios en esta canción y vuelve la versión publicada.', 'Restaurar', function () {
    delete local.songs[s.id]; saveLocal(); delete infoCache[s.id]; editorState = null; document.body.classList.remove('ed-chords'); location.hash = '#/s/' + enc(s.id);
  }, true);
}
function openPasteSheet() {
  openSheet('Pegar con acordes encima', '<p class="help">Pega la canción tal como la copiaste de internet, con cada línea de acordes encima de su línea de letra. Se convierte sin mover los acordes de su sílaba y se agrega al final de lo que ya tienes.</p>' +
    '<div class="field"><textarea id="paste-src" rows="12" spellcheck="false" autocapitalize="off" placeholder="        D           A&#10;Yo le alabo de corazón,"></textarea></div>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="conv">Convertir</button></div>', function (el) {
    el.querySelector('[data-x="conv"]').addEventListener('click', function () {
      var lines = C.parseLetra(el.querySelector('#paste-src').value);
      if (!lines.length) { toast('No hay texto para convertir.'); return; }
      var st = editorState; syncFromMode(); pushUndo();
      st.model = C.normalizeModel(st.model.concat(st.model.length ? [{ type: 'blank' }] : [], lines));
      closeSheet(true);
      refreshModeView();                       // la pestaña abierta muestra lo nuevo antes de cambiar
      if (st.mode !== 'acordes') setMode('acordes');
      toast('Convertida. Revisa los acordes y ajusta lo que haga falta.', 4000);
    });
  });
}

/* parte 6: modo en vivo — piano con las dos manos; avanza a mano, solo (por compases), con el video o escuchando */
var liveState = null;
function songRouteHash() {
  if (stuLive) return '#/a/' + enc(stuLive.sid);
  return ctx.setlist ? '#/r/' + enc(ctx.setlist.id) + '/' + ctx.index : (current.song ? '#/s/' + enc(current.song.id) : '#/');
}
function liveHash() { return stuLive && current.song ? '#/a/' + enc(stuLive.sid) + '/' + enc(current.song.id) : songRouteHash() + '/vivo'; }
/* Acordes en orden de lectura (letra y líneas de acordes). */
function liveSteps(song) {
  var inf = info(song), steps = [], firstN = [], n = 0;
  inf.lines.forEach(function (l, li) {
    firstN[li] = n;
    if (!l.segs) return;
    l.segs.forEach(function (g) { if (g.c !== null && C.isChordTok(g.c)) { steps.push({ li: li, n: n, c: g.c }); n++; } });
  });
  return { steps: steps, firstN: firstN };
}
function seqSig(steps) { return steps.map(function (s) { return s.c; }).join('|'); }
/* Recorrido por compases: { v: 2, bpm, beats, sig, steps: [[acorde, tiempos, segundo del video|null]], video: {id, start}|null }.
   Solo vale si la canción no cambió desde que se hizo. Los grabados antes en segundos se convierten aquí. */
function normTimeline(song, steps) {
  var tl = song.timeline, k;
  if (!tl || !Array.isArray(tl.steps) || !tl.steps.length || tl.sig !== seqSig(steps)) return null;
  if (tl.v === 2) {
    if (!(tl.bpm >= 30 && tl.bpm <= 260) || !(tl.beats >= 1 && tl.beats <= 12)) return null;
    for (k = 0; k < tl.steps.length; k++) {
      var s = tl.steps[k];
      if (!Array.isArray(s) || !(s[0] >= 0 && s[0] < steps.length) || !(s[1] > 0) || (s[2] != null && typeof s[2] !== 'number')) return null;
    }
    return tl;
  }
  if (tl.steps.length < 2) return null;
  for (k = 1; k < tl.steps.length; k++) if (!(tl.steps[k][1] >= tl.steps[k - 1][1])) return null;
  var end = tl.end || tl.steps[tl.steps.length - 1][1] + 2;
  var bpm = +song.bpm || info(song).bpm || C.tlEstimateBpm(tl.steps, end, 4) || 90;
  return { v: 2, bpm: bpm, beats: 4, sig: tl.sig, steps: C.tlQuantize(tl.steps, end, bpm),
           video: tl.video ? { id: tl.video, start: tl.start || 0 } : null, converted: true };
}
function voiceNames(v, en, spell) {
  var pc = C.parseChord(en), names = {};
  v.right.forEach(function (m) { names[m] = latin(C.noteName(m, spell, 'en')); });
  if (pc) v.right.forEach(function (m) { if (C.mod12(m) === pc.root) names[m] = latin(pc.rootName); });
  return { names: names, bass: pc ? latin(pc.bassName || pc.rootName) : latin(C.noteName(v.left, spell, 'en')) };
}
function enterFull() {
  try { var d = document.documentElement; if (!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen({ navigationUI: 'hide' }).catch(function () {}); } catch (e) { /* sin pantalla completa */ }
}
function exitFull() { try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) { /* nada */ } }
function lid(id) { return document.getElementById(id); }

function buildLive(song, pushed, mode) {
  var r = liveSteps(song); if (!r.steps.length) return null;
  var inf = info(song), sh = songShift(song), spell = spellFor(inf.key, sh), keep = C.mod12(sh) === 0 && prefs.spell === 'auto';
  var tl = normTimeline(song, r.steps);
  var path = tl ? tl.steps.map(function (x) { return x[0]; }) : r.steps.map(function (s, k) { return k; });
  var prev = null, vo = path.map(function (k) {
    var en = C.splitTok(C.transposeTok(r.steps[k].c, { shift: sh, spell: spell, notation: 'en', keep: keep })).core;
    var v = C.closeVoicing(en, prev) || C.pianoVoicing(en); prev = v;
    return { en: en, v: v };
  });
  var ez = easyOn() ? easyBuild(song, r.steps, path) : null;
  if (ez) vo = ez.vo;
  var rLo0 = 127; vo.forEach(function (x) { rLo0 = Math.min(rLo0, x.v.right.length ? x.v.right[0] : 127); });
  var base = rLo0 - 12;
  if (!ez) vo.forEach(function (x) { var bp = x.v.bass != null ? x.v.bass : C.mod12(x.v.left), nv = {}; Object.keys(x.v).forEach(function (q) { nv[q] = x.v[q]; }); nv.left = base + C.mod12(bp - base); x.v = nv; });
  var b = { rLo: 127, rHi: 0, lLo: 127, lHi: 0 };
  vo.forEach(function (x) {
    var RR = x.v.right.length ? x.v.right : [x.v.left];
    b.rLo = Math.min(b.rLo, RR[0]); b.rHi = Math.max(b.rHi, RR[RR.length - 1]);
    var LL = x.v.hideLeft ? RR[0] : x.v.left;
    b.lLo = Math.min(b.lLo, LL); b.lHi = Math.max(b.lHi, LL);
  });
  var part = ez ? ez.cfg.part : '', oneOct = part === 'agudos';
  if (part === 'agudos') { b.lLo = b.rLo = ez.win; b.lHi = b.rHi = ez.win + 11; }                 // agudos: una sola octava
  else if (part === 'bajo') {                                                                    // bajo: su octava (y lo que pida el ritmo)
    var hiB = ez.win + 11; vo.forEach(function (x) { x.v.right.concat(x.v.extra || []).forEach(function (m) { hiB = Math.max(hiB, m); }); });
    b.lLo = b.rLo = ez.win; b.lHi = b.rHi = hiB; oneOct = hiB <= ez.win + 11;
  }
  mode = mode || LS.get('cfp.liveMode', 'manual');
  if (stuLive) mode = stuLive.level >= 2 ? (tl ? 'auto' : 'manual') : (midi.inp || oidoActive() ? 'practice' : 'manual');
  if (sync.role === 'sigue') mode = 'sync';
  if (mode === 'sync' && sync.role !== 'sigue') mode = 'manual';
  if ((mode === 'auto' || mode === 'video') && !tl) mode = 'manual';
  if (mode === 'video' && !tl.video) mode = 'auto';
  var saved = viewState[song.id] && viewState[song.id].bpm;
  return { song: song, steps: r.steps, firstN: r.firstN, tl: tl, path: path,
    startB: tl ? C.tlStarts(tl.steps) : null, vtimes: tl && tl.video ? C.tlVideoTimes(tl.steps, tl.bpm) : null,
    bpm: tl ? (saved || tl.bpm) : null, bpb: tl ? tl.beats : 4, stale: !!song.timeline && !tl, easy: ez, minWhites: oneOct ? 7 : 14,
    level: stuLive ? stuLive.level : 0, stu: stuLive,
    vo: vo, i: 0, rLo: b.rLo, rHi: b.rHi, lLo: b.lLo, lHi: b.lHi, spell: spell,
    sound: !!LS.get('cfp.liveSound', false), click: !!LS.get('cfp.liveClick', false), pushed: !!pushed, mode: mode, imm: !!LS.get('cfp.liveImm', false),
    playing: false, counting: false, t0: 0, beat0: 0, nextClick: null, raf: 0 };
}
function openLive(pushed) {
  var song = current.song; if (!song) return;
  closeLive(true);
  var st = buildLive(song, pushed);
  if (!st) { toast('Esta canción no tiene acordes para tocar en vivo.'); location.replace(songRouteHash()); return; }
  liveState = st;
  var el = document.createElement('div');
  el.id = 'live'; el.className = 'live'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Modo en vivo');
  el.innerHTML = '<header class="lv-top" id="lv-top"></header><div class="lv-video" id="lv-video" hidden><div id="lv-yt"></div></div>' +
    '<div class="lv-main" id="lv-main"></div><nav class="lv-nav" id="lv-nav"></nav><span class="lv-vozb" id="lv-vozb" hidden></span>';
  document.body.appendChild(el); if (LS.get('cfp.navHide', false)) el.classList.add('navhide'); el.addEventListener('click', liveFullRetry, true); document.body.classList.add('live-open');
  el.addEventListener('click', onLiveTap);
  el.addEventListener('pointerdown', onGrip);
  el.addEventListener('input', function (e) { if (e.target.getAttribute('data-lvvol')) setVideoVolume(+e.target.value); });
  enterFull(); keepAwake(true);
  if (st.mode === 'video') showVideo(st.tl.video.id, st.tl.video.start).catch(videoFailed);
  drawLive();
  syncTick(true);
  if (st.mode === 'sync' && sync.pos) syncApplyPos(sync.pos);                 // la otra pantalla ya iba sonando
  vozResume();
}
function closeLive(silent) {
  oidoStop(); vozStop();
  var st = liveState, back = st ? songRouteHash() : '';
  if (st) { st.playing = false; st.counting = false; cancelAnimationFrame(st.raf); cancelAnimationFrame(st.rollRaf); }
  if (st && st.stu) { clearTimeout(stuHelpTimer); stuRun = null; }
  stopEar(); gridStop(); stopTempoListen(); sugStop(); sugState = null; recState = null; gridState = null; destroyPlayer();
  var el = lid('live'); if (el) el.remove();
  document.body.classList.remove('live-open');
  liveState = null;
  if (st) { if (stuLive && stuLive.t0) kidLog(stuLive.sid, (Date.now() - stuLive.t0) / 60000); stuLive = null; if (!prefs.fullAlways) exitFull(); syncTick(); }
  if (!silent && st) { if (st.pushed) history.back(); else location.replace(back); }
}
function nextLyricLine(lines, li) { for (var k = li + 1; k < lines.length; k++) if (lines[k].type === 'lyric' || lines[k].type === 'instr') return k; return -1; }
function sectionOf(lines, li) { for (var k = li; k >= 0; k--) if (lines[k].type === 'label') return C.sentenceCase(lines[k].text); return ''; }

/* Las dos manos: arriba la derecha y abajo la izquierda, como en una partitura; teclas del mismo tamaño. */
function handsHTML(x, mini) {
  var st = liveState, nm = x.easy ? { names: easyNames(x), bass: easyNames(x)[x.v.left] } : voiceNames(x.v, x.en, st.spell), ln = {};
  ln[x.v.left] = nm.bass;
  var R = pianoSVG(x.v, nm.names, { noBass: true, lo: st.rLo, hi: st.rHi, cls: 'kb-r', label: 'Mano derecha' });
  var L = pianoSVG({ right: [], left: x.v.left, fingers: [] }, ln, { lo: st.lLo, hi: st.lHi, minWhites: 7, cls: 'kb-l', label: 'Mano izquierda: ' + nm.bass });
  if (mini) return '<div class="lv-minikb">' + L + R + '</div>';
  return '<div class="lv-hands"><div class="lv-hand hand-r"><p class="lv-hl">Mano derecha</p>' + R + '</div>' +
    '<div class="lv-hand hand-l"><p class="lv-hl">Mano izquierda <b>' + esc(nm.bass) + '</b></p>' + L + '</div></div>';
}
/* Teclas del mismo tamaño en ambos teclados. Vertical: uno sobre otro. Horizontal: lado a lado, la izquierda a la izquierda. */
function sizeKeyboards() {
  var el = lid('lv-main'); if (!el) return;
  var r = el.querySelector('.lv-hands .kb-r'), l = el.querySelector('.lv-hands .kb-l');
  if (r && l) {
    var wr = r.viewBox.baseVal.width, wl = l.viewBox.baseVal.width, wide = Math.max(wr, wl);
    var side = window.matchMedia && matchMedia('(orientation: landscape) and (min-width: 640px)').matches;
    var hr = r.parentNode, hl = l.parentNode;
    if (side) { hr.style.flex = wr + ' 1 0'; hl.style.flex = wl + ' 1 0'; r.style.width = l.style.width = '100%'; }
    else { hr.style.flex = hl.style.flex = ''; r.style.width = (100 * wr / wide).toFixed(1) + '%'; l.style.width = (100 * wl / wide).toFixed(1) + '%'; }
  }
  Array.prototype.forEach.call(el.querySelectorAll('.lv-minikb'), function (m) {
    Array.prototype.forEach.call(m.querySelectorAll('svg'), function (s) { s.style.flex = s.viewBox.baseVal.width + ' 1 0'; });
  });
}
var MODE_NAMES = { manual: 'Manual', auto: 'Automático', video: 'Con el video', listen: 'Escuchando', practice: 'Práctica', sync: 'Siguiendo' };
var MODE_ICONS = { manual: 'hand', auto: 'play', video: 'video', listen: 'mic', practice: 'keys', sync: 'share' };
function stepBeats(i) { var st = liveState; return st.startB ? st.startB[i + 1] - st.startB[i] : 0; }
/* Pulsos del acorde actual: 1-2-3-4. Con más de 12 se muestra como texto. */
function beatsHTML() {
  var st = liveState; if (!st.tl || (st.mode !== 'auto' && st.mode !== 'video' && st.mode !== 'sync')) return '';
  var n = Math.ceil(stepBeats(st.i));
  if (n > 16) { var hb = ''; for (var q = 0; q < Math.ceil(n / st.bpb); q++) hb += '<i><b></b></i>'; return '<span class="lv-beats lv-bars" id="lv-beats" aria-hidden="true">' + hb + '</span>'; }
  var h = ''; for (var k = 0; k < n; k++) h += '<i' + (k && k % st.bpb === 0 ? ' class="bar"' : '') + '></i>';
  return '<span class="lv-beats" id="lv-beats" aria-hidden="true">' + h + '</span>';
}
function drawLive() {
  var st = liveState; if (!st || !lid('live')) return;
  if (sugState) { drawSug(); return; }
  if (gridState) { drawGrid(); return; }
  if (recState) { drawRec(); return; }
  lid('live').classList.remove('rec');
  var song = st.song, inf = info(song), sh = songShift(song), fmt = st.easy ? easyFmt : fmtFor(inf.key, sh);
  var step = st.steps[st.path[st.i]], cur = st.vo[st.i], j = st.i + 1 < st.path.length ? st.i + 1 : -1;
  var nstep = j >= 0 ? st.steps[st.path[j]] : null, nxt = j >= 0 ? st.vo[j] : null;
  var sec = sectionOf(inf.lines, step.li), nli = nextLyricLine(inf.lines, step.li);
  var line = function (li, cls) {
    var l = inf.lines[li]; if (!l || !l.segs) return '';
    var counter = { i: st.firstN[li] };
    return '<div class="lv-line ' + cls + '">' + (l.type === 'instr' ? instrHTML(l, fmt, counter) : lyricHTML(l, fmt, counter)) + '</div>';
  };
  var endHTML = '<span class="lv-end">Fin de la canción</span>';
  if (!nxt && ctx.setlist) {
    var ni = neighbor(1), ns = ni >= 0 ? getSong(ctx.setlist.items[ni].id) : null;
    if (ns) endHTML += '<a class="btn primary" href="#/r/' + enc(ctx.setlist.id) + '/' + ni + '/vivo">Siguiente canción: ' + esc(C.sentenceCase(ns.title)) + icon('fwd') + '</a>';
  }
  lid('lv-top').innerHTML = st.stu ? stuTopHTML() :
    '<button type="button" class="iconbtn" data-lv="close" aria-label="Salir del modo en vivo">' + icon('close') + '</button>' +
    '<h2>' + esc(C.sentenceCase(song.title)) + '</h2>' +
    (st.easy && st.easy.keyboard ? '<button type="button" class="lv-key lv-keytr" data-lv="easy" title="Tono de la banda y cuánto transponer el teclado">' + esc(keyLabel(inf.key, sh)) + ' <b>' + (st.easy.keyboard > 0 ? '+' : '−') + Math.abs(st.easy.keyboard) + '</b></button>'
      : '<span class="lv-key" title="Tono">' + esc(keyLabel(inf.key, sh)) + '</span>') +
    '<button type="button" class="lv-ez' + (st.easy ? ' on' : '') + '" data-lv="easy" aria-pressed="' + !!st.easy + '">Fácil</button>' +
    '<button type="button" class="lv-mode" data-lv="modes" aria-label="Cómo avanza: ' + MODE_NAMES[st.mode] + '. Cambiar">' + icon(MODE_ICONS[st.mode] || 'fwd') + '<span class="lv-mode-t">' + esc(MODE_NAMES[st.mode]) + '</span> ▾</button>' +
    liveTopExtras() +
    '<button type="button" class="iconbtn lv-vista" data-lv="vista" aria-label="Vista: cómo se ve la pantalla" title="Vista">' + icon('eye') + '</button>' +
    '<button type="button" class="iconbtn lv-immb" data-lv="imm" aria-label="Solo piano, pantalla completa" title="Solo piano">' + icon('full') + '</button>' +
    '<button type="button" class="iconbtn" data-lv="more" aria-label="Más opciones">' + icon('more') + '</button>';
  var view = st.imm ? 'roll' : liveViewGet(), rollView = view === 'roll', letraView = view === 'letra';
  var nowName = esc(C.splitTok(fmt(step.c)).core), nextName = nstep ? esc(C.splitTok(fmt(nstep.c)).core) : '';
  var posH = '<span class="lv-pos">' + (st.i + 1) + '/' + st.path.length + '</span>';
  var textH = letraView ? '' : '<div class="lv-text" data-lv="tapnow" style="--lyr:' + lyrScale() + '"><p class="lv-sec"><span class="lv-sec-t">' + esc(sec) + '</span>' + posH + '</p>' +
    '<div class="lv-lines song">' + line(step.li, 'cur') + (nli >= 0 ? line(nli, 'fade') : '') + '</div></div>';
  var classic = '<div class="lv-now" data-lv="tapnow" role="button" tabindex="0" aria-label="Ahora ' + nowName + '">' +
      '<div class="lv-head"><span class="lv-label">Ahora</span><span class="lv-chord">' + nowName + '</span>' + beatsHTML() + '</div>' +
      handsHTML(cur, false) + '</div>' +
    '<div class="lv-next">' + (nxt ? '<div class="lv-next-h"><span class="lv-label">Luego</span><b>' + nextName + '</b></div>' + handsHTML(nxt, true) : endHTML) + '</div>';
  var practiceH = (st.mode === 'practice' && !oidoActive()) || (st.stu && midi.inp) ? '<div class="lv-meter"><span id="lv-midi">' + midiStatus() + '</span><button type="button" class="linkbtn" data-lv="midi">Teclado</button><span class="lv-good" id="lv-good"></span></div>' : '';
  var meterH = liveMeterHTML();
  if (!practiceH && !lid('lv-good') && (oidoActive() || ear)) meterH += '<span class="lv-good lv-good-f" id="lv-good" aria-live="polite"></span>';   // «¡Bien!» aunque la franja esté oculta
  var keepCv = lid('lv-roll'); if (keepCv && keepCv.parentNode) keepCv.parentNode.removeChild(keepCv);   // se reutiliza: uno nuevo nace en blanco
  var keepLb = letraView ? lid('lv-letra') : null, lbKey = letraView ? song.id + '|' + sh + '|' + (st.easy ? 'ez' : '') + '|' + prefs.notation + '|' + lyrScale() : '';
  if (keepLb && (keepLb.getAttribute('data-k') !== lbKey || !keepLb.parentNode)) keepLb = null;
  if (keepLb) keepLb.parentNode.removeChild(keepLb);
  lid('lv-main').className = 'lv-main' + (rollView ? ' roll' : '') + (letraView ? ' letra' : '') + (st.easy ? ' ez-' + st.easy.cfg.level + ' part-' + st.easy.cfg.part : '') + (st.level ? ' lvl-' + st.level : '');
  st.kbRects = null;
  lid('live').classList.toggle('imm', !!st.imm);
  lid('live').classList.toggle('v-letra', letraView);
  lid('lv-main').innerHTML = (st.imm ? immHTML(nowName) : '') + textH + (letraView ? letraHeadHTML(nowName, nextName, endHTML, posH) + (keepLb ? '<div id="lv-letra-ph"></div>' : letraHTML(st, inf, fmt, lbKey)) : rollView ? rollHTML(cur, nowName, nextName, endHTML) : classic) + meterH + practiceH +
    (st.counting ? '<div class="lv-count" id="lv-count"></div>' : '');
  if (keepCv) { var ph = lid('lv-roll'); if (ph) ph.parentNode.replaceChild(keepCv, ph); }
  if (keepLb) { var ph2 = lid('lv-letra-ph'); if (ph2) ph2.parentNode.replaceChild(keepLb, ph2); }
  lid('lv-nav').innerHTML = navHTML(); liveMiniDraw();
  var chEl = lid('lv-main').querySelector('.lv-line.cur [data-i="' + step.n + '"]');
  if (chEl) chEl.classList.add('now');
  if (letraView) letraMark(step, !!keepLb);
  sizeKeyboards();
  fixCollisions(lid('lv-main').querySelector('.lv-lines'));
  if (rollView) { RC = null; fitKb(); cancelAnimationFrame(st.rollRaf); st.rollRaf = 0; rollTick(); }   // se dibuja ya, sin esperar al cuadro siguiente
  if (midi.inp) midiKeys();
}
function navHTML() { setTimeout(liveMiniDraw, 0); return navHTMLBase() + '<button type="button" class="iconbtn lv-navtog" data-lv="navtog" aria-label="Guardar los botones" title="Guardar los botones">' + icon('down') + '</button>'; }
function navHTMLBase() {
  var st = liveState, last = st.path.length - 1, manual = st.mode === 'manual';
  if (st.stu) return stuNavHTML();
  if (st.mode === 'sync') return '<div class="lv-row lv-row3"><button type="button" class="btn" data-lv="prev"' + (st.i ? '' : ' disabled') + ' aria-label="Acorde anterior">' + icon('back') + '</button>' +
    '<button type="button" class="btn" data-lv="sync">' + icon('share') + esc(syncStatusText()) + '</button><button type="button" class="btn" data-lv="next"' + (st.i < last ? '' : ' disabled') + ' aria-label="Acorde siguiente">' + icon('fwd') + '</button></div>';
  manual = manual || st.mode === 'practice';
  var prev = '<button type="button" class="btn" data-lv="prev"' + (st.i ? '' : ' disabled') + ' aria-label="Acorde anterior">' + icon('back') + (manual ? 'Anterior' : '') + '</button>';
  var next = '<button type="button" class="btn' + (manual ? ' primary' : '') + '" data-lv="next"' + (st.i < last ? '' : ' disabled') + ' aria-label="Acorde siguiente">' + (manual ? 'Siguiente' : '') + icon('fwd') + '</button>';
  if (manual) return '<div class="lv-row' + (st.mode === 'manual' ? ' lv-row-m' : '') + '">' + prev + next + (st.mode === 'manual' ? '<button type="button" class="btn lv-micq" data-lv="micdir" aria-label="Escuchar a la banda con el micrófono" title="Escuchar a la banda">' + icon('mic') + '</button>' : '') + '</div>';
  var label;
  if (st.mode === 'listen') label = ear ? icon('pause') + 'Dejar de escuchar' : icon('mic') + 'Escuchar';
  else label = st.playing || st.counting ? icon('pause') + 'Pausa' : icon('play') + (st.i ? 'Seguir' : 'Empezar');
  var h = '<div class="lv-row lv-row3">' + prev + '<button type="button" class="btn primary" data-lv="play">' + label + '</button>' + next + '</div>';
  if (st.mode === 'video') h += '<label class="lv-vol"><span>Volumen del video</span><input type="range" min="0" max="100" step="5" value="' + (+LS.get('cfp.videoVol', 60)) + '" data-lvvol="1" aria-label="Volumen del video"></label>';
  if (st.mode === 'auto') h += '<div class="lv-tempo"><button type="button" class="btn" data-lv="slower" aria-label="Más lento">−</button>' +
    '<output>' + Math.round(st.bpm) + '</output><span>bpm</span><button type="button" class="btn" data-lv="faster" aria-label="Más rápido">+</button>' +
    '<button type="button" class="btn lv-clk' + (st.click ? ' on' : '') + '" data-lv="click" aria-pressed="' + st.click + '">' + icon('metro') + 'Clic</button></div>';
  return h;
}
function soundNow() {
  if (oidoActive()) return;
  var st = liveState; if (!st || !st.sound || st.mode === 'listen') return;
  var v = st.vo[st.i].v; playNotes([v.left].concat(v.right));
}
function setLiveIndex(i, fromTimer) {
  var st = liveState; if (!st) return;
  i = Math.max(0, Math.min(st.path.length - 1, i));
  if (i === st.i) return;
  var prev = st.i;
  st.i = i; st.chordT = performance.now(); st.helpNow = false;
  if (ear) ear.since = performance.now();
  if (st.stu) stuStep(prev);
  drawLive(); soundNow();
  syncTick();
  if (!fromTimer) announce('Ahora ' + C.splitTok(fmtFor(info(st.song).key, songShift(st.song))(st.steps[st.path[i]].c)).core);
}

/* ---------- avanzar solo, por compases ---------- */
function beatNow() { var st = liveState; if (st.mode === 'listen' && st.earHold) return st.beat0; return st.beat0 + (performance.now() - st.t0) / 60000 * st.bpm; }
function indexAtBeat(b) {
  var s = liveState.startB, lo = 0, hi = s.length - 2;
  if (b < s[0]) return 0;
  while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (s[mid] <= b) lo = mid; else hi = mid - 1; }
  return lo;
}
function indexAtVideo(t) {
  var v = liveState.vtimes, lo = 0, hi = v.length - 1;
  if (t < v[0]) return 0;
  while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (v[mid] <= t) lo = mid; else hi = mid - 1; }
  return lo;
}
function clickAt(when, accent) {
  if (oidoActive()) { noiseClick(when, accent); return; }
  var ac = AC; if (!ac) return;
  var o = ac.createOscillator(), g = ac.createGain();
  o.frequency.value = accent ? 1650 : 1100;
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, when + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g); g.connect(audioOut() || ac.destination); o.start(when); o.stop(when + 0.06);
}
/* Clic con el reloj de audio: cada pulso se programa un poco antes, así suena exacto aunque la pantalla se atrase. */
function scheduleClicks() {
  var st = liveState, ac = AC; if (!st.click || !ac) return;
  var nowP = performance.now(), nowA = ac.currentTime, b = beatNow();
  if (st.nextClick === null || st.nextClick < Math.ceil(b - 1e-6)) st.nextClick = Math.ceil(b - 1e-6);
  for (var guard = 0; guard < 8; guard++) {
    var at = st.t0 + (st.nextClick - st.beat0) * 60000 / st.bpm;
    if (at - nowP > 150) break;
    if (at >= nowP - 8) clickAt(nowA + Math.max(0, at - nowP) / 1000, st.nextClick % st.bpb === 0);
    st.nextClick++;
  }
}
function updateBeats(inStep) {
  var box = lid('lv-beats'); if (!box) return;
  if (box.classList.contains('lv-bars')) {
    var bpb = liveState.bpb, kk = Math.floor(inStep + 1e-6), bar = Math.floor(kk / bpb);
    Array.prototype.forEach.call(box.children, function (d, q) { d.classList.toggle('done', q < bar); d.classList.toggle('on', q === bar); d.firstChild.style.width = q < bar ? '100%' : q === bar ? Math.round(100 * (kk % bpb + 1) / bpb) + '%' : '0'; });
    return;
  }
  var k = Math.floor(inStep);
  Array.prototype.forEach.call(box.children, function (d, q) { d.classList.toggle('done', q < k); d.classList.toggle('on', q === k); });
}
function loop() {
  var st = liveState; if (!st || !st.playing) return;
  var k, inStep;
  if (st.mode === 'video') {
    var t = yt.player && yt.player.getCurrentTime ? yt.player.getCurrentTime() - st.tl.video.start : 0;
    k = indexAtVideo(t);
    var a = st.vtimes[k], z = k + 1 < st.vtimes.length ? st.vtimes[k + 1] : a + stepBeats(k) * 60 / st.tl.bpm;
    inStep = Math.max(0, Math.min(0.999, (t - a) / Math.max(0.05, z - a))) * stepBeats(k);
  } else if (st.mode === 'sync') {
    k = st.i; inStep = Math.max(0, Math.min(beatNow(), st.startB[k + 1] - 0.05) - st.startB[k]);
  } else {
    var b = beatNow();
    if (b >= st.startB[st.startB.length - 1]) { pauseLive(); if (st.stu && st.mode === 'auto') stuSongEnd(); return; }
    k = indexAtBeat(b); inStep = b - st.startB[k];
    scheduleClicks();
  }
  if (k !== st.i) setLiveIndex(k, true);
  updateBeats(inStep);
  st.raf = requestAnimationFrame(loop);
}
/* Cuenta de entrada: un compás completo al tempo de la canción. */
function countIn(done) {
  var st = liveState, n = 0, ac = audio(), spb = 60000 / st.bpm;
  st.counting = true; drawLive();
  var tick = function () {
    if (!liveState || !liveState.counting) return;
    if (n === st.bpb) { st.counting = false; done(); return; }
    var box = lid('lv-count'); if (box) box.textContent = n + 1;
    if ((st.click || st.sound) && ac) clickAt(ac.currentTime + 0.01, n === 0);
    n++; setTimeout(tick, spb);
  };
  tick();
}
function playLive() {
  var st = liveState; if (!st || !st.tl) return;
  if (st.mode === 'video') {
    showVideo(st.tl.video.id, st.tl.video.start).then(function (p) {
      if (!liveState) return;
      p.seekTo(st.tl.video.start + (st.i ? st.vtimes[st.i] : Math.max(0, st.vtimes[0] - 2)), true); p.playVideo(); if (liveState && liveState.vrate && p.setPlaybackRate) { try { p.setPlaybackRate(liveState.vrate); } catch (er) { /* nada */ } }
      st.playing = true; drawLive(); loop();
    }).catch(videoFailed);
    return;
  }
  audio();
  countIn(function () {
    st.beat0 = st.startB[st.i]; st.t0 = performance.now(); st.nextClick = null; st.chordT = st.t0;
    st.playing = true;
    if (st.stu) { stuRunStart(); stuOnIndex(); }
    drawLive(); loop(); syncTick();
  });
}
function pauseLive() {
  var st = liveState; if (!st) return;
  st.playing = false; st.counting = false; cancelAnimationFrame(st.raf);
  if (st.mode === 'video' && yt.player) { try { yt.player.pauseVideo(); } catch (e) { /* nada */ } }
  drawLive(); syncTick();
}
/* Volver a sincronizar: el acorde elegido es el que suena ahora, desde su primer tiempo. */
function jumpTo(i) {
  var st = liveState; if (!st) return;
  i = Math.max(0, Math.min(st.path.length - 1, i));
  if (st.tl && st.playing) {
    if (st.mode === 'video' && yt.player) { try { yt.player.seekTo(st.tl.video.start + st.vtimes[i], true); } catch (e) { /* nada */ } }
    else { st.beat0 = st.startB[i]; st.t0 = performance.now(); st.nextClick = null; }
  }
  if (st.mode === 'listen') { if (st.startB) { st.beat0 = st.startB[i]; st.t0 = performance.now(); } earJump(i); }
  setLiveIndex(i);
}
function setBpm(v) {
  var st = liveState; v = Math.max(30, Math.min(240, Math.round(v)));
  if (st.playing && st.mode === 'auto') { st.beat0 = beatNow(); st.t0 = performance.now(); st.nextClick = null; }
  st.bpm = v;
  if (!st.stu) setView(st.song, { bpm: v === st.tl.bpm ? null : v });
  lid('lv-nav').innerHTML = navHTML(); syncTick();
}
function setLiveMode(m, viaMic) {
  var st = liveState; if (!st) return;
  pauseLive(); if (m !== 'listen') stopEar();
  if (m === 'listen' && oidoActive()) oidoStop();          // el micrófono lo usa uno solo: «Escuchando» o «Que me escuche»
  st.mode = m; LS.set('cfp.liveMode', m);
  if (m === 'practice' && !viaMic) midiConnect().then(midiStatusDraw).catch(function () { toast('No se pudo usar el teclado MIDI. Usa Chrome en la laptop o Android y conecta el teclado.', 6000); });
  if (m === 'video') showVideo(st.tl.video.id, st.tl.video.start).catch(videoFailed); else hideVideo();
  drawLive();
}
function saveGroupTempo() {
  var st = liveState, song = clone(st.song), tl = clone(st.tl);
  delete tl.converted; tl.bpm = st.bpm; song.timeline = tl;
  local.songs[song.id] = cleanSong(song); saveLocal(); delete infoCache[song.id];
  setView(song, { bpm: null });
  current.song = getSong(song.id);
  var i = st.i, mode = st.mode, pushed = st.pushed;
  liveState = buildLive(current.song, pushed, mode); liveState.i = i;
  drawLive();
  toast('Tempo del grupo: ' + Math.round(tl.bpm) + ' bpm.' + (isGroup() ? ' Publica los cambios para que todos lo tengan.' : ''), 4000);
}
function openLiveModes() {
  var st = liveState, has = !!st.tl, hasV = has && !!st.tl.video;
  var why = st.stale ? 'la canción cambió: vuelve a hacerlo' : 'primero haz el recorrido';
  menuSheet('Cómo avanza', [
    { id: 'manual', icon: 'fwd', label: 'Manual', sub: 'tocando la pantalla o con un pedal', run: function () { setLiveMode('manual'); } },
    { id: 'auto', icon: 'play', label: 'Automático', sub: has ? 'por compases, a ' + Math.round(st.bpm) + ' bpm' : why, disabled: !has, run: function () { setLiveMode('auto'); } },
    { id: 'video', icon: 'video', label: 'Con el video', sub: hasV ? 'para practicar' : (has ? 'el recorrido no tiene video' : why), disabled: !hasV, run: function () { setLiveMode('video'); } },
    { id: 'listen', icon: 'mic', label: 'Escuchando', sub: 'oye a la banda; si no coincide, espera', run: function () { setLiveMode('listen'); } },
    { id: 'pmic', icon: 'mic', label: 'Práctica con el micrófono', sub: 'te escucha y avanza cuando aciertas (sin cable)', run: function () { setLiveMode('practice', true); if (!oidoActive()) oidoToggleLive(); } },
    { id: 'practice', icon: 'keys', label: 'Práctica con el teclado (MIDI)', sub: midiSupported() ? 'espera a que toque el acorde correcto' : 'necesita Chrome en laptop o Android', disabled: !midiSupported(), run: function () { setLiveMode('practice'); } },
    { id: 'rec', icon: 'rec', label: has ? 'Volver a grabar el recorrido' : 'Grabar el recorrido', sub: 'tocando al ritmo del video o de la banda', run: openRecorder },
    { id: 'grid', icon: 'list', label: has ? 'Revisar los compases' : 'Hacer el recorrido sin grabar', sub: has ? 'cuánto dura cada acorde' : 'un compás por acorde, y ajustas', run: function () { openGrid(has ? st.tl : newTimeline(), has && st.tl.converted ? 'Este recorrido se grabó en segundos y se pasó a compases. Revísalo y guárdalo.' : ''); } }
  ], '<p class="help">El recorrido guarda cuántos tiempos dura cada acorde y el tempo de la canción. Automático avanza por compases y puedes cambiar el tempo sin que se desordene. ' +
    'Escuchando usa el micrófono y avanza cuando oye el acorde siguiente; si oye otra cosa o hay silencio, espera. En cualquier modo, tocar un acorde de la letra lo pone como el actual.</p>');
}
function openLiveMore() {
  var st = liveState, items = [
    { id: 'snd', icon: 'speaker', label: st.sound ? 'Sin sonido al avanzar' : 'Sonido al avanzar', sub: 'para practicar', run: function () { st.sound = !st.sound; LS.set('cfp.liveSound', st.sound); drawLive(); soundNow(); } },
    { id: 'full', icon: 'full', label: document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa', run: function () { if (document.fullscreenElement) exitFull(); else enterFull(); } },
    { id: 'view', icon: 'eye', label: 'Vista y tamaño de la letra', sub: 'piano que baja, dos teclados o letra grande', run: openVistaSheet }
  ];
  items.unshift({ id: 'kbs', icon: 'keys', label: 'Teclado: volver al tamaño automático', sub: 'arrastra la barrita sobre el teclado para cambiar su alto', run: function () { resetKb(); } });
  items.unshift({ id: 'vol', icon: 'speaker', label: 'Volumen', sub: 'video y sonidos de la app', run: openVolumeSheet });
  items.unshift({ id: 'imm', icon: 'full', label: st.imm ? 'Salir de «solo piano»' : 'Solo piano (pantalla completa)', sub: 'solo las teclas y lo que viene', run: function () { setImm(!st.imm); } });
  items.unshift({ id: 'easy', icon: 'keys', label: st.stu ? 'Ajustes de ' + liveProfile().name : (st.easy ? 'Modo fácil: activado' : 'Modo fácil (para aprender)'), sub: st.stu ? 'parte, ritmo y tono de práctica' : 'partes, ritmos y tono de práctica', run: openEasySheet });
  if (st.stu && !midi.inp) items.push({ id: 'midi', icon: 'keys', label: 'Conectar el teclado', sub: 'para que la app escuche lo que tocas', run: openMidiInputs });
  if ((st.mode === 'practice' || midi.inp) && !items.some(function (x) { return x.id === 'midi'; })) items.push({ id: 'midi', icon: 'keys', label: 'Teclado MIDI', sub: midi.inp ? midi.inp.name : 'elegir teclado', run: openMidiInputs });
  if (st.mode === 'listen') {
    items.push({ id: 'inp', icon: 'mic', label: 'Entrada de audio', sub: 'micrófono o interfaz con la guitarra', run: openEarInputs });
  }
  if (st.tl) items.push({ id: 'ltempo', icon: 'mic', label: 'Detectar el tempo de la banda', sub: 'con el micrófono, y avanzar a ese tempo', run: function () { pauseLive(); openTempoListen(function (bpm) { setBpm(bpm); toast('Automático a ' + bpm + ' bpm (en este equipo).', 3500); }); } });
  if (st.tl && Math.round(st.bpm) !== Math.round(st.tl.bpm)) items.push({ id: 'gt', icon: 'metro', label: 'Guardar ' + Math.round(st.bpm) + ' bpm como tempo del grupo', sub: 'ahora ' + Math.round(st.tl.bpm), run: saveGroupTempo });
  items.push({ id: 'grid', icon: 'list', label: st.tl ? 'Revisar los compases' : 'Hacer el recorrido sin grabar', run: function () { openGrid(st.tl || newTimeline()); } });
  items.push({ id: 'rec', icon: 'rec', label: st.tl ? 'Volver a grabar el recorrido' : 'Grabar el recorrido', run: openRecorder });
  items.push({ id: 'sync', icon: 'share', label: 'Pantallas conectadas', sub: sync.role === 'guia' ? 'guiando la sala ' + sync.code : sync.role === 'sigue' ? 'siguiendo la sala ' + sync.code : 'que otros celulares sigan a este', run: openSyncSheet });
  items.push({ id: 'oido', icon: 'mic', label: oidoActive() ? 'Dejar de escuchar' : 'Que el celular me escuche', sub: 'sin cable: oye tu piano y avanza cuando aciertas', run: oidoToggleLive });
  items.push({ id: 'mic', icon: 'mic', label: '¿Qué oye el celular?', sub: 'mira en vivo qué teclas oye, el volumen y la afinación', run: openMicCheck });
  if (ear || oidoActive() || TAP.n) items.push({ id: 'grab', icon: 'share', label: 'Guardar lo que oyó (25 s)', sub: 'si no reconoció algo: para revisarlo con tu sonido real', run: tapSaveShare });
  items.push({ id: 'voz', icon: 'voice', label: voz ? 'Apagar la voz' : 'Mandar con la voz', sub: vozLocalReady() ? 'con tu voz grabada: funciona sin internet' : '«siguiente», «otra vez», «más lento», «pausa»…', run: vozToggle });
  items.push({ id: 'voztrain', icon: 'voice', label: vozLocalReady() ? 'Mi voz (sin internet)' : 'Enseñar mi voz (sin internet)', sub: 'dices cada orden 3 veces; el micrófono queda prendido sin parpadear', run: openVozTrain });
  if (st.stu && st.tl && st.tl.video) items.push({ id: 'video', icon: 'video', label: st.mode === 'video' ? 'Volver al clic' : 'Con el video (más lento si quieres)', run: function () { stuVideoMode(st.mode !== 'video'); } });
  if (st.stu) items = items.filter(function (x) { return ['vol', 'kbs', 'imm', 'easy', 'midi', 'sync', 'snd', 'full', 'view', 'voz', 'voztrain', 'oido', 'mic', 'grab', 'video'].indexOf(x.id) >= 0; });
  items.push({ id: 'help', icon: 'text', label: 'Cómo funciona', run: openLiveHelp });
  menuSheet('En vivo', items);
}
function openLiveHelp() {
  openSheet('Tocar en vivo', '<div class="help">' +
    '<p><b>Piano.</b> Arriba la mano derecha, abajo la izquierda, con los dedos marcados. Las posiciones son cercanas: de un acorde al siguiente la mano se mueve lo menos posible. Abajo ves el acorde que viene.</p>' +
    '<p><b>Manual.</b> Toca la pantalla, usa las flechas o un pedal Bluetooth de pasar páginas. Quien conoce la canción puede pasarla con el pie.</p>' +
    '<p><b>Recorrido por compases.</b> Guarda cuántos tiempos dura cada acorde. Se graba tocando «Cambio» al ritmo del video o de la banda: la app acomoda cada toque al tiempo más cercano, así no depende de tu precisión. Luego lo revisas en la cuadrícula. También puedes hacerlo sin grabar: un compás por acorde y ajustas lo que cambie.</p>' +
    '<p><b>Automático.</b> Tras una cuenta de un compás, avanza por tiempos y te muestra en qué tiempo del acorde van. Puedes subir o bajar el tempo en plena canción y con «Clic» suena el metrónomo para la banda. Si se desfasan, toca en la letra el acorde que suena.</p>' +
    '<p><b>Escuchando.</b> El celular oye a la banda (piano o guitarra) y avanza cuando oye el acorde que sigue. Si oye otra cosa —una tecla equivocada, otro acorde, ruido, gente hablando— o hay silencio, espera: la canción no avanza sola. Si la banda se queda más tiempo en un acorde, también espera. Funciona mejor cerca del instrumento o del parlante; en una laptop con la guitarra conectada a la interfaz de audio, mejor todavía. Para ver qué está oyendo, usa «¿Qué oye el celular?».</p></div>');
}
function onLiveTap(e) {
  if (e.target.closest && e.target.closest('[data-lvgrip]')) return;          // la barrita del teclado no avanza
  var st = liveState; if (!st) return;
  if (sugState) { onSugTap(e); return; }
  if (gridState) { onGridTap(e); return; }
  if (recState) { onRecTap(e); return; }
  var jump = e.target.closest('.lv-lines [data-i], .lv-letra [data-i]');
  if (jump) {
    var n = +jump.getAttribute('data-i'), best = -1;
    st.path.forEach(function (k, q) { if (st.steps[k].n === n && (best < 0 || Math.abs(q - st.i) < Math.abs(best - st.i))) best = q; });
    if (best >= 0) jumpTo(best);
    return;
  }
  var b = e.target.closest('[data-lv]'); if (!b || b.disabled) return;
  switch (b.getAttribute('data-lv')) {
    case 'next': jumpTo(st.i + 1); break;
    case 'prev': jumpTo(st.i - 1); break;
    case 'tapnow': if (st.mode !== 'video' && st.mode !== 'sync') { var dir = tapDir(e); jumpTo(st.i + dir); tapFlash(dir); } break;
    case 'vista': openVistaSheet(); break;
    case 'meterhide': setMeterHidden(true); break;
    case 'metershow': setMeterHidden(false); break;
    case 'micdir': dirMicQuick(); break;
    case 'voz': vozToggle(); break;
    case 'close': closeLive(false); break;
    case 'modes': openLiveModes(); break;
    case 'input': openEarInputs(); break;
    case 'imm': setImm(!st.imm); break;
    case 'immoff': setImm(false); break;
    case 'easy': openEasySheet(); break;
    case 'midi': openMidiInputs(); break;
    case 'more': openLiveMore(); break;
    case 'lvl': openLevelSheet(); break;
    case 'stuend': stuSongEnd(true); break;
    case 'sync': openSyncSheet(); break;
    case 'play':
      if (st.mode === 'listen') { if (ear) { stopEar(); drawLive(); } else startEar(); }
      else if (st.playing || st.counting) pauseLive(); else playLive();
      break;
    case 'slower': setBpm(st.bpm - 2); break;
    case 'faster': setBpm(st.bpm + 2); break;
    case 'oido': oidoToggleLive(); break;
    case 'miccheck': openMicCheck(); break;
    case 'navtog': navToggle(); break;
    case 'vrate': videoRate(+b.getAttribute('data-r')); break;
    case 'click': st.click = !st.click; LS.set('cfp.liveClick', st.click); st.nextClick = null; audio(); lid('lv-nav').innerHTML = navHTML(); break;
  }
}
document.addEventListener('keydown', function (e) {
  var st = liveState; if (!st || sheetRoot.firstChild) return;
  var tag = (e.target && e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea') return;
  var k = e.key;
  if (sugState) { if (k === 'Escape') { sugStop(); sugState = null; drawLive(); e.preventDefault(); e.stopImmediatePropagation(); } return; }
  if (gridState) { if (gridKey(k)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
  if (recState) { if (recKey(k)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
  if (k === ' ' || k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === 'Enter') jumpTo(st.i + 1);
  else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') jumpTo(st.i - 1);
  else if (k === 'Home') jumpTo(0);
  else if (k === 'Escape') { if (st.imm) setImm(false); else closeLive(false); }
  else return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

/* ---------- rodillo: las notas bajan hacia su tecla ----------
   Automático: al ritmo exacto (en tiempos). Con el video: al tiempo del video. Escuchando con recorrido: al tempo de
   la banda, esperando la confirmación del oído. Manual o sin recorrido: bajan un acorde por paso. */
var RC = null;
function rollColors() {
  var cs = getComputedStyle(document.body), g = function (n, d) { return cs.getPropertyValue(n).trim() || d; };
  return { chord: g('--chord', '#c8102e'), ink: g('--ink', '#1e2447'), rule: g('--rule', '#e6d7de'), paper: g('--paper', '#fff'), left: '#3a43c4', font: g('--chord-font', 'sans-serif'), ui: g('--ui-font', 'sans-serif') };
}
function rollHTML(cur, nowName, nextName, endHTML) {
  var st = liveState, names = {}, hide = stuHidden(st.i), lvl = st.level || 0, ez = st.easy;
  if (cur.easy) names = easyNames(cur);
  else { var nm = voiceNames(cur.v, cur.en, st.spell); Object.keys(nm.names).forEach(function (k) { names[k] = nm.names[k]; }); names[cur.v.left] = nm.bass; }
  var kv = hide ? { right: [], left: cur.v.left, hideLeft: true, fingers: [] } : cur.v;
  var chordH = lvl >= 4 ? '<span class="lv-chord lv-mem" aria-label="De memoria">♪</span>'
    : '<span class="lv-chord"' + (ez && ez.cfg.colors && cur.v.right.length === 1 && !hide ? ' style="color:' + ezColor(cur.v.right[0]) + '"' : '') + '>' + nowName + '</span>';
  var notesH = ez && ez.cfg.colors && cur.v.right.length > 1 && !hide ? '<span class="lv-notes"><small>teclas</small>' + cur.v.right.map(function (m) { return '<b style="color:' + ezColor(m) + '">' + ezNum(m) + '</b>'; }).join(' ') + '</span>' : '';
  var thenH = lvl >= 4 ? '' : (nextName ? '<span class="lv-then">Luego <b>' + nextName + '</b></span>' : '<span class="lv-then">' + endHTML + '</span>');
  var opts = { ww: st.ww || 30, fs: st.kbFs || 1, lo: st.lLo, hi: st.rHi, cls: 'kb-one', minWhites: st.minWhites || 14, color: ez && ez.cfg.colors ? ezColor : null,
    noBass: !!kv.hideLeft, noFingers: !!(ez && ez.cfg.nums), allLeft: !!kv.allLeft, homePc: ez ? ez.home : 0,
    cLabel: ez && ez.cfg.nums ? '1' : '', noCLabel: lvl >= 4, allNums: lvl === 3 && !!(ez && ez.cfg.nums), numOf: ez ? function (m) { return ezNum(m); } : null,
    label: ez && ez.cfg.part === 'bajo' ? 'Teclado: bajo en azul' : 'Teclado: mano derecha en rojo, mano izquierda en azul' };
  return '<div class="lv-rhead" data-lv="tapnow" role="button" tabindex="0" aria-label="Ahora ' + (lvl >= 4 ? 'de memoria' : nowName) + '">' +
      '<span class="lv-label">Ahora</span>' + chordH + notesH + beatsHTML() + thenH + '</div>' +
    '<div class="lv-roll" data-lv="tapnow"><canvas id="lv-roll" aria-hidden="true"></canvas></div>' +
    '<div class="lv-kb1" data-lv="tapnow"><div class="lv-grip" data-lvgrip="1" role="separator" aria-orientation="horizontal" aria-label="Arrastra para cambiar el alto del teclado; dos toques: tamaño automático"><i></i></div>' +
      pianoSVG(kv, hide ? {} : names, (st.lastKb = { v: kv, names: hide ? {} : names, opts: opts }).opts) + '</div>' +
    '<p class="lv-rot">Gira el celular para ver el piano más grande.</p>';
}
function rollGeom() {
  var st = liveState;
  if (st.tl && (st.mode === 'auto' || st.mode === 'listen' || st.mode === 'video' || st.mode === 'sync')) return { starts: st.startB, span: Math.max(6, 2 * st.bpb), bar: st.bpb };
  var s = [0]; st.path.forEach(function (k, i) { s.push(s[i] + (st.startB ? st.startB[i + 1] - st.startB[i] : 4)); });
  return { starts: s, span: 12, bar: 0 };
}
function rollLive() {
  var st = liveState;
  return ((st.mode === 'auto' || st.mode === 'video') && st.playing) || (st.mode === 'listen' && !!ear && !!st.startB && !!st.t0) || (st.mode === 'sync' && st.playing && !!st.startB);
}
function rollTarget(g) {
  var st = liveState;
  if (st.mode === 'auto' && st.playing) return beatNow();
  if (st.mode === 'video' && st.playing && yt.player && yt.player.getCurrentTime) {                // tiempo del video -> tiempo musical
    var t = yt.player.getCurrentTime() - st.tl.video.start, k = indexAtVideo(t), a = st.vtimes[k], z = k + 1 < st.vtimes.length ? st.vtimes[k + 1] : a + stepBeats(k) * 60 / st.tl.bpm;
    return st.startB[k] + Math.max(0, Math.min(0.999, (t - a) / Math.max(0.05, z - a))) * stepBeats(k);
  }
  if ((st.mode === 'listen' || st.mode === 'sync') && rollLive()) return Math.max(g.starts[st.i], Math.min(beatNow(), g.starts[st.i + 1] - 0.05));   // espera al oído o a la otra pantalla
  return g.starts[st.i];
}
function rollKick() { var st = liveState; if (st && !st.rollRaf) st.rollRaf = requestAnimationFrame(rollTick); }
function rollTick() {
  var st = liveState; if (!st) return; st.rollRaf = 0;
  if (!lid('lv-roll')) return;
  var g = rollGeom(), tgt = rollTarget(g), live = rollLive();
  if (st.rollPos == null || live || Math.abs(tgt - st.rollPos) > 40) st.rollPos = tgt; else st.rollPos += (tgt - st.rollPos) * 0.2;
  if (!live && Math.abs(tgt - st.rollPos) < 0.01) st.rollPos = tgt;
  drawRoll(g);
  if (st.easy) hitKeys(g, live);
  if (live || st.rollPos !== tgt) st.rollRaf = requestAnimationFrame(rollTick);
}
function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawRoll(g) {
  var st = liveState, cv = lid('lv-roll'), main = lid('lv-main'), kb = main && main.querySelector('svg.kb-one'); if (!cv || !kb) return;
  var box = cv.parentNode.getBoundingClientRect(), kr = kb.getBoundingClientRect(), vb = kb.viewBox.baseVal;
  var sc = Math.min(kr.width / vb.width, kr.height / vb.height), W = Math.round(vb.width * sc), H = Math.round(box.height), dpr = window.devicePixelRatio || 1;
  if (W < 10 || H < 10) return;
  cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.style.left = Math.round(kr.left + (kr.width - vb.width * sc) / 2 - box.left) + 'px';
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  var lay = st.kbLay || (st.kbLay = kbLayout(st.lLo, st.rHi, st.minWhites || 14, st.ww || 30)), sx = W / lay.width, col = RC || (RC = rollColors()), now = st.rollPos, ppu = H / g.span;
  var hint = main.querySelector('.lv-rot'); if (hint) hint.style.display = W / (lay.width / 30) < 20 ? 'block' : 'none';   // teclas muy angostas: sugerir girar
  ctx.globalAlpha = 1; ctx.fillStyle = col.rule;
  for (var m = lay.lo; m <= lay.hi; m++) if (C.mod12(m) === 0 && lay.keys[m]) ctx.fillRect(Math.round(lay.keys[m].x * sx), 0, 1, H);   // cada Do
  if (g.bar) for (var bb = Math.ceil(now / g.bar - 1e-9) * g.bar; bb < now + g.span; bb += g.bar) ctx.fillRect(0, Math.round(H - (bb - now) * ppu), W, 1);   // cada compás
  var fmt = st.easy ? easyFmt : fmtFor(info(st.song).key, songShift(st.song)), lvl = st.level || 0, bpb = g.bar || st.bpb || 4;
  var ezn = st.easy && st.easy.cfg.nums, colors = st.easy && st.easy.cfg.colors;
  for (var i = Math.max(0, st.i - 1); i < st.path.length; i++) {
    var a = g.starts[i], z = g.starts[i + 1]; if (a > now + g.span) break; if (z <= now) continue;
    var yT = H - (z - now) * ppu, yB = Math.min(H, H - (a - now) * ppu), cur = i === st.i, v = st.vo[i].v;
    if (yB - yT < 2) continue;
    if (stuHidden(i)) {                     // el alumno ya no necesita las teclas: una franja con el número (o nada, de memoria)
      if (lvl >= 4) continue;
      ctx.globalAlpha = cur ? 0.2 : 0.1; ctx.fillStyle = col.ink; roundRect(ctx, 3, yT + 1, W - 6, yB - yT - 2, 8); ctx.fill();
      if (yB - yT > 18) { ctx.globalAlpha = cur ? 0.9 : 0.6; ctx.fillStyle = col.ink; ctx.textAlign = 'center'; ctx.font = '700 ' + Math.round(Math.min(26, Math.max(14, (yB - yT) * 0.45))) + 'px ' + col.font; ctx.fillText(st.vo[i].label, W / 2, Math.min(H - 8, yB - 8)); }
      continue;
    }
    var hits = st.easy ? partHits(st.easy.cfg, v, a, z, bpb) : [{ b: a, d: z - a, n: v.right, h: 'R' }].concat(v.hideLeft ? [] : [{ b: a, d: z - a, n: [v.left], h: 'L' }]);
    for (var hh = 0; hh < hits.length; hh++) {
      var h = hits[hh], hT = H - (h.b + h.d - now) * ppu, hB = Math.min(H, H - (h.b - now) * ppu);
      if (hB < 0 || hT > H || hB - hT < 2) continue;
      for (var q = 0; q < h.n.length; q++) {
        var mm = h.n[q], key = lay.keys[mm]; if (!key) continue;
        var x = key.x * sx + 1.5, w = key.w * sx - 3, ri = v.right.indexOf(mm);
        ctx.globalAlpha = cur ? 0.95 : 0.55; ctx.fillStyle = colors ? ezColor(mm) : (h.h === 'L' ? col.left : col.chord);
        roundRect(ctx, x, hT + 1, w, hB - hT - 2, Math.min(5, w / 3)); ctx.fill();
        var t = ezn ? ezNum(mm) : (ri >= 0 && v.fingers ? v.fingers[ri] : (h.h === 'L' ? 5 : ''));
        if (hB - hT > 20 && w > 9 && t !== '' && t != null) { ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '700 ' + Math.min(13, Math.round(w * 0.75)) + 'px ' + col.ui; ctx.fillText(String(t), x + w / 2, hB - 6); }
      }
    }
    if (a > now + 0.01 && !st.easy) {   // nombre del acorde que viene, donde empieza (en los modos fáciles cada nota ya lleva su número)
      var nm = C.splitTok(fmt(st.steps[st.path[i]].c)).core;
      ctx.globalAlpha = 1; ctx.font = '700 16px ' + col.font; ctx.textAlign = 'left';
      var tw = ctx.measureText(nm).width, ty = Math.max(16, Math.min(H - 6, yB - 5));
      ctx.fillStyle = col.paper; ctx.fillRect(2, ty - 14, tw + 8, 18); ctx.fillStyle = col.ink; ctx.fillText(nm, 6, ty);
    }
  }
  ctx.globalAlpha = 1; ctx.fillStyle = col.chord; ctx.fillRect(0, H - 3, W, 3);   // línea de «ahora»
}

/* La tecla que toca ahora se enciende con cada golpe del ritmo: así se ve el ritmo también en el teclado. */
function hitKeys(g, live) {
  var st = liveState, main = lid('lv-main'); if (!st || !main) return;
  var rects = st.kbRects;
  if (!rects || !rects.length || !rects[0].isConnected) rects = st.kbRects = main.querySelectorAll('svg.kb-one rect[data-m]');
  var on = {};
  if (live && !stuHidden(st.i)) {
    var a = g.starts[st.i], z = g.starts[st.i + 1];
    partHits(st.easy.cfg, st.vo[st.i].v, a, z, g.bar || st.bpb || 4).forEach(function (h) {
      if (st.rollPos >= h.b - 0.03 && st.rollPos < h.b + Math.min(h.d, 0.45)) h.n.forEach(function (m) { on[m] = 1; });
    });
  }
  for (var k = 0; k < rects.length; k++) { var r = rects[k], v = !!on[+r.getAttribute('data-m')]; if (r.classList.contains('hit') !== v) r.classList.toggle('hit', v); }
}
/* ---------- solo piano: nada más que las teclas y lo que viene ---------- */
function setImm(on) {
  var st = liveState; if (!st) return;
  st.imm = !!on; LS.set('cfp.liveImm', st.imm);
  if (st.imm) enterFull();
  drawLive();
}
function immHTML(nowName) {
  var st = liveState, timed = st.mode === 'auto' || st.mode === 'video', play = '';
  if (timed) play = '<button type="button" data-lv="play" aria-label="' + (st.playing || st.counting ? 'Pausa' : 'Empezar') + '">' + icon(st.playing || st.counting ? 'pause' : 'play') + '</button>';
  else if (st.mode === 'listen') play = '<button type="button" data-lv="play" aria-label="' + (ear ? 'Dejar de escuchar' : 'Escuchar') + '">' + icon(ear ? 'pause' : 'mic') + '</button>';
  return '<div class="lv-imm"><span class="imm-btns"><span class="imm-ch" aria-live="polite">' + nowName + '</span>' + play +
    '<button type="button" data-lv="immoff" aria-label="Salir de solo piano">' + icon('close') + '</button></span></div>';
}
/* ---------- volumen ---------- */
function openVolumeSheet() {
  var av = Math.round(100 * (+LS.get('cfp.appVol', 0.8))), vv = +LS.get('cfp.videoVol', 60);
  openSheet('Volumen', '<div class="field"><label for="vol-v">Video de YouTube: <output id="vol-vo">' + vv + '</output></label><input type="range" id="vol-v" min="0" max="100" step="5" value="' + vv + '"></div>' +
    '<div class="field"><label for="vol-a">Sonidos de la app (piano, clic y cuenta): <output id="vol-ao">' + av + '</output></label><input type="range" id="vol-a" min="0" max="100" step="5" value="' + av + '"></div>' +
    '<p class="help">El piano que suena en Ableton o Analog Lab se ajusta en esos programas o en la perilla de la interfaz.</p>', function (el) {
    el.addEventListener('input', function (e) {
      if (e.target.id === 'vol-v') { setVideoVolume(+e.target.value); el.querySelector('#vol-vo').textContent = e.target.value; var inl = lid('lv-nav') && lid('lv-nav').querySelector('[data-lvvol]'); if (inl) inl.value = e.target.value; }
      if (e.target.id === 'vol-a') { setAppVolume(e.target.value / 100); el.querySelector('#vol-ao').textContent = e.target.value; }
    });
    el.addEventListener('change', function (e) { if (e.target.id === 'vol-a') playNotes([60, 64, 67]); });
  });
}

/* ---------- alto del teclado: automático o el que el usuario arrastra (se recuerda por orientación y por «solo piano») ---------- */
function kbKey() { return 'cfp.kbH.' + (innerWidth > innerHeight ? 'h' : 'v') + (liveState && liveState.imm ? 'i' : ''); }
function kbFrac() { var v = LS.get(kbKey(), null); if (v != null && +v > 0) return +v; return innerWidth > innerHeight ? (liveState && liveState.imm ? 0.4 : 0.34) : null; }
function resetKb() { try { localStorage.removeItem(kbKey()); } catch (e) { /* nada */ } if (fitKb(true)) { cancelAnimationFrame(liveState.rollRaf); liveState.rollRaf = 0; rollTick(); } toast('Teclado en tamaño automático.', 1800); }
/* El teclado llena todo el ancho: se elige el alto y se calcula el ancho de cada tecla (sin deformar números ni letras). */
function fitKb(force) {
  var st = liveState, main = lid('lv-main'), box = main && main.querySelector('.lv-kb1'); if (!st || !box || !st.lastKb) return false;
  var whites = kbLayout(st.lLo, st.rHi, st.minWhites || 14, 30).width / 30, Wc = box.clientWidth, H = main.clientHeight;
  if (!Wc || !H) return false;
  var f = kbFrac(), hk = f ? f * H : Wc * 134 / (30 * whites);
  hk = Math.max(56, Math.min(hk, H * 0.72));
  var ww = Math.max(14, Math.min(240, Wc * 134 / (hk * whites))), fs = Math.max(1, Math.min(1.8, 12 / (14 * hk / 134)));   // números de al menos ~12 px
  if (!force && st.ww && Math.abs(ww - st.ww) < 0.3 && Math.abs(fs - (st.kbFs || 1)) < 0.03) return false;
  st.ww = ww; st.kbFs = fs; st.kbLay = null;
  var o = st.lastKb, svg = box.querySelector('svg.kb-one'); o.opts.ww = ww; o.opts.fs = fs;
  if (svg) svg.outerHTML = pianoSVG(o.v, o.names, o.opts);
  st.kbRects = null;
  if (midi.inp) midiKeys();
  return true;
}
var gripTap = 0;
function onGrip(e) {
  var g = e.target.closest && e.target.closest('[data-lvgrip]'); if (!g || !liveState) return;
  e.preventDefault(); e.stopPropagation();
  var now = Date.now(); if (now - gripTap < 350) { gripTap = 0; resetKb(); return; } gripTap = now;
  var main = lid('lv-main'), svg = main.querySelector('svg.kb-one'), y0 = e.clientY, h0 = svg ? svg.getBoundingClientRect().height : 100, H = main.clientHeight;
  try { g.setPointerCapture(e.pointerId); } catch (x) { /* nada */ }
  var move = function (ev) {
    var h = Math.max(56, Math.min(H * 0.72, h0 - (ev.clientY - y0)));
    LS.set(kbKey(), Math.round(1000 * h / H) / 1000);
    if (fitKb(true)) { cancelAnimationFrame(liveState.rollRaf); liveState.rollRaf = 0; rollTick(); }
  };
  var up = function () { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); };
  g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
}
window.addEventListener('resize', function () { if (liveState && lid('live') && fitKb(true)) { cancelAnimationFrame(liveState.rollRaf); liveState.rollRaf = 0; rollTick(); } });

/* Barra de abajo plegable en horizontal, controles mínimos arriba, y pantalla completa al primer toque. */
function liveMiniDraw() {
  var st = liveState, top = lid('lv-top'), el = lid('live'); if (!st || !top) return;
  var old = top.querySelector('.lv-mini'); if (old) old.remove();
  // solo existe cuando de verdad se ve: barra de abajo guardada y celular en horizontal
  if (!el || !el.classList.contains('navhide') || !LAND_MQ.matches) return;
  var playable = st.tl && (st.mode === 'auto' || st.mode === 'video'), on = st.playing || st.counting;
  var more = top.querySelector('[data-lv="more"]');
  (more || top).insertAdjacentHTML(more ? 'beforebegin' : 'beforeend', '<span class="lv-mini">' + (playable ? '<button type="button" class="iconbtn" data-lv="play" aria-label="' + (on ? 'Pausa' : 'Seguir') + '">' + icon(on ? 'pause' : 'play') + '</button>' : '') +
    '<button type="button" class="iconbtn" data-lv="prev" aria-label="Anterior">' + icon('back') + '</button><button type="button" class="iconbtn" data-lv="next" aria-label="Siguiente">' + icon('fwd') + '</button>' +
    '<button type="button" class="iconbtn" data-lv="navtog" aria-label="Mostrar los botones de abajo" title="Mostrar los botones">' + icon('up') + '</button></span>');
}
var LAND_MQ = window.matchMedia('(orientation: landscape) and (min-width: 640px)');
if (LAND_MQ.addEventListener) LAND_MQ.addEventListener('change', function () { liveMiniDraw(); });
function navToggle() {
  var el = lid('live'); if (!el || !liveState) return;
  var on = !el.classList.contains('navhide');
  el.classList.toggle('navhide', on); LS.set('cfp.navHide', on); drawLive();
}
function liveFullRetry() { var st = liveState; if (st && !st.fullTried && !document.fullscreenElement) { st.fullTried = true; enterFull(); } }

/* ---------- oct 2026: lo mismo para todos los perfiles ----------
   Tocar la pantalla: el tercio izquierdo retrocede y el resto avanza (con un destello que dice hacia dónde).
   La franja de lo que oye el micrófono se puede ocultar: queda un puntito arriba (verde: va bien; ámbar: espera).
   Vista: piano que baja, dos teclados o «Letra grande» (para guitarra y voz), y el tamaño de la letra. */
ICONS.eye = '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>';
ICONS.hand = '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7-2.6 0-4-1.4-5.4-3.4L3.9 14a1.5 1.5 0 0 1 2.4-1.8L8 14"/>';
ICONS.voice = '<path d="M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M3 8v6M21 8v6"/>';
function tapDir(e) {
  var el = lid('live'); if (!el || !e || e.detail === 0 || !(e.clientX > 0)) return 1;     // con teclado o pedal: siempre adelante
  var r = el.getBoundingClientRect();
  return e.clientX - r.left < r.width * 0.3 ? -1 : 1;
}
function tapFlash(dir) {
  var el = lid('live'); if (!el) return;
  var old = el.querySelector('.lv-flash'); if (old) old.remove();
  el.insertAdjacentHTML('beforeend', '<div class="lv-flash ' + (dir < 0 ? 'back' : 'fwd') + '" aria-hidden="true">' + icon(dir < 0 ? 'back' : 'fwd') + '</div>');
  var f = el.querySelector('.lv-flash'); setTimeout(function () { if (f && f.parentNode) f.parentNode.removeChild(f); }, 450);
}
/* la franja del micrófono */
function meterHidden() { return !!LS.get('cfp.meterHide', false); }
function setMeterHidden(h) {
  LS.set('cfp.meterHide', !!h); drawLive();
  if (h) toast('Franja oculta. Para verla otra vez, toca el micrófono de arriba.', 2800);
}
function meterX() { return '<button type="button" class="lv-mx" data-lv="meterhide" aria-label="Ocultar esta franja" title="Ocultar">' + icon('close') + '</button>'; }
function liveMeterHTML() {
  var st = liveState; if (!st || meterHidden()) return '';
  if (st.mode === 'listen') return '<div class="lv-meter lv-m-ear"><span class="lv-lvl" title="Nivel de entrada"><i id="lv-lvl"></i></span><span id="lv-meter" aria-live="off">' +
    (ear ? 'Escuchando…' : 'Toca «Escuchar»: avanza cuando oye el acorde que sigue; si oye otra cosa, espera.') + '</span>' + clipWarnHTML() +
    '<button type="button" class="linkbtn" data-lv="miccheck">¿Qué oye?</button><button type="button" class="linkbtn" data-lv="input">Entrada</button>' + meterX() + '</div>';
  if (!st.stu && oidoActive()) return oidoMeterHTML();
  return '';
}
function clipWarnHTML() { return '<span class="lv-clip" id="lv-clip" hidden>Muy fuerte: baja el volumen o aleja el celular</span>'; }
function liveTopExtras() {
  var st = liveState, h = '';
  if (st && meterHidden() && (ear || oidoActive() || st.mode === 'listen'))
    h += '<button type="button" class="lv-micdot" data-lv="metershow" data-st="' + (ear || oidoActive() ? 'on' : 'off') + '" aria-label="Mostrar lo que oye el micrófono" title="Mostrar lo que oye">' + icon('mic') +
      '<span class="lv-lvl oido-lvl"><i' + (ear ? ' id="lv-lvl"' : '') + '></i></span></button>';
  if (voz) h += '<button type="button" class="lv-vozc" data-lv="voz" aria-pressed="true" aria-label="Voz encendida: toca para apagarla" title="Voz encendida">' + icon('voice') + '</button>';
  return h;
}
function micDotState(s) { var d = document.querySelector('.lv-micdot'); if (d && d.getAttribute('data-st') !== s) d.setAttribute('data-st', s); }
/* el director, en manual: un toque para que la app escuche a la banda */
function dirMicQuick() {
  var st = liveState; if (!st) return;
  if (st.mode !== 'listen') setLiveMode('listen');
  if (!ear) startEar();
}
/* ---------- vista y tamaño de la letra (por perfil y por orientación) ---------- */
var LYR_STEPS = [0.8, 0.9, 1, 1.12, 1.25, 1.4, 1.6, 1.8, 2.05];
function lyrKey() { return 'cfp.lyr.' + (innerWidth > innerHeight ? 'h' : 'v'); }
function lyrScale() { var v = +LS.get(lyrKey(), 1); return v >= 0.6 && v <= 2.5 ? v : 1; }
function lyrStep(d) {
  var v = lyrScale(), i = 0, best = 99;
  LYR_STEPS.forEach(function (x, k) { if (Math.abs(x - v) < best) { best = Math.abs(x - v); i = k; } });
  i = Math.max(0, Math.min(LYR_STEPS.length - 1, i + d)); LS.set(lyrKey(), LYR_STEPS[i]); return LYR_STEPS[i];
}
function liveViewKey() { var st = liveState; return 'cfp.liveView.' + (st && st.stu ? 'a.' + st.stu.sid : 'dir'); }
function liveViewGet() { var v = LS.get(liveViewKey(), null); return v === 'roll' || v === 'hands' || v === 'letra' ? v : (prefs.liveView === 'hands' ? 'hands' : 'roll'); }
function openVistaSheet() {
  var st = liveState; if (!st) return;
  var v = liveViewGet();
  var opt = function (id, label, sub) { return '<button type="button" data-vw="' + id + '" aria-pressed="' + (v === id && !st.imm) + '"><b>' + label + '</b><small>' + sub + '</small></button>'; };
  var body = '<div class="vw-pick" role="group" aria-label="Cómo se ve">' + opt('roll', 'Piano que baja', 'un teclado; las notas bajan hacia su tecla') +
    opt('hands', 'Dos teclados', 'mano derecha arriba, izquierda abajo') + opt('letra', 'Letra grande', 'la letra con sus acordes, para guitarra y voz') + '</div>' +
    '<div class="setting"><span>Tamaño de la letra</span><span class="vw-fs"><button type="button" class="btn" data-fs="-1" aria-label="Letra más chica">A−</button><output id="vw-fso">' +
    Math.round(lyrScale() * 100) + ' %</output><button type="button" class="btn" data-fs="1" aria-label="Letra más grande">A+</button></span></div>' +
    '<label class="chk"><input type="checkbox" id="vw-meter"' + (meterHidden() ? '' : ' checked') + '> <span>Mostrar la franja de lo que oye el micrófono</span></label>' +
    '<div class="btnrow"><button type="button" class="btn" data-vw="imm">' + icon('full') + (st.imm ? 'Salir de «solo piano»' : 'Solo piano (pantalla completa)') + '</button></div>' +
    '<p class="help">El tamaño de la letra se guarda aparte para el celular parado y acostado.</p>';
  openSheet('Vista', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-vw]'), f = e.target.closest('[data-fs]');
      if (f) { var nv = lyrStep(+f.getAttribute('data-fs')); el.querySelector('#vw-fso').textContent = Math.round(nv * 100) + ' %'; drawLive(); return; }
      if (!b) return;
      var w = b.getAttribute('data-vw');
      if (w === 'imm') { closeSheet(true); setImm(!st.imm); return; }
      LS.set(liveViewKey(), w);
      if (st.imm) { st.imm = false; LS.set('cfp.liveImm', false); }
      Array.prototype.forEach.call(el.querySelectorAll('.vw-pick [data-vw]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      drawLive();
    });
    el.addEventListener('change', function (e) { if (e.target.id === 'vw-meter') { LS.set('cfp.meterHide', !e.target.checked); drawLive(); } });
  });
}
/* ---------- «Letra grande»: la canción entera con sus acordes; la línea que suena queda arriba y resaltada ---------- */
function letraHeadHTML(nowName, nextName, endHTML, posH) {
  return '<div class="lv-rhead lb-head" data-lv="tapnow" role="button" tabindex="0" aria-label="Ahora ' + nowName + '"><span class="lv-label">Ahora</span><span class="lv-chord">' + nowName + '</span>' + beatsHTML() +
    (nextName ? '<span class="lv-then">Luego <b>' + nextName + '</b></span>' : '<span class="lv-then">' + endHTML + '</span>') + posH + '</div>';
}
function letraHTML(st, inf, fmt, key) {
  var h = '';
  inf.lines.forEach(function (l, li) {
    if (l.type === 'label') { h += '<p class="lb-sec" data-li="' + li + '">' + esc(C.sentenceCase(l.text)) + '</p>'; return; }
    if (l.type === 'blank') { h += '<div class="lb-gap"></div>'; return; }
    if (!l.segs || (l.type !== 'lyric' && l.type !== 'instr')) return;
    var c = { i: st.firstN[li] };
    h += '<div class="lb-line" data-li="' + li + '">' + (l.type === 'instr' ? instrHTML(l, fmt, c) : lyricHTML(l, fmt, c)) + '</div>';
  });
  return '<div class="lv-letra song" id="lv-letra" data-lv="tapnow" data-k="' + esc(key) + '" style="--lyr:' + lyrScale() + '">' + h + '<div class="lb-end"></div></div>';
}
function letraMark(step, kept) {
  var box = lid('lv-letra'); if (!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('.lb-line.cur, .now'), function (x) { x.classList.remove('cur'); x.classList.remove('now'); });
  var ln = box.querySelector('.lb-line[data-li="' + step.li + '"]'); if (!ln) return;
  ln.classList.add('cur');
  Array.prototype.forEach.call(box.querySelectorAll('.lb-line'), function (x) { x.classList.toggle('past', +x.getAttribute('data-li') < step.li); });
  var ch = ln.querySelector('[data-i="' + step.n + '"]'); if (ch) ch.classList.add('now');
  if (!kept) fixCollisions(box);
  var top = Math.max(0, ln.offsetTop - box.clientHeight * 0.28);
  if (kept && box.scrollTo && Math.abs(box.scrollTop - top) > 2) box.scrollTo({ top: top, behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  else box.scrollTop = top;
}
window.addEventListener('orientationchange', function () { if (liveState && lid('live')) setTimeout(drawLive, 250); });

/* parte 7: grabar el recorrido (con un video de YouTube o mientras la banda toca) y reproductor de YouTube */
var recState = null;
var yt = { player: null, id: '', ready: null };
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (yt.ready) return yt.ready;
  yt.ready = new Promise(function (res, rej) {
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () { if (typeof prev === 'function') prev(); res(window.YT); };
    var s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = function () { yt.ready = null; rej(new Error('sin conexión')); };
    document.head.appendChild(s);
    setTimeout(function () { if (!(window.YT && window.YT.Player)) { yt.ready = null; rej(new Error('tiempo')); } }, 15000);
  });
  return yt.ready;
}
function showVideo(id, start) {
  var box = lid('lv-video');
  if (!box || !id) return Promise.reject(new Error('sin video'));
  box.hidden = false; lid('live').classList.add('with-video');
  if (yt.player && yt.id === id) return Promise.resolve(yt.player);
  destroyPlayer();
  box.innerHTML = '<div id="lv-yt"></div>';
  return loadYT().then(function (YT) {
    return new Promise(function (res, rej) {
      var done = false;
      yt.id = id;
      yt.player = new YT.Player('lv-yt', { videoId: id, width: '100%', height: '100%',
        playerVars: { start: Math.floor(start || 0), playsinline: 1, rel: 0, modestbranding: 1 },
        events: { onReady: function () { done = true; setVideoVolume(+LS.get('cfp.videoVol', 60), true); res(yt.player); }, onError: function () { if (!done) rej(new Error('video')); } } });
      setTimeout(function () { if (!done) rej(new Error('tiempo')); }, 20000);
    });
  });
}
function hideVideo() {
  var box = lid('lv-video'); if (box) box.hidden = true; if (lid('live')) lid('live').classList.remove('with-video');
  if (yt.player) { try { yt.player.pauseVideo(); } catch (e) { /* nada */ } }
}
function destroyPlayer() {
  if (yt.player) { try { yt.player.destroy(); } catch (e) { /* nada */ } }
  yt.player = null; yt.id = '';
}
function videoFailed() { toast('No se pudo abrir el video. Revisa la conexión a internet.', 4500); }

/* ---------- marcar el pulso: la recta que mejor pasa por los toques da el tempo ---------- */
function openTapTempo(onUse) {
  var taps = [], bpm = null;
  openSheet('Marcar el pulso', '<p class="help">Toca el botón siguiendo el pulso de la canción (el que marcarías con el pie), al menos 8 veces. También sirve la barra espaciadora.</p>' +
    '<button type="button" class="tap-big" id="tap-b">Pulso</button><p class="tap-res" id="tap-r">Esperando toques…</p>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="use" disabled>Usar este tempo</button><button type="button" class="btn" data-x="reset">Empezar de nuevo</button></div>', function (el) {
    var res = el.querySelector('#tap-r'), use = el.querySelector('[data-x="use"]');
    var tap = function () {
      var now = performance.now();
      if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
      taps.push(now); bpm = C.tlTapBpm(taps);
      res.textContent = bpm ? Math.round(bpm) + ' bpm (' + taps.length + ' toques)' : taps.length + (taps.length === 1 ? ' toque…' : ' toques…');
      use.disabled = !(bpm && taps.length >= 6);
      var b = el.querySelector('#tap-b'); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
    };
    el.querySelector('#tap-b').addEventListener('pointerdown', function (e) { e.preventDefault(); tap(); });
    el.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (e.target.id === 'tap-b' || e.key === ' ') tap(); } });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      if (b.getAttribute('data-x') === 'reset') { taps = []; bpm = null; res.textContent = 'Esperando toques…'; use.disabled = true; }
      else if (b.getAttribute('data-x') === 'use' && bpm) { closeSheet(); onUse(Math.round(bpm)); }
    });
    el.querySelector('#tap-b').focus();
  });
}

/* ---------- grabar ---------- */
function openRecorder() {
  var st = liveState; if (!st) return;
  pauseLive(); stopEar();
  var song = st.song, tl = st.tl, ref = (song.refs || [])[0] || '';
  recState = {
    video: tl && tl.video ? tl.video.id : C.ytId(ref), start: tl && tl.video ? tl.video.start : C.ytStart(ref),
    bpm: tl ? Math.round(tl.bpm) : (+song.bpm || info(song).bpm || ''), beats: tl ? tl.beats : 4,
    marks: [], p: 0, phase: 'setup', t0: 0, timer: 0
  };
  if (recState.video) showVideo(recState.video, recState.start).catch(videoFailed); else hideVideo();
  drawRec();
}
function recTime() {
  var r = recState;
  if (r.video && yt.player && yt.player.getCurrentTime) return yt.player.getCurrentTime() - r.start;
  return (performance.now() - r.t0) / 1000;
}
function sigButtons(cur, attr) {
  return [2, 3, 4, 6].map(function (b) { return '<button type="button" ' + attr + '="' + b + '" aria-pressed="' + (cur === b) + '">' + b + '/' + (b === 6 ? 8 : 4) + '</button>'; }).join('');
}
function drawRec() {
  var st = liveState, r = recState, song = st.song, inf = info(song), fmt = fmtFor(inf.key, songShift(song));
  lid('live').classList.add('rec');
  lid('lv-top').innerHTML = '<button type="button" class="iconbtn" data-rc="close" aria-label="Salir de la grabación">' + icon('close') + '</button>' +
    '<h2>Grabar recorrido: ' + esc(C.sentenceCase(song.title)) + '</h2>';
  var main = '', nav = '';
  if (r.phase === 'setup') {
    main = '<div class="rec-setup">' +
      '<p class="help">Toca «Cambio» cada vez que cambia el acorde. La app acomoda cada toque al tiempo más cercano del compás, así que no hace falta ser exacto. Al final revisas los compases.</p>' +
      '<div class="field"><label for="rc-url">Video de YouTube (opcional)</label><div class="rc-row">' +
        '<input id="rc-url" value="' + esc(r.video ? 'https://youtu.be/' + r.video : '') + '" placeholder="Pega aquí el enlace del video" autocomplete="off">' +
        '<button type="button" class="btn" data-rc="load">Abrir</button></div></div>' +
      (r.video
        ? '<div class="field"><label for="rc-start">La canción empieza en</label><div class="rc-row"><input id="rc-start" inputmode="numeric" value="' + C.fmtClock(r.start) + '">' +
          '<button type="button" class="btn" data-rc="markstart">Usar el minuto del video</button></div></div>'
        : '<p class="help">Sin video: toca «Empezar», espera la cuenta de 3 y marca los cambios mientras la banda toca. Si hay un enlace y quieres grabar sin video, bórralo.</p>') +
      '<div class="grid2"><div class="field"><label for="rc-bpm">Tempo (bpm)</label><div class="rc-row"><input id="rc-bpm" inputmode="numeric" value="' + esc(String(r.bpm || '')) + '" placeholder="?">' +
        '<button type="button" class="btn" data-rc="tap">Marcar el pulso</button><button type="button" class="btn" data-rc="listen">' + icon('mic') + 'Detectar</button></div></div>' +
      '<div class="field"><span class="lbl-s">Compás</span><div class="seg">' + sigButtons(r.beats, 'data-rcsig') + '</div></div></div>' +
      '<p class="help">Si no sabes el tempo: «Detectar» lo saca con el micrófono mientras suena la canción, «Marcar el pulso» lo calcula de tus toques, o déjalo vacío y se calcula al grabar.</p></div>';
    main = main.replace(/<\/div>$/, '<p class="help">¿Prefieres que la app lo sugiera? <button type="button" class="linkbtn" data-rc="suggest">Sugerir escuchando la canción completa</button> (en prueba).</p></div>');
    nav = '<div class="lv-row"><button type="button" class="btn" data-rc="close">Cancelar</button><button type="button" class="btn primary" data-rc="begin">' + icon('rec') + 'Empezar</button></div>';
  } else if (r.phase === 'count') {
    main = '<div class="lv-count rec-count" id="rc-count">3</div>';
    nav = '<div class="lv-row"><button type="button" class="btn" data-rc="again">Cancelar</button></div>';
  } else {
    main = '<button type="button" class="rec-big" data-rc="mark" id="rc-big">Cambio<b id="rc-next"></b></button>' +
      '<p class="rec-stat"><span id="rc-clock">0:00</span><span id="rc-count2"></span></p>' +
      '<div class="song rec-lines" id="rc-lines">' + bodyHTML(song, fmt) + '</div>';
    nav = '<div class="lv-row"><button type="button" class="btn" data-rc="undo">Deshacer</button><button type="button" class="btn primary" data-rc="finish">Terminar</button></div>';
  }
  lid('lv-main').innerHTML = main;
  lid('lv-nav').innerHTML = nav;
  if (r.phase === 'rec') { fixCollisions(lid('rc-lines')); updateRec(); }
}
/* Mientras se graba solo cambia lo necesario: el próximo acorde, los marcados y el reloj. */
function updateRec() {
  var st = liveState, r = recState; if (!r || r.phase !== 'rec') return;
  var fmt = fmtFor(info(st.song).key, songShift(st.song)), box = lid('rc-lines');
  var nb = lid('rc-next'); if (nb) nb.textContent = r.p < st.steps.length ? C.splitTok(fmt(st.steps[r.p].c)).core : '—';
  var cc = lid('rc-count2'); if (cc) cc.textContent = r.marks.length + (r.marks.length === 1 ? ' marcado' : ' marcados');
  if (!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('.done, .now'), function (x) { x.classList.remove('done', 'now'); });
  r.marks.forEach(function (m) { var x = box.querySelector('[data-i="' + st.steps[m[0]].n + '"]'); if (x) x.classList.add('done'); });
  var nx = r.p < st.steps.length ? box.querySelector('[data-i="' + st.steps[r.p].n + '"]') : null;
  if (nx) {
    nx.classList.add('now');
    var br = nx.getBoundingClientRect(), mr = lid('lv-main').getBoundingClientRect();
    if (br.top < mr.top + 60 || br.bottom > mr.bottom - 20) lid('lv-main').scrollTop += br.top - mr.top - mr.height / 3;
  }
}
function startRec() {
  var r = recState, sv = lid('rc-start'), uv = lid('rc-url'), bv = lid('rc-bpm');
  if (uv) {
    var u = uv.value.trim(), vid = C.ytId(u);
    if (u && !vid) { toast('Ese enlace no es de un video de YouTube. Bórralo para grabar sin video.', 4500); uv.focus(); return; }
    r.video = vid;
    if (!vid) hideVideo();
  }
  if (sv && r.video) { var t = C.parseClock(sv.value); if (t === null) { toast('Escribe el inicio así: 2:43'); sv.focus(); return; } r.start = t; }
  if (bv) { var b = +bv.value.trim(); r.bpm = bv.value.trim() && b >= 30 && b <= 240 ? b : ''; if (bv.value.trim() && !r.bpm) { toast('Escribe un tempo entre 30 y 240, o déjalo vacío.'); bv.focus(); return; } }
  r.marks = []; r.p = 0;
  var go = function () { r.phase = 'rec'; drawRec(); clearInterval(r.timer); r.timer = setInterval(function () { var c = lid('rc-clock'); if (c && recState) c.textContent = C.fmtClock(Math.max(0, recTime())); }, 200); };
  if (r.video) {
    showVideo(r.video, r.start).then(function (p) { if (!recState) return; p.seekTo(Math.max(0, r.start - 1), true); p.playVideo(); go(); })
      .catch(function () { toast('No se pudo abrir el video (¿sin internet?). Para grabar sin video, borra el enlace y toca «Empezar».', 6000); });
    return;
  }
  var n = 3; r.phase = 'count'; drawRec();
  var step = function () {
    if (!recState || r.phase !== 'count') return;
    if (n === 0) { r.t0 = performance.now(); go(); return; }
    var c = lid('rc-count'); if (c) c.textContent = n;
    n--; setTimeout(step, 700);
  };
  step();
}
function recMark(k) {
  var st = liveState, r = recState; if (!r || r.phase !== 'rec' || k < 0 || k >= st.steps.length) return;
  var t = recTime();
  if (r.marks.length && t <= r.marks[r.marks.length - 1][1]) t = r.marks[r.marks.length - 1][1] + 0.01;
  r.marks.push([k, Math.round(t * 1000) / 1000]);
  r.p = Math.min(st.steps.length, k + 1);
  var big = lid('rc-big'); if (big) { big.classList.remove('hit'); void big.offsetWidth; big.classList.add('hit'); }
  updateRec();
}
function recUndo() {
  var r = recState; if (!r || !r.marks.length) return;
  var m = r.marks.pop(); r.p = m[0]; updateRec();
}
/* Al terminar, los toques se acomodan a la cuadrícula del compás y se abre la revisión. */
function finishRec() {
  var st = liveState, r = recState;
  if (r.marks.length < 2) { toast('Marca al menos dos cambios de acorde.'); return; }
  var end = Math.max(recTime(), r.marks[r.marks.length - 1][1] + 0.5);
  clearInterval(r.timer);
  if (yt.player) { try { yt.player.pauseVideo(); } catch (e) { /* nada */ } }
  var guessed = !r.bpm, bpm = r.bpm || C.tlEstimateBpm(r.marks, end, r.beats) || 90;
  var tl = { v: 2, bpm: bpm, beats: r.beats, sig: seqSig(st.steps), steps: C.tlQuantize(r.marks, end, bpm),
             video: r.video ? { id: r.video, start: Math.round(r.start * 100) / 100 } : null };
  if (!r.video) tl.steps.forEach(function (s) { s[2] = null; });
  recState = null;
  openGrid(tl, guessed ? 'Tempo calculado de tus toques: ' + Math.round(bpm) + ' bpm. Confírmalo con «Escuchar»; si no calza, márcalo con el pulso.'
                       : 'Tus toques ya están acomodados a los tiempos. Revisa y guarda.', true);
}
function closeRec() {
  var r = recState; if (!r) return;
  clearInterval(r.timer); recState = null;
  if (!(liveState.mode === 'video' && liveState.tl)) hideVideo();
  drawLive();
}
function onRecTap(e) {
  var r = recState, ch = r.phase === 'rec' ? e.target.closest('#rc-lines [data-i]') : null;
  if (ch) {
    var n = +ch.getAttribute('data-i'), st = liveState;
    for (var k = 0; k < st.steps.length; k++) if (st.steps[k].n === n) { recMark(k); return; }
    return;
  }
  var sig = e.target.closest('[data-rcsig]');
  if (sig) { r.beats = +sig.getAttribute('data-rcsig'); Array.prototype.forEach.call(sig.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === sig)); }); return; }
  var b = e.target.closest('[data-rc]'); if (!b || b.disabled) return;
  switch (b.getAttribute('data-rc')) {
    case 'close':
      if (r.marks.length && r.phase !== 'setup') confirmSheet('Salir sin guardar', 'Se pierden los cambios que marcaste.', 'Salir', closeRec, true); else closeRec();
      break;
    case 'load':
      var u = lid('rc-url').value, id = C.ytId(u);
      if (!id) { toast('Ese enlace no es de un video de YouTube.'); break; }
      r.video = id; if (C.ytStart(u)) r.start = C.ytStart(u);
      if (lid('rc-bpm')) r.bpm = lid('rc-bpm').value.trim() ? +lid('rc-bpm').value : '';
      showVideo(id, r.start).catch(videoFailed); drawRec();
      break;
    case 'markstart':
      if (yt.player && yt.player.getCurrentTime) { r.start = Math.max(0, yt.player.getCurrentTime()); lid('rc-start').value = C.fmtClock(r.start); toast('La canción empieza en ' + C.fmtClock(r.start) + '.'); }
      break;
    case 'tap': openTapTempo(function (bpm) { r.bpm = bpm; var f = lid('rc-bpm'); if (f) f.value = bpm; }); break;
    case 'listen': openTempoListen(function (bpm) { r.bpm = bpm; var f = lid('rc-bpm'); if (f) f.value = bpm; }); break;
    case 'suggest': recState = null; openSuggest(); break;
    case 'begin': startRec(); break;
    case 'mark': recMark(r.p); break;
    case 'undo': recUndo(); break;
    case 'finish': finishRec(); break;
    case 'again': clearInterval(r.timer); r.marks = []; r.p = 0; r.phase = 'setup'; if (yt.player) { try { yt.player.pauseVideo(); } catch (x) { /* nada */ } } drawRec(); break;
  }
}
/* Teclado o pedal mientras se graba: espacio, Enter o → marcan el cambio; borrar deshace. */
function recKey(k) {
  var r = recState;
  if (r.phase === 'rec') {
    if (k === ' ' || k === 'Enter' || k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') { recMark(r.p); return true; }
    if (k === 'Backspace' || k === 'ArrowLeft' || k === 'PageUp') { recUndo(); return true; }
  }
  if (k === 'Escape') { closeRec(); return true; }
  return false;
}

function setVideoVolume(v, quiet) {
  v = Math.max(0, Math.min(100, Math.round(v)));
  if (!quiet) LS.set('cfp.videoVol', v);
  if (yt.player && typeof yt.player.setVolume === 'function') { try { yt.player.setVolume(v); } catch (e) { /* nada */ } }
}

/* parte 8: modo «escuchando» (director)
   Oye a la banda (micrófono o interfaz con la guitarra) y decide si ya suena el acorde siguiente del recorrido.
   Oído 3 (oct 2026): mira tecla por tecla (C.listenCreate, el mismo oído del alumno, con la afinación del piano y sin
   roces ni golpes) y ESPERA: el tiempo del recorrido solo corre si lo que suena es el acorde actual o uno de los que
   pueden venir. Una tecla equivocada, otro acorde, ruido o gente hablando: la canción no avanza (antes avanzaba sola).
   Si la banda se queda más tiempo en un acorde, también espera. El tempo se sigue ajustando a la banda. */
var ear = null, EAR_INPUT = 'cfp.earInput', OIDO_TUNE = 'cfp.oidoAfina';
function earConstraints(id) {
  var a = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
  if (id) a.deviceId = { exact: id };
  return { audio: a };
}
function earGetStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('Este navegador no permite usar el micrófono.'));
  var id = LS.get(EAR_INPUT, '');
  return navigator.mediaDevices.getUserMedia(earConstraints(id)).catch(function (e) {
    if (id && e && (e.name === 'OverconstrainedError' || e.name === 'NotFoundError')) {
      LS.set(EAR_INPUT, ''); toast('La entrada elegida no está conectada; uso la del equipo.', 4000);
      return navigator.mediaDevices.getUserMedia(earConstraints(''));
    }
    throw e;
  });
}
/* Analizador compartido por «escuchar» y «aprender»: así ambos miden igual. */
function earNode(ms, own) {
  var ac = audio(); if (!ac) return null;
  var src = ac.createMediaStreamSource(ms), an = ac.createAnalyser();
  an.fftSize = 8192; an.smoothingTimeConstant = 0; src.connect(an);
  var bins = an.frequencyBinCount, hz = ac.sampleRate / an.fftSize, map = [];
  for (var k = 1; k < bins; k++) {
    var f = k * hz; if (f < 100 || f > 2600) continue;              // debajo de 100 Hz: bombo y ruido
    var midi = 69 + 12 * Math.log(f / 440) / Math.LN2, r = Math.round(midi), w = 1 - Math.min(1, Math.abs(midi - r) * 2);
    if (w > 0) map.push([k, C.mod12(r), w]);
  }
  return { ms: ms, own: own, src: src, an: an, buf: new Float32Array(bins), map: map, prev: new Float32Array(map.length) };
}
function earRelease(E) {
  if (!E) return;
  try { E.src.disconnect(); } catch (e) { /* nada */ }
  if (E.own) E.ms.getTracks().forEach(function (t) { t.stop(); });
}
/* Posiciones donde empieza una línea de la letra: allí la banda suele repetir o saltar a otra parte. */
function earParts(st) {
  var out = [];
  st.path.forEach(function (k, q) { if (!q || st.steps[k].li !== st.steps[st.path[q - 1]].li) out.push(q); });
  return out;
}
function earFollower(st) {
  var tl = !!st.startB, beats = st.path.map(function (k, q) { return tl ? stepBeats(q) : 4; });
  return C.followerCreate({ tpls: st.path.map(function (k, q) { return C.chordTemplate(st.vo[q].en); }), beats: beats, bpm: tl ? (st.bpm || st.tl.bpm) : 90,
    dt: 0.05, parts: earParts(st), i0: st.i, loose: !tl });
}
/* la afinación del piano que midió el oído: se recuerda en este equipo (así acierta desde la primera nota) */
function earTune() { var t = +LS.get(OIDO_TUNE, 0); return t >= -50 && t <= 50 ? t : 0; }
function earSaveTune(o, now) {
  if (!o || !o.tuneInfo || now - (o.tuneSaved || 0) < 5000) return;
  o.tuneSaved = now;
  var g = o.tuneInfo(); if (g && g.r >= 0.5 && g.w >= 60 && Math.round(g.t) !== earTune()) LS.set(OIDO_TUNE, Math.round(g.t));
}
function startEar(stream) {
  if (ear) return;
  var st = liveState; if (!st) return;
  (stream ? Promise.resolve(stream) : earGetStream()).then(function (ms) {
    if (!liveState) { if (!stream) ms.getTracks().forEach(function (t) { t.stop(); }); return; }
    var E = earNode(ms, !stream); if (!E) throw new Error('Sin audio en este equipo.');
    E.lastMeter = 0; E.quietFor = 0; E.since = performance.now();
    E.lis = C.listenCreate({ sr: AC.sampleRate, nfft: E.an.fftSize, tune: earTune() });
    E.pcs = st.vo.map(function (x) { return C.chordPcs(x.en); });
    ear = E; E.fol = earFollower(st); E.bpm = st.tl ? (st.bpm || st.tl.bpm) : 0;
    ear.timer = setInterval(earFrame, 50);
    if (st.startB) { st.beat0 = st.startB[st.i]; st.t0 = performance.now(); st.bpm = E.bpm; }
    drawLive();
  }).catch(function (e) {
    toast('No se pudo usar el micrófono. ' + (e && e.name === 'NotAllowedError' ? 'Da permiso al micrófono en el navegador.' : (e && e.message ? e.message : '')), 5500);
  });
}
function stopEar() { if (!ear) return; clearInterval(ear.timer); earRelease(ear); ear = null; if (liveState) liveState.earHold = false; }
/* Cada 50 ms: qué teclas suenan -> cuánto se parece cada acorde del recorrido -> el seguidor decide.
   El seguidor sabe cuánto dura cada acorde y se da cuenta si la banda se adelanta, se atrasa, se salta acordes o
   repite una parte; pero si lo que suena no es el acorde actual ni uno de los que pueden venir, espera. */
function earFrame() {
  var st = liveState;
  if (!ear || !st || st.mode !== 'listen' || recState || gridState || sugState) return;
  var now = performance.now(), f = ear.lis.frame(oidoRead(ear, ear.lis.kmax));
  var lv = lid('lv-lvl'); if (lv) lv.style.width = Math.max(0, Math.min(100, (f.peak + 90) * 1.6)).toFixed(0) + '%';
  // silencio: muy bajo, o mucho más bajo que como venía sonando la banda (sirve con cualquier volumen de entrada)
  var quiet = f.peak < -72 || (f.lvl != null && f.peak < f.lvl - 26);
  ear.quietFor = quiet ? ear.quietFor + 1 : 0;
  var tonal = f.tonal && !quiet;
  var r = ear.fol.step({ silent: ear.quietFor >= 3, tonal: tonal, onset: f.onset && !quiet,
    scores: tonal ? ear.pcs.map(function (c) { return C.chordScoreKeys(f.all, c); }) : [] });
  if (r.why !== ear.lastWhy) { ear.lastWhy = r.why; tapLog('escucha', { why: r.why, i: r.i }); }
  tapClipShow();
  if (r.changed && r.i !== st.i) {
    tapLog('avanza', { de: st.i, a: r.i, acorde: st.vo[r.i] && st.vo[r.i].en });
    if (window.__earLog) window.__earLog.push([r.i, now]);
    ear.since = now; setLiveIndex(r.i, true);
  }
  if (window.__earWhy) window.__earWhy.push([r.why, r.i, now]);
  ear.bpm = r.bpm;
  // mientras espera, el rodillo también se queda quieto
  st.earHold = r.why !== 'actual' && r.why !== 'siguiente';
  if (st.startB) { st.beat0 = st.startB[st.i] + Math.max(0, r.beat); st.t0 = now; st.bpm = r.bpm; }
  earMeter(r, f);
  earSaveTune(ear.lis, now);
}
/* Tocar un acorde de la letra (o el pedal) le dice al seguidor dónde están. */
function earJump(i) { if (ear && ear.fol) ear.fol.jump(i); }
function earChordName(q) {
  var st = liveState; return q >= 0 && st && st.vo[q] ? C.transposeTok(st.vo[q].en, { shift: 0, keep: true, notation: prefs.notation }) : '';
}
function earHeard(f) {
  var ps = []; for (var p = 0; p < 12; p++) if (f.pcs[p] >= 0.45) ps.push(p);
  ps.sort(function (a, b) { return f.pcs[b] - f.pcs[a]; });
  return ps.slice(0, 4).map(function (p) { return C.noteName(p, liveState && liveState.spell === 'flat' ? 'flat' : 'sharp', prefs.notation); }).join(', ');
}
function earMeter(r, f) {
  var el = lid('lv-meter'), now = performance.now(), st = liveState;
  micDotState(r.why === 'actual' || r.why === 'siguiente' ? 'ok' : r.why === 'silencio' ? 'on' : 'wait');
  if (!el || now - ear.lastMeter < 180) return;
  ear.lastMeter = now;
  var tempo = ear.bpm && st && st.startB ? ' · ' + Math.round(ear.bpm) + ' bpm' : '', cur = earChordName(st.i);
  var nxt = st.i + 1 < st.vo.length ? earChordName(st.i + 1) : '';
  if (r.why === 'silencio') { el.textContent = 'Escuchando… silencio: la canción espera' + tempo; return; }
  if (r.why === 'ruido') { el.textContent = 'Escuchando… no oigo notas claras: espero' + tempo; return; }
  if (r.why === 'otro') {
    var h = earHeard(f);
    el.innerHTML = (h ? 'Oigo <b>' + esc(h) + '</b>: ' : 'Oigo otra cosa: ') + 'no es ' + esc(cur) + (nxt ? ' ni ' + esc(nxt) : '') + '. <b>Espero.</b>';
    return;
  }
  el.innerHTML = 'Siguiendo a la banda: suena <b>' + esc(r.why === 'siguiente' && r.nextI >= 0 ? earChordName(r.nextI) : cur) + '</b>' + esc(tempo);
}
/* ---------- entrada de audio: micrófono del equipo o la interfaz con la guitarra ---------- */
function openEarInputs() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) { toast('Este navegador no permite elegir la entrada.'); return; }
  navigator.mediaDevices.enumerateDevices().then(function (ds) {
    var ins = ds.filter(function (d) { return d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'; }), cur = LS.get(EAR_INPUT, '');
    var h = '<p class="help">Elige por dónde entra el sonido. Con la guitarra conectada a una interfaz de audio (en la laptop, con Chrome), la señal llega limpia: sin voces, bombo ni eco, y el reconocimiento mejora mucho.</p><div class="menu">' +
      '<button type="button" data-in="" aria-pressed="' + !cur + '"><span>Entrada del equipo (predeterminada)</span></button>' +
      ins.map(function (d, k) { return '<button type="button" data-in="' + esc(d.deviceId) + '" aria-pressed="' + (d.deviceId === cur) + '"><span>' + esc(d.label || 'Entrada ' + (k + 1)) + '</span></button>'; }).join('') + '</div>' +
      (ins.some(function (d) { return !d.label; }) ? '<p class="help">Para ver los nombres de las entradas, primero toca «Escuchar» una vez y da permiso al micrófono.</p>' : '');
    openSheet('Entrada de audio', h, function (el) {
      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-in]'); if (!b) return;
        LS.set(EAR_INPUT, b.getAttribute('data-in')); closeSheet();
        if (ear) { stopEar(); startEar(); }
        toast('Entrada elegida: ' + b.textContent.trim() + '.', 3500);
      });
    });
  }).catch(function () { toast('No se pudieron ver las entradas de audio.'); });
}

/* parte 9: recorrido por compases — revisar y ajustar en una cuadrícula, escuchar con clic y acordes, guardar */
var gridState = null;
function newTimeline() {
  var st = liveState, bpm = +st.song.bpm || info(st.song).bpm || 90;
  return { v: 2, bpm: bpm, beats: 4, sig: seqSig(st.steps), steps: st.steps.map(function (s, k) { return [k, 4, null]; }), video: null };
}
function openGrid(tl, note, fromRec) {
  var st = liveState; if (!st) return;
  pauseLive(); stopEar();
  var t = clone(tl); delete t.converted; t.sig = seqSig(st.steps);
  gridState = { tl: t, sel: 0, undo: [], note: note || '', start: JSON.stringify(t), play: null, fromRec: !!fromRec };
  hideVideo();
  drawGrid();
}
function gridFmt() { var st = liveState; return fmtFor(info(st.song).key, songShift(st.song)); }
function gridChord(k) { var st = liveState; return C.splitTok(gridFmt()(st.steps[gridState.tl.steps[k][0]].c)).core; }
function beatsWord(b) { return (b === 1 ? '1 tiempo' : String(b).replace('.', ',') + ' tiempos') + (b % gridState.tl.beats === 0 ? ' (' + (b / gridState.tl.beats) + (b === gridState.tl.beats ? ' compás)' : ' compases)') : ''); }
function lineText(li) {
  var l = info(liveState.song).lines[li]; if (!l || !l.segs) return '';
  if (l.type === 'instr') return 'Línea de acordes';
  var t = l.segs.map(function (s) { return s.t; }).join('').replace(/\s+/g, ' ').trim();
  return t.length > 42 ? t.slice(0, 40) + '…' : t;
}
function drawGrid() {
  var st = liveState, g = gridState, tl = g.tl, starts = C.tlStarts(tl.steps), total = starts[starts.length - 1];
  lid('live').classList.add('rec');
  lid('lv-top').innerHTML = '<button type="button" class="iconbtn" data-g="close" aria-label="Salir de los compases">' + icon('close') + '</button>' +
    '<h2>Compases: ' + esc(C.sentenceCase(st.song.title)) + '</h2>' +
    '<button type="button" class="btn g-play' + (g.play ? ' on' : '') + '" data-g="play">' + (g.play ? icon('pause') + 'Detener' : icon('play') + 'Escuchar') + '</button>';
  var bars = Math.ceil(total / tl.beats), rows = '';
  for (var b = 0; b < bars; b++) {
    var a0 = b * tl.beats, a1 = a0 + tl.beats, segs = '';
    for (var k = 0; k < tl.steps.length; k++) {
      var s0 = starts[k], s1 = starts[k + 1], o0 = Math.max(a0, s0), o1 = Math.min(a1, s1);
      if (o1 <= o0) continue;
      var dz = g.doubt && g.doubt.indexOf(k) >= 0;
      segs += '<button type="button" class="gb' + (k === g.sel ? ' sel' : '') + (o0 > s0 ? ' cont' : '') + (dz ? ' doubt' : '') + '" data-gk="' + k + '" style="flex:' + (o1 - o0) + ' 1 0;--d:' + (o1 - o0) + '"' +
        ' aria-label="' + esc(gridChord(k)) + ', ' + beatsWord(tl.steps[k][1]) + (dz ? ', dudoso' : '') + '">' + (o0 === s0 ? esc(gridChord(k)) + (dz ? '<i>?</i>' : '') : '') + '</button>';
    }
    if (a1 > total) segs += '<span class="gb empty" style="flex:' + (a1 - total) + ' 1 0;--d:' + (a1 - total) + '"></span>';
    rows += '<div class="gbar"><span class="gnum">' + (b + 1) + '</span><div class="grow">' + segs + '</div></div>';
  }
  lid('lv-main').innerHTML =
    '<div class="g-head">' + (g.note ? '<p class="g-note">' + esc(g.note) + '</p>' : '') +
      '<div class="g-tempo"><span class="lbl-s">Tempo</span><button type="button" class="btn" data-g="bpm-" aria-label="Más lento">−</button><output>' + Math.round(tl.bpm) + '</output><span>bpm</span>' +
        '<button type="button" class="btn" data-g="bpm+" aria-label="Más rápido">+</button><button type="button" class="btn" data-g="tap">Marcar el pulso</button>' +
        '<button type="button" class="btn" data-g="listen">' + icon('mic') + 'Detectar</button></div>' +
      '<div class="g-sig"><span class="lbl-s">Compás</span><div class="seg">' + sigButtons(tl.beats, 'data-gsig') + '</div></div>' +
      '<p class="help">' + bars + (bars === 1 ? ' compás' : ' compases') + ', ' + C.fmtClock(total * 60 / tl.bpm) + ' aprox. Cada fila es un compás. Toca un acorde y cambia cuánto dura con los botones de abajo; «Escuchar» lo toca con clic para comprobarlo.</p></div>' +
    '<div class="g-grid" id="g-grid">' + rows + '</div>';
  var sel = tl.steps[g.sel];
  lid('lv-nav').innerHTML =
    '<div class="g-selinfo"><b>' + esc(gridChord(g.sel)) + '</b><span>' + beatsWord(sel[1]) + '</span><span class="g-line">' + esc(lineText(st.steps[sel[0]].li)) + '</span></div>' +
    '<div class="g-ctl"><button type="button" class="btn" data-g="prev" aria-label="Acorde anterior"' + (g.sel ? '' : ' disabled') + '>' + icon('back') + '</button>' +
      '<button type="button" class="btn" data-g="m1" aria-label="Un tiempo menos">−1</button><button type="button" class="btn" data-g="mh" aria-label="Medio tiempo menos">−½</button>' +
      '<button type="button" class="btn" data-g="ph" aria-label="Medio tiempo más">+½</button><button type="button" class="btn" data-g="p1" aria-label="Un tiempo más">+1</button>' +
      '<button type="button" class="btn" data-g="next" aria-label="Acorde siguiente"' + (g.sel < tl.steps.length - 1 ? '' : ' disabled') + '>' + icon('fwd') + '</button></div>' +
    '<div class="lv-row"><button type="button" class="btn" data-g="more">' + icon('more') + 'Más</button><button type="button" class="btn primary" data-g="save">Guardar</button></div>';
  var se = lid('g-grid').querySelector('.gb.sel');
  if (se) { var r = se.getBoundingClientRect(), m = lid('lv-main').getBoundingClientRect(); if (r.top < m.top + 4 || r.bottom > m.bottom - 4) lid('lv-main').scrollTop += r.top - m.top - m.height / 2; }
}
function gPush() { var g = gridState; g.undo.push(JSON.stringify(g.tl)); if (g.undo.length > 120) g.undo.shift(); }
function gDur(d) {
  var g = gridState, s = g.tl.steps[g.sel], v = s[1] + d;
  if (v < 0.5 || v > 64) return;
  gPush(); s[1] = v; if (g.doubt) g.doubt = g.doubt.filter(function (x) { return x !== g.sel; }); if (g.play) { gridStop(); } drawGrid();
}
function gridMore() {
  var g = gridState;
  menuSheet('Recorrido', [
    { id: 'undo', icon: 'back', label: 'Deshacer', disabled: !g.undo.length, run: function () { g.tl = JSON.parse(g.undo.pop()); g.sel = Math.min(g.sel, g.tl.steps.length - 1); drawGrid(); } },
    { id: 'ins', icon: 'add', label: 'Insertar un acorde después de ' + gridChord(g.sel), sub: 'por ejemplo, una parte que se repite', run: gridInsert },
    { id: 'del', icon: 'trash', label: 'Quitar ' + gridChord(g.sel) + ' del recorrido', disabled: g.tl.steps.length < 2, run: function () { gPush(); g.tl.steps.splice(g.sel, 1); if (g.doubt) g.doubt = g.doubt.filter(function (x) { return x !== g.sel; }).map(function (x) { return x > g.sel ? x - 1 : x; }); g.sel = Math.min(g.sel, g.tl.steps.length - 1); drawGrid(); } },
    { id: 'bar', icon: 'list', label: 'Poner cada acorde en un compás', sub: 'y ajustar después', run: function () { gPush(); g.tl.steps.forEach(function (s) { s[1] = g.tl.beats; }); drawGrid(); } },
    { id: 'sug', icon: 'mic', label: 'Sugerir escuchando la canción (en prueba)', run: function () { gridStop(); gridState = null; openSuggest(); } },
    { id: 'rec', icon: 'rec', label: 'Grabar de nuevo', run: function () { gridStop(); gridState = null; openRecorder(); } }
  ]);
}
function gridInsert() {
  var g = gridState, st = liveState, fmt = gridFmt(), h = '';
  st.steps.forEach(function (s, k) { h += '<button type="button" data-ins="' + k + '"><b>' + esc(C.splitTok(fmt(s.c)).core) + '</b><span>' + esc(lineText(s.li)) + '</span></button>'; });
  openSheet('Insertar después de ' + gridChord(g.sel), '<p class="help">Elige el acorde que suena a continuación. Entra con un compás; luego ajustas cuánto dura.</p><div class="g-ins">' + h + '</div>', function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-ins]'); if (!b) return;
      gPush(); g.tl.steps.splice(g.sel + 1, 0, [+b.getAttribute('data-ins'), g.tl.beats, null]); if (g.doubt) g.doubt = g.doubt.map(function (x) { return x > g.sel ? x + 1 : x; }); g.sel++;
      closeSheet(); drawGrid();
    });
  });
}
function gridSave() {
  var st = liveState, g = gridState, song = clone(st.song), tl = g.tl;
  gridStop();
  song.timeline = { v: 2, bpm: Math.round(tl.bpm * 10) / 10, beats: tl.beats, sig: seqSig(st.steps),
    steps: tl.steps.map(function (s) { return [s[0], s[1], typeof s[2] === 'number' ? s[2] : null]; }), video: tl.video || null, rec: new Date().toISOString() };
  local.songs[song.id] = cleanSong(song); saveLocal(); delete infoCache[song.id];
  setView(song, { bpm: null });
  current.song = getSong(song.id);
  var mode = tl.video && (st.mode === 'video' || g.fromRec) ? 'video' : 'auto', pushed = st.pushed;   // recién grabado con video: se comprueba con el video
  gridState = null; LS.set('cfp.liveMode', mode);
  liveState = buildLive(current.song, pushed, mode);
  if (mode === 'video') showVideo(tl.video.id, tl.video.start).catch(videoFailed); else hideVideo();
  drawLive();
  var bars = Math.ceil(C.tlStarts(tl.steps)[tl.steps.length] / tl.beats);
  toast('Recorrido guardado: ' + bars + ' compases a ' + Math.round(tl.bpm) + ' bpm.' + (isGroup() ? ' Publica los cambios para que el grupo lo tenga.' : ''), 5000);
}
function gridClose() {
  var g = gridState;
  var go = function () { gridStop(); gridState = null; var st = liveState; if (st.mode === 'video' && st.tl) showVideo(st.tl.video.id, st.tl.video.start).catch(videoFailed); drawLive(); };
  if (JSON.stringify(g.tl) !== g.start) confirmSheet('Salir sin guardar', 'Se pierden los cambios del recorrido.', 'Salir', go, true); else go();
}

/* ---------- escuchar: clic con acento en el tiempo 1 y los acordes en su lugar (reloj de audio) ---------- */
function chordAt(when, notes, len) {
  var ac = AC; if (!ac) return;
  var out = ac.createGain(); out.gain.value = 0.16; out.connect(audioOut() || ac.destination);
  notes.forEach(function (m, q) {
    var f = 440 * Math.pow(2, (m - 69) / 12), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(q === 0 ? 0.9 : 0.55, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.3, len));
    o.connect(g); g.connect(out); o.start(when); o.stop(when + Math.max(0.3, len) + 0.05);
  });
}
function gridPlay() {
  var g = gridState, st = liveState, ac = audio();
  if (!ac) { toast('Este equipo no puede reproducir sonido.'); return; }
  var tl = g.tl, starts = C.tlStarts(tl.steps), sh = songShift(st.song), inf = info(st.song), spell = spellFor(inf.key, sh), keep = C.mod12(sh) === 0 && prefs.spell === 'auto', prev = null;
  var vo = tl.steps.map(function (s) { var en = C.splitTok(C.transposeTok(st.steps[s[0]].c, { shift: sh, spell: spell, notation: 'en', keep: keep })).core; var v = C.closeVoicing(en, prev) || C.pianoVoicing(en); prev = v; return v; });
  g.play = { t0: ac.currentTime + 0.15, b0: starts[g.sel], starts: starts, spb: 60 / tl.bpm, nextBeat: Math.ceil(starts[g.sel]), nextStep: g.sel, vo: vo, end: starts[starts.length - 1], timer: 0, marks: [] };
  g.play.timer = setInterval(gridTick, 40);
  gridTick();
}
function gridTick() {
  var g = gridState, p = g && g.play, ac = AC; if (!p || !ac) return;
  var horizon = ac.currentTime + 0.3, at = function (b) { return p.t0 + (b - p.b0) * p.spb; };
  while (p.nextBeat < p.end && at(p.nextBeat) < horizon) { clickAt(at(p.nextBeat), p.nextBeat % g.tl.beats === 0); p.nextBeat++; }
  while (p.nextStep < g.tl.steps.length && at(p.starts[p.nextStep]) < horizon) {
    var k = p.nextStep, when = at(p.starts[k]), v = p.vo[k];
    chordAt(when, [v.left].concat(v.right), Math.min(2.4, (p.starts[k + 1] - p.starts[k]) * p.spb));
    p.marks.push(setTimeout(gridMark.bind(null, k), Math.max(0, (when - ac.currentTime) * 1000)));
    p.nextStep++;
  }
  if (p.nextStep >= g.tl.steps.length && ac.currentTime > at(p.end)) { gridStop(); drawGrid(); }
}
function gridMark(k) {
  var box = lid('g-grid'); if (!box || !gridState || !gridState.play) return;
  Array.prototype.forEach.call(box.querySelectorAll('.gb.play'), function (x) { x.classList.remove('play'); });
  var first = null;
  Array.prototype.forEach.call(box.querySelectorAll('[data-gk="' + k + '"]'), function (x) { x.classList.add('play'); if (!first) first = x; });
  if (first) { var r = first.getBoundingClientRect(), m = lid('lv-main').getBoundingClientRect(); if (r.bottom > m.bottom - 8 || r.top < m.top + 4) lid('lv-main').scrollTop += r.top - m.top - m.height / 3; }
}
function gridStop() {
  var g = gridState; if (!g || !g.play) return;
  clearInterval(g.play.timer); g.play.marks.forEach(clearTimeout); g.play = null;
  var box = lid('g-grid'); if (box) Array.prototype.forEach.call(box.querySelectorAll('.gb.play'), function (x) { x.classList.remove('play'); });
}
function onGridTap(e) {
  var g = gridState;
  var seg = e.target.closest('[data-gk]');
  if (seg) { g.sel = +seg.getAttribute('data-gk'); var was = !!g.play; gridStop(); drawGrid(); if (was) { gridPlay(); drawGrid(); } return; }
  var sig = e.target.closest('[data-gsig]');
  if (sig) { gPush(); g.tl.beats = +sig.getAttribute('data-gsig'); gridStop(); drawGrid(); return; }
  var b = e.target.closest('[data-g]'); if (!b || b.disabled) return;
  switch (b.getAttribute('data-g')) {
    case 'close': gridClose(); break;
    case 'play': if (g.play) gridStop(); else gridPlay(); drawGrid(); break;
    case 'bpm-': gPush(); g.tl.bpm = Math.max(30, Math.round(g.tl.bpm) - 1); gridStop(); drawGrid(); break;
    case 'bpm+': gPush(); g.tl.bpm = Math.min(240, Math.round(g.tl.bpm) + 1); gridStop(); drawGrid(); break;
    case 'tap': openTapTempo(function (bpm) { gPush(); g.tl.bpm = bpm; g.note = ''; gridStop(); drawGrid(); }); break;
    case 'listen': gridStop(); openTempoListen(function (bpm) { gPush(); g.tl.bpm = bpm; g.note = ''; drawGrid(); toast('Tempo: ' + bpm + ' bpm. Compruébalo con «Escuchar».'); }); break;
    case 'm1': gDur(-1); break;
    case 'mh': gDur(-0.5); break;
    case 'ph': gDur(0.5); break;
    case 'p1': gDur(1); break;
    case 'prev': g.sel = Math.max(0, g.sel - 1); drawGrid(); break;
    case 'next': g.sel = Math.min(g.tl.steps.length - 1, g.sel + 1); drawGrid(); break;
    case 'more': gridMore(); break;
    case 'save': gridSave(); break;
  }
}
function gridKey(k) {
  var g = gridState;
  if (k === 'ArrowLeft') { g.sel = Math.max(0, g.sel - 1); drawGrid(); return true; }
  if (k === 'ArrowRight') { g.sel = Math.min(g.tl.steps.length - 1, g.sel + 1); drawGrid(); return true; }
  if (k === '+' || k === 'ArrowUp') { gDur(1); return true; }
  if (k === '-' || k === 'ArrowDown') { gDur(-1); return true; }
  if (k === ' ') { if (g.play) gridStop(); else gridPlay(); drawGrid(); return true; }
  if (k === 'Escape') { gridClose(); return true; }
  return false;
}

/* parte 10: escuchar el tempo con el micrófono y comprobarlo con un clic sobre la música */
var tempoL = null;
var TEMPO_SECS = 12;
function stopTempoListen() {
  var t = tempoL; if (!t) return;
  clearInterval(t.clickTimer); t.clickTimer = 0; t.clickOn = false;
  if (t.node) { try { t.node.disconnect(); t.node.onaudioprocess = null; } catch (e) { /* nada */ } t.node = null; }
  if (t.src) { try { t.src.disconnect(); } catch (e) { /* nada */ } t.src = null; }
  if (t.stream) { t.stream.getTracks().forEach(function (k) { k.stop(); }); t.stream = null; }
}
function openTempoListen(onUse) {
  stopTempoListen();
  tempoL = { phase: 'ready', stream: null, src: null, node: null, chunks: [], len: 0, sr: 0, firstAC: null, level: 0, res: null, pick: null, clickOn: false, clickTimer: 0 };
  openSheet('Detectar el tempo', '<div id="tlb"></div>', function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tl]'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-tl');
      if (a === 'start' || a === 'again') tlStart();
      else if (a === 'cancel') { stopTempoListen(); tempoL.phase = 'ready'; tlDraw(); }
      else if (a === 'pick') { tempoL.pick = +b.getAttribute('data-v'); if (tempoL.clickOn) tlClick(true); tlDraw(); }
      else if (a === 'click') { tlClick(!tempoL.clickOn); tlDraw(); }
      else if (a === 'use') { var v = tempoL.pick; stopTempoListen(); closeSheet(); onUse(v); }
    });
    tlDraw();
  }, { onClose: stopTempoListen });
}
function tlDraw() {
  var t = tempoL, box = document.getElementById('tlb'); if (!t || !box) return;
  var h = '';
  if (t.phase === 'ready') {
    h = '<p class="help">Pon a sonar la canción: el video en otro equipo (laptop, televisor o parlante) o la banda tocando. Deja el celular cerca y toca «Empezar». Escucho ' + TEMPO_SECS + ' segundos.</p>' +
      '<p class="help">Si el video suena en este mismo celular, puede que el micrófono no lo oiga bien; es mejor en otro equipo.</p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-tl="start">' + icon('mic') + 'Empezar a escuchar</button></div>';
  } else if (t.phase === 'listen') {
    var secs = t.sr ? Math.min(TEMPO_SECS, t.len / t.sr) : 0;
    h = '<p class="tl-big">Escuchando… <span id="tl-s">' + Math.ceil(TEMPO_SECS - secs) + '</span> s</p>' +
      '<div class="tl-meter"><i id="tl-lv"></i></div><p class="help" id="tl-hint">Nivel de sonido: si la barra casi no se mueve, acerca el celular a la música.</p>' +
      '<div class="btnrow"><button type="button" class="btn" data-tl="cancel">Cancelar</button></div>';
  } else if (t.phase === 'quiet') {
    h = '<p class="tl-warn">Casi no se escuchó música. Acerca el celular o sube el volumen y vuelve a intentarlo.</p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-tl="again">Escuchar de nuevo</button></div>';
  } else {
    var r = t.res, low = r.confidence < 9;
    h = '<p class="tl-res"><b>' + t.pick + '</b> bpm</p>' +
      (low ? '<p class="tl-warn">No encontré un pulso claro (poca música o mucho ruido). Compruébalo con el clic, o marca el pulso tocando.</p>' : '') +
      '<p class="help">A veces se detecta la mitad o el doble del tempo. Elige el que calce con la música:</p>' +
      '<div class="seg tl-alt">' + r.candidates.map(function (c) { return '<button type="button" data-tl="pick" data-v="' + c + '" aria-pressed="' + (c === t.pick) + '">' + c + '</button>'; }).join('') + '</div>' +
      '<p class="help">Con la música sonando, toca «Comprobar»: el clic debe caer justo con el pulso y no irse adelantando ni atrasando.</p>' +
      '<div class="btnrow"><button type="button" class="btn' + (t.clickOn ? ' on' : '') + '" data-tl="click">' + icon('metro') + (t.clickOn ? 'Detener el clic' : 'Comprobar con clic') + '</button>' +
      '<button type="button" class="btn primary" data-tl="use">Usar ' + t.pick + ' bpm</button></div>' +
      '<div class="btnrow"><button type="button" class="btn" data-tl="again">Escuchar de nuevo</button></div>';
  }
  box.innerHTML = h;
}
function tlStart() {
  var t = tempoL; stopTempoListen();
  var ac = audio();
  if (!ac || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Este navegador no permite usar el micrófono. Marca el pulso tocando.', 5000); return; }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (ms) {
    if (!tempoL) { ms.getTracks().forEach(function (k) { k.stop(); }); return; }
    t.stream = ms; t.src = ac.createMediaStreamSource(ms);
    t.node = ac.createScriptProcessor(4096, 1, 1);
    var mute = ac.createGain(); mute.gain.value = 0;
    t.src.connect(t.node); t.node.connect(mute); mute.connect(ac.destination);
    t.sr = ac.sampleRate; t.chunks = []; t.len = 0; t.firstAC = null; t.phase = 'listen'; tlDraw();
    var inLat = 0; try { inLat = (ms.getAudioTracks()[0].getSettings().latency) || 0; } catch (e) { /* no se sabe */ }
    t.node.onaudioprocess = function (ev) {
      if (!tempoL || tempoL.phase !== 'listen') return;
      var d = ev.inputBuffer.getChannelData(0), rms = 0;
      if (t.firstAC === null) t.firstAC = ac.currentTime - d.length / t.sr - inLat;   // hora (reloj de audio) del primer sonido grabado
      t.chunks.push(new Float32Array(d)); t.len += d.length;
      for (var i = 0; i < d.length; i += 4) rms += d[i] * d[i];
      rms = Math.sqrt(rms / (d.length / 4)); t.level = Math.max(t.level * 0.8, rms);
      var lv = document.getElementById('tl-lv'); if (lv) lv.style.width = Math.min(100, Math.round(Math.sqrt(rms) * 250)) + '%';
      var sEl = document.getElementById('tl-s'); if (sEl) sEl.textContent = Math.max(0, Math.ceil(TEMPO_SECS - t.len / t.sr));
      if (t.len >= t.sr * TEMPO_SECS) tlAnalyze();
    };
  }).catch(function (e) {
    toast('No se pudo usar el micrófono. ' + (e && e.name === 'NotAllowedError' ? 'Da permiso al micrófono en el navegador.' : 'Marca el pulso tocando.'), 5500);
  });
}
function tlAnalyze() {
  var t = tempoL, x = new Float32Array(t.len), o = 0;
  t.chunks.forEach(function (c) { x.set(c, o); o += c.length; });
  var firstAC = t.firstAC; stopTempoListen(); t.firstAC = firstAC; t.chunks = [];
  var rms = 0; for (var i = 0; i < x.length; i += 8) rms += x[i] * x[i]; rms = Math.sqrt(rms / (x.length / 8));
  var r = rms > 0.002 ? C.tempoFromSamples(x, t.sr) : null;
  if (!r) { t.phase = 'quiet'; tlDraw(); return; }
  t.res = r; t.pick = Math.round(r.bpm); t.phase = 'done'; tlDraw();
}
/* Clic de comprobación, alineado con los pulsos detectados (la música sigue sonando). */
function tlClick(on) {
  var t = tempoL, ac = AC; clearInterval(t.clickTimer); t.clickTimer = 0; t.clickOn = !!on && !!ac;
  if (!t.clickOn) return;
  var period = 60 / t.pick, base = t.firstAC + t.res.phase, lat = (ac.outputLatency || 0) + (ac.baseLatency || 0), next = null;
  var tick = function () {
    var now = ac.currentTime;
    if (next === null) next = Math.ceil((now + 0.05 + lat - base) / period);
    while (base + next * period - lat < now + 0.3) { var w = base + next * period - lat; if (w > now) clickAt(w, false); next++; }
  };
  tick(); t.clickTimer = setInterval(tick, 60);
}

/* parte 11: sugerir el recorrido escuchando la canción completa (en prueba) */
var sugState = null;
function sugStop() {
  var g = sugState; if (!g) return;
  clearInterval(g.timer); g.timer = 0;
  if (g.node) { try { g.node.onaudioprocess = null; g.node.disconnect(); } catch (e) { /* nada */ } g.node = null; }
  if (g.src) { try { g.src.disconnect(); } catch (e) { /* nada */ } g.src = null; }
  if (g.stream) { g.stream.getTracks().forEach(function (k) { k.stop(); }); g.stream = null; }
}
/* Pasos del cancionero donde empieza una sección o estrofa: ahí puede volver la canción al repetir. */
function sectionTargets(song, steps) {
  var lines = info(song).lines, out = [0], fresh = true, k = 0;
  lines.forEach(function (l, li) {
    if (l.type === 'label' || l.type === 'blank') { fresh = true; return; }
    while (k < steps.length && steps[k].li < li) k++;
    if (k < steps.length && steps[k].li === li && fresh) { if (out.indexOf(k) < 0) out.push(k); fresh = false; }
  });
  return out;
}
function openSuggest() {
  var st = liveState; if (!st) return;
  pauseLive(); stopEar(); gridStop();
  sugStop();
  sugState = { phase: 'setup', beats: st.tl ? st.tl.beats : 4, bpm: '', fs: null, secs: 0, level: 0, pct: 0 };
  recState = null; gridState = null;
  hideVideo(); drawSug();
}
function drawSug() {
  var st = liveState, g = sugState;
  lid('live').classList.add('rec');
  lid('lv-top').innerHTML = '<button type="button" class="iconbtn" data-sg="close" aria-label="Salir">' + icon('close') + '</button>' +
    '<h2>Sugerir el recorrido: ' + esc(C.sentenceCase(st.song.title)) + '</h2>';
  var main = '', nav = '';
  if (g.phase === 'setup') {
    main = '<div class="rec-setup">' +
      '<p class="help">La app escucha la canción completa y ubica en el tiempo los acordes que ya tiene el cancionero: el tempo, cuánto dura cada acorde y las repeticiones. Sirve con el video sonando en otro equipo, con la banda tocando, o con un archivo de audio o video que ustedes graben. Es una sugerencia: después la revisas en los compases.</p>' +
      '<div class="grid2"><div class="field"><span class="lbl-s">Compás</span><div class="seg">' + sigButtons(g.beats, 'data-sgsig') + '</div></div>' +
      '<div class="field"><label for="sg-bpm">Tempo, si lo sabes (bpm)</label><input id="sg-bpm" inputmode="numeric" value="' + esc(String(g.bpm || '')) + '" placeholder="opcional"></div></div>' +
      '<div class="sg-src"><button type="button" class="btn primary" data-sg="mic">' + icon('mic') + 'Escuchar la canción completa</button>' +
      '<button type="button" class="btn" data-sg="file">' + icon('upload') + 'Abrir un archivo de audio o video</button>' +
      '<input type="file" id="sg-file" accept="audio/*,video/*" hidden></div>' +
      '<p class="help">Con el micrófono: pon la canción desde el principio en otro equipo, deja el celular cerca y toca «Terminar» cuando acabe. En iPhone, grabar y reproducir en el mismo equipo no funciona bien.</p></div>';
    nav = '<div class="lv-row"><button type="button" class="btn" data-sg="close">Cancelar</button></div>';
  } else if (g.phase === 'listen') {
    main = '<div class="rec-setup"><p class="tl-big">Escuchando <span id="sg-t">' + C.fmtClock(g.secs) + '</span></p>' +
      '<div class="tl-meter"><i id="sg-lv"></i></div><p class="help">Deja que suene la canción completa, con sus repeticiones. Toca «Terminar» cuando acabe (máximo 10 minutos).</p></div>';
    nav = '<div class="lv-row"><button type="button" class="btn" data-sg="close">Cancelar</button><button type="button" class="btn primary" data-sg="done">Terminar</button></div>';
  } else {
    main = '<div class="rec-setup"><p class="tl-big">' + (g.phase === 'read' ? 'Leyendo el archivo… <span id="sg-p">' + g.pct + '</span> %' : 'Analizando…') + '</p></div>';
    nav = '';
  }
  lid('lv-main').innerHTML = main; lid('lv-nav').innerHTML = nav;
}
function sugBpm() { var v = +((lid('sg-bpm') || {}).value || ''); return v >= 30 && v <= 240 ? v : null; }
function sugMic() {
  var g = sugState, ac = audio(); g.bpm = sugBpm();
  if (!ac || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Este navegador no permite usar el micrófono. Prueba con un archivo.', 5000); return; }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (ms) {
    if (!sugState) { ms.getTracks().forEach(function (k) { k.stop(); }); return; }
    var D = Math.max(1, Math.round(ac.sampleRate / 11025)), carry = new Float32Array(0), out = new Float32Array(8192);
    g.fs = C.featureStream(ac.sampleRate / D); g.stream = ms; g.src = ac.createMediaStreamSource(ms);
    g.node = ac.createScriptProcessor(4096, 1, 1);
    var mute = ac.createGain(); mute.gain.value = 0; g.src.connect(g.node); g.node.connect(mute); mute.connect(ac.destination);
    g.phase = 'listen'; g.secs = 0; drawSug();
    g.node.onaudioprocess = function (ev) {
      if (!sugState || g.phase !== 'listen') return;
      var d = ev.inputBuffer.getChannelData(0), all = new Float32Array(carry.length + d.length);
      all.set(carry); all.set(d, carry.length);
      var n = Math.floor(all.length / D), rms = 0;
      if (out.length < n) out = new Float32Array(n);
      for (var i = 0; i < n; i++) { var s = 0; for (var j = 0; j < D; j++) s += all[i * D + j]; out[i] = s / D; rms += out[i] * out[i]; }
      carry = all.slice(n * D);
      g.fs.push(out.subarray(0, n));
      g.secs = g.fs.seconds();
      var lv = lid('sg-lv'); if (lv) lv.style.width = Math.min(100, Math.round(Math.sqrt(Math.sqrt(rms / Math.max(1, n))) * 250)) + '%';
      var tt = lid('sg-t'); if (tt) tt.textContent = C.fmtClock(g.secs);
      if (g.secs > 600) sugAnalyze();
    };
  }).catch(function (e) {
    toast('No se pudo usar el micrófono. ' + (e && e.name === 'NotAllowedError' ? 'Da permiso al micrófono en el navegador.' : 'Prueba con un archivo.'), 5500);
  });
}
function sugFile(file) {
  var g = sugState; g.bpm = sugBpm(); g.phase = 'read'; g.pct = 0; drawSug();
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  var fail = function () { if (!sugState) return; g.phase = 'setup'; drawSug(); toast('No se pudo leer ese archivo. Prueba con otro formato (mp3, m4a, wav o un video mp4).', 5500); };
  if (!OAC) { fail(); return; }
  var rd = new FileReader();
  rd.onerror = fail;
  rd.onload = function () {
    var oac = new OAC(1, 11025, 11025), done = false;
    var ok = function (buf) {
      if (done || !sugState) return; done = true;
      var sr = buf.sampleRate, n = buf.length, chs = [], c;
      for (c = 0; c < buf.numberOfChannels; c++) chs.push(buf.getChannelData(c));
      g.fs = C.featureStream(sr);
      var pos = 0, step = sr * 20, tmp = new Float32Array(step);
      var next = function () {
        if (!sugState) return;
        var m = Math.min(step, n - pos);
        for (var i = 0; i < m; i++) { var s = 0; for (c = 0; c < chs.length; c++) s += chs[c][pos + i]; tmp[i] = s / chs.length; }
        g.fs.push(tmp.subarray(0, m)); pos += m;
        g.pct = Math.round(100 * pos / n); var pe = lid('sg-p'); if (pe) pe.textContent = g.pct;
        if (pos < n) setTimeout(next, 0); else sugAnalyze();
      };
      next();
    };
    try { var pr = oac.decodeAudioData(rd.result, ok, fail); if (pr && pr.then) pr.then(ok, fail); } catch (e) { fail(); }
  };
  rd.readAsArrayBuffer(file);
}
function sugAnalyze() {
  var g = sugState, st = liveState; if (!g || !g.fs) return;
  sugStop(); g.phase = 'analyze'; drawSug();
  setTimeout(function () {
    if (!sugState) return;
    var feat = g.fs.finish(), res = null;
    try { res = C.suggestTimeline(feat, st.steps.map(function (s) { return C.splitTok(s.c).core; }), sectionTargets(st.song, st.steps), g.beats, g.bpm); } catch (e) { res = null; }
    sugState = null;
    if (!res || res.steps.length < 2) {
      drawLive();
      toast('No pude reconocer la canción en el audio. Revisa que se escuche bien, o graba el recorrido tocando «Cambio».', 6000);
      return;
    }
    var semi = res.shift > 6 ? res.shift - 12 : res.shift, bars = Math.ceil(res.steps.reduce(function (a, s) { return a + s[1]; }, 0) / res.beats);
    var note = 'Sugerido escuchando: ' + bars + ' compases a ' + Math.round(res.bpm) + ' bpm.';
    if (semi) note += ' La grabación suena ' + Math.abs(semi) + (Math.abs(semi) === 1 ? ' semitono' : ' semitonos') + ' más ' + (semi > 0 ? 'arriba' : 'abajo') + ' que el cancionero.';
    if (res.match < 0.6) note += ' El audio se parece poco a esta canción: revisa que sea la correcta.';
    note += res.doubt.length ? ' Los acordes con «?» son dudosos (por ejemplo, el mismo acorde dos veces seguidas): revísalos con «Escuchar».' : ' Revísalo con «Escuchar» antes de guardar.';
    var tl = { v: 2, bpm: res.bpm, beats: res.beats, sig: seqSig(st.steps), steps: res.steps.map(function (s) { return [s[0], s[1], null]; }), video: null };
    openGrid(tl, note);
    gridState.doubt = res.doubt.slice();
    drawGrid();
  }, 30);
}
function onSugTap(e) {
  var g = sugState;
  var sig = e.target.closest('[data-sgsig]');
  if (sig) { g.beats = +sig.getAttribute('data-sgsig'); Array.prototype.forEach.call(sig.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === sig)); }); return; }
  var b = e.target.closest('[data-sg]'); if (!b) return;
  switch (b.getAttribute('data-sg')) {
    case 'close': sugStop(); sugState = null; drawLive(); break;
    case 'mic': sugMic(); break;
    case 'file':
      var inp = lid('sg-file');
      inp.onchange = function () { if (inp.files && inp.files[0]) sugFile(inp.files[0]); };
      inp.click(); break;
    case 'done':
      if (g.secs < 20) { toast('Escucha al menos 20 segundos de la canción.'); break; }
      sugAnalyze(); break;
  }
}

/* parte 12: modo fácil y partes para aprender (acordes, bajo, agudos), tono de práctica, ritmos y práctica con el teclado MIDI */
/* La configuración de toque viene del modo fácil de este equipo o, en el modo alumno, del perfil del alumno. */
function easyOn() { return !!(liveProfile() || (prefs.easy && prefs.easy.on)); }
var PARTS = { acordes: 'Acordes (dos manos)', bajo: 'Bajo (mano izquierda)', agudos: 'Agudos (mano derecha)' };
var RHYTHMS = {
  sost: 'Dejar sonar', golpe: 'Un golpe por acorde', tiempo: 'En cada tiempo', bajoac: 'Bajo-acorde (izquierda 1 y 3, derecha 2 y 4)',
  mach: 'Machacado de rock and roll', unotres: 'En 1 y 3', doscuatro: 'En 2 y 4 (contratiempo)', quintas: 'Quintas (1-5-1-5)', boogie: 'Rock and roll (1-5-6-5)'
};
var PART_RHYTHMS = { acordes: ['sost', 'golpe', 'tiempo', 'bajoac', 'mach'], bajo: ['sost', 'golpe', 'tiempo', 'unotres', 'quintas', 'boogie'], agudos: ['sost', 'golpe', 'tiempo', 'doscuatro', 'mach'] };
var HOMES = [[0, 'Do'], [7, 'Sol'], [5, 'Fa'], [2, 'Re'], [9, 'La'], [-1, 'El de la banda']];
/* Completa una configuración con los valores por omisión de su parte. */
function cfgNorm(e) {
  e = e || {};
  var part = PARTS[e.part] ? e.part : (e.level === 'super' ? 'agudos' : 'acordes');
  var home = e.home != null ? +e.home : (e.doKey === false ? -1 : 0);
  var rh = PART_RHYTHMS[part].indexOf(e.rhythm) >= 0 ? e.rhythm : (e.level === 'super' || !e.rhythm ? 'sost' : 'tiempo');
  var notes = part === 'acordes' ? 3 : part === 'bajo' ? (+e.notes === 2 ? 2 : 1) : (+e.notes === 3 ? 3 : +e.notes === 2 ? 2 : 1);
  var oct = +e.oct || (part === 'bajo' ? 36 : part === 'agudos' ? (e.level === 'super' ? 60 : 72) : 60);
  return { on: e.on !== false, part: part, level: part === 'agudos' ? 'super' : 'easy', home: home, notes: notes, rhythm: rh, oct: oct,
    hands: part === 'acordes' ? (e.hands === 'right' || e.hands === 'left' ? e.hands : 'both') : (part === 'bajo' ? 'left' : 'right'),
    shape: e.shape === 'root' ? 'root' : 'octave', nums: e.nums !== false, colors: e.colors != null ? !!e.colors : part === 'agudos',
    zone: e.zone === 'izq' || e.zone === 'der' ? e.zone : 'todo' };
}
function easyCfg() { var pr = liveProfile(); return pr ? cfgNorm(pr) : cfgNorm(Object.assign({}, prefs.easy || {}, { on: !!(prefs.easy && prefs.easy.on) })); }
function norm6(x) { x = C.mod12(x); return x > 5 ? x - 12 : x; }
/* Colores por número (1 rojo, 2 naranja, 3 amarillo, 4 verde, 5 azul, 6 morado, 7 rosado); una negra toma el de abajo. */
var EZ_COLORS = ['#e53935', '#e53935', '#f57c00', '#f57c00', '#c79a00', '#2e9e5b', '#2e9e5b', '#1e88e5', '#1e88e5', '#8e24aa', '#8e24aa', '#d81b60'];
function ezHome() { return liveState && liveState.easy ? liveState.easy.home : 0; }
function ezColor(m) { return EZ_COLORS[C.mod12(m - ezHome())]; }
function ezNum(m, home) { return C.EZ_NUMS[C.mod12(m - (home == null ? ezHome() : home))]; }
/* El acorde dentro de una sola octava: 1 = 1-3-5, 4 = 1-4-6, 5 = 2-5-7, 6m = 1-3-6… sin mover la mano. */
function octaveNotes(pcs, lo) { return pcs.map(function (pc) { return lo + C.mod12(pc - lo); }).sort(function (a, b) { return a - b; }); }
function triadFingers(n) {
  if (n.length !== 3) return n.map(function () { return ''; });
  return [1, (n[1] - n[0] >= 5 || n[2] - n[0] < 8) ? 3 : 2, 5];      // 1-3-5 o 1-2-5, como se enseña cada posición
}
/* Donde empieza la octava de la mano: la tónica del tono de práctica, cerca de la octava elegida (así las formas 1-3-5, 1-4-6, 2-5-7 son iguales en todo tono). */
function homeWindow(oct, home) { return oct + ((C.mod12(home) + 6) % 12) - 6; }
/* Las teclas de cada parte para un acorde (raíz ya en el tono de práctica). */
function partVoicing(cfg, s, win) {
  var iv = s.suf === 'm' ? [0, 3, 7] : s.suf === 'dim' ? [0, 3, 6] : s.suf === 'aug' ? [0, 4, 8] : [0, 4, 7];
  var pcs = iv.map(function (x) { return C.mod12(s.root + x); }), v;
  if (cfg.part === 'bajo') {
    var L = win + C.mod12(s.root - win), nn = cfg.notes === 2 ? [L, L + 7] : [L];
    v = { right: nn, fingers: cfg.notes === 2 ? [5, 1] : [''], left: L, hideLeft: true, allLeft: true };
    v.extra = cfg.rhythm === 'boogie' ? [L + 7, L + (s.suf === 'm' || s.suf === 'dim' ? 12 : 9)] : cfg.rhythm === 'quintas' ? [L + 7] : [];
  } else if (cfg.part === 'agudos') {
    var r = cfg.notes === 1 ? [win + C.mod12(s.root - win)] : octaveNotes(cfg.notes === 2 ? [s.root, s.root + 7] : pcs, win);
    v = { right: r, fingers: cfg.notes === 3 ? triadFingers(r) : cfg.notes === 2 ? [1, 4] : [''], left: r[0], hideLeft: true };
  } else if (cfg.shape === 'root') {
    var r0 = (win - 5) + C.mod12(s.root - (win - 5));
    v = { right: iv.map(function (x) { return r0 + x; }), fingers: [1, 3, 5], left: r0 - 12 };
  } else {
    var ro = octaveNotes(pcs, win);
    v = { right: ro, fingers: triadFingers(ro), left: (win - 12) + C.mod12(s.root - (win - 12)) };
  }
  if (cfg.part === 'acordes' && cfg.hands === 'left') { v.right = []; v.fingers = []; }
  if (cfg.part === 'acordes' && cfg.hands === 'right') v.hideLeft = true;
  v.root = s.root; v.bass = s.root;
  return v;
}
/* Nombre del acorde para llevar la cuenta de lo que ya domina: en bajo y agudos de 1-2 notas basta la raíz. */
function chordKey(cfg, label) { return (cfg.part === 'bajo' || (cfg.part === 'agudos' && cfg.notes < 3)) ? label.replace(/[m°+]$/, '') : label; }
/* En modo fácil la canción se muestra en el tono de práctica (Do si no se elige otro): el teclado transpone al tono de la banda. */
function easyBuild(song, steps, path) {
  var cfg = easyCfg(), inf = info(song), sh = songShift(song), kpc = C.mod12(inf.key.pc + sh);
  var home = cfg.home < 0 ? C.mod12(kpc - (inf.key.minor ? 9 : 0)) : cfg.home;                 // el «1»
  var toH = cfg.home < 0 ? 0 : norm6(home + (inf.key.minor ? 9 : 0) - kpc), eff = sh + toH, win = homeWindow(cfg.oct, home);
  var vo = path.map(function (k) {
    var tok = steps[k].c;
    var real = C.splitTok(C.transposeTok(tok, { shift: sh, spell: 'sharp', notation: 'en', keep: false })).core;      // lo que suena (para el oído)
    var shown = C.splitTok(C.transposeTok(tok, { shift: eff, spell: 'sharp', notation: 'en', keep: false })).core;   // lo que ve y toca
    var s = C.simpleChord(shown) || { root: home, suf: '' }, disp = C.noteName(s.root, 'sharp', 'en') + s.suf;
    var v = partVoicing(cfg, s, win);
    var label = cfg.nums ? C.numLabel(C.mod12(s.root - home), s.suf) : latin(C.noteName(s.root, 'sharp', 'en')) + (s.suf === 'dim' ? '°' : s.suf === 'aug' ? '+' : s.suf);
    var num = C.numLabel(C.mod12(s.root - home), s.suf);
    return { en: real, disp: disp, v: v, label: label, easy: true, key: chordKey(cfg, num) };
  });
  return { vo: vo, toC: toH, keyboard: norm6(-toH), eff: eff, cfg: cfg, home: home, win: win };
}
function easyFmt(tok) {
  var st = liveState; if (!st || !st.easy || !C.isChordTok(tok)) return tok;
  var p = C.splitTok(tok), s = C.simpleChord(C.splitTok(C.transposeTok(tok, { shift: st.easy.eff, spell: 'sharp', notation: 'en', keep: false })).core);
  if (!s) return tok;
  return p.pre + (st.easy.cfg.nums ? C.numLabel(C.mod12(s.root - st.easy.home), s.suf) : latin(C.noteName(s.root, 'sharp', 'en')) + (s.suf === 'dim' ? '°' : s.suf === 'aug' ? '+' : s.suf)) + p.post;
}
function easyNames(x) {
  var st = liveState, names = {}, nums = st.easy.cfg.nums, nm = function (m) { return nums ? ezNum(m) : latin(C.noteName(m, 'sharp', 'en')); };
  x.v.right.forEach(function (m) { names[m] = nm(m); }); names[x.v.left] = nm(x.v.left);
  (x.v.extra || []).forEach(function (m) { names[m] = nm(m); });
  return names;
}
/* ---------- ritmos: los golpes de cada acorde en el rodillo ----------
   Devuelve [{ b: pulso desde el inicio de la canción, d: duración en pulsos, n: [notas], h: 'L' | 'R' }]. Las barras de
   compás caen en los múltiplos de «bpb», así «1 y 3» o «2 y 4» coinciden con el compás de la canción. */
function partHits(cfg, v, a, z, bpb) {
  var out = [], rh = v.right, L = v.hideLeft ? null : v.left, hand = v.allLeft ? 'L' : 'R', b, k;
  bpb = bpb || 4;
  var put = function (bb, d, notes, h) { if (notes.length && bb < z - 1e-6) out.push({ b: bb, d: Math.max(0.12, Math.min(d, z - bb)), n: notes, h: h }); };
  var both = function (bb, d) { put(bb, d, rh, hand); if (L !== null) put(bb, d, [L], 'L'); };
  var beats = []; for (k = Math.ceil(a - 1e-6); k < z - 1e-6; k++) beats.push(k);
  if (!beats.length || beats[0] > a + 1e-6) beats.unshift(a);
  var pos = function (bb) { return ((Math.round(bb * 4) / 4) % bpb + bpb) % bpb; };
  switch (cfg.rhythm) {
    case 'golpe': both(a, 1); break;
    case 'tiempo': beats.forEach(function (bb) { both(bb, 0.8); }); break;
    case 'bajoac':
      if (L === null || !rh.length) { beats.forEach(function (bb) { both(bb, 0.8); }); break; }
      beats.forEach(function (bb, q) { var r = Math.floor(pos(bb)); if (!q || r % 2 === 0) put(bb, 0.8, [L], 'L'); else put(bb, 0.8, rh, 'R'); });
      break;
    case 'mach':
      for (b = a; b < z - 1e-6; b = Math.floor(b * 2 + 1e-6) / 2 + 0.5) put(b, 0.4, rh.length ? rh : [L], rh.length ? hand : 'L');
      if (L !== null && rh.length) beats.forEach(function (bb, q) { if (!q || pos(bb) === 0) put(bb, 0.9, [L], 'L'); });
      break;
    case 'unotres': beats.forEach(function (bb, q) { if (!q || Math.floor(pos(bb)) % 2 === 0) both(bb, 0.9); }); break;
    case 'doscuatro': beats.forEach(function (bb) { if (Math.floor(pos(bb)) % 2 === 1) both(bb, 0.8); }); if (!out.length) both(a, 0.8); break;
    case 'quintas': case 'boogie':
      var root = v.allLeft ? rh[0] : (L !== null ? L : rh[0]), seq = cfg.rhythm === 'quintas' ? [0, 7] : [0, 7, (v.extra && v.extra[1] ? v.extra[1] - root : 9), 7];
      beats.forEach(function (bb, q) { var r = q ? Math.floor(pos(bb)) : 0; put(bb, 0.85, [root + seq[r % seq.length]], 'L'); });
      break;
    default: both(a, z - a);
  }
  return out;
}
function relive() {
  var st = liveState; if (!st) return;
  var i = st.i, mode = st.mode, pushed = st.pushed, lvl = st.level;
  pauseLive(); stopEar();
  liveState = buildLive(current.song, pushed, mode); liveState.i = Math.min(i, liveState.path.length - 1); liveState.level = lvl;
  drawLive();
}
/* ---------- editor de la configuración de toque (modo fácil de este equipo o un alumno) ---------- */
function cfgEditorHTML(e) {
  var seg2 = function (name, cur, opts) { return '<div class="seg" data-ezk="' + name + '">' + opts.map(function (o) { return '<button type="button" data-ezv="' + o[0] + '" aria-pressed="' + (String(cur) === String(o[0])) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; };
  var h = '<p class="lbl-s">Parte</p>' + seg2('part', e.part, Object.keys(PARTS).map(function (k) { return [k, PARTS[k]]; }));
  if (e.part === 'bajo') h += '<p class="lbl-s">Qué se toca</p>' + seg2('notes', e.notes, [[1, 'Una nota (la del acorde)'], [2, 'Dos notas (quinta)']]) +
    '<p class="lbl-s">Octava</p>' + seg2('oct', e.oct, [[36, 'Más grave'], [48, 'Grave']]);
  else if (e.part === 'agudos') h += '<p class="lbl-s">Qué se toca</p>' + seg2('notes', e.notes, [[1, 'Una nota'], [2, 'Dos notas (quinta)'], [3, 'Tres notas']]) +
    '<p class="lbl-s">Octava</p>' + seg2('oct', e.oct, [[60, 'Media'], [72, 'Aguda'], [84, 'Muy aguda']]);
  else h += '<p class="lbl-s">Manos</p>' + seg2('hands', e.hands, [['both', 'Las dos'], ['left', 'Solo izquierda'], ['right', 'Solo derecha']]) +
    '<p class="lbl-s">Mano derecha</p>' + seg2('shape', e.shape, [['octave', 'En una octava (mueve menos)'], ['root', 'Siempre 1-3-5']]);
  h += '<p class="lbl-s">Ritmo</p>' + seg2('rhythm', e.rhythm, PART_RHYTHMS[e.part].map(function (k) { return [k, RHYTHMS[k]]; }));
  h += '<p class="lbl-s">Tono de práctica</p>' + seg2('home', e.home, HOMES) +
    '<p class="help">Se toca siempre en este tono y el teclado transpone al tono de la banda. Los números no cambian: el 1 es siempre «la casa» de la canción.</p>';
  h += '<p class="lbl-s">Con el teclado MIDI compartido entre dos, esta parte cuenta</p>' + seg2('zone', e.zone, [['todo', 'Todo el teclado'], ['izq', 'La mitad izquierda'], ['der', 'La mitad derecha']]);
  h += '<label class="chk"><input type="checkbox" data-ezc="nums"' + (e.nums ? ' checked' : '') + '> Números en vez de letras</label>' +
    '<label class="chk"><input type="checkbox" data-ezc="colors"' + (e.colors ? ' checked' : '') + '> Teclas de colores</label>';
  return h;
}
/* Enlaza el editor: cada cambio llama a onChange con la configuración nueva (y redibuja el editor si cambió la parte). */
function cfgEditorBind(box, get, onChange) {
  box.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-ezv]'); if (!btn) return;
    var key = btn.parentNode.getAttribute('data-ezk'), val = btn.getAttribute('data-ezv'), e = get();
    e[key] = /^-?\d+$/.test(val) ? +val : val;
    if (key === 'part') { e.rhythm = null; e.oct = null; e.notes = null; e.zone = null; e.colors = null; }
    e = cfgNorm(e); onChange(e); box.innerHTML = cfgEditorHTML(e);
  });
  box.addEventListener('change', function (ev) {
    var c = ev.target.getAttribute('data-ezc'); if (!c) return;
    var e = get(); e[c] = ev.target.checked; onChange(cfgNorm(e));
  });
}
function transposeHelp(k, minor) {
  if (!k) return 'Esta canción ya está en el tono de práctica: no hace falta transponer el teclado.';
  var n = (k > 0 ? '+' : '−') + Math.abs(k);
  return 'El teclado transpone ' + n + '. En Ableton: en la pista del piano agrega el efecto MIDI «Pitch» y ponlo en ' + n +
    '. En Analog Lab o en el KeyLab también se puede transponer. Si el teclado mismo transpone, avísalo en «Teclado MIDI» para que la práctica lo tenga en cuenta.';
}
function openEasySheet() {
  if (liveProfile()) { openStudentSheet(liveProfile().id); return; }
  var e = cfgNorm(prefs.easy || {});
  var st = liveState, tr = st && st.easy ? transposeHelp(st.easy.keyboard) : '';
  openSheet('Modo fácil', '<p class="help">Para tocar en vivo con confianza: partes simples, en números y siempre en el mismo tono.</p>' +
    '<label class="chk"><input type="checkbox" id="ez-on"' + (prefs.easy && prefs.easy.on ? ' checked' : '') + '> Activar</label>' +
    '<div id="ez-b">' + cfgEditorHTML(e) + '</div>' + (tr ? '<p class="help" id="ez-tr">' + esc(tr) + '</p>' : '') +
    '<div class="btnrow"><button type="button" class="btn primary" data-close="1">Listo</button></div>', function (el) {
    var box = el.querySelector('#ez-b'), save = function (ne) { e = ne; prefs.easy = Object.assign({}, e, { on: el.querySelector('#ez-on').checked }); savePrefs(); relive(); var t = el.querySelector('#ez-tr'); if (t && liveState && liveState.easy) t.textContent = transposeHelp(liveState.easy.keyboard); };
    cfgEditorBind(box, function () { return Object.assign({}, e); }, function (ne) { el.querySelector('#ez-on').checked = true; save(ne); });
    el.querySelector('#ez-on').addEventListener('change', function () { save(e); });
  });
}
/* ---------- práctica con el teclado MIDI: la app ve qué tecla toca Diego y espera el acorde correcto ---------- */
var midi = { acc: null, inp: null, held: {}, sound: false };
function midiSupported() { return typeof navigator.requestMIDIAccess === 'function'; }
function midiConnect() {
  if (!midiSupported()) return Promise.reject(new Error('nomidi'));
  if (midi.acc) { midiPick(); return Promise.resolve(midi.acc); }
  return navigator.requestMIDIAccess().then(function (acc) {
    midi.acc = acc; acc.onstatechange = function () { midiPick(); midiStatusDraw(); };
    midiPick(); return acc;
  });
}
function midiInputs() { var out = []; if (midi.acc) midi.acc.inputs.forEach(function (i) { out.push(i); }); return out; }
function midiPick() {
  var ins = midiInputs(), want = LS.get('cfp.midiIn', ''), sel = null;
  ins.forEach(function (i) { if (i.id === want) sel = i; });
  if (!sel) ins.forEach(function (i) { if (!sel && /keylab|arturia|essential/i.test(i.name || '')) sel = i; });
  if (!sel) sel = ins[0] || null;
  if (midi.inp && midi.inp !== sel) midi.inp.onmidimessage = null;
  midi.inp = sel; midi.held = {};
  if (sel) sel.onmidimessage = midiMsg;
}
/* Zona del teclado de quien practica: con el teclado dividido, dos alumnos tocan a la vez y cada uno cuenta solo lo suyo. */
function midiSplit() { return +LS.get('cfp.midiSplit', 60) || 60; }
function midiInZone(n) {
  var st = liveState, z = st && st.easy ? st.easy.cfg.zone : 'todo';
  return z === 'izq' ? n < midiSplit() : z === 'der' ? n >= midiSplit() : true;
}
/* Si el mismo KeyLab transpone, las notas llegan corridas: se devuelven al tono de práctica. */
function midiOffset() { var st = liveState; return st && st.easy && LS.get('cfp.midiKbTr', false) ? st.easy.keyboard : 0; }
function midiMsg(e) {
  var d = e.data, cmd = d[0] & 0xf0, n = d[1] - midiOffset();
  if (cmd === 0x90 && d[2] > 0) {
    if (!midiInZone(n)) return;
    midi.held[n] = performance.now(); if (midi.sound) playNotes([n]);
  if (drill) { drillNote(n); return; }
    midiKeys();
    if (typeof stuNote === 'function') stuNote(n);
    midiCheck(n);
  } else if (cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) { delete midi.held[n]; midiKeys(); }
}
function midiTarget() {
  var st = liveState, pcs = {}; if (!st) return pcs;
  var v = st.vo[st.i].v;
  v.right.forEach(function (m) { pcs[C.mod12(m)] = 1; }); if (!v.hideLeft) pcs[C.mod12(v.left)] = 1;
  return pcs;
}
/* Notas que no son error: las del acorde y las que pide el ritmo (en el rock and roll del bajo: la quinta y la sexta). */
function midiAllowed() {
  var st = liveState, pcs = midiTarget(); if (!st) return pcs;
  (st.vo[st.i].v.extra || []).forEach(function (m) { pcs[C.mod12(m)] = 1; });
  return pcs;
}
/* Teclas tocadas: verde si son del acorde, ámbar si no. En cualquier octava cuenta. */
function midiKeys() {
  var st = liveState, main = lid('lv-main'); if (!st || !main || !midi.inp) return;
  var tgt = midiAllowed();
  // cada tecla tocada enciende una sola tecla en pantalla: la misma si se ve, si no la más cercana con esa nota
  var rects = main.querySelectorAll('svg.piano rect[data-m]'), shown = {}, lit = {};
  Array.prototype.forEach.call(rects, function (r) { shown[+r.getAttribute('data-m')] = 1; });
  Object.keys(midi.held).forEach(function (n) {
    n = +n; if (shown[n]) { lit[n] = 1; return; }
    var best = null; Object.keys(shown).forEach(function (m) { m = +m; if (C.mod12(m) === C.mod12(n) && (best === null || Math.abs(m - n) < Math.abs(best - n))) best = m; });
    if (best !== null) lit[best] = 1;
  });
  Array.prototype.forEach.call(rects, function (r) {
    var m = +r.getAttribute('data-m'), on = !!lit[m];
    r.classList.toggle('mok', on && !!tgt[C.mod12(m)]); r.classList.toggle('mbad', on && !tgt[C.mod12(m)]);
  });
}
/* n: la tecla que se acaba de tocar. Una tecla equivocada tocada ahora no deja avanzar; las que quedaron
   presionadas del acorde anterior no cuentan como error. */
function midiCheck(n) {
  var st = liveState; if (!st || st.mode !== 'practice' || st.pWait) return;
  var tgt = midiTarget(), ok = midiAllowed(), need = Object.keys(tgt), held = {}, bad = false, t0 = st.chordT || 0;
  if (n != null && !ok[C.mod12(n)]) { if (typeof stuWrong === 'function') stuWrong(); return; }
  Object.keys(midi.held).forEach(function (m) { var pc = C.mod12(+m); held[pc] = 1; if (!ok[pc] && midi.held[m] >= t0) bad = true; });
  if (bad || !need.length || !need.every(function (p) { return held[p]; })) return;
  practiceAdvance();
}
function practiceAdvance() {
  var st = liveState; if (!st || st.pWait) return;
  st.pWait = true;
  if (typeof stuRight === 'function') stuRight();
  var g = lid('lv-good'); if (g) { g.textContent = '¡Bien!'; g.classList.remove('hit'); void g.offsetWidth; g.classList.add('hit'); }
  setTimeout(function () {
    if (liveState !== st) return; st.pWait = false;
    if (st.i < st.path.length - 1) jumpTo(st.i + 1);
    else { var g2 = lid('lv-good'); if (g2) g2.textContent = '¡Terminaste la canción!'; if (typeof stuSongEnd === 'function') stuSongEnd(); }
  }, 280);
}
function midiStatus() {
  if (!midiSupported()) return 'Este navegador no puede usar MIDI: usa Chrome en la laptop o en Android.';
  return midi.inp ? 'Teclado: ' + esc(midi.inp.name || 'MIDI') + '. Toca el acorde para avanzar.' : 'Conecta el teclado por USB (o por la interfaz) y toca «Teclado».';
}
function midiStatusDraw() { var e = lid('lv-midi'); if (e) e.innerHTML = midiStatus(); }
function openMidiInputs() {
  midiConnect().then(function () {
    var ins = midiInputs(), cur = midi.inp ? midi.inp.id : '';
    openSheet('Teclado MIDI', '<p class="help">Elige el teclado. En Windows, si Ableton ya está usando el teclado, el navegador a veces no lo recibe: conecta el KeyLab por USB a la laptop para la app, y su salida MIDI a la interfaz para Ableton; así cada programa usa su propia conexión.</p>' +
      (ins.length ? '<div class="menu">' + ins.map(function (i) { return '<button type="button" data-mi="' + esc(i.id) + '" aria-pressed="' + (i.id === cur) + '"><span>' + esc(i.name || 'Entrada MIDI') + '</span></button>'; }).join('') + '</div>'
        : '<p class="tl-warn">No encontré teclados MIDI. Revisa el cable USB y vuelve a abrir esta ventana.</p>') +
      '<label class="chk"><input type="checkbox" id="mi-snd"' + (midi.sound ? ' checked' : '') + '> Que la app suene al tocar (si no usas Ableton ni Analog Lab)</label>' +
      '<label class="chk"><input type="checkbox" id="mi-tr"' + (LS.get('cfp.midiKbTr', false) ? ' checked' : '') + '> El mismo KeyLab transpone (no Ableton ni Analog Lab)</label>' +
      '<p class="lbl-s">Teclado dividido: dónde empieza la zona derecha</p><div class="seg" id="mi-split">' + [[48, 'Do 3'], [60, 'Do 4 (central)'], [72, 'Do 5']].map(function (o) { return '<button type="button" data-sp="' + o[0] + '" aria-pressed="' + (midiSplit() === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<p class="help">Con el teclado dividido (dos sonidos en Analog Lab o dos pistas en Ableton), el bajo cuenta solo las teclas de la izquierda y los agudos solo las de la derecha.</p>', function (el) {
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-mi]'); if (!b) return; LS.set('cfp.midiIn', b.getAttribute('data-mi')); midiPick(); midiStatusDraw(); closeSheet(); toast('Teclado elegido.'); });
      el.addEventListener('change', function (e) { if (e.target.id === 'mi-snd') midi.sound = e.target.checked; if (e.target.id === 'mi-tr') LS.set('cfp.midiKbTr', e.target.checked); });
      el.addEventListener('click', function (e) { var b = e.target.closest('[data-sp]'); if (!b) return; LS.set('cfp.midiSplit', +b.getAttribute('data-sp')); Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); });
    });
  }).catch(function () { toast('No se pudo usar MIDI. Usa Chrome en la laptop o en Android y conecta el teclado.', 6000); });
}

/* parte 13: modo alumno
   Cada alumno tiene su parte (bajo, agudos o acordes), su tono de práctica, su ritmo y sus canciones.
   Escalera de ayuda por canción: 1 Con ayuda, 2 A tiempo, 3 Solo números, 4 De memoria. Con el teclado conectado,
   la ayuda de un acorde que ya domina se apaga sola y vuelve si se equivoca o duda. Todo se guarda en este equipo. */
var STU_KEY = 'cfp.alumnos.v1';
var stuLive = null;                       // { sid, level } mientras un alumno toca
var stuRun = null;                        // la vuelta en curso: aciertos por acorde
var STU_COLORS = ['#3a43c4', '#d9558f', '#2e9e5b', '#d8680f', '#8e24aa', '#22897f'];
var LEVELS = [null,
  { n: 1, name: 'Con ayuda', desc: 'Las teclas se encienden. Con el teclado conectado, la canción espera a que toques; si no, avanzas tú.' },
  { n: 2, name: 'A tiempo', desc: 'Las teclas se encienden y la canción avanza sola, al tempo.' },
  { n: 3, name: 'Solo números', desc: 'Sin teclas encendidas: ves el número del acorde y el que viene.' },
  { n: 4, name: 'De memoria', desc: 'Solo la letra y los tiempos. Tocas sin ayuda.' }];

function stuData() { var d = LS.get(STU_KEY, null); if (!d || !Array.isArray(d.list)) d = { list: [], device: null }; return d; }
function stuSave(d) { LS.set(STU_KEY, d); }
function getStudent(id) { var l = stuData().list; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
function putStudent(pr) {
  var d = stuData(), k = -1;
  d.list.forEach(function (x, i) { if (x.id === pr.id) k = i; });
  if (k >= 0) d.list[k] = pr; else d.list.push(pr);
  stuSave(d);
}
function liveProfile() { return stuLive ? getStudent(stuLive.sid) : null; }
function newStudent(name, part) {
  var n = stuData().list.length;
  return Object.assign({ id: newId('a'), name: name, color: STU_COLORS[n % STU_COLORS.length], songs: [], prog: {}, chords: {} },
    cfgNorm({ part: part, rhythm: 'golpe', home: 0 }));
}
function stuDesc(pr) {
  var c = cfgNorm(pr), home = HOMES.filter(function (h) { return h[0] === c.home; })[0];
  return PARTS[c.part] + ' · ' + (c.home < 0 ? 'en el tono de la banda' : 'toca en ' + home[1]) + ' · ' + RHYTHMS[c.rhythm].toLowerCase();
}
function stuProg(pr, songId) { var p = (pr.prog || {})[songId]; return p || { step: 1, stars: {} }; }
function starsHTML(p, big) {
  var h = '<span class="stars' + (big ? ' big' : '') + '" aria-label="' + Object.keys(p.stars || {}).length + ' de 4 estrellas">';
  for (var k = 1; k <= 4; k++) h += '<i class="' + (p.stars && p.stars[k] ? 'on' : '') + '" title="' + LEVELS[k].name + '">' + icon('star') + '</i>';
  return h + '</span>';
}

/* ---------- qué acordes pide cada canción, en números, y cuáles ya domina el alumno ---------- */
function songKeys(song, cfg) {
  var inf = info(song), base = inf.key.minor ? inf.key.pc + 3 : inf.key.pc, out = [];
  inf.chords.forEach(function (c) { var s = C.simpleChord(C.SHARP[c.root] + (C.isMinorQual(c.qual) ? 'm' : '')); if (s) out.push(chordKey(cfg, C.numLabel(C.mod12(s.root - base), s.suf))); });
  return out;
}
function masteredSet(pr) { var m = {}; Object.keys(pr.chords || {}).forEach(function (k) { if (pr.chords[k].mastered) m[k] = 1; }); return m; }
/* Qué tan al alcance está una canción: cuántos acordes distintos pide y qué parte de sus cambios ya domina. */
function songFit(song, pr) {
  var cfg = cfgNorm(pr), keys = songKeys(song, cfg), m = masteredSet(pr), dist = {};
  keys.forEach(function (k) { dist[k] = 1; });
  var known = keys.filter(function (k) { return m[k]; }).length;
  return { n: Object.keys(dist).length, list: Object.keys(dist), cover: keys.length ? known / keys.length : 0 };
}

/* ---------- pantallas ---------- */
function renderStudents() {
  leaveSong(); stuLive = null;
  var d = stuData();
  app.innerHTML = '<div class="page stu"><div class="page-h">' + btnIcon('back', 'Volver a la lista', 'data-go="#/"') + '<h1>Modo alumno</h1>' +
    '<button type="button" class="btn primary" data-sact="new">' + icon('add') + 'Nuevo</button></div>' +
    (d.list.length ? '<ul class="list">' + d.list.map(function (pr) {
      return '<li><a class="row" href="#/a/' + enc(pr.id) + '"><span class="avatar" style="--c:' + esc(pr.color) + '">' + esc((pr.name || '?').charAt(0).toUpperCase()) + '</span>' +
        '<span class="txt"><span class="ttl">' + esc(pr.name) + (d.device === pr.id ? ' <span class="pill">este equipo</span>' : '') + '</span><span class="sub">' + esc(stuDesc(pr)) + '</span></span>' + icon('fwd') + '</a></li>';
    }).join('') + '</ul>'
    : '<p class="empty">Crea un alumno para cada niño: su parte (bajo, agudos o acordes), su tono y sus canciones. Sus estrellas se guardan en este equipo.</p>') +
    '<p class="help">En el celular de cada niño, abre su alumno y marca «Este equipo es de…»: la app abrirá directo en sus canciones.</p></div>';
}
function renderStudent(sid) { renderKid(sid, 'canciones'); }
function openSongPicker(sid) {
  var pr = getStudent(sid); if (!pr) return;
  var start = (pr.songs || []).slice();
  var list = allSongs().filter(function (s) { return info(s).seq.length; }).map(function (s) { return { s: s, f: songFit(s, pr) }; })
    .sort(function (a, b) { return a.f.n - b.f.n || b.f.cover - a.f.cover; });
  openSheet('Canciones de ' + pr.name, '<p class="help">Ordenadas de la más fácil a la más difícil para su parte. Marca las que va a practicar.</p><div class="field"><input id="sp-q" type="search" placeholder="Buscar" autocomplete="off"></div><ul class="menu pick" id="sp-l"></ul>', function (el) {
    var draw = function () {
      var q = C.normalize(el.querySelector('#sp-q').value || ''), cur = getStudent(sid).songs || [];
      el.querySelector('#sp-l').innerHTML = list.filter(function (x) { return !q || C.normalize(x.s.title).indexOf(q) >= 0; }).slice(0, 80).map(function (x) {
        var on = cur.indexOf(x.s.id) >= 0;
        return '<li><button type="button" data-pk="' + esc(x.s.id) + '" aria-pressed="' + on + '"><span>' + esc(C.sentenceCase(x.s.title)) + '</span><span class="sub">' + x.f.n + ' acordes: ' + esc(x.f.list.join(' ')) + '</span></button></li>';
      }).join('');
    };
    el.addEventListener('input', draw);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-pk]'); if (!b) return;
      var p2 = getStudent(sid), id = b.getAttribute('data-pk'), k = (p2.songs || []).indexOf(id);
      p2.songs = p2.songs || []; if (k >= 0) p2.songs.splice(k, 1); else p2.songs.push(id);
      putStudent(p2); b.setAttribute('aria-pressed', String(k < 0));
    });
    draw();
  }, { onClose: function () { kidSongsDone(sid, start); if (route.name === 'student') renderStudent(sid); else if (route.name === 'ficha') renderFicha(sid); } });
}
function openNewStudent() {
  var part = 'bajo';
  openSheet('Nuevo alumno', '<div class="field"><label for="ns-n">Nombre</label><input id="ns-n" autocomplete="off"></div>' +
    '<p class="lbl-s">Su parte</p><div class="seg" id="ns-p">' + Object.keys(PARTS).map(function (k) { return '<button type="button" data-p="' + k + '" aria-pressed="' + (k === part) + '">' + PARTS[k] + '</button>'; }).join('') + '</div>' +
    '<p class="help">Bajo: una nota con la izquierda, la del acorde. Agudos: una o dos notas altas con la derecha. Acordes: las dos manos. Luego puedes cambiarlo.</p>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="ok">Crear</button></div>', function (el) {
    var inp = el.querySelector('#ns-n'); setTimeout(function () { inp.focus(); }, 40);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-p]');
      if (b) { part = b.getAttribute('data-p'); Array.prototype.forEach.call(b.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return; }
      if (e.target.closest('[data-x="ok"]')) {
        var name = inp.value.trim(); if (!name) { inp.focus(); return; }
        var pr = newStudent(name, part); putStudent(pr); closeSheet(true); location.hash = '#/a/' + enc(pr.id);
      }
    });
  });
}
function openStudentSheet(sid) {
  var pr = getStudent(sid); if (!pr) return;
  var e = cfgNorm(pr), d = stuData();
  openSheet('Ajustes de ' + pr.name, '<div class="field"><label for="se-n">Nombre</label><input id="se-n" value="' + esc(pr.name) + '" autocomplete="off"></div>' +
    '<div id="se-b">' + cfgEditorHTML(e) + '</div>' +
    '<label class="chk"><input type="checkbox" id="se-dev"' + (d.device === sid ? ' checked' : '') + '> Este equipo es de ' + esc(pr.name) + ' (la app abre directo en sus canciones)</label>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-close="1">Listo</button><button type="button" class="btn" data-x="reset">Borrar estrellas y acordes</button><button type="button" class="btn danger" data-x="del">Eliminar alumno</button></div>', function (el) {
    var save = function (ne) { var p2 = getStudent(sid); Object.assign(p2, ne); putStudent(p2); e = ne; if (liveState && liveState.stu) relive(); };
    cfgEditorBind(el.querySelector('#se-b'), function () { return Object.assign({}, e); }, save);
    el.querySelector('#se-n').addEventListener('change', function (ev) { var v = ev.target.value.trim(); if (v) { var p2 = getStudent(sid); p2.name = v; putStudent(p2); } });
    el.querySelector('#se-dev').addEventListener('change', function (ev) { var d2 = stuData(); d2.device = ev.target.checked ? sid : (d2.device === sid ? null : d2.device); stuSave(d2); });
    el.addEventListener('click', function (ev) {
      var x = ev.target.closest('[data-x]'); if (!x) return;
      if (x.getAttribute('data-x') === 'reset') confirmSheet('Borrar estrellas y acordes', 'Se borran las estrellas y los acordes dominados de ' + esc(pr.name) + ' en este equipo. Sus canciones y ajustes se quedan.', 'Borrar', function () {
        var p2 = getStudent(sid); p2.prog = {}; p2.chords = {}; putStudent(p2); if (route.name === 'student') renderStudent(sid); else if (route.name === 'ficha') renderFicha(sid); toast('Listo.'); }, true);
      if (x.getAttribute('data-x') === 'del') confirmSheet('Eliminar alumno', 'Se elimina ' + esc(pr.name) + ' de este equipo, con sus estrellas. Las canciones no se tocan.', 'Eliminar', function () {
        var d2 = stuData(); d2.list = d2.list.filter(function (p2) { return p2.id !== sid; }); if (d2.device === sid) d2.device = null; stuSave(d2); location.hash = '#/a'; }, true);
    });
  }, { onClose: function () { if (route.name === 'student' && !liveState) renderStudent(sid); else if (route.name === 'ficha' && getStudent(sid)) renderFicha(sid); else if (route.name === 'ficha') location.replace('#/'); } });
}

/* ---------- tocar como alumno ---------- */
function openStudentLive(sid, songId) {
  var pr = getStudent(sid), song = getSong(songId);
  if (!pr || !song) { location.replace(pr ? '#/a/' + enc(sid) : '#/a'); return; }
  current.song = song; ctx.setlist = null; ctx.index = -1;
  var p = stuProg(pr, songId), lvl = p.step || 1;
  if (lvl >= 2 && !song.timeline) lvl = 1;
  stuLive = { sid: sid, level: lvl, t0: Date.now() };
  openLive(false);
  if (liveState) {
    liveState.stu = stuLive; setStuLevel(lvl, true);
    if (liveState.mode === 'sync' && sync.pos) syncApplyPos(sync.pos);      // ya iba sonando en la otra pantalla
  }
  if (liveState && liveState.mode !== 'sync' && LS.get(OIDO_AUTO, false) && !midi.inp && !oidoActive()) oidoToggleLive();
}
/* Modo de avance para cada escalón: 1 espera al teclado (o avanza a mano); 2-4 avanzan solos al tempo. */
function stuModeFor(lvl) {
  var st = liveState;
  if (st && st.mode === 'sync') return 'sync';
  if (lvl >= 2) return st && st.tl ? 'auto' : 'manual';
  return midi.inp || oidoActive() ? 'practice' : 'manual';
}
function setStuLevel(n, quiet) {
  var st = liveState; if (!st || !st.stu) return;
  if (n >= 2 && !st.tl) { toast('Esta canción aún no tiene compases: para los escalones 2 a 4 hay que hacerlos primero (en el modo en vivo normal).', 5000); n = 1; }
  st.level = n; stuLive.level = n; st.stu.level = n;
  if (st.mode !== 'sync') pauseLive();
  st.mode = stuModeFor(n);
  if (st.mode === 'practice') stuRunStart();
  if (st.mode === 'auto' && st.tl) st.bpm = st.bpm || st.tl.bpm;
  stuPrepareFade();
  drawLive();
  if (!quiet) toast('Escalón ' + n + ': ' + LEVELS[n].name + '.', 2200);
}
function openLevelSheet() {
  var st = liveState; if (!st || !st.stu) return;
  var pr = liveProfile(), p = stuProg(pr, st.song.id);
  openSheet('Escalón de ayuda', '<ul class="menu lvl">' + [1, 2, 3, 4].map(function (k) {
    var dis = k >= 2 && !st.tl;
    return '<li><button type="button" data-lvl="' + k + '" aria-pressed="' + (st.level === k) + '"' + (dis ? ' disabled' : '') + '><span class="lvl-n">' + k + '</span>' +
      '<span>' + LEVELS[k].name + (p.stars && p.stars[k] ? ' ' + icon('star') : '') + '</span><span class="sub">' + LEVELS[k].desc + (dis ? ' (esta canción aún no tiene compases)' : '') + '</span></button></li>';
  }).join('') + '</ul><p class="help">Al pasar un escalón (8 de cada 10 acordes bien, o «Me salió» sin teclado) ganas su estrella y la próxima vez empiezas en el siguiente.</p>', function (el) {
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-lvl]'); if (!b || b.disabled) return; closeSheet(true); setStuLevel(+b.getAttribute('data-lvl')); });
  });
}
function stuTopHTML() {
  var st = liveState, pr = liveProfile(), inf = info(st.song), sh = songShift(st.song);
  return '<button type="button" class="iconbtn" data-lv="close" aria-label="Salir">' + icon('close') + '</button>' +
    '<h2><span class="avatar sm" style="--c:' + esc(pr.color) + '">' + esc(pr.name.charAt(0).toUpperCase()) + '</span>' + esc(C.sentenceCase(st.song.title)) + '</h2>' +
    (st.easy && st.easy.keyboard ? '<button type="button" class="lv-key lv-keytr" data-lv="easy" title="Tono de la banda y cuánto transponer el teclado">' + esc(keyLabel(inf.key, sh)) + ' <b>' + (st.easy.keyboard > 0 ? '+' : '−') + Math.abs(st.easy.keyboard) + '</b></button>' : '') +
    '<button type="button" class="lv-step" data-lv="lvl" aria-label="Escalón ' + st.level + ': ' + LEVELS[st.level].name + '. Cambiar">' + '<span class="lvl-n">' + st.level + '</span><span class="lvl-name">' + esc(LEVELS[st.level].name) + '</span> ▾</button>' +
    (st.mode === 'sync' ? '<span class="lv-sync" title="Siguiendo a otra pantalla">' + icon('share') + '</span>' : '') +
    liveTopExtras() +
    '<button type="button" class="iconbtn lv-vista" data-lv="vista" aria-label="Vista: cómo se ve la pantalla" title="Vista">' + icon('eye') + '</button>' +
    '<button type="button" class="iconbtn" data-lv="more" aria-label="Más opciones">' + icon('more') + '</button>';
}
function stuNavHTML() {
  var st = liveState, last = st.path.length - 1;
  var prev = '<button type="button" class="btn" data-lv="prev"' + (st.i ? '' : ' disabled') + ' aria-label="Acorde anterior">' + icon('back') + '</button>';
  var next = '<button type="button" class="btn" data-lv="next"' + (st.i < last ? '' : ' disabled') + ' aria-label="Acorde siguiente">' + icon('fwd') + '</button>';
  if (st.mode === 'sync') return '<div class="lv-row lv-row3">' + prev + '<span class="lv-status">' + esc(syncStatusText()) + '</span>' + next + '</div>';
  var mic = midi.inp ? '' : oidoActive() ? oidoMeterHTML() : '';
  if (st.mode === 'practice' || st.mode === 'manual') {
    var mid = st.mode === 'practice' ? '<span class="lv-status">' + (oidoActive() ? 'Toca y la app avanza' : 'Toca el acorde para avanzar') + '</span>'
      : (st.i === last ? '<button type="button" class="btn primary" data-lv="stuend">' + icon('star') + 'Terminé</button>'
        : '<button type="button" class="btn primary" data-lv="next">Siguiente' + icon('fwd') + '</button>');
    var conn = midi.inp || oidoActive() ? '' : '<p class="lv-hint"><button type="button" class="btn sm" data-lv="oido">' + icon('mic') + 'Que el celular me escuche</button>' +
      (midiSupported() ? ' <button type="button" class="linkbtn" data-lv="midi">o conecta el teclado</button>' : '') + '</p>';
    return '<div class="lv-row lv-row3">' + prev + mid + next + '</div>' + mic + conn;
  }
  var label = st.playing || st.counting ? icon('pause') + 'Pausa' : icon('play') + (st.i ? 'Seguir' : 'Empezar');
  var row = '<div class="lv-row lv-row3">' + prev + '<button type="button" class="btn primary" data-lv="play">' + label + '</button>' + next + '</div>';
  if (st.mode === 'video') return row + '<div class="lv-tempo"><span>Velocidad</span>' + VRATES.map(function (r) {
    return '<button type="button" class="btn lv-clk' + ((st.vrate || 1) === r ? ' on' : '') + '" data-lv="vrate" data-r="' + r + '">' + Math.round(r * 100) + ' %</button>';
  }).join('') + '</div>';
  return row +
    '<div class="lv-tempo"><button type="button" class="btn" data-lv="slower" aria-label="Más lento">−</button><output>' + Math.round(st.bpm) + '</output><span>bpm' +
    (st.tl && Math.round(st.bpm) < Math.round(st.tl.bpm) ? '<span class="lv-band"> (más lento que la banda: ' + Math.round(st.tl.bpm) + ')</span>' : '') + '</span>' +
    '<button type="button" class="btn" data-lv="faster" aria-label="Más rápido">+</button>' +
    '<button type="button" class="btn lv-clk' + (st.click ? ' on' : '') + '" data-lv="click" aria-pressed="' + st.click + '">' + icon('metro') + 'Clic</button>' +
    (midi.inp ? '' : '<button type="button" class="btn lv-clk lv-mic' + (oidoActive() ? ' on' : '') + '" data-lv="oido" aria-pressed="' + oidoActive() + '" aria-label="Que el celular me escuche">' + icon('mic') + '</button>') +
    '</div>' + mic;
}

/* ---------- ayuda que se retira sola ----------
   Un acorde dominado (tres veces bien seguidas a la primera) ya no se enciende en los escalones 1 y 2; si el alumno
   duda o se equivoca, la ayuda vuelve en ese momento y el acorde deja de estar dominado hasta que lo vuelva a lograr. */
var stuHelpTimer = 0;
function stuPrepareFade() {
  var st = liveState; if (!st || !st.stu) return;
  var pr = liveProfile(), m = masteredSet(pr);
  st.fade = {}; if ((st.level === 1 || st.level === 2) && (midi.inp || oidoActive())) st.vo.forEach(function (x) { if (m[x.key]) st.fade[x.key] = 1; });
  stuOnIndex();
}
function stuHidden(i) {
  var st = liveState; if (!st || !st.stu) return false;
  if (st.level >= 3) return true;
  if (!st.fade || !st.fade[st.vo[i].key]) return false;
  return !(i === st.i && st.helpNow);
}
function stuOnIndex() {
  if (oidoActive()) oidoTargetNow();
  var st = liveState; if (!st || !st.stu) return;
  clearTimeout(stuHelpTimer);
  st.firstTry = true; st.helpNow = false;
  if (st.fade && st.fade[st.vo[st.i].key] && st.level <= 2) {
    var wait = st.mode === 'auto' && st.bpm ? 60000 / st.bpm * 1.1 : 2500;
    var i0 = st.i;
    stuHelpTimer = setTimeout(function () { if (liveState === st && st.i === i0 && !st.gotIt) { st.helpNow = true; drawLive(); } }, wait);
  }
  st.gotIt = false;
}
function stuStat(key, ok) {
  var pr = liveProfile(); if (!pr || !key) return;
  pr.chords = pr.chords || {};
  var c = pr.chords[key] || { streak: 0, mastered: false, seen: 0 };
  c.seen++;
  if (ok) { c.streak++; if (c.streak >= 3 && !c.mastered) { c.mastered = true; toast('¡Ya dominas el ' + key + '! Desde ahora la app no lo enciende: tú lo encuentras.', 3500); } }
  else { c.streak = 0; c.mastered = false; }
  pr.chords[key] = c; (pr.chords && pr.chords[key] && (pr.chords[key].at = Date.now())), putStudent(pr);
}
/* Del teclado (práctica que espera): acierto o error en el acorde actual. */
function stuRight() {
  var st = liveState; if (!st || !st.stu) return;
  st.gotIt = true; clearTimeout(stuHelpTimer);
  var faded = st.fade && st.fade[st.vo[st.i].key];
  stuStat(st.vo[st.i].key, st.firstTry && (!faded || !st.helpNow));
  if (stuRun) stuRun.marks[st.i] = st.firstTry ? 'ok' : 'tarde';
}
function stuWrong() {
  var st = liveState; if (!st || !st.stu) return;
  if (st.firstTry) { st.firstTry = false; }
  if (st.fade && st.fade[st.vo[st.i].key] && !st.helpNow) { st.helpNow = true; drawLive(); }
}
/* A tempo (escalones 2 a 4): cada acorde se juzga con lo que se tocó desde un poco antes de que empiece hasta un tiempo después. */
var stuRecent = [];
function stuNote(n) {
  var st = liveState, now = performance.now(); if (!st || !st.stu) return;
  stuRecent.push([now, C.mod12(n)]); if (stuRecent.length > 40) stuRecent.shift();
  if (st.mode !== 'auto' || !stuRun || !st.playing) return;
  if (!midiAllowed()[C.mod12(n)]) stuWrong();
  stuEval();
}
function stuEval() {
  var st = liveState, now = performance.now(); if (!st || !st.stu || !stuRun || st.mode !== 'auto') return;
  var tgt = midiTarget(), okp = midiAllowed(), spb = 60000 / st.bpm, from = (st.chordT || now) - 0.35 * spb, got = {}, bad = 0;
  stuRecent.forEach(function (x) { if (x[0] >= from) { if (tgt[x[1]]) got[x[1]] = 1; else if (!okp[x[1]]) bad++; } });
  if (stuRun.marks[st.i] === 'ok' || stuRun.marks[st.i] === 'tarde') return;
  if (Object.keys(tgt).every(function (p) { return got[p]; }) && bad <= 1) {
    var late = now - (st.chordT || now) > spb * 1.0;
    stuRun.marks[st.i] = late ? 'tarde' : 'ok'; st.gotIt = true; clearTimeout(stuHelpTimer);
    var faded = st.fade && st.fade[st.vo[st.i].key];
    stuStat(st.vo[st.i].key, !late && st.firstTry && (!faded || !st.helpNow));
    var g = lid('lv-good'); if (g) { g.textContent = late ? 'Un poco tarde' : '¡Bien!'; g.classList.remove('hit'); void g.offsetWidth; g.classList.add('hit'); }
  }
}
/* Al cambiar de acorde tocando a tempo: el que terminó sin tocarse bien queda como «mal». */
function stuStep(prev) {
  var st = liveState; if (!st || !st.stu) return;
  if (stuRun && st.mode === 'auto' && prev >= 0 && !stuRun.marks[prev] && (midi.inp || oidoActive())) { stuRun.marks[prev] = 'mal'; stuStat(st.vo[prev].key, false); }
  stuOnIndex();
  if (stuRun && st.mode === 'auto' && st.playing) stuEval();          // quizá ya lo tocó un poquito antes del cambio
}
function stuRunStart() {
  var st = liveState; if (!st || !st.stu) return;
  stuRun = { level: st.level, marks: [], from: st.i, midi: !!midi.inp || oidoActive(), song: st.song.id };
}
/* Fin de la canción: resultado, estrella y el escalón de la próxima vez. */
function stuSongEnd(manual) {
  var st = liveState; if (!st || !st.stu) return;
  var pr = liveProfile(), sid = pr.id, songId = st.song.id, lvl = st.level, run = stuRun;
  if (run && st.mode === 'auto' && run.midi && !run.marks[st.i]) run.marks[st.i] = 'mal';
  var total = 0, ok = 0, late = 0;
  if (run && run.midi && (st.mode === 'auto' || st.mode === 'practice')) {
    for (var k = run.from; k < st.path.length; k++) { total++; if (run.marks[k] === 'ok') ok++; else if (run.marks[k] === 'tarde') late++; }
  }
  stuRun = null;
  var measured = total > 0, score = measured ? (ok + 0.5 * late) / total : null;
  var pass = measured ? (lvl === 1 ? (ok + late) / total >= 0.9 && ok / total >= 0.6 : score >= 0.8) : null;
  var body = '<div class="result">' + starsHTML(stuProg(pr, songId), true);
  if (measured) body += '<p class="res-big">' + ok + ' de ' + total + ' ' + (lvl === 1 ? 'a la primera' : 'a tiempo') + '</p>' +
    (late ? '<p class="help">' + late + (lvl === 1 ? ' después de intentar otra vez.' : ' un poco tarde.') + '</p>' : '');
  else body += '<p class="res-big">¿Te salió bien?</p><p class="help">Sin el teclado ni el micrófono, la app no oye lo que tocas: dilo tú, con honestidad.</p>';
  body += '<div id="res-msg"></div><div class="btnrow" id="res-b"></div></div>';
  openSheet('¡Terminaste!', body, function (el) {
    var finish = function (passed) {
      var p2 = getStudent(sid), p = stuProg(p2, songId); p.stars = p.stars || {};
      var msg = '';
      if (passed) {
        var fresh = !p.stars[lvl]; p.stars[lvl] = true;
        if (lvl < 4 && p.step <= lvl) p.step = lvl + 1;
        msg = (fresh ? '¡Ganaste la estrella de «' + LEVELS[lvl].name + '»!' : 'Muy bien, otra vez.') + (lvl < 4 ? ' La próxima vez empiezas en «' + LEVELS[lvl + 1].name + '».' : ' ¡Ya la tocas de memoria!');
      } else if (passed === false) {
        msg = score !== null && score < 0.5 && lvl > 1 ? 'Todavía cuesta: puedes bajar a «' + LEVELS[lvl - 1].name + '» o probar más lento.' : 'Casi. Una vez más y sale.';
      }
      p.last = Date.now(); p2.prog = p2.prog || {}; p2.prog[songId] = p; putStudent(p2);
      el.querySelector('.stars').outerHTML = starsHTML(p, true);
      el.querySelector('#res-msg').innerHTML = msg ? '<p class="res-msg">' + esc(msg) + '</p>' : '';
      var b = '<button type="button" class="btn primary" data-r="again">Otra vez</button>';
      if (passed && lvl < 4) b = '<button type="button" class="btn primary" data-r="up">Siguiente: ' + esc(LEVELS[lvl + 1].name) + '</button>' + b.replace(' primary', '');
      if (passed === false && lvl > 1) b += '<button type="button" class="btn" data-r="down">Bajar a ' + esc(LEVELS[lvl - 1].name) + '</button>';
      b += '<button type="button" class="btn" data-r="back">Mis canciones</button>';
      el.querySelector('#res-b').innerHTML = b;
    };
    if (measured) finish(pass);
    else el.querySelector('#res-b').innerHTML = '<button type="button" class="btn primary" data-r="yes">' + icon('star') + 'Sí, me salió</button><button type="button" class="btn" data-r="no">Todavía no</button>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-r]'); if (!b) return;
      var r = b.getAttribute('data-r');
      if (r === 'yes') { finish(true); return; }
      if (r === 'no') { finish(false); return; }
      closeSheet(true);
      if (!liveState) return;
      if (r === 'back') { closeLive(false); return; }
      var target = r === 'up' ? Math.min(4, lvl + 1) : r === 'down' ? Math.max(1, lvl - 1) : lvl;
      jumpTo(0); setStuLevel(target, r === 'again');
    });
  });
}

/* parte 14: pantallas conectadas
   Una pantalla guía (la laptop que escucha la guitarra, o el celular con el pedal) y las demás la siguen: cada una
   muestra su propia parte (el bajo de un alumno, los agudos de otro, los acordes). Van por internet a través de dos
   servidores públicos gratuitos a la vez (si uno falla, sigue el otro) y, entre ventanas de la misma laptop, sin
   internet. Solo viajan la canción que se toca y en qué acorde va: nada se guarda en los otros equipos. */
var SYNC_BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
var SYNC_BASE = 'cancionero-fdp/v1/sala/';
var sync = { role: null, code: '', sid: '', seq: 0, links: [], bc: null, hb: 0, lastSong: '', lastSeq: {}, lastSid: '', songId: null, sh: null, stu: null, leader: '', gotAt: 0 };
var syncOverride = {};

/* ---------- cliente MQTT 3.1.1 mínimo sobre WebSocket (QoS 0) ---------- */
function mqttClient(url, clientId, onMsg, onState) {
  var ws = null, buf = new Uint8Array(0), alive = false, pingT = 0, subs = [], pid = 1, te = new TextEncoder(), td = new TextDecoder();
  function str(x) { var b = te.encode(x); return [b.length >> 8, b.length & 255].concat(Array.prototype.slice.call(b)); }
  function remLen(n) { var out = []; do { var d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; out.push(d); } while (n > 0); return out; }
  function packet(type, body) { return new Uint8Array([type].concat(remLen(body.length), body)); }
  function send(p) { try { if (ws && ws.readyState === 1) ws.send(p); } catch (e) { /* se reconecta solo */ } }
  function sub(t) { var id = (pid++ & 0xffff) || 1; send(packet(0x82, [id >> 8, id & 255].concat(str(t), [0]))); }
  function parse() {
    while (buf.length >= 2) {
      var mul = 1, val = 0, k = 1, byte;
      do { if (k >= buf.length) return; byte = buf[k++]; val += (byte & 127) * mul; mul *= 128; } while (byte & 128);
      if (buf.length < k + val) return;
      var type = buf[0] >> 4, flags = buf[0] & 15, body = buf.subarray(k, k + val);
      buf = buf.slice(k + val);
      if (type === 2) {                                                        // CONNACK
        if (body[1] === 0) { alive = true; subs.forEach(sub); pingT = setInterval(function () { send(new Uint8Array([0xC0, 0])); }, 20000); onState('open'); }
        else onState('error');
      } else if (type === 3) {                                                 // PUBLISH
        var tl = (body[0] << 8) | body[1], topic = td.decode(body.subarray(2, 2 + tl)), off = 2 + tl;
        if ((flags >> 1) & 3) off += 2;
        try { onMsg(topic, td.decode(body.subarray(off))); } catch (e) { /* mensaje dañado */ }
      }
    }
  }
  try { ws = new WebSocket(url, ['mqtt']); } catch (e) { setTimeout(function () { onState('error'); }, 0); ws = null; }
  if (ws) {
    ws.binaryType = 'arraybuffer';
    ws.onopen = function () { send(packet(0x10, str('MQTT').concat([4, 2, 0, 45]).concat(str(clientId)))); };
    ws.onmessage = function (ev) { var b = new Uint8Array(ev.data), n = new Uint8Array(buf.length + b.length); n.set(buf); n.set(b, buf.length); buf = n; parse(); };
    ws.onclose = function () { var was = alive; alive = false; clearInterval(pingT); onState(was ? 'closed' : 'error'); };
    ws.onerror = function () { /* llega también onclose */ };
  }
  return {
    subscribe: function (t) { subs.push(t); if (alive) sub(t); },
    publish: function (t, payload, retain) {
      if (!alive) return false;
      var p = te.encode(payload);
      send(packet(0x30 | (retain ? 1 : 0), str(t).concat(Array.prototype.slice.call(p)))); return true;
    },
    close: function () { clearInterval(pingT); try { send(new Uint8Array([0xE0, 0])); if (ws) ws.close(); } catch (e) { /* nada */ } alive = false; },
    isOpen: function () { return alive; }
  };
}

/* ---------- conexión: varios servidores a la vez + otras ventanas del mismo equipo ---------- */
function syncTopic(kind) { return SYNC_BASE + sync.code + '/' + kind; }
function syncOpen() {
  var code = sync.code;
  try { sync.bc = new BroadcastChannel('cfp-sala-' + code); sync.bc.onmessage = function (e) { if (e.data) syncIn(e.data.k, e.data.m); }; } catch (e) { sync.bc = null; }
  var list = LS.get('cfp.sync.brokers', null) || SYNC_BROKERS;
  sync.links = [];
  list.slice(0, 2).forEach(function (u) { syncLink(u); });
  if (list[2]) setTimeout(function () {
    if (sync.code === code && sync.role && !sync.links.some(function (l) { return l.c && l.c.isOpen(); }) && !sync.links.some(function (l) { return l.url === list[2]; })) syncLink(list[2]);
  }, 7000);
}
function syncLink(url) {
  var L = { url: url, c: null, tries: 0, dead: false }, code = sync.code;
  var go = function () {
    if (L.dead || sync.code !== code || !sync.role) return;
    L.c = mqttClient(url, 'cfp' + Math.random().toString(36).slice(2, 12), function (topic, payload) {
      syncIn(topic.split('/').pop(), payload);
    }, function (state) {
      if (state === 'open') { L.tries = 0; if (sync.role === 'guia') syncTick(true); }
      else if (!L.dead) { L.tries++; setTimeout(go, Math.min(20000, 2500 * L.tries)); }
      syncStatusDraw();
    });
    if (sync.role === 'sigue') { L.c.subscribe(syncTopic('song')); L.c.subscribe(syncTopic('pos')); }
  };
  sync.links.push(L); go();
}
function syncOnline() { return sync.links.filter(function (l) { return l.c && l.c.isOpen(); }).length; }
function syncSend(kind, obj, retain) {
  obj.v = 1; obj.sid = sync.sid; obj.seq = ++sync.seq; obj.t = Date.now(); obj.name = LS.get('cfp.sync.name', '') || '';
  var raw = JSON.stringify(obj);
  if (sync.bc) try { sync.bc.postMessage({ k: kind, m: raw }); } catch (e) { /* nada */ }
  sync.links.forEach(function (l) { if (l.c) l.c.publish(syncTopic(kind), raw, retain); });
}
function syncClose(clearRetained) {
  clearInterval(sync.hb); sync.hb = 0;
  if (clearRetained) sync.links.forEach(function (l) { if (l.c && l.c.isOpen()) { l.c.publish(syncTopic('song'), '', true); l.c.publish(syncTopic('pos'), '', true); } });
  var links = sync.links; sync.links = [];
  setTimeout(function () { links.forEach(function (l) { l.dead = true; if (l.c) l.c.close(); }); }, clearRetained ? 400 : 0);
  if (sync.bc) { try { sync.bc.close(); } catch (e) { /* nada */ } sync.bc = null; }
}

/* ---------- guiar ---------- */
function syncCode() { return String(1000 + Math.floor(Math.random() * 9000)); }
function syncLead() {
  syncStop(true);
  sync.role = 'guia'; sync.code = syncCode(); sync.sid = newId('g'); sync.seq = 0; sync.lastSong = '';
  syncOpen();
  sync.hb = setInterval(function () { var st = liveState; if (st && (st.playing || (st.mode === 'listen' && ear))) syncTick(); }, 2000);
  syncTick(true);
}
/* Quien guía avisa: la canción (con sus compases, tal como está en este equipo) y en qué acorde y tiempo va. */
function syncTick(force) {
  if (sync.role !== 'guia') return;
  var st = liveState;
  if (!st || !lid('live')) { syncSend('pos', { id: null, playing: false }, true); return; }
  var sig = st.song.id + '|' + songShift(st.song);
  if (force || sync.lastSong !== sig) {
    sync.lastSong = sig;
    syncSend('song', { id: st.song.id, song: cleanSong(st.song), sh: songShift(st.song) }, true);
  }
  var moving = !!(st.playing || (st.mode === 'listen' && ear));
  syncSend('pos', { id: st.song.id, i: st.i, n: st.path.length, bpm: st.bpm || 0, playing: moving,
    beat: st.startB ? (moving ? beatNow() : st.startB[st.i]) : 0 }, true);
}

/* ---------- seguir ---------- */
function syncFollow(code, sid) {
  code = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (code.length < 4) { toast('El código tiene 4 números.'); return false; }
  syncStop(true);
  sync.role = 'sigue'; sync.code = code; sync.lastSeq = {}; sync.lastSid = ''; sync.songId = null; sync.sh = null; sync.stu = sid || null; sync.gotAt = 0;
  LS.set('cfp.sync.last', { code: code, stu: sync.stu, t: Date.now() });
  syncOpen();
  return true;
}
function syncIn(kind, raw) {
  if (sync.role !== 'sigue' || (kind !== 'song' && kind !== 'pos') || !raw) return;
  var m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || m.v !== 1) return;
  if (m.t && Date.now() - m.t > 6 * 3600e3) return;                        // de otra reunión
  if (m.sid !== sync.lastSid) { sync.lastSid = m.sid; sync.lastSeq = {}; }
  if (m.seq <= (sync.lastSeq[kind] || 0)) return;                          // repetido (llegó por dos caminos)
  sync.lastSeq[kind] = m.seq; sync.gotAt = Date.now(); sync.leader = m.name || '';
  if (kind === 'song') syncApplySong(m); else syncApplyPos(m);
  syncStatusDraw();
}
function syncApplySong(m) {
  if (!m.id || !m.song) return;
  var same = sync.songId === m.id && sync.sh === m.sh && liveState && current.song && current.song.id === m.id;
  syncOverride = {}; syncOverride[m.id] = Object.assign({}, m.song, { id: m.id });
  delete infoCache[m.id];
  sync.songId = m.id; sync.sh = m.sh;
  var sid = sync.stu && getStudent(sync.stu) ? sync.stu : (stuLive && getStudent(stuLive.sid) ? stuLive.sid : stuData().device);
  var hash = sid && getStudent(sid) ? '#/a/' + enc(sid) + '/' + enc(m.id) : '#/s/' + enc(m.id) + '/vivo';
  if (same) return;
  if (location.hash === hash) render(); else location.hash = hash;
}
function syncApplyPos(m) {
  sync.pos = m;
  var st = liveState;
  if (!st || !current.song || current.song.id !== m.id || st.mode !== 'sync') return;
  var i = Math.max(0, Math.min(st.path.length - 1, m.i | 0)), now = performance.now();
  if (st.startB && m.playing && m.bpm) {
    st.bpm = m.bpm; st.beat0 = (m.beat || st.startB[i]) + 0.12 * m.bpm / 60; st.t0 = now;     // ~0,12 s del viaje por internet
    if (!st.playing) { st.playing = true; if (i === st.i) drawLive(); cancelAnimationFrame(st.raf); loop(); }
  } else if (st.playing) { st.playing = false; cancelAnimationFrame(st.raf); if (i === st.i) drawLive(); }
  if (i !== st.i) setLiveIndex(i, true);
  rollKick();
}
function syncStop(quiet) {
  var was = sync.role;
  syncClose(was === 'guia');
  sync.role = null; sync.code = ''; syncOverride = {}; sync.songId = null; sync.sh = null; sync.pos = null;
  if (was === 'sigue') LS.del('cfp.sync.last');
  if (was && !quiet) {
    toast(was === 'guia' ? 'Ya no guías a otras pantallas.' : 'Ya no sigues a otra pantalla.', 3000);
    if (liveState && liveState.mode === 'sync') relive();
  }
}
/* Al abrir la app otra vez (el celular se bloqueó o se recargó): si seguía a una sala hace poco, se vuelve a unir. */
function syncResume() {
  var o = LS.get('cfp.sync.last', null);
  if (o && o.code && Date.now() - o.t < 3 * 3600e3) { syncFollow(o.code, o.stu); toast('Siguiendo la sala ' + o.code + '. Para dejarla: «Pantallas conectadas».', 4000); }
}
function syncLabel() { return 'Sala ' + sync.code; }
function syncStatusText() {
  if (sync.role !== 'sigue') return 'Pantallas conectadas';
  var n = syncOnline();
  if (!n && !sync.bc) return 'Sala ' + sync.code + ': sin conexión';
  if (!sync.gotAt) return 'Sala ' + sync.code + ': esperando a quien guía…';
  return 'Siguiendo ' + (sync.leader ? 'a ' + sync.leader : 'la sala ' + sync.code) + (n ? '' : ' (sin internet)');
}
function syncStatusDraw() {
  var el = document.getElementById('sy-state'); if (el) el.innerHTML = syncStateHTML();
  if (liveState && liveState.mode === 'sync') { var nav = lid('lv-nav'); if (nav) nav.innerHTML = navHTML(); }
}
function syncStateHTML() {
  var n = syncOnline();
  if (n) return '<b class="ok">Conectado por internet</b> (' + n + (n === 1 ? ' servidor' : ' servidores') + ').';
  return sync.links.length ? 'Buscando conexión por internet… En esta misma laptop, otra ventana ya funciona sin internet.' : '';
}
function openSyncSheet(sid) {
  if (typeof sid !== 'string') sid = stuLive ? stuLive.sid : null;
  var name = LS.get('cfp.sync.name', '');
  var body;
  if (sync.role === 'guia') {
    body = '<p class="help">Los otros celulares entran con este código (o con la invitación) y ven la canción y el acorde que va aquí, cada uno con su parte.</p>' +
      '<p class="sy-code">' + esc(sync.code) + '</p><p class="help" id="sy-state">' + syncStateHTML() + '</p>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-sy="invite">' + icon('share') + 'Invitar por WhatsApp</button>' +
      '<button type="button" class="btn" data-sy="win">Abrir otra ventana (misma laptop)</button><button type="button" class="btn danger" data-sy="stop">Dejar de guiar</button></div>';
  } else if (sync.role === 'sigue') {
    body = '<p class="sy-code">' + esc(sync.code) + '</p><p class="help" id="sy-state">' + esc(syncStatusText()) + '<br>' + syncStateHTML() + '</p>' +
      '<div class="btnrow"><button type="button" class="btn danger" data-sy="stop">Dejar de seguir</button></div>';
  } else {
    body = '<p class="help">Una pantalla guía y las demás la siguen: la laptop que escucha la guitarra (o el celular de quien pasa con el pedal) y los celulares de los chicos, cada uno con su parte.</p>' +
      '<div class="field"><label for="sy-n">Tu nombre (lo ven los demás)</label><input id="sy-n" value="' + esc(name) + '" autocomplete="off"></div>' +
      '<div class="btnrow"><button type="button" class="btn primary" data-sy="lead">' + icon('share') + 'Guiar desde esta pantalla</button></div>' +
      '<div class="field"><label for="sy-c">¿Te pasaron un código? Escríbelo para seguir esa pantalla</label><input id="sy-c" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="4 números"></div>' +
      '<div class="btnrow"><button type="button" class="btn" data-sy="join">Seguir</button></div>' +
      '<p class="help">Necesita internet en cada equipo: datos del celular o wifi. La zona móvil de la laptop sirve si la laptop tiene internet. Gasta muy pocos datos. Sin internet, una segunda ventana en la misma laptop también se conecta.</p>';
  }
  openSheet('Pantallas conectadas', body, function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sy]'); if (!b) return;
      var a = b.getAttribute('data-sy');
      if (a === 'lead') { var n = el.querySelector('#sy-n').value.trim(); LS.set('cfp.sync.name', n); syncLead(); closeSheet(true); openSyncSheet(sid); }
      else if (a === 'join') { if (syncFollow(el.querySelector('#sy-c').value, sid)) { closeSheet(true); toast('Siguiendo la sala ' + sync.code + '. La canción aparece cuando quien guía la abre.', 4500); if (liveState) relive(); } }
      else if (a === 'stop') { syncStop(); closeSheet(true); }
      else if (a === 'invite') { var u = location.href.split('#')[0] + '#/sala/' + sync.code; shareText('Entra a la sala del cancionero para seguir la canción en tu celular: ' + u + ' (código ' + sync.code + ')', 'Sala ' + sync.code); }
      else if (a === 'win') { try { window.open(location.href.split('#')[0] + '#/sala/' + sync.code, '_blank', 'noopener'); } catch (x) { toast('No se pudo abrir otra ventana.'); } }
    });
  });
}

/* parte 15: ¿quién va a tocar? — perfiles del equipo y el espacio de cada alumno
   Pantalla de entrada con un botón grande por persona. Cada alumno tiene su espacio con cinco pestañas: sus canciones,
   el cancionero, practicar, logros y ajustes. En el celular de un alumno unido al grupo, lo que cambia se prueba al
   instante y le llega al director para que lo apruebe (parte 16). */
var WHO_KEY = 'cfp.who';
ICONS.trophy = '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5a3.5 3.5 0 0 0 4 4M16 6h3.5a3.5 3.5 0 0 1-4 4M12 13v4M8 20h8M10 17h4"/>';
ICONS.swap = '<path d="M7 8h12l-3.5-3.5M17 16H5l3.5 3.5"/>';
ICONS.check = '<path d="M5 12.5l4.5 4.5L19 7"/>';
ICONS.inbox = '<path d="M4 13l2.5-7h11L20 13v6H4v-6zM4 13h5l1 2h4l1-2h5"/>';
ICONS.group = '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M3.5 19c.6-3.3 2.8-5 5.5-5s4.9 1.7 5.5 5M14.5 14.6c.8-.4 1.6-.6 2.5-.6 2.2 0 3.8 1.4 4.3 4"/>';
var CFG_FIELDS = ['part', 'home', 'notes', 'rhythm', 'oct', 'hands', 'shape', 'nums', 'colors', 'zone'];
function whoGet() { try { return JSON.parse(sessionStorage.getItem(WHO_KEY) || 'null'); } catch (e) { return null; } }
function whoSet(w) { try { if (w) sessionStorage.setItem(WHO_KEY, JSON.stringify(w)); else sessionStorage.removeItem(WHO_KEY); } catch (e) { /* nada */ } }
function isDirDevice() { var g = grupoInfo(); return g ? g.role === 'dir' : !stuData().device; }
function whoKid() {
  var w = whoGet();
  if (w) return w.k === 'a' ? getStudent(w.sid) : null;
  var dev = stuData().device;
  return dev && !isDirDevice() ? getStudent(dev) : null;
}
function needsApproval() { var g = grupoInfo(); return !!(g && g.role === 'alumno' && whoKid()); }
function dirName() { var g = grupoInfo(); return (g && g.dirName) || LS.get('cfp.dirName', '') || ''; }
function dirMsg() { return dirName() || 'tu profe'; }
function cfgPick(pr) { var c = cfgNorm(pr), o = {}; CFG_FIELDS.forEach(function (k) { if (c[k] !== undefined) o[k] = c[k]; }); return o; }
function deviceStudents() {
  var d = stuData(), g = grupoInfo();
  if (g && g.role === 'alumno') return d.list.filter(function (pr) { return (g.sids || []).indexOf(pr.id) >= 0; });
  return d.list;
}
function pickerEntries() {
  var out = deviceStudents().map(function (pr) { return { k: 'a', sid: pr.id, name: pr.name, color: pr.color, sub: PARTS[cfgNorm(pr).part] }; });
  if (isDirDevice()) out.push({ k: 'd', name: dirName() || 'Director', color: '#1e2447', sub: 'Todo el cancionero' });
  return out;
}
function autoWho() {
  var dev = stuData().device;
  if (dev && getStudent(dev) && !isDirDevice()) return { k: 'a', sid: dev };
  if (!stuData().list.length) return { k: 'd' };
  var e = pickerEntries();
  if (e.length === 1) return e[0].k === 'a' ? { k: 'a', sid: e[0].sid } : { k: 'd' };
  return null;
}
/* ---------- pantalla de entrada ---------- */
function renderPicker() {
  leaveSong(); stuLive = null; whoSet(null);
  var e = pickerEntries();
  if (!e.length) { whoSet({ k: 'd' }); location.replace('#/'); return; }
  var nIn = typeof inboxCount === 'function' ? inboxCount() : 0;
  app.innerHTML = '<div class="quien"><h1>¿Quién va a tocar?</h1><ul class="quien-l">' + e.map(function (x) {
    return '<li><button type="button" class="quien-b" data-q="' + (x.k === 'd' ? 'd' : 'a:' + esc(x.sid)) + '" style="--c:' + esc(x.color || '#3a43c4') + '">' +
      '<span class="quien-av">' + esc((x.name || '?').charAt(0).toUpperCase()) + (x.k === 'd' && nIn ? '<em class="badge">' + nIn + '</em>' : '') + '</span>' +
      '<span class="quien-n">' + esc(x.name) + '</span><span class="quien-s">' + esc(x.sub || '') + '</span></button></li>';
  }).join('') + '</ul>' + (isDirDevice() ? '<p class="quien-f"><button type="button" class="linkbtn" data-q="adm">Alumnos y grupo</button></p>' : '') + '</div>';
  app.querySelector('.quien').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-q]'); if (!b) return;
    var q = b.getAttribute('data-q');
    if (q === 'd' || q === 'adm') askPin(function () { whoSet({ k: 'd' }); location.hash = q === 'adm' ? '#/a' : '#/'; });
    else { whoSet({ k: 'a', sid: q.slice(2) }); location.hash = '#/a/' + enc(q.slice(2)); }
  });
}
function pinHash(p) { var h = 7; for (var i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0; return 'p' + h.toString(36); }
function askPin(then) {
  var ph = LS.get('cfp.dirPin', ''); if (!ph) { then(); return; }
  openSheet('Clave de ' + (dirName() || 'director'), '<div class="field"><label for="pin-i">Escribe la clave</label><input id="pin-i" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>' +
    '<p class="help" id="pin-m"></p><div class="btnrow"><button type="button" class="btn primary" data-x="ok">Entrar</button></div>', function (el) {
    var inp = el.querySelector('#pin-i');
    var go = function () { if (pinHash(inp.value) === ph) { closeSheet(true); then(); } else { el.querySelector('#pin-m').textContent = 'Esa no es la clave.'; inp.value = ''; inp.focus(); } };
    setTimeout(function () { inp.focus(); }, 60);
    el.querySelector('[data-x="ok"]').addEventListener('click', go);
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
  });
}
function openPinSheet(after) {
  var has = !!LS.get('cfp.dirPin', '');
  openSheet(has ? 'Cambiar la clave' : 'Poner clave', '<p class="help">Una clave corta (4 números) para que los chicos no entren a tu perfil sin querer. No es una caja fuerte: es un seguro para niños.</p>' +
    '<div class="field"><label for="pin-n">Clave nueva</label><input id="pin-n" type="password" inputmode="numeric" maxlength="8" autocomplete="off"></div>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-x="ok">Guardar</button>' + (has ? '<button type="button" class="btn" data-x="del">Quitar la clave</button>' : '') + '</div>', function (el) {
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-x]'); if (!b) return;
      if (b.getAttribute('data-x') === 'del') LS.set('cfp.dirPin', '');
      else { var v = el.querySelector('#pin-n').value.trim(); if (v.length < 3) { toast('Usa al menos 3 números.'); return; } LS.set('cfp.dirPin', pinHash(v)); }
      closeSheet(true); toast('Listo.'); if (after) after();
    });
  });
}
/* ---------- espacio del alumno ---------- */
var KID_TABS = [['canciones', 'Mis canciones', 'star'], ['cancionero', 'Cancionero', 'book'], ['practicar', 'Practicar', 'keys'], ['logros', 'Logros', 'trophy'], ['ajustes', 'Ajustes', 'gear']];
function kidHref(sid, tab) { return tab === 'canciones' ? '#/a/' + enc(sid) : '#/k/' + enc(sid) + '/' + tab; }
function kidHeadHTML(pr, kid, back) {
  var c = cfgNorm(pr), home = HOMES.filter(function (h) { return h[0] === c.home; })[0];
  var sub = PARTS[c.part].replace(/ \(.*\)$/, '') + ' · ' + (c.home < 0 ? 'en el tono de la banda' : 'en ' + (home ? home[1] : 'Do')) + ' · ' + RHYTHMS[c.rhythm].replace(/ \(.*\)$/, '').toLowerCase();
  var sw = !kid || pickerEntries().length > 1;
  return '<header class="kid-h">' + (back ? btnIcon('back', 'Volver', 'data-go="' + back + '"') : kid ? '' : btnIcon('back', 'Volver a los alumnos', 'data-go="#/a"')) +
    '<span class="avatar" style="--c:' + esc(pr.color) + '">' + esc((pr.name || '?').charAt(0).toUpperCase()) + '</span>' +
    '<div class="kid-t"><h1>' + esc(pr.name) + '</h1><p>' + esc(sub) + '</p></div>' +
    (sw ? btnIcon('swap', 'Cambiar de perfil', 'data-go="#/quien"') : '') + '</header>';
}
function kidTabsHTML(pr, tab) {
  return '<nav class="kid-tabs" aria-label="Secciones">' + KID_TABS.map(function (t) {
    return '<a href="' + kidHref(pr.id, t[0]) + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + icon(t[2]) + '<span>' + t[1] + '</span></a>';
  }).join('') + '</nav>';
}
function renderKid(sid, tab) {
  leaveSong();
  var pr = getStudent(sid); if (!pr) { location.replace(whoKid() ? '#/quien' : '#/a'); return; }
  if (!liveState) stuLive = null;
  tab = tab || 'canciones';
  if (KID_TABS.every(function (t) { return t[0] !== tab; })) tab = 'canciones';
  var kid = !!whoKid(), body;
  if (tab === 'canciones') body = kidSongsHTML(pr, kid);
  else if (tab === 'cancionero') body = kidBookHTML(pr);
  else if (tab === 'practicar') body = kidPracticeHTML(pr);
  else if (tab === 'logros') body = kidLogrosHTML(pr);
  else body = kidAjustesHTML(pr, kid);
  app.innerHTML = '<div class="kid" style="--c:' + esc(pr.color) + '">' + kidHeadHTML(pr, kid) + '<main class="kid-b" id="kid-b">' + body + '</main>' + kidTabsHTML(pr, tab) + '</div>';
  kidBind(pr, tab);
}
function kidNext(pr) {
  var best = null;
  (pr.songs || []).forEach(function (id, i) {
    var s = getSong(id); if (!s) return;
    var p = stuProg(pr, id), n = Object.keys(p.stars || {}).length; if (n >= 4) return;
    var score = n * 10 + i * 0.1 + (p.last && Date.now() - p.last < 20 * 3600e3 ? 3 : 0);
    if (!best || score < best.score) best = { s: s, p: p, score: score };
  });
  return best;
}
function kidSongsHTML(pr, kid) {
  var sid = pr.id;
  var rows = (pr.songs || []).map(function (id) {
    var s = getSong(id); if (!s) return '';
    var p = stuProg(pr, id), f = songFit(s, pr), tl = !!s.timeline;
    return '<li class="stu-song"><a class="ttl" href="#/a/' + enc(sid) + '/' + enc(id) + '">' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) +
      '<small>Escalón ' + p.step + ': ' + LEVELS[p.step].name + ' · acordes ' + esc(f.list.join(' ')) + (tl ? '' : ' · sin compases') + '</small></a>' +
      starsHTML(p) + '<a class="btn primary play" href="#/a/' + enc(sid) + '/' + enc(id) + '" aria-label="Tocar ' + esc(C.sentenceCase(s.title)) + '">' + icon('play') + '</a></li>';
  }).join('');
  var m = Object.keys(masteredSet(pr)), learning = Object.keys(pr.chords || {}).filter(function (k) { return !pr.chords[k].mastered && pr.chords[k].seen; });
  var sug = allSongs().filter(function (s) { return (pr.songs || []).indexOf(s.id) < 0 && info(s).seq.length; }).map(function (s) { return { s: s, f: songFit(s, pr) }; })
    .filter(function (x) { return m.length ? x.f.cover >= 0.9 : x.f.n <= 3; })
    .sort(function (a, b) { return a.f.n - b.f.n || b.f.cover - a.f.cover; }).slice(0, 5);
  var nx = kidNext(pr);
  var tip = kid && !LS.get('cfp.tip.' + sid, false) ? '<div class="note-box kid-tip">' + icon('star') + '<span><b>¡Hola, ' + esc(pr.name) + '!</b> Empieza con «Tocar» en «Para hoy». Si tu piano no tiene cable, dentro de la canción toca «Que el celular me escuche». En «Practicar» hay juegos para aprender las teclas. ' +
    '<button type="button" class="linkbtn" data-k="tipok">Entendido</button></span></div>' : '';
  return tip + (typeof propNoticesHTML === 'function' ? propNoticesHTML(sid) : '') +
    (nx ? '<section class="today"><p class="today-k">' + (kid ? 'Para hoy' : 'Le toca') + '</p><h2>' + esc(C.sentenceCase(nx.s.title)) + '</h2>' +
      '<p class="today-s">Escalón ' + nx.p.step + ': ' + esc(LEVELS[nx.p.step].name) + '</p>' + starsHTML(nx.p, true) +
      '<a class="btn primary big" href="#/a/' + enc(sid) + '/' + enc(nx.s.id) + '">' + icon('play') + 'Tocar</a></section>' : '') +
    weekHTML(pr) +
    '<h2 class="stu-h">' + (kid ? 'Tus canciones' : 'Sus canciones') + '</h2>' +
    (rows ? '<ol class="list stu-list">' + rows + '</ol>' : '<p class="empty">Todavía no hay canciones. Elige unas pocas para empezar: mejor 3 o 4 bien tocadas que muchas a medias.</p>') +
    '<div class="btnrow"><button type="button" class="btn" data-sact="pick">' + icon('add') + 'Elegir canciones</button>' +
    '<button type="button" class="btn" data-sact="follow">' + icon('share') + 'Seguir a otra pantalla</button></div>' +
    '<h2 class="stu-h">Acordes</h2><p class="stu-chords">' + (m.length ? 'Ya dominas: <b>' + esc(m.join(' · ')) + '</b>' : 'Todavía ninguno dominado.') +
    (learning.length ? '<br>Practicando: ' + esc(learning.join(' · ')) : '') + '</p>' +
    (sug.length ? '<h2 class="stu-h">' + (m.length ? 'Con tus acordes ya puedes tocar' : 'Las más fáciles para empezar') + '</h2><ul class="list stu-sug">' + sug.map(function (x) {
      return '<li><span class="ttl">' + esc(C.sentenceCase(x.s.title)) + '<small>' + x.f.n + (x.f.n === 1 ? ' acorde: ' : ' acordes: ') + esc(x.f.list.join(' ')) + '</small></span>' +
        '<button type="button" class="btn" data-sadd="' + esc(x.s.id) + '">' + icon('add') + 'Añadir</button></li>';
    }).join('') + '</ul>' : '');
}
function dayKey(dt) { return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); }
function weekDays(pr) {
  var out = [], now = new Date(), dow = (now.getDay() + 6) % 7;
  for (var k = 0; k < 7; k++) {
    var dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + k), key = dayKey(dt);
    out.push({ k: key, d: 'LMMJVSD'.charAt(k), min: (pr.log || {})[key] || 0, today: k === dow });
  }
  return out;
}
function weekHTML(pr) {
  var w = weekDays(pr), n = w.filter(function (x) { return x.min >= 1; }).length;
  return '<section class="week" aria-label="Días que practicó esta semana: ' + n + ' de 4"><p class="week-t">Esta semana: <b>' + n + '</b> de 4 días' + (n >= 4 ? ' ' + icon('star') : '') + '</p><ol>' +
    w.map(function (x) { return '<li class="' + (x.min >= 1 ? 'on' : '') + (x.today ? ' hoy' : '') + '" title="' + x.k + ': ' + Math.round(x.min) + ' min"><span>' + x.d + '</span></li>'; }).join('') + '</ol></section>';
}
function kidLog(sid, min) {
  if (!(min > 0.15)) return;
  var pr = getStudent(sid); if (!pr) return;
  pr.log = pr.log || {};
  var k = dayKey(new Date());
  pr.log[k] = Math.round(((pr.log[k] || 0) + Math.min(90, min)) * 10) / 10;
  var ks = Object.keys(pr.log).sort(); while (ks.length > 70) delete pr.log[ks.shift()];
  putStudent(pr);
}
function kidBookRows(pr, q) {
  q = C.normalize(q || '');
  var mine = pr.songs || [];
  var list = allSongs().filter(function (s) { return info(s).seq.length && (!q || C.normalize((s.num || '') + ' ' + s.title + ' ' + (s.author || '')).indexOf(q) >= 0); });
  if (!list.length) return '<li class="empty">No hay canciones con ese nombre.</li>';
  return list.slice(0, 250).map(function (s) {
    var f = songFit(s, pr), on = mine.indexOf(s.id) >= 0;
    return '<li><a class="row" href="#/k/' + enc(pr.id) + '/c/' + enc(s.id) + '"><span class="txt"><span class="ttl">' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) +
      (on ? ' <i class="kmine" title="En tus canciones">' + icon('star') + '</i>' : '') + '</span><span class="sub">' + f.n + (f.n === 1 ? ' acorde: ' : ' acordes: ') + esc(f.list.join(' ')) + '</span></span>' + icon('fwd') + '</a></li>';
  }).join('');
}
function kidBookHTML(pr) {
  return '<label class="search kid-search">' + icon('search') + '<input id="kq" type="search" placeholder="Buscar por título o número" autocomplete="off" aria-label="Buscar canción"></label>' +
    '<ul class="list kid-book" id="kid-bl">' + kidBookRows(pr, '') + '</ul>' +
    '<div class="btnrow"><a class="btn" href="#/e/nueva">' + icon('add') + (needsApproval() ? 'Proponer una canción nueva' : 'Nueva canción') + '</a></div>';
}
function renderKidSong(sid, id) {
  leaveSong();
  var pr = getStudent(sid), s = getSong(id);
  if (!pr || !s) { location.replace(pr ? '#/k/' + enc(sid) + '/cancionero' : '#/'); return; }
  var inf = info(s), sh = songShift(s), mine = (pr.songs || []).indexOf(id) >= 0, f = songFit(s, pr), kid = !!whoKid();
  current.song = s; ctx.setlist = null; ctx.index = -1;
  app.innerHTML = '<div class="kid" style="--c:' + esc(pr.color) + '">' + kidHeadHTML(pr, kid, '#/k/' + enc(sid) + '/cancionero') +
    '<main class="kid-b"><h2 class="kid-st">' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) + '</h2>' +
    '<p class="kid-sub">' + f.n + (f.n === 1 ? ' acorde para tu parte: ' : ' acordes para tu parte: ') + esc(f.list.join(' ')) + (s.timeline ? '' : ' · todavía sin compases') + '</p>' +
    '<div class="btnrow"><a class="btn primary big" href="#/a/' + enc(sid) + '/' + enc(id) + '">' + icon('play') + 'Tocar</a>' +
    (mine ? '<span class="pill">' + icon('star') + 'En tus canciones</span>' : '<button type="button" class="btn" data-k="add" data-id="' + esc(id) + '">' + icon('add') + 'Agregar a mis canciones</button>') +
    '<button type="button" class="btn" data-k="nums" data-id="' + esc(id) + '">' + icon('share') + 'Mandar en números</button>' +
    '<a class="btn" href="#/e/' + enc(id) + '">' + icon('edit') + (needsApproval() ? 'Proponer un cambio' : 'Editar') + '</a></div>' +
    '<div class="song kid-song" id="song-body">' + bodyHTML(s, fmtFor(inf.key, sh, 'num')) + '</div></main>' + kidTabsHTML(pr, 'cancionero') + '</div>';
  if (typeof fixCollisions === 'function') fixCollisions(lid('song-body'));
  kidBind(pr, 'cancion');
}
function kidPracticeHTML(pr) {
  var c = cfgNorm(pr);
  var card = function (k, ic, t, d) { return '<button type="button" class="kcard" data-k="' + k + '"><span class="kcard-i">' + icon(ic) + '</span><span class="kcard-t">' + t + '</span><span class="kcard-d">' + d + '</span></button>'; };
  return '<div class="kcards">' +
    card('finder', 'mic', '¿Qué tecla es?', 'Toca una tecla y el celular te dice su número. Sirve también para probar el micrófono.') +
    card('notas', 'keys', 'Juego de notas', 'La app te pide un número y tú lo encuentras. Primero con ayuda; cuando aciertas seguido, sin ayuda.') +
    (c.part !== 'bajo' ? card('acordes', 'keys', 'Juego de acordes', 'Los acordes 1, 4, 5, 6m y 2m: las posiciones de casi todas tus canciones.') : '') +
    card('video', 'video', 'Practicar con un video', 'Pega un enlace de YouTube, ponlo más lento y repite una parte hasta que salga.') +
    card('metro', 'metro', 'Metrónomo', 'Para practicar a tempo, empezando lento.') +
    card('midi', 'keys', midi.inp ? 'Teclado conectado' : 'Conectar el teclado (cable)', 'Si tu piano tiene USB, con un cable OTG al celular la app ve cada tecla que tocas.') +
    '</div><p class="help">Sin cable también se puede: dentro de cada canción toca «Que el celular me escuche» y pon el celular cerca del piano. Poco y seguido: 10 a 15 minutos, cuatro o cinco días a la semana.</p>';
}
function kidLogrosHTML(pr) {
  var tot = 0;
  Object.keys(pr.prog || {}).forEach(function (id) { tot += Object.keys((pr.prog[id] || {}).stars || {}).length; });
  var m = Object.keys(masteredSet(pr)), learning = Object.keys(pr.chords || {}).filter(function (k) { return !pr.chords[k].mastered && pr.chords[k].seen; });
  var w = weekDays(pr), days = w.filter(function (x) { return x.min >= 1; }).length, mins = Math.round(w.reduce(function (a, x) { return a + x.min; }, 0)), g = pr.games || {};
  var rows = (pr.songs || []).map(function (id) { var s = getSong(id); if (!s) return ''; return '<li><span class="ttl">' + esc(C.sentenceCase(s.title)) + '</span>' + starsHTML(stuProg(pr, id)) + '</li>'; }).join('');
  return '<div class="kstats"><div><b>' + tot + '</b><span>estrellas</span></div><div><b>' + m.length + '</b><span>acordes dominados</span></div><div><b>' + days + '<small>/4</small></b><span>días esta semana</span></div></div>' +
    weekHTML(pr) + '<p class="help">' + mins + (mins === 1 ? ' minuto' : ' minutos') + ' de práctica esta semana. Mejor poco y seguido: 10 a 15 minutos, cuatro o cinco días.</p>' +
    (rows ? '<h2 class="stu-h">Estrellas por canción</h2><ul class="list klog">' + rows + '</ul>' : '') +
    '<h2 class="stu-h">Acordes</h2><p class="stu-chords">' + (m.length ? 'Dominados: <b>' + esc(m.join(' · ')) + '</b>' : 'Todavía ninguno dominado.') + (learning.length ? '<br>Practicando: ' + esc(learning.join(' · ')) : '') + '</p>' +
    (g.notas || g.acordes ? '<h2 class="stu-h">Juegos</h2><p class="stu-chords">' + (g.notas ? 'Notas: <b>' + g.notas + '/10</b> a la primera. ' : '') + (g.acordes ? 'Acordes: <b>' + g.acordes + '/10</b> a la primera.' : '') + '</p>' : '') +
    '<p class="help">Cada canción tiene 4 estrellas: con ayuda, a tiempo, solo números y de memoria. La que más vale es la última: tocar sin mirar.</p>';
}
function chkHTML(id, on, label) { return '<label class="chk"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> <span>' + esc(label) + '</span></label>'; }
function kidAjustesHTML(pr, kid) {
  var g = grupoInfo(), appr = kid && needsApproval();
  return (appr ? '<p class="note-box">' + icon('inbox') + '<span>Los cambios de cómo tocas los revisa ' + esc(dirMsg()) + '. Mientras tanto ya los puedes usar.</span></p>' : '') +
    '<h2 class="stu-h">Cómo ' + (kid ? 'tocas' : 'toca') + '</h2><div id="kid-cfg">' + cfgEditorHTML(cfgNorm(pr)) + '</div>' +
    '<h2 class="stu-h">Este equipo</h2>' +
    (g && g.role === 'dir' ? '' : chkHTML('ka-dev', stuData().device === pr.id, 'Este equipo es de ' + pr.name + ' (abre directo en sus canciones)')) +
    chkHTML('ka-oido', LS.get(OIDO_AUTO, false), 'Que el celular me escuche al practicar (sin cable)') +
    (vozSupported() ? chkHTML('ka-voz', LS.get(VOZ_PREF, false), 'Mandar con la voz al tocar («siguiente», «otra vez», «más lento»)') : '') +
    chkHTML('ka-full', !!prefs.fullAlways, 'Pantalla completa siempre (sin la barra de la batería)') +
    '<div class="btnrow"><button type="button" class="btn" data-k="finder">' + icon('mic') + 'Probar el micrófono</button><button type="button" class="btn" data-k="midi">' + icon('keys') + 'Teclado (cable)</button></div>' +
    '<h2 class="stu-h">Grupo</h2><p class="help">' + esc(grupoStatusText()) + '</p>' +
    (kid ? '' : '<div class="btnrow"><button type="button" class="btn" data-k="invite">' + icon('share') + 'Invitar a ' + esc(pr.name) + ' (WhatsApp)</button>' +
      '<button type="button" class="btn" data-sact="edit">' + icon('gear') + 'Nombre, color y borrar</button></div>');
}
function kidMidi() {
  if (!midiSupported()) { toast('Este navegador no puede usar un teclado por cable. Usa «Que el celular me escuche».', 5000); return; }
  midiConnect().then(function () { toast(midi.inp ? 'Teclado conectado.' : 'No encontré el teclado. Revisa el cable.', 3500); if (route.name === 'kidtab') render(); })
    .catch(function () { toast('No se pudo conectar el teclado.', 3500); });
}
function kidBind(pr, tab) {
  var root = app.querySelector('.kid'); if (!root) return;
  root.addEventListener('click', function (e) {
    var t = e.target, pick = t.closest('[data-sact="pick"]');
    if (pick) { e.stopPropagation(); openSongPicker(pr.id); return; }
    var add = t.closest('[data-sadd]');
    if (add) { e.stopPropagation(); kidAddSong(pr.id, add.getAttribute('data-sadd')); renderKid(pr.id, 'canciones'); return; }
    var b = t.closest('[data-k]'); if (!b) return;
    var a = b.getAttribute('data-k');
    if (a === 'finder') openDrill(pr.id, 'finder');
    else if (a === 'notas' || a === 'acordes') openDrill(pr.id, a);
    else if (a === 'video') openVideoPractice(pr.id);
    else if (a === 'metro') openMetronome();
    else if (a === 'midi') kidMidi();
    else if (a === 'invite') grupoInviteKid(pr.id);
    else if (a === 'tipok') { LS.set('cfp.tip.' + pr.id, true); var tp = b.closest('.kid-tip'); if (tp) tp.remove(); }
    else if (a === 'add') { kidAddSong(pr.id, b.getAttribute('data-id')); renderKidSong(pr.id, b.getAttribute('data-id')); }
    else if (a === 'nums') { var s = getSong(b.getAttribute('data-id')); if (s) openNumsShare(s); }
  });
  var q = root.querySelector('#kq');
  if (q) q.addEventListener('input', function () { root.querySelector('#kid-bl').innerHTML = kidBookRows(pr, q.value); });
  if (tab !== 'ajustes') return;
  var box = root.querySelector('#kid-cfg');
  if (box) cfgEditorBind(box, function () { return cfgNorm(getStudent(pr.id)); }, function (ne) { kidCfgChange(pr.id, ne); });
  root.addEventListener('change', function (e) {
    var t = e.target; if (!t || t.type !== 'checkbox') return;
    if (t.id === 'ka-dev') { var d = stuData(); d.device = t.checked ? pr.id : (d.device === pr.id ? null : d.device); stuSave(d); }
    else if (t.id === 'ka-oido') LS.set(OIDO_AUTO, t.checked);
    else if (t.id === 'ka-voz') LS.set(VOZ_PREF, t.checked);
    else if (t.id === 'ka-full') { prefs.fullAlways = t.checked; savePrefs(); if (t.checked) enterFull(); else exitFull(); }
  });
}
/* Cambios que hace el alumno: en el celular de un alumno del grupo se prueban al instante y van como propuesta. */
function kidCfgChange(sid, ne) {
  var pr = getStudent(sid); if (!pr) return;
  var before = cfgPick(pr);
  Object.keys(ne || {}).forEach(function (k) { pr[k] = ne[k]; });
  putStudent(pr);
  if (needsApproval()) proposeCfg(sid, before, cfgPick(getStudent(sid)));
  var h = app.querySelector('.kid-h'); if (h) h.outerHTML = kidHeadHTML(getStudent(sid), !!whoKid());
}
function kidSongsDone(sid, start) {
  if (!needsApproval()) return;
  var pr = getStudent(sid); if (!pr) return;
  proposeSongs(sid, start, (pr.songs || []).slice());
}
function kidAddSong(sid, id) {
  var pr = getStudent(sid); if (!pr || !id) return;
  var start = (pr.songs || []).slice();
  if (start.indexOf(id) >= 0) return;
  pr.songs = start.concat([id]); putStudent(pr);
  kidSongsDone(sid, start);
  toast(needsApproval() ? 'Agregada. ' + dirMsg().charAt(0).toUpperCase() + dirMsg().slice(1) + ' lo va a revisar.' : 'Agregada a tus canciones.', 3000);
}
/* Editor: si quien escribe es un alumno del grupo, la canción se guarda en su celular y va como propuesta. */
function kidSongSave(s) {
  var kid = whoKid(); if (!kid || !needsApproval()) return false;
  var cur = getSong(s.id), before = cur ? cleanSong(cur) : null;
  local.songs[s.id] = s; delete local.deleted[s.id]; saveLocal(); delete infoCache[s.id];
  proposeSong(kid.id, s, before);
  editorState = null; document.body.classList.remove('ed-chords');
  location.hash = '#/k/' + enc(kid.id) + '/c/' + enc(s.id);
  toast('Guardada en tu celular. ' + dirMsg().charAt(0).toUpperCase() + dirMsg().slice(1) + ' la revisa para que llegue a todos.', 4500);
  return true;
}
/* Pantalla completa siempre (si el alumno o el director lo eligió): se pide con el primer toque. */
document.addEventListener('click', function () { if (prefs.fullAlways && !document.fullscreenElement) enterFull(); }, true);
/* En el inicio del director: cambiar de perfil y entrar al grupo. */
var _stuChipsG = stuChipsHTML;
stuChipsHTML = function () {
  return _stuChipsG.apply(this, arguments) + '<div class="who-row">' + (stuData().list.length ? '<a class="chip-b" href="#/quien">' + icon('swap') + 'Cambiar de perfil</a>' : '') +
    '<a class="chip-b" href="#/grupo">' + icon('group') + 'Grupo' + (inboxCount() ? ' <em class="badge">' + inboxCount() + '</em>' : '') + '</a></div>';
};

/* parte 16: grupo conectado — perfiles, estrellas y propuestas que el director aprueba
   Cada equipo se une con una invitación (enlace por WhatsApp). El director publica el «estado del grupo»: alumnos,
   sus canciones y ajustes, sus decisiones y sus cambios del cancionero que aún no subió a GitHub; va firmado con una
   clave que solo tienen sus equipos. Cada equipo publica las estrellas de sus alumnos. Lo que un alumno propone llega
   al buzón del director. Todo viaja cifrado por los servidores públicos de las pantallas conectadas (dos a la vez). */
var GRUPO_KEY = 'cfp.grupo.v1', INBOX_KEY = 'cfp.props.inbox', MINE_KEY = 'cfp.props.mine', DEC_KEY = 'cfp.props.dec', OV_KEY = 'cfp.g.ov';
var GR = null, GROV = null, GRI;
var TE8 = new TextEncoder(), TD8 = new TextDecoder();
var CFG_NAMES = { part: 'Parte', home: 'Tono de práctica', notes: 'Notas', rhythm: 'Ritmo', oct: 'Octava', hands: 'Manos', shape: 'Forma', nums: 'Números en las teclas', colors: 'Colores', zone: 'Zona del teclado' };
function grupoInfo() { if (GRI === undefined) GRI = LS.get(GRUPO_KEY, null); return GRI; }
function grupoSave(g) { GRI = g; LS.set(GRUPO_KEY, g); }
function devId() { var d = LS.get('cfp.devId', ''); if (!d) { d = 'd' + Math.random().toString(36).slice(2, 10); LS.set('cfp.devId', d); } return d; }
function inboxCount() { return isDirDevice() ? LS.get(INBOX_KEY, []).length : 0; }
/* Canciones que llegan del director a los celulares de los alumnos (sus cambios aún no publicados en GitHub). */
function grOv() { if (!GROV) GROV = LS.get(OV_KEY, null) || { songs: {}, deleted: {} }; return GROV; }
function grOvOn() { var g = grupoInfo(); return !!(g && g.role !== 'dir' && isGroup()); }
function gSong(id) { return grOvOn() ? grOv().songs[id] || null : null; }
function gDel(id) { return grOvOn() ? !!grOv().deleted[id] : false; }
function gSongIds() { return grOvOn() ? Object.keys(grOv().songs) : []; }
/* ---------- cifrado ---------- */
function b64u(u8) { var s = ''; for (var i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
function sha256(str) { return crypto.subtle.digest('SHA-256', TE8.encode(str)).then(function (b) { return new Uint8Array(b); }); }
function grKeys() {
  var g = grupoInfo(); if (!g) return Promise.reject(new Error('sin grupo'));
  if (GR && GR.keys && GR.keys.secret === g.secret && (!g.priv || GR.keys.priv)) return Promise.resolve(GR.keys);
  var k = { secret: g.secret }, EC = { name: 'ECDSA', namedCurve: 'P-256' };
  return sha256('cfp-gid:' + g.secret).then(function (h) { k.gid = b64u(h).slice(0, 16).replace(/[^A-Za-z0-9]/g, 'x'); return sha256('cfp-aes:' + g.secret); })
    .then(function (h) { return crypto.subtle.importKey('raw', h, 'AES-GCM', false, ['encrypt', 'decrypt']); })
    .then(function (aes) { k.aes = aes; return crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: g.x, y: g.y, ext: true }, EC, true, ['verify']); })
    .then(function (pub) { k.pub = pub; return g.priv ? crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: g.x, y: g.y, d: g.priv.d, ext: true }, EC, true, ['sign']) : null; })
    .then(function (priv) { k.priv = priv; if (GR) GR.keys = k; return k; });
}
function gzipU8(u8) {
  if (typeof CompressionStream === 'undefined') return Promise.resolve(null);
  return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }).catch(function () { return null; });
}
function gunzipU8(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
function grEnc(obj) {
  var raw = TE8.encode(JSON.stringify(obj));
  return Promise.all([grKeys(), raw.length > 600 ? gzipU8(raw) : Promise.resolve(null)]).then(function (r) {
    var z = r[1], body = z || raw, pt = new Uint8Array(1 + body.length), iv = crypto.getRandomValues(new Uint8Array(12));
    pt[0] = z ? 1 : 0; pt.set(body, 1);
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, r[0].aes, pt).then(function (ct) { var c = new Uint8Array(ct), out = new Uint8Array(12 + c.length); out.set(iv); out.set(c, 12); return b64u(out); });
  });
}
function grDec(str) {
  return grKeys().then(function (k) { var u = unb64u(str); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, k.aes, u.slice(12)); })
    .then(function (pt) { var p = new Uint8Array(pt); return p[0] === 1 ? gunzipU8(p.slice(1)) : p.slice(1); })
    .then(function (u) { return JSON.parse(TD8.decode(u)); });
}
function grSign(text) { return grKeys().then(function (k) { return crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.priv, TE8.encode(text)); }).then(function (s) { return b64u(new Uint8Array(s)); }); }
function grVerify(text, sig) { return grKeys().then(function (k) { return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.pub, unb64u(sig), TE8.encode(text)); }); }
/* ---------- conexión ---------- */
function grOnline() { return !!(GR && GR.links.some(function (L) { return L.c && L.c.isOpen(); })); }
function grupoDisconnect() {
  if (!GR) return;
  GR.links.forEach(function (L) { L.dead = true; if (L.c) L.c.close(); });
  GR.links = [];
}
function grupoConnect() {
  var g = grupoInfo(); if (!g || !window.crypto || !crypto.subtle) return;
  if (GR && GR.secret === g.secret && GR.role === g.role && GR.links.length) return;
  grupoDisconnect();
  GR = { secret: g.secret, role: g.role, links: [], out: {}, seen: LS.get('cfp.g.seen', {}), lastProg: {}, keys: null };
  grKeys().then(function (k) {
    var list = LS.get('cfp.sync.brokers', null) || SYNC_BROKERS;
    list.slice(0, 2).forEach(function (u) { grLink(u, k.gid); });
  }).catch(function () { /* navegador sin cifrado: sin grupo */ });
}
function grLink(url, gid) {
  var L = { url: url, c: null, tries: 0, dead: false, base: 'cfp/v2/g/' + gid + '/' }, mine = GR;
  var go = function () {
    if (L.dead || GR !== mine) return;
    L.c = mqttClient(url, 'cfg' + Math.random().toString(36).slice(2, 12), function (topic, payload) {
      if (topic.indexOf(L.base) === 0) grIn(topic.slice(L.base.length), payload);
    }, function (state) {
      if (state === 'open') { L.tries = 0; L.idle = false; grOnOpen(L); }
      else if (!L.dead) {
        L.tries++; grSyncDraw();
        if (navigator.onLine === false) { L.idle = true; return; }   // sin internet: vuelve a intentar cuando haya
        setTimeout(go, Math.min(30000, 2500 * L.tries));
      }
    });
    var g = grupoInfo(); if (!g) return;
    L.c.subscribe(L.base + 'estado');
    if (g.role === 'dir') { L.c.subscribe(L.base + 'prog/+'); L.c.subscribe(L.base + 'buzon/+'); }
    else (g.sids || []).forEach(function (s) { L.c.subscribe(L.base + 'prog/' + s); });
  };
  GR.links.push(L); go();
}
function grPub(kind, payload) {
  if (!GR) return;
  GR.out[kind] = payload;
  var sent = false;
  GR.links.forEach(function (L) { if (L.c && L.c.isOpen() && L.c.publish(L.base + kind, payload, true)) sent = true; });
  if (sent) LS.set('cfp.g.sync', Date.now()); else if (!LS.get('cfp.g.pend', 0)) LS.set('cfp.g.pend', Date.now());
  grSyncDraw();
}
function grPubClear(kind) {
  if (!GR) return;
  delete GR.out[kind];
  GR.links.forEach(function (L) { if (L.c && L.c.isOpen()) L.c.publish(L.base + kind, '', true); });
}
function grOnOpen(L) {
  Object.keys(GR.out).forEach(function (kind) { L.c.publish(L.base + kind, GR.out[kind], true); });
  var g = grupoInfo(); if (!g) return;
  if (g.role === 'dir') { grStateDirty(true); stuData().list.forEach(function (pr) { grProgDirty(pr.id, true); }); }
  else { (g.sids || []).forEach(function (s) { grProgDirty(s, true); }); grResendProps(); }
  // lo guardado sin internet ya salió (se vuelve a mandar todo al conectarse)
  LS.set('cfp.g.sync', Date.now()); LS.set('cfp.g.pend', 0);
  grSyncDraw(); grRefreshView(true);
}
function grIn(kind, payload) {
  if (!payload) return;
  grDec(payload).then(function (msg) {
    if (kind === 'estado') return grOnState(msg);
    if (kind.indexOf('prog/') === 0) return grOnProg(kind.slice(5), msg);
    if (kind.indexOf('buzon/') === 0) return grOnProp(kind.slice(6), msg);
  }).catch(function () { /* de otro grupo o dañado */ });
}
function grRefreshView(soft) {
  if (liveState || drill || vprac || sheetRoot.firstChild) return;
  if (['home', 'student', 'kidtab', 'quien', 'grupo', 'props', 'students', 'ficha'].indexOf(route.name) < 0) return;
  if (soft && route.name !== 'grupo') return;
  clearTimeout(grRefreshView.t);
  grRefreshView.t = setTimeout(function () { if (!liveState && !drill && !vprac && !sheetRoot.firstChild) render(); }, 120);
}
/* ---------- estado del grupo (lo publica el director) ---------- */
function grBuildState() {
  var g = grupoInfo(), songs, deleted;
  if (isGroup()) { songs = local.songs; deleted = local.deleted; LS.set('cfp.g.lastSongs', { songs: songs, deleted: deleted }); }
  else { var ls = LS.get('cfp.g.lastSongs', { songs: {}, deleted: {} }); songs = ls.songs; deleted = ls.deleted; }
  return { v: 1, at: Date.now(), by: devId(), dirName: g.dirName || dirName(),
    students: stuData().list.map(function (pr) { var o = cfgPick(pr); o.id = pr.id; o.name = pr.name; o.color = pr.color; o.songs = (pr.songs || []).slice(); return o; }),
    songs: songs || {}, deleted: deleted || {}, dec: LS.get(DEC_KEY, {}), dataVersion: DATA.version || '' };
}
function grStateDirty(now) {
  var g = grupoInfo(); if (!GR || !g || g.role !== 'dir') return;
  clearTimeout(GR.st); GR.st = setTimeout(grStateSend, now ? 60 : 1500);
}
function grStateSend() {
  var g = grupoInfo(); if (!GR || !g || g.role !== 'dir' || !g.priv) return;
  var st = grBuildState(), body = JSON.stringify([st.students, st.songs, st.deleted, st.dec, st.dirName]);
  if (GR.pubBody === body && GR.out.estado) return;
  GR.pubBody = body;
  var s = JSON.stringify(st);
  var songsJS = JSON.stringify([st.songs, st.deleted]), first = GR.songsJS == null;
  grSign(s).then(function (sig) { return grEnc({ s: s, sig: sig }); }).then(function (x) {
    var g2 = grupoInfo(); if (!g2) return;
    g2.at = st.at; grupoSave(g2); grPub('estado', x);
    if (!first && GR && GR.songsJS !== songsJS && !liveState) toast(grOnline() ? 'Listo: tus cambios del cancionero ya van a los chicos.' : 'Guardado. Les llega a los chicos cuando este equipo tenga internet.', 3000);
    if (GR) GR.songsJS = songsJS;
  }).catch(function () { /* nada */ });
}
function grOnState(msg) {
  if (!msg || !msg.s || !msg.sig) return;
  return grVerify(msg.s, msg.sig).then(function (ok) {
    if (!ok) return;
    var st = JSON.parse(msg.s), g = grupoInfo(); if (!g) return;
    LS.set('cfp.g.sync', Date.now()); grSyncDraw();
    if (!(st.at > (g.at || 0))) return;
    g.at = st.at; if (st.dirName) g.dirName = st.dirName; grupoSave(g);
    if (st.by === devId()) return;
    grApplyState(st, g);
  });
}
function grApplyState(st, g) {
  var mine = g.role === 'dir' ? null : (g.sids || []);
  (st.students || []).forEach(function (s) {
    if (mine && mine.indexOf(s.id) < 0) return;
    var pr = getStudent(s.id) || { id: s.id, prog: {}, chords: {} };
    ['name', 'color'].concat(CFG_FIELDS).forEach(function (k) { if (s[k] !== undefined) pr[k] = s[k]; });
    pr.songs = (s.songs || []).slice();
    grReapplyPending(pr);
    _putStudentG(pr);
  });
  if (g.role === 'dir') {
    grMergeDirSongs(st);
    var dec = LS.get(DEC_KEY, {}); Object.keys(st.dec || {}).forEach(function (k) { dec[k] = st.dec[k]; }); LS.set(DEC_KEY, dec);
    LS.set(INBOX_KEY, LS.get(INBOX_KEY, []).filter(function (p) { return !dec[p.id]; }));
  } else {
    grNews(st);
    LS.set(OV_KEY, { songs: st.songs || {}, deleted: st.deleted || {}, at: st.at }); GROV = null; infoCache = {};
    grDecisions(st.dec || {});
    if (st.dataVersion && DATA.version && st.dataVersion > DATA.version) fetchRemote().then(function () { grRefreshView(); }).catch(function () { /* nada */ });
  }
  grRefreshView();
}
function grMergeDirSongs(st) {
  if (!isGroup()) return;
  var ch = false;
  Object.keys(st.songs || {}).forEach(function (id) {
    var a = JSON.stringify(st.songs[id]); if (JSON.stringify(local.songs[id] || null) === a) return;
    var b = baseSong(id);
    if (b && JSON.stringify(cleanSong(b)) === a) { if (local.songs[id]) { delete local.songs[id]; ch = true; } }
    else { local.songs[id] = st.songs[id]; ch = true; }
    delete infoCache[id];
  });
  Object.keys(st.deleted || {}).forEach(function (id) { if (!local.deleted[id]) { local.deleted[id] = st.deleted[id]; ch = true; } });
  if (ch) _saveLocalG();
}
/* ---------- estrellas de cada alumno (las publica cada equipo; se juntan, nunca se pierden) ---------- */
function grProgDirty(sid, now) {
  if (!GR || !sid) return;
  clearTimeout(GR['p_' + sid]); GR['p_' + sid] = setTimeout(function () { grProgSend(sid); }, now ? 30 : 1500);
}
function grProgSend(sid) {
  var pr = getStudent(sid); if (!pr || !GR) return;
  var body = { prog: pr.prog || {}, chords: pr.chords || {}, log: pr.log || {}, games: pr.games || {} }, js = JSON.stringify(body);
  if (GR.lastProg[sid] === js && GR.out['prog/' + sid]) return;
  GR.lastProg[sid] = js;
  grEnc(Object.assign({ sid: sid, at: Date.now(), dev: devId() }, body)).then(function (x) { grPub('prog/' + sid, x); }).catch(function () { /* nada */ });
}
function progMerge(a, b) {
  var out = { prog: {}, chords: {}, log: {}, games: {} };
  [a.prog || {}, b.prog || {}].forEach(function (P) {
    Object.keys(P).forEach(function (id) {
      var x = out.prog[id] || { step: 1, stars: {} }, y = P[id] || {};
      x.step = Math.max(x.step || 1, y.step || 1); x.stars = Object.assign({}, x.stars || {}, y.stars || {});
      if (y.last) x.last = Math.max(x.last || 0, y.last);
      out.prog[id] = x;
    });
  });
  [a.chords || {}, b.chords || {}].forEach(function (Q) { Object.keys(Q).forEach(function (k) { var x = out.chords[k], y = Q[k]; if (!x || (y.at || 0) > (x.at || 0)) out.chords[k] = y; }); });
  [a.log || {}, b.log || {}].forEach(function (L) { Object.keys(L).forEach(function (d) { out.log[d] = Math.max(out.log[d] || 0, L[d] || 0); }); });
  [a.games || {}, b.games || {}].forEach(function (G2) { Object.keys(G2).forEach(function (k) { out.games[k] = Math.max(out.games[k] || 0, G2[k] || 0); }); });
  return out;
}
function grOnProg(sid, m) {
  if (!GR || !m) return;
  if (m.dev && m.dev !== devId()) { GR.seen[sid] = Math.max(GR.seen[sid] || 0, m.at || 0); LS.set('cfp.g.seen', GR.seen); }
  var pr = getStudent(sid); if (!pr) return;
  var cur = { prog: pr.prog || {}, chords: pr.chords || {}, log: pr.log || {}, games: pr.games || {} }, merged = progMerge(cur, m);
  if (JSON.stringify(merged) === JSON.stringify(progMerge(cur, {}))) return;
  pr.prog = merged.prog; pr.chords = merged.chords; pr.log = merged.log; pr.games = merged.games;
  putStudent(pr);
  grRefreshView();
}
/* ---------- propuestas del alumno ---------- */
function applySongsDiff(cur, before, after) {
  var add = after.filter(function (x) { return before.indexOf(x) < 0; }), rem = before.filter(function (x) { return after.indexOf(x) < 0; });
  var out = (cur || []).filter(function (x) { return rem.indexOf(x) < 0; });
  add.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
  return out;
}
function propose(p) {
  var pr = getStudent(p.sid), mine = LS.get(MINE_KEY, []), k = -1;
  p.id = p.id || newId('p'); p.at = p.at || Date.now(); p.upd = Date.now(); p.status = 'pending'; p.fromName = pr ? pr.name : (p.fromName || '');
  mine.forEach(function (x, i) { if (x.id === p.id) k = i; });
  if (k >= 0) mine[k] = p; else mine.push(p);
  LS.set(MINE_KEY, mine.slice(-40));
  grSendProp(p);
}
function grSendProp(p) { if (!grupoInfo() || !GR) return; grEnc(p).then(function (x) { grPub('buzon/' + p.id, x); }).catch(function () { /* nada */ }); }
function grResendProps() { LS.get(MINE_KEY, []).forEach(function (p) { if (p.status === 'pending') grSendProp(p); }); }
function propWithdraw(p) {
  LS.set(MINE_KEY, LS.get(MINE_KEY, []).filter(function (x) { return x.id !== p.id; }));
  if (GR) grEnc({ id: p.id, sid: p.sid, withdrawn: true, upd: Date.now() }).then(function (x) { grPub('buzon/' + p.id, x); }).catch(function () { /* nada */ });
}
function pendingOf(sid, kind, match) {
  return LS.get(MINE_KEY, []).filter(function (p) { return p.status === 'pending' && p.sid === sid && p.kind === kind && (!match || match(p)); })[0] || null;
}
function proposeCfg(sid, before, after) {
  var prev = pendingOf(sid, 'cfg'), b = prev ? prev.before : before;
  var changed = Object.keys(after).filter(function (k) { return JSON.stringify(after[k]) !== JSON.stringify(b[k]); });
  if (!changed.length) { if (prev) propWithdraw(prev); return; }
  var data = {}; changed.forEach(function (k) { data[k] = after[k]; });
  propose({ id: prev && prev.id, at: prev && prev.at, kind: 'cfg', sid: sid, data: data, before: b,
    label: 'cambiar ' + changed.map(function (k) { return (CFG_NAMES[k] || k).toLowerCase(); }).join(', ') });
}
function proposeSongs(sid, start, after) {
  var prev = pendingOf(sid, 'songs'), b = prev ? prev.before : start;
  var add = after.filter(function (x) { return b.indexOf(x) < 0; }), rem = b.filter(function (x) { return after.indexOf(x) < 0; });
  if (!add.length && !rem.length) { if (prev) propWithdraw(prev); return; }
  propose({ id: prev && prev.id, at: prev && prev.at, kind: 'songs', sid: sid, before: b, data: { songs: after },
    label: 'cambiar sus canciones (' + [add.length ? 'agregar ' + add.length : '', rem.length ? 'quitar ' + rem.length : ''].filter(Boolean).join(', ') + ')' });
}
function proposeSong(sid, s, before) {
  var prev = pendingOf(sid, 'song', function (p) { return p.data && p.data.id === s.id; }), b = prev ? prev.before : before;
  if (b && JSON.stringify(b) === JSON.stringify(s)) { if (prev) propWithdraw(prev); return; }
  propose({ id: prev && prev.id, at: prev && prev.at, kind: 'song', sid: sid, data: s, before: b,
    label: (b ? 'cambiar «' : 'agregar la canción «') + C.sentenceCase(s.title) + '»' });
}
function grReapplyPending(pr) {
  LS.get(MINE_KEY, []).forEach(function (p) {
    if (p.status !== 'pending' || p.sid !== pr.id) return;
    if (p.kind === 'cfg') Object.keys(p.data || {}).forEach(function (k) { pr[k] = p.data[k]; });
    else if (p.kind === 'songs') pr.songs = applySongsDiff(pr.songs || [], p.before || [], (p.data && p.data.songs) || []);
  });
}
function grDecisions(dec) {
  var mine = LS.get(MINE_KEY, []), msgs = [];
  mine.forEach(function (p) {
    if (p.status !== 'pending' || !dec[p.id]) return;
    var r = dec[p.id]; p.status = r.ok ? 'approved' : 'rejected'; p.note = r.note || ''; p.seen = false;
    if (r.ok) propSettle(p); else propRevert(p);
    msgs.push((r.ok ? '✓ ' + dirMsg() + ' aprobó: ' : dirMsg() + ' dijo «no por ahora»: ') + p.label + (r.note ? '. «' + r.note + '»' : ''));
  });
  if (msgs.length) { LS.set(MINE_KEY, mine); toast(msgs.join(' · '), 6000); }
}
function propRevert(p) {
  var pr = getStudent(p.sid);
  if (p.kind === 'cfg' && pr) { Object.keys(p.data || {}).forEach(function (k) { pr[k] = (p.before || {})[k]; }); _putStudentG(pr); }
  else if (p.kind === 'songs' && pr) { pr.songs = applySongsDiff(pr.songs || [], (p.data && p.data.songs) || [], p.before || []); _putStudentG(pr); }
  else if (p.kind === 'song' && p.data) {
    var id = p.data.id, b = baseSong(id);
    if (p.before && !(b && JSON.stringify(cleanSong(b)) === JSON.stringify(p.before))) local.songs[id] = p.before; else delete local.songs[id];
    _saveLocalG(); delete infoCache[id];
  }
}
function propSettle(p) { if (p.kind === 'song' && p.data && grOv().songs[p.data.id]) { delete local.songs[p.data.id]; _saveLocalG(); delete infoCache[p.data.id]; } }
function propNoticesHTML(sid) {
  var all = LS.get(MINE_KEY, []), mine = all.filter(function (p) { return p.sid === sid; });
  var pend = mine.filter(function (p) { return p.status === 'pending'; }), fresh = mine.filter(function (p) { return p.status !== 'pending' && !p.seen; }), h = '';
  if (pend.length) h += '<div class="note-box kid-wait">' + icon('inbox') + '<span>Esperando a ' + esc(dirMsg()) + ': ' + esc(pend.map(function (p) { return p.label; }).join('; ')) + '. Mientras tanto ya lo puedes usar.</span></div>';
  fresh.forEach(function (p) {
    h += '<div class="note-box kid-dec ' + (p.status === 'approved' ? 'ok' : 'no') + '">' + (p.status === 'approved' ? icon('check') + '<span>' + esc(dirMsg()) + ' aprobó: ' : '<span>' + esc(dirMsg()) + ' dijo «no por ahora»: ') +
      esc(p.label) + (p.note ? '. «' + esc(p.note) + '»' : '') + '</span></div>';
  });
  if (fresh.length) { all.forEach(function (p) { if (p.sid === sid && p.status !== 'pending') p.seen = true; }); LS.set(MINE_KEY, all); }
  return h;
}
/* ---------- buzón del director ---------- */
function grOnProp(pid, p) {
  if (!p || !p.id || !isDirDevice()) return;
  var dec = LS.get(DEC_KEY, {}), inbox = LS.get(INBOX_KEY, []), k = -1;
  inbox.forEach(function (x, i) { if (x.id === p.id) k = i; });
  if (p.withdrawn) { if (k >= 0) { inbox.splice(k, 1); LS.set(INBOX_KEY, inbox); grRefreshView(); } grPubClear('buzon/' + p.id); return; }
  if (dec[p.id]) { grPubClear('buzon/' + p.id); return; }
  if (k >= 0 && (inbox[k].upd || 0) >= (p.upd || 0)) return;
  if (k >= 0) inbox[k] = p; else inbox.push(p);
  LS.set(INBOX_KEY, inbox);
  if (k < 0) toast((p.fromName || 'Un alumno') + ' propone: ' + p.label + '.', 4500);
  grRefreshView();
}
function propApply(p) {
  var pr = getStudent(p.sid);
  if (p.kind === 'cfg' && pr) { Object.keys(p.data || {}).forEach(function (k) { pr[k] = p.data[k]; }); putStudent(pr); }
  else if (p.kind === 'songs' && pr) { pr.songs = applySongsDiff(pr.songs || [], p.before || [], (p.data && p.data.songs) || []); putStudent(pr); }
  else if (p.kind === 'song' && p.data) { var s = propMerge(p); local.songs[s.id] = s; delete local.deleted[s.id]; saveLocal(); delete infoCache[s.id]; }
}
/* Si cambiaste la canción después de que el alumno la tomó, se junta: queda lo tuyo y encima solo lo que él cambió
   (por ejemplo, él arregló los compases y tú la letra: quedan las dos cosas). */
var SONG_PARTS = { src: 'la letra y los acordes', timeline: 'los compases', key: 'el tono', title: 'el título', author: 'el autor' };
function propConflict(p) {
  if (p.kind !== 'song' || !p.before || !p.data) return null;
  var cur = getSong(p.data.id); if (!cur) return null;
  var c = cleanSong(cur), b = p.before, k = cleanSong(p.data), mine = [], both = [];
  Object.keys(Object.assign({}, b, c, k)).forEach(function (f) {
    var J = function (o) { return JSON.stringify(o[f] === undefined ? null : o[f]); };
    if (J(c) === J(b)) return;                                  // tú no lo tocaste
    mine.push(f); if (J(k) !== J(b)) both.push(f);              // los dos lo cambiaron
  });
  return mine.length ? { mine: mine, both: both } : null;
}
function propMerge(p) {
  var k = cleanSong(p.data), b = p.before, cur = getSong(k.id);
  if (!b || !cur) return k;
  var out = JSON.parse(JSON.stringify(cleanSong(cur)));
  Object.keys(Object.assign({}, b, k)).forEach(function (f) {
    if (JSON.stringify(k[f] === undefined ? null : k[f]) === JSON.stringify(b[f] === undefined ? null : b[f])) return;
    if (k[f] === undefined) delete out[f]; else out[f] = k[f];
  });
  return cleanSong(out);
}
function propDecide(pid, ok, note) {
  var inbox = LS.get(INBOX_KEY, []), p = inbox.filter(function (x) { return x.id === pid; })[0]; if (!p) return;
  if (ok) propApply(p);
  var dec = LS.get(DEC_KEY, {}); dec[pid] = { ok: !!ok, note: note || '', at: Date.now() };
  var keys = Object.keys(dec).sort(function (a, b) { return dec[a].at - dec[b].at; }); while (keys.length > 80) delete dec[keys.shift()];
  LS.set(DEC_KEY, dec);
  LS.set(INBOX_KEY, inbox.filter(function (x) { return x.id !== pid; }));
  grPubClear('buzon/' + pid); grStateDirty(true);
  toast(ok ? 'Aprobado: le llega a ' + (p.fromName || 'tu alumno') + ' y a todos.' : 'Listo: no se aplica, y se le avisa.', 3500);
}
function cfgVal(k, v) {
  if (k === 'part') return PARTS[v] || String(v);
  if (k === 'rhythm') return RHYTHMS[v] || String(v);
  if (k === 'home') { var h = HOMES.filter(function (x) { return x[0] === v; })[0]; return h ? h[1] : String(v); }
  if (k === 'oct' && typeof v === 'number') return 'Do ' + (Math.floor(v / 12) - 1);
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  return v == null || v === '' ? '—' : String(v);
}
function lineDiff(a, b) {
  var n = a.length, m = b.length, L = [], i, j, out = [];
  for (i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
  for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  i = 0; j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push({ t: '=', s: a[i] }); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: '-', s: a[i++] }); else out.push({ t: '+', s: b[j++] }); }
  while (i < n) out.push({ t: '-', s: a[i++] });
  while (j < m) out.push({ t: '+', s: b[j++] });
  return out;
}
function propDiffHTML(p) {
  if (p.kind === 'cfg') {
    return '<table class="dif"><tbody>' + Object.keys(p.data || {}).map(function (k) {
      return '<tr><th>' + esc(CFG_NAMES[k] || k) + '</th><td><del>' + esc(cfgVal(k, (p.before || {})[k])) + '</del></td><td>' + icon('fwd') + '</td><td><ins>' + esc(cfgVal(k, p.data[k])) + '</ins></td></tr>';
    }).join('') + '</tbody></table>';
  }
  if (p.kind === 'songs') {
    var b = p.before || [], a = (p.data && p.data.songs) || [], t = function (id) { var s = getSong(id); return s ? C.sentenceCase(s.title) : id; };
    var add = a.filter(function (x) { return b.indexOf(x) < 0; }), rem = b.filter(function (x) { return a.indexOf(x) < 0; });
    return (add.length ? '<p class="dif-l"><ins>Agregar: ' + esc(add.map(t).join(', ')) + '</ins></p>' : '') + (rem.length ? '<p class="dif-l"><del>Quitar: ' + esc(rem.map(t).join(', ')) + '</del></p>' : '');
  }
  var s = p.data || {}, o = p.before, head = '';
  if (o) [['title', 'Título'], ['author', 'Autor'], ['key', 'Tono']].forEach(function (f) { if ((o[f[0]] || '') !== (s[f[0]] || '')) head += '<p class="dif-l">' + f[1] + ': <del>' + esc(o[f[0]] || '—') + '</del> → <ins>' + esc(s[f[0]] || '—') + '</ins></p>'; });
  if (o && JSON.stringify(o.timeline || null) !== JSON.stringify(s.timeline || null)) head += '<p class="dif-l">Cambió los compases.</p>';
  var A = String((o && o.src) || '').split('\n'), B = String(s.src || '').split('\n');
  var d = o ? lineDiff(A, B) : B.map(function (x) { return { t: '+', s: x }; });
  var keep = d.map(function (x, i) { return !o || x.t !== '=' || (d[i - 1] && d[i - 1].t !== '=') || (d[i + 1] && d[i + 1].t !== '='); });
  var body = d.map(function (x, i) {
    if (!keep[i]) return keep[i - 1] ? '<div class="dl gap">…</div>' : '';
    return '<div class="dl' + (x.t === '+' ? ' add' : x.t === '-' ? ' del' : '') + '">' + esc(x.s || ' ') + '</div>';
  }).join('');
  return head + (o && !d.some(function (x) { return x.t !== '='; }) ? '' : '<div class="dif-src">' + body + '</div>');
}
function whenText(t) {
  var m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'recién' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.round(m / 60) + ' h' : 'hace ' + Math.round(m / 1440) + ' d';
}
function propCardHTML(p) {
  var pr = getStudent(p.sid), name = (pr && pr.name) || p.fromName || 'Alumno';
  var cf = propConflict(p), cfH = '';
  if (cf) {
    var nm = function (a) { return a.map(function (f) { return SONG_PARTS[f] || f; }).join(', '); };
    cfH = '<p class="note-box prop-cf">' + (cf.both.length ? 'Ojo: tú también cambiaste ' + esc(nm(cf.both)) + ' después de que ' + esc(name) + ' la tomó. Si apruebas, en eso queda lo de ' + esc(name) + '.' :
      'Cambiaste ' + esc(nm(cf.mine)) + ' después de que ' + esc(name) + ' la tomó. Si apruebas, se juntan: lo tuyo se queda y se suma lo que cambió ' + esc(name) + '.') + '</p>';
  }
  return '<article class="prop" data-pid="' + esc(p.id) + '"><header><span class="avatar" style="--c:' + esc(pr ? pr.color : '#888') + '">' + esc(name.charAt(0).toUpperCase()) + '</span>' +
    '<div><b>' + esc(name) + '</b> propone ' + esc(p.label) + '<small>' + whenText(p.at) + '</small></div></header>' + cfH + propDiffHTML(p) +
    '<div class="field"><input data-note placeholder="Mensaje para ' + esc(name) + ' (si quieres)" autocomplete="off" aria-label="Mensaje"></div>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-pa="ok">' + icon('check') + 'Aprobar</button><button type="button" class="btn" data-pa="no">No por ahora</button></div></article>';
}
function renderProps() {
  leaveSong();
  var inbox = LS.get(INBOX_KEY, []);
  app.innerHTML = '<div class="page props"><div class="page-h">' + btnIcon('back', 'Volver', 'data-go="#/"') + '<h1>Propuestas</h1></div>' +
    (inbox.length ? '<p class="help">Lo que apruebes se aplica en tus equipos y en los de los chicos. Si dices «no por ahora», en su celular vuelve como estaba.</p>' + inbox.map(propCardHTML).join('') :
      '<p class="empty">No hay propuestas pendientes. Cuando un alumno cambie sus ajustes o sus canciones, o proponga una canción, aparece aquí.</p>') + '</div>';
  app.querySelector('.props').addEventListener('click', function (e) {
    var b = e.target.closest('[data-pa]'); if (!b) return;
    var card = b.closest('[data-pid]'), note = card.querySelector('[data-note]');
    propDecide(card.getAttribute('data-pid'), b.getAttribute('data-pa') === 'ok', note ? note.value.trim() : '');
    renderProps();
  });
}
function inboxBannerHTML() {
  var n = inboxCount();
  return n ? '<a class="inbox-b" href="#/propuestas">' + icon('inbox') + '<span><b>' + n + (n === 1 ? ' propuesta' : ' propuestas') + '</b> de los alumnos para revisar</span>' + icon('fwd') + '</a>' : '';
}
/* ---------- invitaciones y pantalla del grupo ---------- */
function grupoStatusText() {
  var g = grupoInfo();
  if (!g) return isDirDevice() ? 'Este equipo no está en un grupo. Créalo en Grupo para que los celulares de los chicos reciban sus canciones y ajustes, y para aprobar sus cambios.' :
    'Este celular no está unido al grupo. Pide la invitación por WhatsApp.';
  return (g.role === 'dir' ? 'Diriges el grupo desde este equipo.' : 'Unido al grupo' + (g.dirName ? ' de ' + g.dirName : '') + '.') +
    (grOnline() ? ' Conectado.' : ' Sin internet ahora: todo funciona igual y se pone al día cuando vuelva.');
}
function grInviteURL(o) { return location.href.split('#')[0] + '#/unir/' + b64u(TE8.encode(JSON.stringify(o))); }
function grupoInviteKid(sid) {
  var g = grupoInfo(), pr = getStudent(sid); if (!pr) return;
  if (!g || g.role !== 'dir') { toast('Primero crea el grupo.', 3000); location.hash = '#/grupo'; return; }
  var url = grInviteURL({ v: 1, g: g.secret, x: g.x, y: g.y, s: sid, n: pr.name, c: pr.color, d: g.dirName || dirName() });
  shareText('Hola ' + pr.name + ': con este enlace tu celular se une al grupo de música' + (g.dirName ? ' de ' + g.dirName : '') + '. Ábrelo en Chrome:\n' + url, 'Invitación al grupo');
}
function grupoInviteDir() {
  var g = grupoInfo(); if (!g || !g.priv) return;
  var url = grInviteURL({ v: 1, g: g.secret, x: g.x, y: g.y, p: g.priv.d, d: g.dirName || dirName() });
  openSheet('Otro equipo tuyo', '<p class="help">Abre este enlace en tu otro equipo (tu celular o la laptop). Con él también se aprueban cambios: no se lo pases a los chicos.</p>' +
    '<div class="field"><textarea readonly rows="4">' + esc(url) + '</textarea></div><div class="btnrow"><button type="button" class="btn primary" data-x="copy">' + icon('copy') + 'Copiar</button>' +
    '<button type="button" class="btn" data-x="share">' + icon('share') + 'Compartir</button></div>', function (el) {
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-x]'); if (!b) return;
      if (b.getAttribute('data-x') === 'copy') copyText(url, 'Copiado.'); else shareText(url, 'Cancionero: mi otro equipo');
    });
  });
}
function grupoCreate(name) {
  if (!window.crypto || !crypto.subtle) { toast('Este navegador no permite el grupo. Usa Chrome actualizado.', 5000); return Promise.resolve(false); }
  var sec = b64u(crypto.getRandomValues(new Uint8Array(16)));
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']).then(function (kp) { return crypto.subtle.exportKey('jwk', kp.privateKey); })
    .then(function (jwk) {
      if (name) LS.set('cfp.dirName', name);
      grupoSave({ v: 1, secret: sec, x: jwk.x, y: jwk.y, priv: { d: jwk.d }, role: 'dir', sids: [], dirName: name || '', at: 0 });
      grupoDisconnect(); GR = null; grupoConnect(); return true;
    });
}
function grupoLeave() {
  confirmSheet('Salir del grupo', 'Este equipo deja de recibir y mandar cambios del grupo. Lo que ya tiene se queda.', 'Salir del grupo', function () {
    grupoDisconnect(); GR = null; grupoSave(null); LS.set(OV_KEY, null); GROV = null; infoCache = {};
    toast('Este equipo ya no está en el grupo.'); render();
  }, true);
}
function seenText(sid) {
  var t = GR && GR.seen[sid];
  return t ? 'Su celular se conectó ' + whenText(t) : 'Su celular todavía no se une';
}
function renderGrupo() {
  leaveSong();
  var g = grupoInfo(), d = stuData(), n = inboxCount(), h = '<div class="page grupo"><div class="page-h">' + btnIcon('back', 'Volver', 'data-go="#/"') + '<h1>Grupo</h1></div>';
  if (!g) {
    h += '<p class="help">Con el grupo, cada alumno tiene sus canciones y ajustes en su propio celular, tú ves sus estrellas, y lo que ellos cambien te llega para que lo apruebes antes de que se aplique para todos. ' +
      'Tus compases y cambios del cancionero les llegan solos. No hace falta internet todo el tiempo: cada equipo guarda todo y se pone al día cuando tiene internet (en casa, con datos o con la zona Wi-Fi de tu celular). Lo que viaja va cifrado.</p>' +
      (isDirDevice() ? '<div class="field"><label for="g-n">Tu nombre (así te verán los chicos)</label><input id="g-n" value="' + esc(LS.get('cfp.dirName', '')) + '" autocomplete="off"></div>' +
        '<div class="btnrow"><button type="button" class="btn primary" data-g="create">' + icon('group') + 'Crear el grupo</button></div>' :
        '<p class="note-box">Para unir este celular, abre el enlace de invitación que te mandó tu profe.</p>');
  } else if (g.role === 'dir') {
    h += '<p class="help">' + esc(grupoStatusText()) + '</p>' + inboxBannerHTML() +
      '<h2 class="stu-h">Invitar a cada alumno</h2>' +
      (d.list.length ? '<ul class="list grupo-l">' + d.list.map(function (pr) {
        return '<li><span class="avatar" style="--c:' + esc(pr.color) + '">' + esc(pr.name.charAt(0).toUpperCase()) + '</span><span class="txt"><span class="ttl">' + esc(pr.name) + '</span><span class="sub">' + esc(seenText(pr.id)) + '</span></span>' +
          '<button type="button" class="btn" data-g="inv:' + esc(pr.id) + '">' + icon('share') + 'Invitar</button></li>';
      }).join('') + '</ul>' : '<p class="empty">Primero crea a los alumnos (Alumnos → Nuevo).</p>') +
      '<p class="help">Cada invitación es para un alumno: al abrirla en su celular, ese celular queda como suyo.</p>' +
      '<h2 class="stu-h">Tus otros equipos</h2><div class="btnrow"><button type="button" class="btn" data-g="invdir">' + icon('share') + 'Enlace para otro equipo mío</button></div>' +
      '<h2 class="stu-h">Clave de tu perfil</h2><p class="help">' + (LS.get('cfp.dirPin', '') ? 'Tu perfil tiene clave.' : 'Sin clave: cualquiera puede entrar a tu perfil desde «¿Quién va a tocar?».') + '</p>' +
      '<div class="btnrow"><button type="button" class="btn" data-g="pin">' + (LS.get('cfp.dirPin', '') ? 'Cambiar la clave' : 'Poner clave') + '</button></div>' +
      '<div class="btnrow"><button type="button" class="btn danger" data-g="leave">Salir del grupo en este equipo</button></div>';
  } else {
    h += '<p class="help">' + esc(grupoStatusText()) + '</p><div class="btnrow"><button type="button" class="btn danger" data-g="leave">Salir del grupo</button></div>';
  }
  app.innerHTML = h + '</div>';
  app.querySelector('.grupo').addEventListener('click', function (e) {
    var b = e.target.closest('[data-g]'); if (!b) return;
    var a = b.getAttribute('data-g');
    if (a === 'create') { var nm = (app.querySelector('#g-n') || {}).value || ''; grupoCreate(nm.trim()).then(function (ok) { if (ok) { toast('Grupo creado. Ahora invita a cada alumno.', 3500); renderGrupo(); } }); }
    else if (a.indexOf('inv:') === 0) grupoInviteKid(a.slice(4));
    else if (a === 'invdir') grupoInviteDir();
    else if (a === 'pin') openPinSheet(renderGrupo);
    else if (a === 'leave') grupoLeave();
  });
}
function renderJoin(data) {
  leaveSong();
  var o = null; try { o = JSON.parse(TD8.decode(unb64u(data))); } catch (e) { o = null; }
  if (!o || !o.g || !o.x || !o.y) { app.innerHTML = '<div class="page"><h1>Invitación</h1><p class="empty">Este enlace no está completo. Pide que te lo manden otra vez.</p><p><a class="btn" href="#/">Ir al cancionero</a></p></div>'; return; }
  var cur = grupoInfo(), other = cur && cur.secret !== o.g;
  app.innerHTML = '<div class="page join"><h1>Unirse al grupo</h1><p class="join-t">Este equipo se une al grupo de música' + (o.d ? ' de <b>' + esc(o.d) + '</b>' : '') + ' ' +
    (o.p ? 'como otro equipo de quien dirige.' : 'como el celular de <b>' + esc(o.n || 'un alumno') + '</b>.') + '</p>' +
    (o.p ? '<p class="note-box">Con este enlace también se aprueban los cambios de los alumnos. Úsalo solo en tus equipos.</p>' :
      '<p class="help">Funciona sin internet. Sus canciones y ajustes llegan, y sus estrellas le llegan a ' + esc(o.d || 'su profe') + ', cada vez que el celular tenga internet.</p>') +
    (other ? '<p class="note-box">Este equipo estaba en otro grupo: se cambia a este.</p>' : '') +
    '<div class="btnrow"><button type="button" class="btn primary big" data-j="ok">' + icon('check') + 'Unirme</button><a class="btn" href="#/">Ahora no</a></div></div>';
  app.querySelector('[data-j="ok"]').addEventListener('click', function () { grupoJoin(o); });
}
function grupoJoin(o) {
  var cur = grupoInfo(), same = cur && cur.secret === o.g;
  var g = same ? cur : { v: 1, secret: o.g, x: o.x, y: o.y, role: 'alumno', sids: [], at: 0 };
  g.dirName = o.d || g.dirName || '';
  if (o.p) { g.role = 'dir'; g.priv = { d: o.p }; }
  if (o.s && g.role !== 'dir' && (g.sids || []).indexOf(o.s) < 0) { g.sids = g.sids || []; g.sids.push(o.s); }
  if (!same) { LS.set(OV_KEY, null); GROV = null; g.at = 0; }
  grupoSave(g);
  if (o.s && g.role !== 'dir') {
    if (!getStudent(o.s)) { var pr = newStudent(o.n || 'Alumno', 'bajo'); pr.id = o.s; if (o.c) pr.color = o.c; _putStudentG(pr); }
    var d = stuData(); d.device = o.s; stuSave(d); whoSet({ k: 'a', sid: o.s });
  } else whoSet({ k: 'd' });
  grupoDisconnect(); GR = null; grupoConnect();
  toast('Listo: este equipo ya está en el grupo.', 3500);
  location.replace(o.s && g.role !== 'dir' ? '#/a/' + enc(o.s) : '#/');
}
/* Cada cambio del director (canciones, compases, alumnos) se publica solo; las estrellas también. */
var _saveLocalG = saveLocal;
saveLocal = function () { var r = _saveLocalG.apply(this, arguments); if (GR && grupoInfo() && isDirDevice()) grStateDirty(); return r; };
var _putStudentG = putStudent;
putStudent = function (pr) { var r = _putStudentG.apply(this, arguments); if (GR && grupoInfo() && pr) { if (isDirDevice()) grStateDirty(); grProgDirty(pr.id); } return r; };
setTimeout(grupoConnect, 400);
window.addEventListener('online', function () { if (grupoInfo()) { grupoDisconnect(); GR = null; grupoConnect(); } });
window.addEventListener('offline', function () { grSyncDraw(); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState !== 'visible' || !grupoInfo() || grOnline() || navigator.onLine === false) return;
  grupoDisconnect(); GR = null; grupoConnect();
});
/* Las canciones que manda el director se ven en el celular del alumno como si ya estuvieran publicadas. */
var _allSongsG = allSongs;
allSongs = function () {
  var out = _allSongsG.apply(this, arguments); if (!grOvOn()) return out;
  var ov = grOv(), seen = {}, res = [];
  out.forEach(function (s) { seen[s.id] = 1; if (local.songs[s.id]) { res.push(s); return; } if (ov.deleted[s.id]) return; res.push(ov.songs[s.id] || s); });
  Object.keys(ov.songs).forEach(function (id) { if (!seen[id] && !local.deleted[id] && !ov.deleted[id]) res.push(ov.songs[id]); });
  return res;
};
var _getSongG = getSong;
getSong = function (id) {
  if (id && grOvOn() && !local.songs[id] && !local.deleted[id] && !(typeof syncOverride !== 'undefined' && syncOverride && syncOverride[id])) {
    var ov = grOv(); if (ov.deleted[id]) return null; if (ov.songs[id]) return ov.songs[id];
  }
  return _getSongG.apply(this, arguments);
};

/* parte 17: el celular escucha el piano (sin cable)
   Para practicar en casa con cualquier piano o teclado, aunque no tenga salida USB ni MIDI. No reconoce cualquier
   sonido: tras cada tecla que suena comprueba si es la nota (o el acorde) que tocaba (C.hearCreate, en el motor).
   Aquí también: «¿Qué tecla es?», juego de notas y de acordes, video más lento y metrónomo. */
var oido = null;
var OIDO_AUTO = 'cfp.oidoAuto';
var NOTE_ES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
function oidoActive() { return !!(oido && oido.det); }
function micErrText(e) {
  return e && e.name === 'NotAllowedError' ? 'Da permiso al micrófono: toca el candado junto a la dirección y permite el micrófono.' :
    'No se pudo usar el micrófono. ' + (e && e.message ? e.message : '');
}
function oidoStart(onEv, stream) {
  oidoStop();
  audio();
  var go = function (ms) {
    var E = earNode(ms, !stream); if (!E) throw new Error('Este equipo no permite usar el micrófono aquí.');
    // el oído sabe la frecuencia del micrófono: así arma el espectro tecla por tecla que usa con los acordes
    // y la afinación del piano que ya midió antes en este equipo (la sigue midiendo y la guarda)
    oido = { E: E, det: C.hearCreate({ sr: AC.sampleRate, nfft: E.an.fftSize, tune: earTune() }), onEv: onEv || null };
    oido.timer = setInterval(oidoTick, 50);
    return oido;
  };
  if (stream) { try { return Promise.resolve(go(stream)); } catch (e) { return Promise.reject(e); } }
  return earGetStream().then(go);
}
function oidoStop() { if (!oido) return; clearInterval(oido.timer); earRelease(oido.E); oido = null; }
function oidoRead(E, K) {
  E.an.getFloatFrequencyData(E.buf);
  var raw = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], peak = -160;
  for (var q = 0; q < E.map.length; q++) {
    var m = E.map[q], db = E.buf[m[0]]; if (!(db > -160)) continue;
    if (db > peak) peak = db;
    raw[m[1]] += Math.pow(10, db / 20) * m[2];
  }
  var mag = null;
  if (K) {                                   // fuerza de cada frecuencia (hasta ~2,7 kHz) para mirar tecla por tecla
    mag = E.mag && E.mag.length === K + 2 ? E.mag : (E.mag = new Float64Array(K + 2));
    for (var k = 0; k < K + 2; k++) { var d = E.buf[k]; mag[k] = d > -160 ? Math.pow(10, d / 20) : 0; }
  }
  return { raw: raw, peak: peak, t: performance.now(), mag: mag, db: E.buf, clip: tapClipping() };
}
function oidoTick() {
  if (!oido) return;
  var f = oidoRead(oido.E, oido.det.kmax), ev = oido.det.frame(f), w = Math.max(0, Math.min(100, (f.peak + 90) * 1.6)).toFixed(0) + '%';
  Array.prototype.forEach.call(document.querySelectorAll('.oido-lvl i'), function (i) { i.style.width = w; });
  if (ev && oido.onEv) oido.onEv(ev);
  tapClipShow();
  earSaveTune(oido.det, f.t);
}
/* ---------- en el modo en vivo del alumno ---------- */
function oidoTargetNow() {
  var st = liveState; if (!oidoActive() || !st || drill) return;
  var v = st.vo[st.i].v, reg = 127, keys = (v.right || []).concat(v.hideLeft ? [] : [v.left]).filter(function (m) { return m != null; });
  keys.forEach(function (m) { if (m < reg) reg = m; });
  // las teclas exactas que muestra la pantalla: con acordes, el oído mira cada una (y la misma una octava más arriba o abajo)
  oido.det.target(Object.keys(midiTarget()).map(Number), Object.keys(midiAllowed()).map(Number), reg === 127 ? 60 : reg, performance.now(), keys);
  tapLog('objetivo', { i: st.i, acorde: st.vo[st.i].en, pcs: Object.keys(midiTarget()).map(Number), teclas: keys });
  oidoMarkMiss([]);
}
/* Teclas que faltan del acorde: brillan en la pantalla para que el alumno vea cuál le faltó. */
function oidoMarkMiss(pcs) {
  var st = liveState, main = lid('lv-main'); if (!st || !main) return;
  var v = st.vo[st.i] && st.vo[st.i].v, want = {};
  if (v) (v.right || []).concat(v.hideLeft ? [] : [v.left]).forEach(function (m) { if (m != null && pcs.indexOf(C.mod12(m)) >= 0) want[m] = 1; });
  Array.prototype.forEach.call(main.querySelectorAll('svg.piano rect[data-m]'), function (r) { r.classList.toggle('mmiss', !!want[+r.getAttribute('data-m')]); });
}
function oidoNums(pcs) { var h = liveState && liveState.easy ? liveState.easy.home : 0; return pcs.map(function (p) { return ezNum(p, h); }); }
function oidoList(a) { return a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1]; }
function oidoLabel(pcs) { var h = liveState && liveState.easy ? liveState.easy.home : 0; return pcs.map(function (p) { return ezNum(p, h); }).join('-'); }
function oidoLiveEv(ev) {
  var st = liveState; if (!st) return;
  if (ev.type !== 'note') tapLog(ev.type, ev.type === 'onset' ? null : { have: ev.have, miss: ev.miss, pcs: ev.pcs, sus: ev.sus || undefined });
  if (ev.type === 'onset' || ev.type === 'note') return;
  var box = lid('lv-oido'), want = (st.vo[st.i] && st.vo[st.i].label) || '';
  micDotState(ev.type === 'ok' ? 'ok' : 'wait');
  if (ev.type === 'ok') {
    if (box) { box.className = 'ok'; box.textContent = '¡Eso es!'; }
    oidoMarkMiss([]);
    if (st.mode === 'practice') practiceAdvance();
    else if (st.mode === 'auto' && st.stu) stuMicOk(ev.t);
  } else if (ev.type === 'partial') {
    // tocó parte del acorde: no es error; se le dice qué tecla falta y esa tecla brilla
    var miss = oidoNums(ev.miss);
    if (box) { box.className = 'part'; box.textContent = (ev.have.length ? 'Bien el ' + oidoList(oidoNums(ev.have)) + '. ' : '') + 'Falta el ' + oidoList(miss) + '.'; }
    oidoMarkMiss(ev.miss);
  } else if (ev.type === 'bad') {
    if (box) { box.className = 'bad'; box.textContent = ev.extra ? 'Sobra el ' + oidoLabel(ev.pcs) + ': toca solo las del acorde.' : 'Oigo el ' + oidoLabel(ev.pcs) + (want ? '. Busca el ' + want + '.' : '.'); }
    if (!st.pWait && ev.conf >= 0.88 && st.stu) stuWrong();
  }
}
/* A tiempo con el micrófono: el golpe cuenta desde un poco antes del cambio hasta un tiempo después. */
function stuMicOk(t) {
  var st = liveState; if (!st || !st.stu || !stuRun || !st.playing) return;
  if (stuRun.marks[st.i] === 'ok' || stuRun.marks[st.i] === 'tarde') return;
  var spb = 60000 / st.bpm, t0 = st.chordT || t;
  if (t < t0 - 0.35 * spb) return;
  var late = t - t0 > spb;
  stuRun.marks[st.i] = late ? 'tarde' : 'ok'; st.gotIt = true; clearTimeout(stuHelpTimer);
  var faded = st.fade && st.fade[st.vo[st.i].key];
  stuStat(st.vo[st.i].key, !late && st.firstTry && (!faded || !st.helpNow));
  var g = lid('lv-good'); if (g) { g.textContent = late ? 'Un poco tarde' : '¡Bien!'; g.classList.remove('hit'); void g.offsetWidth; g.classList.add('hit'); }
}
function oidoRelive() { var st = liveState; if (!st) return; if (st.stu) setStuLevel(st.level, true); else drawLive(); oidoTargetNow(); }
function oidoToggleLive() {
  var st = liveState; if (!st) return;
  if (oidoActive()) { oidoStop(); LS.set(OIDO_AUTO, false); oidoRelive(); toast('Ya no te escucho.', 1800); return; }
  st.sound = false; midi.sound = false;                 // la app no debe sonar: se oiría a sí misma
  oidoStart(oidoLiveEv).then(function () {
    if (liveState !== st) { oidoStop(); return; }
    LS.set(OIDO_AUTO, true); oidoRelive();
    toast('Te escucho. Pon el celular cerca del piano.', 3200);
  }).catch(function (e) { toast(micErrText(e), 6000); });
}
function oidoLiveWith(stream) {
  var st = liveState; if (!st) return Promise.resolve(false);
  st.sound = false;
  return oidoStart(oidoLiveEv, stream).then(function () { oidoRelive(); return true; });
}
function oidoMeterHTML() {
  if (meterHidden()) return '';
  var st = liveState, want = st && st.vo[st.i] ? st.vo[st.i].label || '' : '';
  return '<div class="lv-meter lv-oidom"><span class="lv-lvl oido-lvl"><i></i></span><span id="lv-oido">' +
    (st.mode === 'practice' ? 'Te escucho: toca el ' + esc(want) : 'Te escucho') + '</span>' + clipWarnHTML() +
    '<button type="button" class="linkbtn" data-lv="miccheck">¿Qué oye?</button><button type="button" class="linkbtn" data-lv="oido">Apagar</button><span class="lv-good" id="lv-good"></span>' + meterX() + '</div>';
}
/* Clic sin tono mientras el celular escucha (un clic con tono sonaría como una nota). */
function noiseClick(when, accent) {
  var ac = AC; if (!ac) return;
  if (!noiseClick.b || noiseClick.b.sampleRate !== ac.sampleRate) {
    var b = ac.createBuffer(1, Math.round(ac.sampleRate * 0.03), ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ac.sampleRate * 0.005));
    noiseClick.b = b;
  }
  var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseClick.b; f.type = 'highpass'; f.frequency.value = 4500; g.gain.value = accent ? 1.2 : 0.8;
  s.connect(f); f.connect(g); g.connect(audioOut() || ac.destination); s.start(when);
}
/* ---------- video en el modo en vivo del alumno: más lento sin perder la sincronía ---------- */
var VRATES = [0.5, 0.75, 1];
function videoRate(r) {
  var st = liveState; if (!st) return;
  st.vrate = r;
  try { if (yt.player && yt.player.setPlaybackRate) yt.player.setPlaybackRate(r); } catch (e) { /* nada */ }
  var nav = lid('lv-nav'); if (nav) nav.innerHTML = navHTML();
}
function videoRateStep(dir) { var st = liveState; if (!st) return; var k = VRATES.indexOf(st.vrate || 1); k = Math.max(0, Math.min(VRATES.length - 1, (k < 0 ? 2 : k) + dir)); videoRate(VRATES[k]); }
function stuVideoMode(on) {
  var st = liveState; if (!st || !st.tl || !st.tl.video) return;
  pauseLive();
  if (on) { st.mode = 'video'; st.vrate = st.vrate || 0.75; showVideo(st.tl.video.id, st.tl.video.start).catch(videoFailed); }
  else { hideVideo(); st.mode = stuModeFor(st.level); }
  drawLive();
}

/* ---------- juegos: la app pide un número y el alumno lo encuentra (primero con ayuda, después sin ayuda) ---------- */
var drill = null;
var DR_NOTES = [['1', [0]], ['2', [2]], ['3', [4]], ['4', [5]], ['5', [7]], ['6', [9]], ['7', [11]]];
var DR_CHORDS = [['1', [0, 4, 7]], ['4', [5, 9, 0]], ['5', [7, 11, 2]], ['6m', [9, 0, 4]], ['2m', [2, 5, 9]]];
function drKbSVG(lo, n, lit, home) {
  var isB = function (m) { return [1, 3, 6, 8, 10].indexOf(C.mod12(m)) >= 0; };
  var W = 46, H = 150, BW = 28, BH = 92, wx = {}, x = 0, out = '', m;
  for (m = lo; m < lo + n; m++) if (!isB(m)) { wx[m] = x; x += W; }
  for (m = lo; m < lo + n; m++) if (!isB(m)) {
    var on = lit.indexOf(m) >= 0, num = ezNum(m, home);
    out += '<rect x="' + (wx[m] + 1) + '" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="5" class="dw' + (on ? ' on' : '') + '"/>' +
      (num.indexOf('#') < 0 ? '<text x="' + (wx[m] + W / 2) + '" y="' + (H - 14) + '" class="dn' + (on ? ' on' : '') + '">' + num + '</text>' : '');
  }
  for (m = lo; m < lo + n; m++) if (isB(m) && wx[m - 1] != null) out += '<rect x="' + (wx[m - 1] + W - BW / 2) + '" y="1" width="' + BW + '" height="' + BH + '" rx="4" class="db' + (lit.indexOf(m) >= 0 ? ' on' : '') + '"/>';
  return '<svg class="dr-svg" viewBox="0 0 ' + x + ' ' + H + '" role="img" aria-label="Teclado">' + out + '</svg>';
}
function openDrill(sid, kind) {
  var pr = getStudent(sid); if (!pr) return;
  closeDrill(true);
  var c = cfgNorm(pr), home = c.home < 0 ? 0 : c.home, lo = 48 + C.mod12(home);
  if ([1, 3, 6, 8, 10].indexOf(C.mod12(lo)) >= 0) lo--;
  var el = document.createElement('div');
  el.className = 'drill'; el.id = 'drill'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.style.setProperty('--c', pr.color || '#3a43c4');
  el.innerHTML = '<header class="dr-top"><button type="button" class="iconbtn" data-d="x" aria-label="Salir">' + icon('close') + '</button><h2>' +
    (kind === 'finder' ? '¿Qué tecla es?' : kind === 'acordes' ? 'Juego de acordes' : 'Juego de notas') + '</h2><span class="dr-score" id="dr-score"></span></header>' +
    '<div class="dr-ask" id="dr-ask"></div><div class="dr-kb" id="dr-kb"></div><p class="dr-fb" id="dr-fb" aria-live="polite"></p><div class="dr-act" id="dr-act"></div>';
  document.body.appendChild(el); document.body.classList.add('live-open');
  drill = { sid: sid, kind: kind, home: home, lo: lo, span: kind === 'acordes' ? 24 : 13, items: kind === 'acordes' ? DR_CHORDS : DR_NOTES,
    n: 0, total: 10, okFirst: 0, streak: 0, help: true, helpNow: true, cur: null, tries: 0, t0: Date.now(), lit: [], pcs: [] };
  el.addEventListener('click', drillTap);
  if (kind === 'finder') drillDraw('Toca una tecla y te digo su número.');
  else drillNext();
  if (kind === 'finder' || (LS.get(OIDO_AUTO, false) && !midi.inp)) drillMic();
}
function drillMic() {
  var d = drill; if (!d) return;
  oidoStart(drillMicEv).then(function () {
    if (drill !== d) { oidoStop(); return; }
    LS.set(OIDO_AUTO, true);
    if (d.kind !== 'finder' && d.pcs.length) oido.det.target(d.pcs, [], d.lo, performance.now(), d.lit);
    drillDraw();
  }).catch(function (er) { toast(micErrText(er), 6000); });
}
function drillNext() {
  var d = drill; if (!d) return;
  if (d.n >= d.total) { drillEnd(); return; }
  var it; do { it = d.items[Math.floor(Math.random() * d.items.length)]; } while (d.cur && it[0] === d.cur[0] && d.items.length > 1);
  var rel = it[1];
  d.cur = it; d.n++; d.tries = 0; d.helpNow = d.help;
  d.pcs = rel.map(function (x) { return C.mod12(x + d.home); });
  d.lit = rel.map(function (x) { return d.lo + C.mod12(d.home - (d.lo % 12)) + (x < rel[0] ? x + 12 : x); });
  if (oidoActive()) oido.det.target(d.pcs, [], d.lo, performance.now(), d.lit);
  clearTimeout(d.ht);
  var n0 = d.n;
  if (!d.help) d.ht = setTimeout(function () { if (drill === d && d.n === n0 && !d.lock) { d.helpNow = true; drillDraw('Mira: aquí está.'); } }, 5000);
  drillDraw('');
}
function drillActHTML() {
  var d = drill, h = '';
  if (midi.inp) h += '<span class="dr-in">' + icon('keys') + 'Teclado conectado</span>';
  else if (oidoActive()) h += '<span class="dr-in"><span class="lv-lvl oido-lvl"><i></i></span>Te escucho</span>';
  else h += '<button type="button" class="btn primary" data-d="mic">' + icon('mic') + 'Que el celular me escuche</button>';
  if (!midi.inp && !oidoActive() && d.kind !== 'finder') h += '<button type="button" class="btn" data-d="self">' + icon('check') + 'Lo toqué</button>';
  if (!midi.inp && midiSupported()) h += '<button type="button" class="linkbtn" data-d="midi">Conectar teclado (cable)</button>';
  if (d.kind !== 'finder' && !d.helpNow && !d.done) h += '<button type="button" class="linkbtn" data-d="help">Ayuda</button>';
  return h;
}
function drillDraw(fb) {
  var d = drill, el = lid('drill'); if (!d || !el || d.done) return;
  if (d.kind === 'finder') {
    if (d.heard == null) { el.querySelector('#dr-ask').innerHTML = '<span class="dr-q">Toca una tecla</span><b class="dr-n">?</b>'; el.querySelector('#dr-kb').innerHTML = drKbSVG(d.lo, 13, [], d.home); }
  } else {
    el.querySelector('#dr-ask').innerHTML = '<span class="dr-q">' + (d.kind === 'acordes' ? 'Toca el acorde' : 'Toca el') + '</span><b class="dr-n">' + esc(d.cur[0]) + '</b>' + (d.help ? '' : '<span class="dr-tag">sin ayuda</span>');
    el.querySelector('#dr-kb').innerHTML = drKbSVG(d.lo, d.span, d.helpNow ? d.lit : [], d.home);
    el.querySelector('#dr-score').textContent = Math.min(d.n, d.total) + ' de ' + d.total;
  }
  if (fb != null) el.querySelector('#dr-fb').innerHTML = esc(fb);
  el.querySelector('#dr-act').innerHTML = drillActHTML();
}
function drillShowHeard(pc) {
  var d = drill, el = lid('drill'); if (!d || !el) return;
  d.heard = pc;
  var num = ezNum(pc, d.home), lit = [];
  for (var m = d.lo; m < d.lo + 13; m++) if (C.mod12(m) === pc) lit.push(m);
  el.querySelector('#dr-ask').innerHTML = '<span class="dr-q">Esa tecla es el</span><b class="dr-n">' + esc(num) + '</b><span class="dr-q">' + NOTE_ES[pc] + '</span>';
  el.querySelector('#dr-kb').innerHTML = drKbSVG(d.lo, 13, lit, d.home);
  el.querySelector('#dr-fb').textContent = 'Si el número es el correcto, el celular te oye bien.';
}
function drillHit(ok, heard) {
  var d = drill, el = lid('drill'); if (!d || d.lock || d.done || d.kind === 'finder') return;
  if (ok) {
    d.lock = true; clearTimeout(d.ht);
    var first = d.tries === 0, msg = first ? '¡Bien!' : 'Eso es.';
    if (first) { d.okFirst++; d.streak++; } else d.streak = 0;
    if (d.help && d.streak >= 3) { d.help = false; d.streak = 0; msg = '¡Muy bien! Ahora sin ayuda.'; }
    if (el) { var f = el.querySelector('#dr-fb'); f.textContent = msg; f.className = 'dr-fb ok'; }
    setTimeout(function () { if (drill !== d) return; d.lock = false; var f2 = el && el.querySelector('#dr-fb'); if (f2) f2.className = 'dr-fb'; drillNext(); }, 700);
  } else {
    d.tries++; d.streak = 0;
    if (d.tries >= 2) d.helpNow = true;
    if (d.tries >= 3) d.help = true;                     // si cuesta, la ayuda vuelve
    drillDraw(heard ? 'Ese es el ' + heard + '. Busca el ' + d.cur[0] + '.' : 'Casi. Prueba otra vez.');
  }
}
function drillNote(n) {
  var d = drill; if (!d || d.lock) return;
  var pc = C.mod12(n);
  if (d.kind === 'finder') { drillShowHeard(pc); return; }
  if (d.pcs.indexOf(pc) < 0) { drillHit(false, ezNum(n, d.home)); return; }
  var held = {}; Object.keys(midi.held).forEach(function (m) { held[C.mod12(+m)] = 1; });
  if (d.pcs.every(function (p) { return held[p]; })) drillHit(true);
}
function drillMicEv(ev) {
  var d = drill; if (!d) return;
  if (d.kind === 'finder') { if (ev.type === 'note') drillShowHeard(ev.pc); return; }
  if (ev.type === 'ok') drillHit(true);
  else if (ev.type === 'partial') drillPartial(ev.miss.map(function (p) { return ezNum(p, d.home); }), ev.miss);
  else if (ev.type === 'bad') drillHit(false, ev.pcs.map(function (p) { return ezNum(p, d.home); }).join('-'));
}
/* Acorde a medias en el juego: se muestra qué tecla falta (esa sola brilla) y cuenta como intento. */
function drillPartial(nums, pcs) {
  var d = drill, el = lid('drill'); if (!d || d.lock || d.done || !el) return;
  d.tries++; d.streak = 0;
  var lit = d.lit.filter(function (m) { return pcs.indexOf(C.mod12(m)) >= 0; });
  el.querySelector('#dr-kb').innerHTML = drKbSVG(d.lo, d.span, lit, d.home);
  var f = el.querySelector('#dr-fb'); f.textContent = 'Casi: falta el ' + oidoList(nums) + '.'; f.className = 'dr-fb';
}
function drillEnd() {
  var d = drill, el = lid('drill'); if (!d || !el) return;
  var s = d.okFirst, stars = s >= 9 ? 3 : s >= 7 ? 2 : s >= 5 ? 1 : 0, pr = getStudent(d.sid);
  d.done = true; clearTimeout(d.ht);
  el.querySelector('#dr-ask').innerHTML = '<span class="dr-q">' + (s >= 7 ? '¡Muy bien!' : 'Buen trabajo') + '</span><b class="dr-n">' + s + '/' + d.total + '</b><span class="dr-q">a la primera</span>';
  el.querySelector('#dr-kb').innerHTML = '<p class="dr-stars">' + [1, 2, 3].map(function (k) { return '<i class="' + (k <= stars ? 'on' : '') + '">' + icon('star') + '</i>'; }).join('') + '</p>';
  el.querySelector('#dr-fb').textContent = s >= 9 ? 'Ya casi no necesitas ayuda.' : 'Otra vuelta y sale mejor.';
  el.querySelector('#dr-act').innerHTML = '<button type="button" class="btn primary" data-d="again">Otra vez</button><button type="button" class="btn" data-d="x">Salir</button>';
  if (pr) { pr.games = pr.games || {}; pr.games[d.kind] = Math.max(pr.games[d.kind] || 0, s); putStudent(pr); }
}
function drillTap(e) {
  var b = e.target.closest('[data-d]'), d = drill; if (!b || !d) return;
  var a = b.getAttribute('data-d');
  if (a === 'x') closeDrill();
  else if (a === 'mic') drillMic();
  else if (a === 'self') drillHit(true);
  else if (a === 'midi') midiConnect().then(function () { drillDraw(); if (!midi.inp) toast('No encontré el teclado. Revisa el cable.', 4000); }).catch(function () { toast('Este navegador no puede usar el teclado por cable.', 4000); });
  else if (a === 'help') { d.helpNow = true; drillDraw(); }
  else if (a === 'again') { d.n = 0; d.okFirst = 0; d.streak = 0; d.cur = null; d.done = false; d.help = true; drillNext(); }
}
function closeDrill(silent) {
  var d = drill; if (!d) return;
  clearTimeout(d.ht); drill = null; oidoStop();
  var el = lid('drill'); if (el) el.remove();
  if (!liveState) document.body.classList.remove('live-open');
  kidLog(d.sid, (Date.now() - d.t0) / 60000);
  if (!silent && route.name === 'kidtab') renderKid(d.sid, 'practicar');
}
document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drill && !sheetRoot.firstChild) closeDrill(); });

/* ---------- practicar con un video de YouTube: más lento y repitiendo una parte ---------- */
var vprac = null;
function openVideoPractice(sid) {
  var last = LS.get('cfp.vp.' + sid, ''), el = document.createElement('div');
  el.className = 'drill vprac'; el.id = 'vprac'; el.setAttribute('role', 'dialog');
  el.innerHTML = '<header class="dr-top"><button type="button" class="iconbtn" data-v="x" aria-label="Salir">' + icon('close') + '</button><h2>Practicar con un video</h2></header>' +
    '<div class="vp-in"><input id="vp-url" type="url" inputmode="url" placeholder="Pega aquí el enlace de YouTube" value="' + esc(last) + '" autocomplete="off"><button type="button" class="btn primary" data-v="open">Abrir</button></div>' +
    '<div class="vp-box"><div id="vp-yt"></div></div>' +
    '<div class="vp-ctl"><div class="seg" id="vp-rate">' + [[0.5, '50 %'], [0.75, '75 %'], [1, '100 %']].map(function (r) { return '<button type="button" data-rate="' + r[0] + '" aria-pressed="' + (r[0] === 1) + '">' + r[1] + '</button>'; }).join('') + '</div>' +
    '<button type="button" class="btn" data-v="back5">« 5 s</button><button type="button" class="btn" data-v="a">Inicio A</button><button type="button" class="btn" data-v="b">Fin B</button>' +
    '<button type="button" class="btn" data-v="loop" aria-pressed="false">Repetir A-B</button></div>' +
    '<p class="help" id="vp-msg">Ponlo más lento para sacar la canción de oído. Marca dónde empieza (A) y dónde termina (B) una parte y repítela hasta que salga.</p>';
  document.body.appendChild(el); document.body.classList.add('live-open');
  var V = vprac = { p: null, a: null, b: null, loop: false, timer: 0, rate: 1 };
  var msg = function (t) { var m = el.querySelector('#vp-msg'); if (m) m.textContent = t; };
  var open = function () {
    var url = el.querySelector('#vp-url').value.trim(), id = C.ytId(url);
    if (!id) { msg('Ese enlace no es de YouTube. Cópialo desde el botón «Compartir» del video.'); return; }
    LS.set('cfp.vp.' + sid, url);
    if (V.p) { try { V.p.destroy(); } catch (x) { /* nada */ } V.p = null; el.querySelector('.vp-box').innerHTML = '<div id="vp-yt"></div>'; }
    msg('Abriendo el video…');
    loadYT().then(function (YT) {
      if (vprac !== V) return;
      V.p = new YT.Player('vp-yt', { videoId: id, width: '100%', height: '100%', playerVars: { playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(C.ytStart(url) || 0) },
        events: { onReady: function () { msg('Listo. Elige la velocidad y dale play.'); try { V.p.setPlaybackRate(V.rate); } catch (x) { /* nada */ } } } });
    }).catch(function () { msg('No se pudo abrir el video. Revisa la conexión a internet.'); });
  };
  V.timer = setInterval(function () {
    if (!V.p || !V.loop || V.a == null || V.b == null || !V.p.getCurrentTime) return;
    try { if (V.p.getCurrentTime() >= V.b) V.p.seekTo(V.a, true); } catch (x) { /* nada */ }
  }, 200);
  el.addEventListener('click', function (e) {
    var r = e.target.closest('[data-rate]');
    if (r) { V.rate = +r.getAttribute('data-rate'); Array.prototype.forEach.call(r.parentNode.children, function (x) { x.setAttribute('aria-pressed', String(x === r)); }); try { if (V.p) V.p.setPlaybackRate(V.rate); } catch (x) { /* nada */ } return; }
    var b = e.target.closest('[data-v]'); if (!b) return;
    var a = b.getAttribute('data-v'), now = 0;
    try { now = V.p && V.p.getCurrentTime ? V.p.getCurrentTime() : 0; } catch (x) { now = 0; }
    if (a === 'x') closeVideoPractice();
    else if (a === 'open') open();
    else if (!V.p) msg('Primero abre un video.');
    else if (a === 'back5') V.p.seekTo(Math.max(0, now - 5), true);
    else if (a === 'a') { V.a = now; msg('Inicio A en ' + C.fmtClock(now) + '. Ahora marca el fin B.'); }
    else if (a === 'b') { V.b = now; if (V.a != null && V.b > V.a) { V.loop = true; el.querySelector('[data-v="loop"]').setAttribute('aria-pressed', 'true'); V.p.seekTo(V.a, true); msg('Repitiendo de ' + C.fmtClock(V.a) + ' a ' + C.fmtClock(V.b) + '.'); } else msg('El fin B tiene que ir después del inicio A.'); }
    else if (a === 'loop') { V.loop = !V.loop && V.a != null && V.b != null; b.setAttribute('aria-pressed', String(V.loop)); if (!V.loop) msg('Ya no repite.'); }
  });
  el.querySelector('#vp-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
  if (last) open();
  V.t0 = Date.now(); V.sid = sid;
}
function closeVideoPractice() {
  var V = vprac; if (!V) return;
  vprac = null; clearInterval(V.timer);
  if (V.p) { try { V.p.destroy(); } catch (x) { /* nada */ } }
  var el = lid('vprac'); if (el) el.remove();
  if (!liveState) document.body.classList.remove('live-open');
  kidLog(V.sid, (Date.now() - V.t0) / 60000);
}
/* ---------- metrónomo ---------- */
function openMetronome() {
  var M = { bpm: +LS.get('cfp.metro', 80) || 80, on: false, n: 0, timer: 0 };
  audio();
  openSheet('Metrónomo', '<div class="metro"><button type="button" class="btn" data-m="-" aria-label="Más lento">−</button><output id="mt-b">' + M.bpm + '</output>' +
    '<button type="button" class="btn" data-m="+" aria-label="Más rápido">+</button></div><p class="help">Pulsos por minuto. Empieza lento: más vale lento y parejo que rápido y a saltos.</p>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-m="go">' + icon('play') + 'Empezar</button></div>', function (el) {
    var tick = function () { if (!M.on || !AC) return; clickAt(AC.currentTime + 0.02, M.n % 4 === 0); M.n++; M.timer = setTimeout(tick, 60000 / M.bpm); };
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      var a = b.getAttribute('data-m');
      if (a === '-' || a === '+') { M.bpm = Math.max(30, Math.min(220, M.bpm + (a === '+' ? 4 : -4))); LS.set('cfp.metro', M.bpm); el.querySelector('#mt-b').textContent = M.bpm; }
      else { M.on = !M.on; clearTimeout(M.timer); M.n = 0; b.innerHTML = M.on ? icon('pause') + 'Parar' : icon('play') + 'Empezar'; if (M.on) { audio(); tick(); } }
    });
  }, { onClose: function () { M.on = false; clearTimeout(M.timer); } });
}

/* parte 18: mandar con la voz mientras tocas («siguiente», «otra vez», «más lento»…)
   Usa el reconocimiento de voz de Chrome (en Android casi siempre necesita internet). Solo responde a frases cortas y
   exactas, para que la letra que se canta no mueva nada. */
var voz = null, VOZ_PREF = 'cfp.voz';
/* Solo órdenes que casi nunca salen en las letras: «para», «sigue», «alto», «vuelve», «pasa» o «toca» se cantan mucho. */
var VOZ_CMDS = [
  ['next', ['siguiente', 'adelante', 'el que sigue', 'la que sigue']],
  ['prev', ['anterior', 'atras', 'para atras', 'retrocede']],
  ['again', ['otra vez', 'repite', 'repetir', 'de nuevo', 'repite esa']],
  ['top', ['desde el inicio', 'al inicio', 'desde el principio', 'del principio', 'desde el comienzo']],
  ['slower', ['mas lento', 'mas despacio', 'baja la velocidad', 'mas lenta']],
  ['faster', ['mas rapido', 'sube la velocidad', 'mas rapida']],
  ['pause', ['pausa', 'detente', 'stop']],
  ['play', ['dale', 'empieza', 'empezar', 'continua', 'arranca']],
  ['help', ['ayuda', 'ayudame', 'muestrame']],
  ['coro', ['al coro', 'el coro', 'vamos al coro']],
  ['end', ['salir', 'terminar']]
];
function vozSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition) || vozLocalReady(); }
function vozGoogleOk() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function vozNorm(s) { return C.normalize(s).replace(/[^a-zñ ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(oye|ok|okey|app|piano|ya) /, '').replace(/ por favor$/, ''); }
/* La frase entera tiene que ser corta (hasta 3 palabras) y terminar en una orden: así una frase cantada no manda nada. */
function vozMatch(text) {
  var s = vozNorm(text); if (!s) return null;
  var w = s.split(' '); if (w.length > 3) return null;
  for (var i = 0; i < VOZ_CMDS.length; i++) for (var j = 0; j < VOZ_CMDS[i][1].length; j++) {
    var c = VOZ_CMDS[i][1][j];
    if (s === c || (s.length > c.length && s.slice(-c.length - 1) === ' ' + c)) return VOZ_CMDS[i][0];
  }
  return null;
}
/* Con internet (Chrome): responde mientras hablas (sin esperar el final de la frase). En Android, Chrome corta cada
   pocos segundos; la app lo vuelve a prender al instante y el aviso de arriba no parpadea. */
function vozStartGoogle() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return false;
  if (navigator.onLine === false) { toast('La voz de Chrome necesita internet. Usa «Enseñar mi voz»: funciona sin internet.', 5500); return false; }
  var r = new SR(), V = { kind: 'google', r: r, on: true, fails: 0, fired: {}, ends: [] };
  r.lang = 'es-PE'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
  try { if (SR.available) { r.processLocally = false; } } catch (x) { /* nada */ }
  r.onresult = function (e) {
    for (var k = e.resultIndex; k < e.results.length; k++) {
      var res = e.results[k];
      for (var a = 0; a < res.length; a++) {
        var cmd = vozMatch(res[a].transcript); if (!cmd) continue;
        var key = k + ':' + cmd; if (V.fired[key]) return;      // la misma frase no manda dos veces
        V.fired[key] = 1; vozRun(cmd, res[a].transcript); return;
      }
    }
  };
  r.onerror = function (e) {
    var er = e && e.error;
    if (er === 'not-allowed' || er === 'service-not-allowed') { toast('Da permiso al micrófono para mandar con la voz.', 5000); vozStop(); }
    else if (er === 'network') { toast('La voz de Chrome necesita internet. Usa «Enseñar mi voz»: funciona sin internet.', 5500); vozStop(); }
    else if (er === 'audio-capture') { V.fails++; if (V.fails > 2) { toast('El micrófono está ocupado. Usa la voz sin internet («Enseñar mi voz»): funciona junto con «Escuchando».', 6500); vozStop(); } }
  };
  r.onend = function () {
    if (voz !== V || !V.on) return;
    var now = Date.now(); V.ends.push(now); V.ends = V.ends.filter(function (t) { return now - t < 10000; }); V.fired = {};
    if (V.ends.length > 12) { setTimeout(function () { if (voz === V && V.on) { try { r.start(); } catch (x) { /* nada */ } } }, 1500); return; }   // se corta muy seguido: respira un poco
    try { r.start(); } catch (x) { setTimeout(function () { if (voz === V && V.on) { try { r.start(); } catch (y) { /* nada */ } } }, 250); }
  };
  voz = V;
  try { r.start(); } catch (x) { /* nada */ }
  return true;
}
function vozStart() {
  vozStop();
  var ok = vozLocalReady() ? vozLocalStart() : vozStartGoogle();
  vozBadge(); if (liveState) drawLive();
  return ok;
}
function vozStop() {
  var V = voz; voz = null;
  if (V && V.kind === 'google') { V.on = false; try { V.r.abort(); } catch (x) { /* nada */ } }
  if (V && V.kind === 'local') vozLocalStop();
  vozBadge();
}
function vozBadge() { var b = lid('lv-vozb'); if (b) { b.hidden = true; b.textContent = ''; } }
function vozToggle() {
  if (voz) { vozStop(); LS.set(VOZ_PREF, false); if (liveState) drawLive(); toast('Voz apagada.', 1500); return; }
  if (!vozLocalReady() && !vozGoogleOk()) { openVozTrain(); return; }
  if (!vozLocalReady() && navigator.onLine === false) { openVozTrain(); return; }
  if (vozStart()) {
    LS.set(VOZ_PREF, true);
    toast(vozLocalReady() ? 'Te oigo (sin internet): di las órdenes que grabaste, en una pausa.' : 'Di «siguiente», «anterior», «otra vez», «desde el inicio», «más lento», «pausa» o «dale».', 5500);
  }
}
/* al abrir otra canción la voz sigue prendida (antes se apagaba al cerrar la canción y parecía que ya no funcionaba) */
function vozResume() { if (!voz && LS.get(VOZ_PREF, false) && (vozLocalReady() || (vozGoogleOk() && navigator.onLine !== false))) vozStart(); }
function vozLineStart(st) { var li = st.steps[st.path[st.i]].li, q = st.i; while (q > 0 && st.steps[st.path[q - 1]].li === li) q--; return q; }
function vozFind(st, re) {
  var lines = info(st.song).lines, n = st.path.length;
  for (var k = 1; k <= n; k++) {
    var q = (st.i + k) % n, li = st.steps[st.path[q]].li, pl = q ? st.steps[st.path[q - 1]].li : -1;
    if (li !== pl && re.test(sectionOf(lines, li))) return q;
  }
  return -1;
}
function vozRun(cmd, heard) {
  var st = liveState; if (!st) return;
  var b = lid('lv-vozb'); if (b) { b.hidden = false; b.textContent = '«' + String(heard).trim() + '»'; clearTimeout(vozRun.t); vozRun.t = setTimeout(vozBadge, 1600); }
  tapLog('voz', { cmd: cmd, oido: String(heard).trim() });
  var playable = st.tl && (st.mode === 'auto' || st.mode === 'video');
  switch (cmd) {
    case 'next': jumpTo(st.i + 1); break;
    case 'prev': jumpTo(st.i - 1); break;
    case 'again': jumpTo(vozLineStart(st)); break;
    case 'top': jumpTo(0); if (playable && !st.playing && !st.counting) playLive(); break;
    case 'slower': if (st.mode === 'video') videoRateStep(-1); else if (st.mode === 'auto' && st.bpm) setBpm(st.bpm * 0.9); break;
    case 'faster': if (st.mode === 'video') videoRateStep(1); else if (st.mode === 'auto' && st.bpm) setBpm(st.bpm * 1.1); break;
    case 'pause': if (st.playing || st.counting) pauseLive(); break;
    case 'play': if (playable && !st.playing && !st.counting) playLive(); break;
    case 'help': st.helpNow = true; drawLive(); break;
    case 'coro': var q = vozFind(st, /coro/i); if (q >= 0) jumpTo(q); else toast('Esta canción no tiene el coro marcado.', 2500); break;
    case 'end': closeLive(false); break;
  }
}

/* parte 19: sin internet sin miedo, novedades y la ficha de cada alumno para el director
   - Un aviso pequeño dice si el equipo está al día con el grupo, si tiene cosas guardadas por mandar o si no hay
     internet (y que todo funciona igual). «Sincronizar» lo intenta en el momento.
   - En el celular del alumno: «Ram cambió los compases de Alabaré» cuando llega un cambio del director.
   - En el equipo del director, los botones de cada alumno abren su ficha: cómo va, cómo toca (ajustes que le llegan
     a su celular), sus canciones e invitación. Ya no es lo mismo que «¿Quién va a tocar?». */

/* ---------- ¿al día con el grupo? ---------- */
function grSyncState() {
  var g = grupoInfo(); if (!g) return null;
  var last = LS.get('cfp.g.sync', 0), pend = LS.get('cfp.g.pend', 0), dev = g.role === 'dir' ? 'este equipo' : 'este celular';
  if (grOnline()) return { k: 'ok', t: 'Al día con el grupo', s: pend ? 'Mandando lo guardado…' : 'Lo que cambies se manda al instante.' };
  if (pend) return { k: 'pend', t: 'Guardado en ' + dev, s: 'Se manda solo cuando haya internet. No se pierde.' };
  if (navigator.onLine === false) return { k: 'off', t: 'Sin internet', s: 'Todo funciona igual.' + (last ? ' Al día ' + whenText(last) + '.' : '') };
  return { k: 'try', t: 'Buscando al grupo…', s: last ? 'Al día ' + whenText(last) + '.' : '' };
}
function grSyncChipHTML() {
  var st = grSyncState(); if (!st) return '';
  return '<div class="gsync gs-' + st.k + '" role="status"><span class="gs-dot" aria-hidden="true"></span><span class="gs-t"><b>' + esc(st.t) + '</b>' +
    (st.s ? '<small>' + esc(st.s) + '</small>' : '') + '</span>' +
    (st.k === 'ok' ? '' : '<button type="button" class="linkbtn" data-gsync="now">Sincronizar</button>') + '</div>';
}
function grSyncDraw() {
  clearTimeout(grSyncDraw.t);
  grSyncDraw.t = setTimeout(function () {
    var h = grSyncChipHTML();
    Array.prototype.forEach.call(document.querySelectorAll('.gsync'), function (el) { if (h) el.outerHTML = h; else el.remove(); });
  }, 80);
}
function grupoSyncNow() {
  if (!grupoInfo()) return;
  if (navigator.onLine === false) { toast('Este equipo no tiene internet ahora. Cuando tenga (wifi, datos o la zona Wi-Fi de otro celular), se manda solo.', 5000); return; }
  grupoDisconnect(); GR = null; grupoConnect(); grSyncDraw();
  toast('Buscando al grupo…', 2000);
}
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-gsync]'); if (b) { e.preventDefault(); grupoSyncNow(); } });

/* ---------- novedades del director en el celular del alumno ---------- */
var NEWS_KEY = 'cfp.g.news';
function grNews(st) {
  var old = LS.get(OV_KEY, null); if (!old || !old.at) return;            // la primera vez llega todo: no es novedad
  var g = grupoInfo(), mine = {}, items = [], who = (st.dirName || dirMsg());
  deviceStudents().forEach(function (pr) { (pr.songs || []).forEach(function (id) { mine[id] = 1; }); });
  Object.keys(st.songs || {}).forEach(function (id) {
    var a = (old.songs || {})[id] || baseSong(id), b = st.songs[id]; if (!b) return;
    var A = a ? cleanSong(a) : null, B = cleanSong(b);
    if (A && JSON.stringify(A) === JSON.stringify(B)) return;
    var what = !A ? 'agregó' : JSON.stringify(A.timeline || null) !== JSON.stringify(B.timeline || null) ? 'cambió los compases de' :
      (A.key || '') !== (B.key || '') ? 'cambió el tono de' : 'cambió';
    items.push({ id: id, title: C.sentenceCase(B.title || ''), what: what, mine: !!mine[id], at: Date.now() });
  });
  if (!items.length) return;
  items.sort(function (x, y) { return (y.mine ? 1 : 0) - (x.mine ? 1 : 0); });
  var list = items.concat(LS.get(NEWS_KEY, []).filter(function (n) { return !items.some(function (x) { return x.id === n.id; }); })).slice(0, 8);
  LS.set(NEWS_KEY, list);
  var top = items[0];
  toast(who.charAt(0).toUpperCase() + who.slice(1) + ' ' + top.what + ' «' + top.title + '»' + (items.length > 1 ? ' y ' + (items.length - 1) + ' más' : '') + '. Ya lo tienes.', 5000);
  if (g) grRefreshView();
}
function kidNewsHTML() {
  var list = LS.get(NEWS_KEY, []).filter(function (n) { return Date.now() - n.at < 7 * 864e5; }); if (!list.length) return '';
  var who = dirMsg(), W = who.charAt(0).toUpperCase() + who.slice(1);
  return '<div class="note-box kid-news">' + icon('star') + '<span><b>Novedades:</b> ' + list.slice(0, 3).map(function (n) {
    return W + ' ' + esc(n.what) + ' «' + esc(n.title) + '»';
  }).join('. ') + '.</span><button type="button" class="linkbtn" data-news="ok">Visto</button></div>';
}
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-news]'); if (!b) return;
  LS.set(NEWS_KEY, []); var box = b.closest('.kid-news'); if (box) box.remove();
});
/* el aviso va arriba en «Mis canciones» y en «Ajustes» del alumno */
var _renderKid19 = renderKid;
renderKid = function (sid, tab) {
  _renderKid19.apply(this, arguments);
  if (!grupoInfo() || (tab && tab !== 'canciones' && tab !== 'ajustes')) return;
  var b = app.querySelector('#kid-b'); if (b) b.insertAdjacentHTML('afterbegin', grSyncChipHTML() + (whoKid() ? kidNewsHTML() : ''));
};
var _renderGrupo19 = renderGrupo;
renderGrupo = function () {
  _renderGrupo19.apply(this, arguments);
  var h = app.querySelector('.grupo .page-h'); if (h && grupoInfo()) h.insertAdjacentHTML('afterend', grSyncChipHTML());
};

/* ---------- ficha del alumno (en el equipo del director) ---------- */
function fichaHref(sid) { return '#/ficha/' + enc(sid); }
function renderFicha(sid) {
  leaveSong();
  var pr = getStudent(sid); if (!pr) { location.replace('#/a'); return; }
  var g = grupoInfo(), c = cfgNorm(pr), dir = !g || g.role === 'dir';
  if (!dir) { location.replace('#/a/' + enc(sid)); return; }               // en el celular de un alumno no hay ficha
  var props = LS.get(INBOX_KEY, []).filter(function (p) { return p.sid === sid; });
  var songs = (pr.songs || []).map(function (id) { return getSong(id); }).filter(Boolean);
  var stars = 0; songs.forEach(function (s) { stars += Object.keys(stuProg(pr, s.id).stars || {}).length; });
  var wk = weekDays(pr), mins = 0; wk.forEach(function (d) { mins += d.min; });
  var m = Object.keys(masteredSet(pr)), home = c.home < 0 ? 0 : c.home;
  var mNum = m.map(function (k) { return k; }).slice(0, 8);
  var phone = g ? (GR && GR.seen[sid] ? 'Su celular se conectó ' + whenText(GR.seen[sid]) + '.' : 'Su celular todavía no se une al grupo.') : '';
  var h = '<div class="page ficha" style="--c:' + esc(pr.color) + '">' +
    '<header class="kid-h">' + btnIcon('back', 'Volver', 'data-go="#/"') +
    '<span class="avatar" style="--c:' + esc(pr.color) + '">' + esc((pr.name || '?').charAt(0).toUpperCase()) + '</span>' +
    '<div class="kid-t"><h1>' + esc(pr.name) + '</h1><p>' + esc(stuDesc(pr)) + '</p></div></header>' +
    (g ? grSyncChipHTML() : '') +
    (props.length ? '<a class="inbox-b" href="#/propuestas">' + icon('inbox') + '<span><b>' + props.length + (props.length === 1 ? ' propuesta' : ' propuestas') + '</b> de ' + esc(pr.name) + ' para revisar</span>' + icon('fwd') + '</a>' : '') +
    '<section class="fi-sec"><h2 class="stu-h">Cómo va</h2>' + weekHTML(pr) +
    '<p class="fi-stats"><span><b>' + Math.round(mins) + '</b> min esta semana</span><span><b>' + stars + '</b> ' + icon('star') + ' en sus canciones</span>' +
    '<span>Acordes que ya domina: <b>' + (mNum.length ? esc(mNum.join(' ')) : 'todavía ninguno') + '</b></span></p>' +
    (pr.games && Object.keys(pr.games).length ? '<p class="help">Juegos: ' + Object.keys(pr.games).map(function (k) { return esc(k === 'acordes' ? 'acordes' : k === 'notas' ? 'notas' : k) + ' ' + pr.games[k] + '/10'; }).join(' · ') + '</p>' : '') + '</section>' +
    '<section class="fi-sec"><h2 class="stu-h">Cómo toca</h2><p class="help">' + (g ? 'Lo que cambies aquí le llega a su celular (cuando tenga internet). No necesita tu aprobación: eres tú.' :
      'Así lo verá cuando toque en este equipo. Con el grupo creado, también le llega a su celular.') + '</p>' +
    '<div id="fi-cfg">' + cfgEditorHTML(c) + '</div></section>' +
    '<section class="fi-sec"><h2 class="stu-h">Sus canciones</h2>' +
    (songs.length ? '<ul class="list fi-songs">' + songs.map(function (s) {
      var p = stuProg(pr, s.id);
      return '<li><span class="txt"><span class="ttl">' + (s.num ? esc(s.num) + '. ' : '') + esc(C.sentenceCase(s.title)) + '</span><span class="sub">Escalón ' + p.step + ': ' + esc(LEVELS[p.step].name) +
        (s.timeline ? '' : ' · sin compases') + '</span></span>' + starsHTML(p) +
        '<button type="button" class="iconbtn" data-fx="rm:' + esc(s.id) + '" aria-label="Quitar ' + esc(C.sentenceCase(s.title)) + ' de sus canciones">' + icon('close') + '</button></li>';
    }).join('') + '</ul>' : '<p class="empty">Todavía no tiene canciones. Agrégale dos o tres fáciles para empezar.</p>') +
    '<div class="btnrow"><button type="button" class="btn" data-sact="pick">' + icon('add') + 'Elegir sus canciones</button></div></section>' +
    '<section class="fi-sec"><h2 class="stu-h">Su celular</h2>' + (phone ? '<p class="help">' + esc(phone) + '</p>' : '') +
    '<div class="btnrow">' + (g ? '<button type="button" class="btn" data-fx="inv">' + icon('share') + 'Invitar su celular (WhatsApp)</button>' : '<a class="btn" href="#/grupo">' + icon('group') + 'Crear el grupo</a>') +
    '<a class="btn" href="#/a/' + enc(sid) + '">' + icon('user') + 'Ver su espacio como lo ve ' + esc(pr.name) + '</a>' +
    '<button type="button" class="btn" data-sact="edit">' + icon('gear') + 'Nombre, color y borrar</button></div></section></div>';
  app.innerHTML = h;
  var root = app.querySelector('.ficha');
  var box = root.querySelector('#fi-cfg');
  if (box) cfgEditorBind(box, function () { return cfgNorm(getStudent(sid)); }, function (ne) {
    var p2 = getStudent(sid); if (!p2) return;
    Object.keys(ne || {}).forEach(function (k) { p2[k] = ne[k]; });
    putStudent(p2);
    var sub = root.querySelector('.kid-t p'); if (sub) sub.textContent = stuDesc(getStudent(sid));
    clearTimeout(renderFicha.t); renderFicha.t = setTimeout(function () { toast(grupoInfo() ? (grOnline() ? 'Le llega a ' + p2.name + ' al instante.' : 'Guardado. Le llega a ' + p2.name + ' cuando haya internet.') : 'Guardado.', 2200); }, 700);
  });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fx]'); if (!b) return;
    var a = b.getAttribute('data-fx');
    if (a === 'inv') grupoInviteKid(sid);
    else if (a.indexOf('rm:') === 0) {
      var p3 = getStudent(sid), id = a.slice(3); if (!p3) return;
      p3.songs = (p3.songs || []).filter(function (x) { return x !== id; }); putStudent(p3); renderFicha(sid);
    }
  });
}
/* En el inicio del director: «Tus alumnos» abre la ficha de cada uno (no su perfil). */
stuChipsHTML = function () {
  var l = stuData().list, g = grupoInfo(), n = inboxCount();
  var who = '<div class="who-row">' + (l.length ? '<a class="chip-b" href="#/quien">' + icon('swap') + 'Cambiar de perfil</a>' : '') +
    '<a class="chip-b" href="#/grupo">' + icon('group') + 'Grupo' + (n ? ' <em class="badge">' + n + '</em>' : '') + '</a></div>';
  if (!l.length) return who;
  return '<section class="tus-al" aria-label="Tus alumnos"><p class="tus-t">Tus alumnos <small>toca uno para ver cómo va y ajustar cómo toca</small></p><nav class="stu-chips">' + l.map(function (pr) {
    var k = LS.get(INBOX_KEY, []).filter(function (p) { return p.sid === pr.id; }).length;
    return '<a class="chip" href="' + fichaHref(pr.id) + '"><span class="avatar sm" style="--c:' + esc(pr.color) + '">' + esc(pr.name.charAt(0).toUpperCase()) + '</span>' + esc(pr.name) +
      (k ? ' <em class="badge">' + k + '</em>' : '') + '</a>';
  }).join('') + '<a class="chip more" href="#/a">' + icon('user') + 'Todos</a></nav>' + (g ? grSyncChipHTML() : '') + '</section>' + who;
};

/* parte 20: «¿Qué oye el celular?»
   Antes de tocar, o cuando algo no sale, muestra en vivo qué teclas oye el celular, si el volumen alcanza, si hay mucho
   ruido y cuánto está desafinado el piano. Así se sabe al momento si el problema es el celular, el piano, el parlante o
   la distancia. Usa el mismo oído del alumno y de «Escuchando» (C.listenCreate). Si el micrófono ya está prendido
   (alumno o director), usa ese mismo; si no, lo prende solo mientras la pantalla está abierta. */
var MC_LO = 36, MC_HI = 96;                      // Do2 a Do7: el bajo de Diego, los acordes y los agudos
function micKeysSvg() {
  var white = [], black = [], m, x = 0, W = 0;
  for (m = MC_LO; m <= MC_HI; m++) if ([1, 3, 6, 8, 10].indexOf(C.mod12(m)) < 0) W++;
  var kw = 100 / W;
  for (m = MC_LO; m <= MC_HI; m++) {
    var pc = C.mod12(m);
    if ([1, 3, 6, 8, 10].indexOf(pc) < 0) { white.push('<rect class="mc-w" data-k="' + m + '" x="' + (x * kw).toFixed(3) + '" y="0" width="' + kw.toFixed(3) + '" height="60"/>'); x++; }
    else black.push('<rect class="mc-b" data-k="' + m + '" x="' + (x * kw - kw * 0.32).toFixed(3) + '" y="0" width="' + (kw * 0.64).toFixed(3) + '" height="37"/>');
  }
  var labels = ''; x = 0;
  for (m = MC_LO; m <= MC_HI; m++) {
    if ([1, 3, 6, 8, 10].indexOf(C.mod12(m)) >= 0) continue;
    if (C.mod12(m) === 0) labels += '<text x="' + (x * kw + kw / 2).toFixed(3) + '" y="57" class="mc-lab">' + esc(C.noteName(0, 'sharp', prefs.notation)) + (Math.floor(m / 12) - 1) + '</text>';
    x++;
  }
  return '<svg class="mc-kb" viewBox="0 0 100 60" preserveAspectRatio="none" role="img" aria-label="Teclado: se encienden las teclas que oye el celular">' + white.join('') + black.join('') + labels + '</svg>';
}
function openMicCheck() {
  var M = { E: null, own: false, lis: null, timer: 0, glow: {}, quietSince: performance.now(), lastTonal: 0, peaks: [], tuneSaved: 0, n: 0 };
  var stop = function () { clearInterval(M.timer); M.timer = 0; if (M.own && M.E) earRelease(M.E); M.E = null; };
  var html = '<p class="help">Toca unas notas o un acorde: se encienden las teclas que el celular oye. Así sabes si te escucha bien antes de empezar.</p>' +
    '<div class="mc-wrap">' + micKeysSvg() + '</div>' +
    '<p class="mc-heard" id="mc-heard" aria-live="polite">Esperando sonido…</p>' +
    '<div class="mc-row"><span class="mc-k">Volumen</span><span class="tl-meter mc-lvl"><i id="mc-lvl"></i></span></div>' +
    '<ul class="mc-st"><li id="mc-vol">—</li><li id="mc-noise">—</li><li id="mc-tune">Afinación del piano: toca unas notas para medirla.</li></ul>' +
    '<details class="mc-tips"><summary>Consejos para que te oiga mejor</summary><ul>' +
    '<li>Pon el celular frente al piano o frente al parlante, a uno o dos palmos. Encima del teclado oye más el ruido de las teclas que la música.</li>' +
    '<li>Con un equipo de dos parlantes el sonido llega dos veces y algunas notas se apagan: mejor que suene un solo parlante, o pon el celular frente a uno.</li>' +
    '<li>Si el sonido de piano tiene mucho eco (reverberación), bájalo un poco en el programa (Analog Lab, Ableton).</li>' +
    '<li>Si cantas mientras tocas, el celular puede confundirse con tu voz.</li></ul></details>' +
    '<div class="btnrow"><button type="button" class="btn primary" data-close="1">Listo</button><button type="button" class="btn" data-mc="save">' + icon('share') + 'Guardar lo que oyó (25 s)</button></div>' +
    '<p class="help">Si una nota o un acorde no lo reconoce, tócalo unas veces y toca «Guardar lo que oyó»: el archivo sirve para mejorar el oído con tu piano y tu parlante de verdad.</p>';
  openSheet('¿Qué oye el celular?', html, function (el) {
    el.addEventListener('click', function (e) { if (e.target.closest('[data-mc="save"]')) tapSaveShare(); });
    var go = function (E, own) {
      M.E = E; M.own = own;
      M.lis = C.listenCreate({ sr: AC.sampleRate, nfft: E.an.fftSize, tune: earTune(), lo: MC_LO, hi: MC_HI, ring: 60 });
      M.timer = setInterval(tick, 50);
    };
    var tick = function () {
      if (!M.E || !el.isConnected) { stop(); return; }
      var now = performance.now(), f = M.lis.frame(oidoRead(M.E, M.lis.kmax)), m, k;
      var lv = el.querySelector('#mc-lvl'); if (lv) lv.style.width = Math.max(0, Math.min(100, (f.peak + 90) * 1.4)).toFixed(0) + '%';
      M.peaks.push(f.peak); if (M.peaks.length > 60) M.peaks.shift();
      // teclas que suenan: se encienden y se apagan de a poco (así se alcanzan a ver)
      Object.keys(M.glow).forEach(function (q) { M.glow[q] *= 0.8; if (M.glow[q] < 0.05) delete M.glow[q]; });
      if (f.tonal) { M.lastTonal = now; Object.keys(f.keys).forEach(function (q) { if (f.keys[q] >= 0.25 && +q >= MC_LO && +q <= MC_HI) M.glow[q] = Math.max(M.glow[q] || 0, f.keys[q]); }); }
      if (++M.n % 2) return;                         // la pantalla, 10 veces por segundo
      Array.prototype.forEach.call(el.querySelectorAll('.mc-kb rect'), function (r) {
        var g = M.glow[r.getAttribute('data-k')] || 0;
        r.style.fill = g ? 'var(--chord)' : ''; r.style.fillOpacity = g ? (0.35 + 0.65 * Math.min(1, g)).toFixed(2) : '';
      });
      var heard = el.querySelector('#mc-heard');
      if (heard) {
        if (f.tonal) {
          var ps = []; for (k = 0; k < 12; k++) if (f.pcs[k] >= 0.45) ps.push(k);
          ps.sort(function (a, b) { return f.pcs[b] - f.pcs[a]; });
          heard.innerHTML = 'Oigo: <b>' + esc(ps.slice(0, 5).map(function (p) { return C.noteName(p, 'sharp', prefs.notation); }).join(', ')) + '</b>';
        } else if (now - M.lastTonal > 1500) heard.textContent = f.peak > -70 ? 'Oigo sonido, pero no notas claras (ruido, voces).' : 'No oigo nada todavía: toca unas notas.';
      }
      // volumen y ruido de fondo (lo más bajo de los últimos 3 s)
      var lo = Math.min.apply(null, M.peaks), hi = Math.max.apply(null, M.peaks), vol = el.querySelector('#mc-vol'), nz = el.querySelector('#mc-noise');
      if (vol) vol.textContent = hi > -6 || tapClipping() ? 'Muy fuerte: se satura. Aleja un poco el celular o baja el volumen.' :
        (now - M.lastTonal < 3000 ? (hi < -50 ? 'Te oigo bajito: acerca el celular al piano o al parlante.' : 'Volumen: bien.') : 'Volumen: toca para medirlo.');
      if (nz) nz.textContent = lo > -50 ? 'Hay bastante ruido de fondo (ventilador, calle, conversación): puede confundir notas.' : 'Ruido de fondo: poco.';
      // afinación del piano (la usan el oído del alumno y «Escuchando»)
      var g = M.lis.tuneInfo(), tn = el.querySelector('#mc-tune');
      if (tn && g && g.w >= 30 && g.r >= 0.4) {
        var c = Math.round(g.t), a = Math.abs(c);
        tn.textContent = a < 8 ? 'Afinación del piano: bien.' : 'El piano suena ' + (a >= 25 ? 'bastante' : 'un poco') + ' más ' + (c > 0 ? 'alto' : 'bajo') + ' de lo normal (' + (c > 0 ? '+' : '') + c + ' centésimos de semitono). No importa: ya lo compenso.';
      }
      earSaveTune(M.lis, now);
    };
    // si ya hay micrófono prendido (alumno o «Escuchando»), se usa ese; si no, uno solo para esta pantalla
    if (oido && oido.E) go(oido.E, false);
    else if (ear) go(ear, false);
    else earGetStream().then(function (ms) {
      if (!el.isConnected) { ms.getTracks().forEach(function (t) { t.stop(); }); return; }
      audio(); var E = earNode(ms, true); if (!E) throw new Error('Este equipo no permite usar el micrófono aquí.');
      go(E, true);
    }).catch(function (e) { var h = el.querySelector('#mc-heard'); if (h) h.textContent = micErrText(e); });
  }, { onClose: stop });
}

/* parte 21: lo que entra por el micrófono, medido y guardado un rato
   - Saturación: si el sonido llega tan fuerte que el micrófono se satura, las notas se deforman y el oído se confunde.
     Se avisa «Muy fuerte: baja el volumen o aleja el celular» (en la franja, en el puntito de arriba y en «¿Qué oye?»).
   - Los últimos 25 s quedan guardados en la memoria (no en el equipo): con «Guardar lo que oyó» se arma un archivo .wav
     con el audio y, adentro, lo que la app esperaba y decidió en cada momento. Sirve para revisar con el sonido REAL por
     qué no reconoció algo (se manda en el chat donde se mejora la app).
   - Las muestras también alimentan la voz sin internet (parte 22). */
var TAP = { node: null, sink: null, src: null, ring: null, sr: 0, w: 0, n: 0, clipT: -1e9, clipN: 0, fns: [], log: [], mod: null };
var TAP_SECS = 25;
var TAP_CODE = "class T extends AudioWorkletProcessor{constructor(){super();this.b=new Float32Array(1024);this.k=0;}" +
  "process(i){var c=i[0]&&i[0][0];if(c){for(var j=0;j<c.length;j++){this.b[this.k++]=c[j];if(this.k===1024){this.port.postMessage(this.b,[this.b.buffer]);this.b=new Float32Array(1024);this.k=0;}}}return true;}}" +
  "registerProcessor('cfp-tap',T);";
function tapAttach(src) {
  var ac = AC; if (!ac || !src || TAP.src === src) return;
  tapDetach();
  TAP.src = src;
  if (!TAP.ring || TAP.sr !== ac.sampleRate) { TAP.sr = ac.sampleRate; TAP.ring = new Int16Array(Math.round(ac.sampleRate * TAP_SECS)); TAP.w = 0; TAP.n = 0; }
  var sink = function (node) { var g = ac.createGain(); g.gain.value = 0; src.connect(node); node.connect(g); g.connect(ac.destination); TAP.node = node; TAP.sink = g; };
  var legacy = function () {
    try { var sp = ac.createScriptProcessor(2048, 1, 1); sp.onaudioprocess = function (e) { tapFeed(new Float32Array(e.inputBuffer.getChannelData(0))); }; sink(sp); } catch (e) { /* sin muestras */ }
  };
  if (ac.audioWorklet && window.AudioWorkletNode) {
    if (!TAP.mod) TAP.mod = ac.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP_CODE], { type: 'application/javascript' })));
    TAP.mod.then(function () {
      if (TAP.src !== src || TAP.node) return;
      var n = new AudioWorkletNode(ac, 'cfp-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
      n.port.onmessage = function (e) { tapFeed(e.data); };
      sink(n);
    }).catch(function () { if (TAP.src === src && !TAP.node) legacy(); });
  } else legacy();
}
function tapDetach() {
  if (TAP.node) { try { TAP.src.disconnect(TAP.node); } catch (e) { /* nada */ } try { TAP.node.disconnect(); } catch (e) { /* nada */ } try { TAP.sink.disconnect(); } catch (e) { /* nada */ } }
  TAP.node = TAP.sink = TAP.src = null;
}
function tapFeed(b) {
  var R = TAP.ring, L = R.length, clip = 0, w = TAP.w;
  for (var i = 0; i < b.length; i++) {
    var v = b[i]; if (v >= 0.98 || v <= -0.98) clip++;
    R[w] = v >= 1 ? 32767 : v <= -1 ? -32767 : Math.round(v * 32767); w++; if (w === L) w = 0;
  }
  TAP.w = w; TAP.n = Math.min(L, TAP.n + b.length);
  if (clip >= 2) { TAP.clipT = performance.now(); TAP.clipN++; }
  for (var k = 0; k < TAP.fns.length; k++) { try { TAP.fns[k](b); } catch (e) { /* nada */ } }
}
function tapClipping() { return performance.now() - TAP.clipT < 1200; }
/* qué esperaba la app y qué decidió (para revisar después junto con el audio) */
function tapLog(k, d) { TAP.log.push({ t: Math.round(performance.now()), k: k, d: d }); if (TAP.log.length > 600) TAP.log.splice(0, 100); }
/* aviso de saturación en la franja y en el puntito de arriba */
function tapClipShow() {
  var on = tapClipping(), cw = lid('lv-clip'); if (cw && cw.hidden === on) cw.hidden = !on;
  if (on) micDotState('clip');
}
function tapWavBlob() {
  var n = TAP.n, R = TAP.ring, L = R ? R.length : 0, sr = TAP.sr; if (!n) return null;
  var start = (TAP.w - n + L) % L, now = Math.round(performance.now());
  var st = liveState, info = { app: APP_VERSION, sr: sr, fin: now, inicio: now - Math.round(1000 * n / sr), afinacion: earTune(), modo: st ? st.mode : '', cancion: st ? st.song.title : '',
    alumno: st && st.stu ? st.stu.sid : '', equipo: navigator.userAgent, log: TAP.log.filter(function (x) { return x.t >= now - 1000 * n / sr - 2000; }) };
  var js = new TextEncoder().encode(JSON.stringify(info)), jl = js.length + (js.length % 2);
  var buf = new ArrayBuffer(44 + n * 2 + 8 + jl), dv = new DataView(buf);
  var wr = function (o, s) { for (var q = 0; q < s.length; q++) dv.setUint8(o + q, s.charCodeAt(q)); };
  wr(0, 'RIFF'); dv.setUint32(4, 36 + n * 2 + 8 + jl, true); wr(8, 'WAVE'); wr(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); wr(36, 'data'); dv.setUint32(40, n * 2, true);
  var pcm = new Int16Array(buf, 44, n);
  if (start + n <= L) pcm.set(R.subarray(start, start + n)); else { pcm.set(R.subarray(start)); pcm.set(R.subarray(0, n - (L - start)), L - start); }
  wr(44 + n * 2, 'cfpl'); dv.setUint32(48 + n * 2, js.length, true); new Uint8Array(buf, 52 + n * 2, js.length).set(js);
  return new Blob([buf], { type: 'audio/wav' });
}
function tapSaveShare() {
  var b = tapWavBlob();
  if (!b) { toast('Todavía no hay audio: prende el micrófono («Escuchar» o «Que el celular me escuche») y toca un rato.', 5000); return; }
  var d = new Date(), name = 'cancionero-oido-' + d.toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.wav';
  shareFile(name, b, 'audio/wav').then(function () { toast('Listo: manda ese archivo en el chat donde mejoran la app, y cuenta qué tocaste.', 6000); });
}
/* el micrófono de «Escuchando», «Que me escuche» y «¿Qué oye?» pasa por aquí */
var earNode0 = earNode;
earNode = function (ms, own) { var E = earNode0(ms, own); if (E) tapAttach(E.src); return E; };

/* parte 22: voz sin internet
   Cada persona enseña su voz una vez: dice cada orden 3 veces (sirve cualquier palabra: «siguiente» o «adelante»).
   La app la reconoce con su propio micrófono, siempre prendido (no parpadea), sin internet y a la vez que «Escuchando»
   o «Que el celular me escuche». Responde a palabras sueltas dichas en una pausa: cantar o tocar seguido no manda nada.
   Lo grabado (números, no audio) se guarda en este equipo, uno por perfil. */
var VOZL_CMDS = [['next', 'siguiente', true], ['prev', 'atrás', true], ['again', 'otra vez', false], ['pause', 'pausa', false], ['play', 'dale', false]];
var VL = { eng: null, mic: null, train: null, onTest: null, thr: null };
function vozLocalKey() { var w = typeof whoGet === 'function' ? whoGet() : null; return 'cfp.vozLocal.' + (w && w.k === 'a' ? 'a.' + w.sid : 'dir'); }
function vozLocalModel() {
  var m = LS.get(vozLocalKey(), null); if (!m || !m.cmds) return null;
  var out = {}; Object.keys(m.cmds).forEach(function (c) { out[c] = m.cmds[c].map(function (t) { return t.map(function (f) { return Float32Array.from(f); }); }); });
  return out;
}
function vozLocalReady() { var m = LS.get(vozLocalKey(), null); return !!(m && m.cmds && m.cmds.next && m.cmds.next.length >= 2 && m.cmds.prev && m.cmds.prev.length >= 2); }
function vozLocalSave(model) {
  var o = {}; Object.keys(model).forEach(function (c) { o[c] = model[c].map(function (t) { return t.map(function (f) { return Array.prototype.map.call(f, function (x) { return Math.round(x * 100) / 100; }); }); }); });
  LS.set(vozLocalKey(), { v: 1, cmds: o }); VL.thr = null; VL.model = null;
}
/* micrófono propio de la voz (no el de «Escuchando»: así cada uno se prende y se apaga solo) */
function vozLocalMic() {
  if (VL.mic) return Promise.resolve(VL.mic);
  return earGetStream().then(function (ms) {
    var ac = audio(); if (!ac) throw new Error('Sin audio en este equipo.');
    var src = ac.createMediaStreamSource(ms), feed = function (b) { if (VL.eng) VL.eng.push(b); };
    var done = function (node) { var g = ac.createGain(); g.gain.value = 0; src.connect(node); node.connect(g); g.connect(ac.destination); VL.mic = { ms: ms, src: src, node: node, g: g }; VL.eng = C.vozCreate({ sr: ac.sampleRate, onSeg: vozLocalSeg }); return VL.mic; };
    if (ac.audioWorklet && window.AudioWorkletNode) {
      if (!TAP.mod) TAP.mod = ac.audioWorklet.addModule(URL.createObjectURL(new Blob([TAP_CODE], { type: 'application/javascript' })));
      return TAP.mod.then(function () { var n = new AudioWorkletNode(ac, 'cfp-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] }); n.port.onmessage = function (e) { feed(e.data); }; return done(n); });
    }
    var sp = ac.createScriptProcessor(2048, 1, 1); sp.onaudioprocess = function (e) { feed(new Float32Array(e.inputBuffer.getChannelData(0))); }; return done(sp);
  });
}
function vozLocalMicOff() {
  var M = VL.mic; VL.mic = null; VL.eng = null; if (!M) return;
  try { M.src.disconnect(); M.node.disconnect(); M.g.disconnect(); } catch (e) { /* nada */ }
  M.ms.getTracks().forEach(function (t) { t.stop(); });
}
function vozLocalStart() {
  var V = { kind: 'local', on: true }; voz = V;
  vozLocalMic().catch(function (e) { if (voz === V) { voz = null; if (liveState) drawLive(); } toast(micErrText(e), 6000); });
  return true;
}
function vozLocalStop() { if (!VL.train && !VL.onTest) vozLocalMicOff(); }
/* un trozo corto de voz: grabarlo (enseñar), probarlo o mandar la orden */
function vozLocalSeg(seq) {
  if (VL.train) { VL.train(seq); return; }
  if (!VL.model) VL.model = vozLocalModel();
  if (!VL.model) return;
  if (!VL.thr) VL.thr = C.vozThresholds(VL.model);
  var r = C.vozClassify(VL.model, VL.thr, seq);
  if (VL.onTest) { VL.onTest(r); return; }
  if (r.cmd && voz && voz.kind === 'local') vozRun(r.cmd, (VOZL_CMDS.filter(function (x) { return x[0] === r.cmd; })[0] || [0, r.cmd])[1]);
}
/* ---------- enseñar la voz ---------- */
function openVozTrain() {
  var m = LS.get(vozLocalKey(), null), cmds = (m && m.cmds) || {}, model = {};
  Object.keys(cmds).forEach(function (c) { model[c] = cmds[c].map(function (t) { return t.map(function (f) { return Float32Array.from(f); }); }); });
  var row = function (x) {
    var n = (model[x[0]] || []).length;
    return '<div class="vt-row" data-c="' + x[0] + '"><span class="vt-w"><b>«' + esc(x[1]) + '»</b>' + (x[2] ? '' : ' <small>(si quieres)</small>') + '</span><span class="vt-dots" aria-label="' + n + ' de 3">' +
      [0, 1, 2].map(function (k) { return '<i' + (k < n ? ' class="on"' : '') + '></i>'; }).join('') + '</span><button type="button" class="btn sm" data-rec="' + x[0] + '">' + (n ? 'Repetir' : 'Grabar') + '</button></div>';
  };
  var body = '<p class="help">Toca «Grabar» y di la orden con tu voz normal; cuando la app la oiga, dila otra vez (son 3). Puedes usar otra palabra si te sale mejor (por ejemplo «adelante» en vez de «siguiente»). Graba en un lugar tranquilo.</p>' +
    '<div class="vt" id="vt">' + VOZL_CMDS.map(row).join('') + '</div><p class="vt-st" id="vt-st" aria-live="polite"></p>' +
    '<div class="btnrow"><button type="button" class="btn" data-x="test">' + icon('mic') + 'Probar</button><button type="button" class="btn primary" data-x="ok">Listo</button>' +
    (m ? '<button type="button" class="btn danger" data-x="del">Borrar mi voz</button>' : '') + '</div>' +
    '<p class="help">Funciona sin internet y con el micrófono siempre prendido. Responde a palabras sueltas dichas en una pausa (no mientras suena fuerte la música): para tocar en vivo con la banda, lo más seguro sigue siendo tocar la pantalla o el pedal.</p>';
  var stopAll = function () { VL.train = null; VL.onTest = null; if (!voz || voz.kind !== 'local') vozLocalMicOff(); };
  openSheet('Enseñar mi voz (sin internet)', body, function (el) {
    var st = function (t) { var s2 = el.querySelector('#vt-st'); if (s2) s2.textContent = t; };
    var redraw = function () { el.querySelector('#vt').innerHTML = VOZL_CMDS.map(row).join(''); };
    el.addEventListener('click', function (e) {
      var r = e.target.closest('[data-rec]'), x = e.target.closest('[data-x]');
      if (r) {
        var c = r.getAttribute('data-rec'), label = VOZL_CMDS.filter(function (q) { return q[0] === c; })[0][1];
        model[c] = []; redraw(); VL.onTest = null;
        st('Abriendo el micrófono…');
        vozLocalMic().then(function () {
          st('Habla ahora: «' + label + '» (1 de 3)');
          VL.train = function (seq) {
            model[c].push(seq); redraw();
            if (model[c].length >= 3) { VL.train = null; vozLocalSave(model); st('Listo «' + label + '». ' + (vozLocalReady() ? 'Puedes probar.' : 'Ahora graba la siguiente.')); if (!voz || voz.kind !== 'local') vozLocalMicOff(); }
            else st('Bien. Otra vez: «' + label + '» (' + (model[c].length + 1) + ' de 3)');
          };
        }).catch(function (er) { st(micErrText(er)); });
        return;
      }
      if (!x) return;
      var a = x.getAttribute('data-x');
      if (a === 'ok') { stopAll(); closeSheet(); return; }
      if (a === 'del') { try { localStorage.removeItem(vozLocalKey()); } catch (er) { /* nada */ } model = {}; VL.model = null; VL.thr = null; redraw(); st('Borrado.'); return; }
      if (a === 'test') {
        if (!vozLocalReady()) { st('Primero graba «siguiente» y «atrás».'); return; }
        VL.train = null; VL.model = null; VL.thr = null; st('Di una orden…');
        vozLocalMic().then(function () {
          VL.onTest = function (res) {
            var w = res.cmd ? VOZL_CMDS.filter(function (q) { return q[0] === res.cmd; })[0][1] : '';
            st(res.cmd ? 'Te entendí: «' + w + '» ✓' : 'No lo reconocí. Dilo igual que cuando lo grabaste, o vuelve a grabar esa orden.');
          };
        }).catch(function (er) { st(micErrText(er)); });
      }
    });
  }, { onClose: stopAll });
}

var APP_VERSION = '2026-10-05 10:06';
/* parte 5: rutas, eventos y arranque */
function parseHash() {
  var raw = location.hash, live = /\/vivo$/.test(raw);
  var r = parseHashFrom(raw.replace(/\/vivo$/, ''));
  r.live = live; r.key = raw.replace(/\/vivo$/, '');
  return r;
}
function parseHashFrom(hash) {
  var h = hash.replace(/^#\/?/, '');
  if (!h) return { name: 'home' };
  var p = h.split('/').map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
  if (p[0] === 's' && p[1]) return { name: 'song', id: p[1] };
  if (p[0] === 'r' && !p[1]) return { name: 'sets' };
  if (p[0] === 'r' && p[1] && p[2] !== undefined && p[2] !== '') return { name: 'setsong', set: p[1], idx: +p[2] };
  if (p[0] === 'r' && p[1]) return { name: 'set', id: p[1] };
  if (p[0] === 'e' && p[1]) return { name: 'edit', id: p[1] };
  if (p[0] === 'a' && !p[1]) return { name: 'students' };
  if (p[0] === 'a' && p[1] && p[2]) return { name: 'stulive', sid: p[1], song: p[2] };
  if (p[0] === 'quien') return { name: 'quien' };
  if (p[0] === 'k' && p[1] && p[2] === 'c' && p[3]) return { name: 'kidsong', sid: p[1], song: p[3] };
  if (p[0] === 'k' && p[1] && p[2]) return { name: 'kidtab', sid: p[1], tab: p[2] };
  if (p[0] === 'unir' && p[1]) return { name: 'unir', data: p[1] };
  if (p[0] === 'grupo') return { name: 'grupo' };
  if (p[0] === 'propuestas') return { name: 'props' };
  if (p[0] === 'ficha' && p[1]) return { name: 'ficha', sid: p[1] };
  if (p[0] === 'a' && p[1]) return { name: 'student', sid: p[1] };
  if (p[0] === 'sala' && p[1]) return { name: 'sala', code: p[1] };
  return { name: 'home' };
}
function render() {
  var r = parseHash();
  if (route.name === 'home') homeState.scroll = window.scrollY;
  if (sheetState) sheetState.onClose = null;
  closeSheet(true);
  var fromSameSong = (route.name === 'song' || route.name === 'setsong') && !route.live && route.key === r.key;
  closeLive(true);
  if (r.name !== 'edit') { editorState = null; document.body.classList.remove('ed-chords'); }
  route = r;
  if (r.name === 'sala') {                                  // invitación a seguir otra pantalla
    var dev = stuData().device;
    syncFollow(r.code, dev);
    location.replace(dev && getStudent(dev) ? '#/a/' + enc(dev) : '#/');
    toast('Siguiendo la sala ' + sync.code + '. La canción aparece cuando quien guía la abre.', 4500);
    return;
  }
  if (r.name === 'home') {                                   // ¿quién va a tocar?
    var w = whoGet();
    if (!w) { var aw = autoWho(); if (aw) { whoSet(aw); w = aw; } }
    if (!w) { location.replace('#/quien'); return; }
    if (w.k === 'a' && getStudent(w.sid)) { location.replace('#/a/' + enc(w.sid)); return; }
  }
  if (r.name === 'quien') { renderPicker(); window.scrollTo(0, 0); return; }
  if (r.name === 'kidtab') { renderKid(r.sid, r.tab); window.scrollTo(0, 0); return; }
  if (r.name === 'kidsong') { renderKidSong(r.sid, r.song); window.scrollTo(0, 0); return; }
  if (r.name === 'unir') { renderJoin(r.data); return; }
  if (r.name === 'grupo') { renderGrupo(); window.scrollTo(0, 0); return; }
  if (r.name === 'props') { renderProps(); window.scrollTo(0, 0); return; }
  if (r.name === 'ficha') { renderFicha(r.sid); window.scrollTo(0, 0); return; }
  if (r.name === 'home') { renderHome(); return; }
  if (r.name === 'students') { renderStudents(); window.scrollTo(0, 0); return; }
  if (r.name === 'student') { renderStudent(r.sid); window.scrollTo(0, 0); return; }
  if (r.name === 'stulive') { renderStudent(r.sid); openStudentLive(r.sid, r.song); return; }
  if (r.name === 'song') { renderSong(r.id); if (r.live) openLive(fromSameSong); }
  else if (r.name === 'setsong') {
    var sl = getSetlist(r.set), it = sl && sl.items[r.idx];
    if (!it) { location.hash = sl ? '#/r/' + enc(r.set) : '#/r'; return; }
    renderSong(it.id, r.set, r.idx);
    if (r.live) openLive(fromSameSong);
  }
  else if (r.name === 'sets') renderSetlists();
  else if (r.name === 'set') renderSetlist(r.id);
  else if (r.name === 'edit') renderEditor(r.id);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

app.addEventListener('click', function (e) {
  var t = e.target;
  var ch = t.closest('.ch[data-i], .ci[data-i]');
  if (ch && route.name !== 'edit') { openChordSheet(+ch.getAttribute('data-i')); return; }
  var go = t.closest('[data-go]');
  if (go) { location.hash = go.getAttribute('data-go'); return; }
  var tab = t.closest('[data-tab]');
  if (tab) {
    homeState.group = tab.getAttribute('data-tab');
    Array.prototype.forEach.call(app.querySelectorAll('[data-tab]'), function (x) { x.setAttribute('aria-pressed', String(x === tab)); });
    var res = document.getElementById('results'); if (res) res.innerHTML = resultsHTML();
    return;
  }
  var sa = t.closest('[data-sact]');
  if (sa) {
    var sact = sa.getAttribute('data-sact');
    if (sact === 'new') openNewStudent();
    else if (sact === 'edit') openStudentSheet(route.sid);
    else if (sact === 'pick') openSongPicker(route.sid);
    else if (sact === 'follow') openSyncSheet(route.sid);
    else if (sact === 'all') homeState.full = true;          // el enlace lleva a la lista completa
    return;
  }
  var sad = t.closest('[data-sadd]');
  if (sad && route.name === 'student') {
    var pr = getStudent(route.sid);
    if (pr) { pr.songs = pr.songs || []; if (pr.songs.indexOf(sad.getAttribute('data-sadd')) < 0) pr.songs.push(sad.getAttribute('data-sadd')); putStudent(pr); renderStudent(pr.id); toast('Añadida a las canciones de ' + pr.name + '.'); }
    return;
  }
  var b = t.closest('[data-act]');
  if (!b || b.disabled) return;
  var act = b.getAttribute('data-act'), i = +b.getAttribute('data-i'), ni;
  switch (act) {
    case 'back': location.hash = ctx.setlist ? '#/r/' + enc(ctx.setlist.id) : '#/'; break;
    case 'down': transpose(-1); break;
    case 'up': transpose(1); break;
    case 'key': openKeySheet(); break;
    case 'capo': openCapoSheet(); break;
    case 'view': openViewSheet(); break;
    case 'scroll': if (scroller.on) stopScroll(); else startScroll(); break;
    case 'menu': openSongMenu(); break;
    case 'addset': openAddToSet(current.song); break;
    case 'prev': case 'next':
      ni = neighbor(act === 'next' ? 1 : -1);
      if (ni >= 0) location.hash = '#/r/' + enc(ctx.setlist.id) + '/' + ni;
      break;
    case 'homemenu': openHomeMenu(); break;
    case 'help': openHelp(); break;
    case 'publish': openPublishSheet(); break;
    case 'backup': openBackupSheet(); break;
    case 'books': openBooksSheet(); break;
    case 'install': openInstall(); break;
    case 'installhide': LS.set('cfp.installHideT', Date.now()); refreshChrome(); break;
    case 'newset':
      promptSheet('Nuevo repertorio', 'Nombre', defaultSetName(), 'Crear', function (name) {
        var sl = { id: newId('r'), name: name, items: [] }; saveSetlist(sl); location.hash = '#/r/' + enc(sl.id);
      });
      break;
    case 'setmenu': openSetMenu(); break;
    case 'setadd': openSetAdd(); break;
    case 'setup': if (i > 0) mutateSet(function (sl) { var x = sl.items.splice(i, 1)[0]; sl.items.splice(i - 1, 0, x); }); break;
    case 'setdown': mutateSet(function (sl) { if (i < sl.items.length - 1) { var x = sl.items.splice(i, 1)[0]; sl.items.splice(i + 1, 0, x); } }); break;
    case 'setdel': mutateSet(function (sl) { sl.items.splice(i, 1); }); break;
    case 'edsave': saveEditor(); break;
    case 'edcancel': cancelEditor(); break;
    case 'edpaste': openPasteSheet(); break;
      case 'easylive': case 'superlive':
        prefs.easy = Object.assign({}, prefs.easy || {}, { on: true, level: act === 'superlive' ? 'super' : 'easy', part: act === 'superlive' ? 'agudos' : 'acordes', oct: 60 });
        savePrefs(); location.hash = liveHash(); break;
    case 'eddelete': deleteSong(); break;
    case 'edrestore': restoreSong(); break;
  }
});
app.addEventListener('keydown', function (e) {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.ch[data-i], .ci[data-i]')) {
    e.preventDefault(); openChordSheet(+e.target.getAttribute('data-i'));
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && sheetRoot.firstChild) { closeSheet(); return; }
  var tag = (e.target && e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || sheetRoot.firstChild || e.ctrlKey || e.metaKey || e.altKey) return;
  if (route.name === 'song' || route.name === 'setsong') {
    if (e.key === '+' || e.key === '=') { transpose(1); e.preventDefault(); }
    else if (e.key === '-' || e.key === '_') { transpose(-1); e.preventDefault(); }
    else if (ctx.setlist && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      var ni = neighbor(e.key === 'ArrowRight' ? 1 : -1);
      if (ni >= 0) location.hash = '#/r/' + enc(ctx.setlist.id) + '/' + ni;
    }
  }
});
var refit = debounce(function () {
  fixCollisions(document.getElementById('song-body'));
  fixCollisions(document.getElementById('ed-prev'));
  if (liveState && !recState) drawLive();
  var eds = document.getElementById('ed-song'); if (eds && editorState && editorState.mode === 'acordes') { fixCollisions(eds); renderPanel(); }
}, 150);
window.addEventListener('resize', refit);
try {
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(refit);
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', refit);
  }
} catch (e) { /* sin API de fuentes */ }
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && current.song) keepAwake(true); });

/* ---------- datos al día, instalación y uso sin internet ---------- */
var pendingRefresh = false;
function afterRemoteUpdate() {
  infoCache = {};
  if (route.name === 'home' || route.name === 'sets' || route.name === 'set') render();
  else pendingRefresh = true;
  var d = new Date(DATA.version);
  toast('Cancionero actualizado' + (isNaN(d) ? '.' : ': versión del ' + d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' }) + '.'), 3500);
}
window.addEventListener('hashchange', function () { pendingRefresh = false; });
window.addEventListener('online', function () { fetchRemote().then(function (res) { if (res === 'nuevo') afterRemoteUpdate(); else refreshChrome(); }); });
window.addEventListener('offline', refreshChrome);
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); install.evt = e; refreshChrome(); });
window.addEventListener('appinstalled', function () { install.evt = null; refreshChrome(); toast('Cancionero instalado.'); });
try { localStorage.removeItem('cfp.installHidden'); } catch (e) { /* el aviso viejo que quedaba oculto para siempre */ }
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  var hadController = !!navigator.serviceWorker.controller;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin modo sin internet */ });
    setTimeout(function () { if (navigator.onLine !== false) checkUpdate(false).catch(function () {}); }, 2500);   // ¿hay una versión nueva en GitHub?
  });
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadController) showUpdateBanner(''); hadController = true; });
}
if (window.matchMedia) {
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs); } catch (e) { /* navegador antiguo */ }
}

openBookData();
syncResume();
render();
fetchRemote().then(function (res) { if (res === 'nuevo') afterRemoteUpdate(); else refreshChrome(); });
window.__cancionero = {
    oidoWith: function (stream) { return oidoLiveWith(stream); }, oidoState: function () { return { on: oidoActive(), mode: liveState && liveState.mode, i: liveState && liveState.i }; },
    grupo: function () { return { info: grupoInfo(), online: grOnline(), inbox: LS.get(INBOX_KEY, []), mine: LS.get(MINE_KEY, []), dec: LS.get(DEC_KEY, {}) }; }, who: function () { return whoGet(); }, oidoTarget: function () { return liveState ? { pcs: Object.keys(midiTarget()).map(Number), i: liveState.i, n: liveState.path.length, mode: liveState.mode } : null; },
    grupoInvite: function (sid) { var g = grupoInfo(), pr = getStudent(sid); return grInviteURL({ v: 1, g: g.secret, x: g.x, y: g.y, s: sid, n: pr.name, c: pr.color, d: g.dirName }); },
    stu: function (sid) { return getStudent(sid); }, kidSave: function (song) { return kidSongSave(cleanSong(song)); }, songById: function (id) { return getSong(id); },
    dirSave: function (song) { var s2 = cleanSong(song); local.songs[s2.id] = s2; saveLocal(); delete infoCache[s2.id]; }, fixCollisions: fixCollisions, version: function () { return APP_VERSION; }, setPref: function (k, v) { prefs[k] = v; savePrefs(); applyPrefs(); render(); }, openVersion: function () { openVersionSheet(); }, listenWith: function (stream) { if (liveState) { setLiveMode('listen'); startEar(stream); } }, liveInfo: function () { return liveState ? { i: liveState.i, n: liveState.path.length, mode: liveState.mode, playing: liveState.playing, path: liveState.path.slice(), chords: liveState.vo.map(function (x) { return x.en; }), keys: liveState.vo.map(function (x) { return (x.v.right || []).concat(x.v.hideLeft || x.v.left == null ? [] : [x.v.left]); }), startB: liveState.startB, bpm: liveState.bpm, tl: liveState.tl } : null; }, grid: function () { return gridState ? JSON.parse(JSON.stringify(gridState.tl)) : null; }, _setV1: function (marks, end) { var st = liveState, song = clone(st.song); song.timeline = { v: 1, video: '', start: 0, sig: seqSig(st.steps), steps: marks, end: end }; local.songs[song.id] = cleanSong(song); saveLocal(); delete infoCache[song.id]; }, editorSrc: function () { return editorState ? C.modelToSrc(editorState.model) : null; },
  setTimeline: function (id, beats, bpm, bpb) { var song = clone(getSong(id)), st = liveSteps(song); song.timeline = { v: 2, bpm: bpm || 100, beats: bpb || 4, sig: seqSig(st.steps), steps: st.steps.map(function (x, k) { return [k, (beats && beats[k % beats.length]) || 4, null]; }), video: null }; local.songs[id] = cleanSong(song); saveLocal(); delete infoCache[id]; },
  students: function () { return stuData(); }, syncState: function () { return { role: sync.role, code: sync.code, online: syncOnline(), songId: sync.songId, gotAt: sync.gotAt }; },
  liveExtra: function () { var st = liveState; return st ? { level: st.level, mode: st.mode, stu: !!st.stu, part: st.easy ? st.easy.cfg.part : null, rhythm: st.easy ? st.easy.cfg.rhythm : null, home: st.easy ? st.easy.home : null, keyboard: st.easy ? st.easy.keyboard : null, labels: st.vo.map(function (x) { return x.label; }), keys: st.vo.map(function (x) { return x.key; }), right: st.vo.map(function (x) { return x.v.right; }), lo: st.lLo, hi: st.rHi, fade: st.fade || null, helpNow: !!st.helpNow, playing: st.playing, bpm: st.bpm } : null; },
  audioInfo: function () { return { n: TAP.n, clip: TAP.clipN, log: TAP.log.length }; }, audioWavSize: function () { var w = tapWavBlob(); return w ? w.size : 0; },
  midiIn: function (bytes) { midiMsg({ data: bytes }); }, midiFake: function (name) { midi.inp = { name: name || 'Teclado de prueba' }; }, state: function () { return { book: BOOKS.active, version: DATA.version, source: dataState.source, songs: allSongs().length, changes: localChangeCount() }; } };
})();


window.__appOk = true;
if (window.__BUILD && window.__BUILD !== '20261005150642') { try { showUpdateBanner(''); } catch (e) { /* nada */ } }
