/* Motor musical del cancionero — sin DOM, probado con Node. */
(function (root) {
  'use strict';

  var SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  var FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  var LATIN = { C: 'Do', D: 'Re', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  var BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  // Tonalidades mayores que se escriben con bemoles (Fa, Sib, Mib, Lab, Reb)
  var FLAT_MAJOR = { 5: 1, 10: 1, 3: 1, 8: 1, 1: 1 };

  var CORE_RE = /^[A-G][#b]?(?:maj|min|aug|dim|sus|add|m|M|\+|°|ø)*\d*(?:(?:sus|add|maj|b|#)\d+)*(?:\/[A-G][#b]?)?$/;
  var SPLIT_RE = /^([(\[{]*)(.*?)([)\]},.:;]*)$/;
  var PARSE_RE = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;

  function mod12(n) { return ((n % 12) + 12) % 12; }

  function pcOf(letter, acc) {
    return mod12(BASE[letter] + (acc === '#' ? 1 : acc === 'b' ? -1 : 0));
  }

  function splitTok(tok) {
    var m = SPLIT_RE.exec(tok);
    return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: '', core: tok, post: '' };
  }

  function isChordCore(core) { return CORE_RE.test(core); }
  function isChordTok(tok) { return isChordCore(splitTok(tok).core); }

  function parseChord(core) {
    var m = PARSE_RE.exec(core);
    if (!m || !CORE_RE.test(core)) return null;
    return {
      root: pcOf(m[1], m[2]), rootName: m[1] + m[2], qual: m[3] || '',
      bass: m[4] ? pcOf(m[4], m[5]) : null, bassName: m[4] ? m[4] + m[5] : null
    };
  }

  function isMinorQual(q) { return /^m(?!aj)/.test(q) || /^min/.test(q); }

  /** Nombre de nota según preferencia: 'sharp' | 'flat' ; notación 'en' | 'es' */
  function noteName(pc, spell, notation) {
    var n = (spell === 'flat' ? FLAT : SHARP)[mod12(pc)];
    if (notation === 'es') n = LATIN[n[0]] + n.slice(1);
    return n;
  }

  /** ¿Con qué alteraciones se escribe una tonalidad? */
  function spellForKey(pc, minor) {
    var major = minor ? mod12(pc + 3) : mod12(pc);
    return FLAT_MAJOR[major] ? 'flat' : 'sharp';
  }

  /**
   * Transpone un token de acorde (con paréntesis/puntuación) conservando lo que no es acorde.
   * opts: {shift, spell: 'sharp'|'flat', notation: 'en'|'es', keep: bool}
   * keep=true → sin cambio de tono y sin preferencia forzada: se respeta la escritura original.
   */
  function transposeTok(tok, opts) {
    var p = splitTok(tok);
    var c = parseChord(p.core);
    if (!c) return tok;
    var shift = opts.shift || 0, notation = opts.notation || 'en';
    var rootS, bassS;
    if (opts.keep && shift === 0) {
      rootS = c.rootName; bassS = c.bassName;
      if (notation === 'es') {
        rootS = LATIN[rootS[0]] + rootS.slice(1);
        if (bassS) bassS = LATIN[bassS[0]] + bassS.slice(1);
      }
    } else {
      rootS = noteName(c.root + shift, opts.spell, notation);
      bassS = c.bass === null ? null : noteName(c.bass + shift, opts.spell, notation);
    }
    return p.pre + rootS + c.qual + (bassS ? '/' + bassS : '') + p.post;
  }

  /* ---------------- Canciones: formato de texto ----------------
     '# Coro 1'          etiqueta de sección
     '> (De nuevo coro)' nota / indicación
     '! Intro: [C] [G]'  instrucción con acordes en línea
     ''                  espacio entre estrofas
     'Yo le al[D]abo'    letra con acordes anclados a la sílaba */
  function parseLine(raw) {
    if (raw === '' || /^\s*$/.test(raw)) return { type: 'blank' };
    if (raw[0] === '#') return { type: 'label', text: raw.replace(/^#\s?/, '') };
    if (raw[0] === '>') return { type: 'note', text: raw.replace(/^>\s?/, '') };
    if (raw[0] === '!') return { type: 'instr', segs: segsOf(raw.replace(/^!\s?/, '')) };
    return { type: 'lyric', segs: segsOf(raw) };
  }

  function segsOf(s) {
    var segs = [], re = /\[([^\]]*)\]/g, last = 0, m, cur = { c: null, t: '' };
    while ((m = re.exec(s))) {
      cur.t += s.slice(last, m.index);
      if (cur.c !== null || cur.t !== '') segs.push(cur);
      var parts = splitMulti(m[1]);                 // «[G D]» o «[(A B7)]»: varios acordes en el mismo lugar
      for (var q = 0; q < parts.length - 1; q++) segs.push({ c: parts[q], t: '' });
      cur = { c: parts[parts.length - 1], t: '' };
      last = re.lastIndex;
    }
    cur.t += s.slice(last);
    if (cur.c !== null || cur.t !== '' || !segs.length) segs.push(cur);
    return segs;
  }

  function splitMulti(inner) {
    var t = inner.trim();
    if (!/[\s,]/.test(t)) return [inner];
    var parts = t.split(/[\s,]+/).filter(Boolean);
    if (parts.length > 1 && parts.every(function (p) { return isChordTok(p) || /^\(?[xX]\s?\d+\)?$/.test(p); })) return parts;
    return [inner];
  }

  function parseSong(src) {
    return String(src || '').replace(/\r/g, '').split('\n').map(parseLine);
  }

  function chordsInSong(lines) {
    var out = [];
    lines.forEach(function (l) {
      if (l.segs) l.segs.forEach(function (s) {
        if (s.c !== null) {
          var core = splitTok(s.c).core, c = parseChord(core);
          if (c) out.push(c);
        }
      });
    });
    return out;
  }

  /* ---------------- Detección de tonalidad ---------------- */
  var W_MAJOR = { maj: { 0: 3, 5: 2, 7: 2.6, 2: 0.6, 4: 0.5, 10: 0.6, 9: 0.2, 8: 0.2 },
                  min: { 2: 1.8, 4: 1.2, 9: 2, 5: 0.5, 7: 0.3 } };
  var W_MINOR = { min: { 0: 3, 5: 2, 7: 1.2, 2: 0.3 },
                  maj: { 7: 2.6, 3: 2, 8: 2, 10: 2, 5: 0.6, 0: 0.3, 2: 0.3 } };

  function detectKey(chords) {
    if (!chords.length) return { pc: 0, minor: false };
    var best = null;
    for (var r = 0; r < 12; r++) {
      [false, true].forEach(function (minor) {
        var W = minor ? W_MINOR : W_MAJOR, score = 0;
        chords.forEach(function (c) {
          var iv = mod12(c.root - r), m = isMinorQual(c.qual);
          var w = (m ? W.min : W.maj)[iv] || -0.4;
          score += w;
        });
        var first = chords[0], last = chords[chords.length - 1];
        function isTonic(c) { return c.root === r && isMinorQual(c.qual) === minor; }
        if (isTonic(first)) score += 3;
        if (isTonic(last)) score += 4;
        if (!best || score > best.score) best = { pc: r, minor: minor, score: score };
      });
    }
    return { pc: best.pc, minor: best.minor };
  }

  function keyName(key, spell, notation) {
    return noteName(key.pc, spell || spellForKey(key.pc, key.minor), notation) + (key.minor ? 'm' : '');
  }

  /* ---------------- Cejilla (capo) ---------------- */
  var EASY = { 'C': 0, 'D': 0, 'E': 0, 'G': 0, 'A': 0, 'Am': 0, 'Em': 0, 'Dm': 0,
               'C7': 0, 'D7': 0, 'E7': 0, 'G7': 0, 'A7': 0, 'B7': 0.3, 'Am7': 0, 'Em7': 0, 'Dm7': 0.2,
               'Cmaj7': 0.2, 'Fmaj7': 0.4, 'Asus4': 0.2, 'Dsus4': 0.2, 'Esus4': 0.2, 'Asus2': 0.2, 'Dsus2': 0.2,
               'F': 1.2, 'Bm': 1.4, 'Bm7': 1, 'F#m': 1.8, 'Gm': 1.8, 'B': 1.6, 'F#': 2, 'A#': 2.2, 'C#m': 2,
               'G#m': 2.4, 'Cm': 2, 'Fm': 2.2, 'A#m': 2.6, 'D#m': 2.8, 'F#m7': 1.2, 'C#m7': 1.4, 'G#7': 2.4, 'C#7': 2.4 };
  function shapeCost(c, shift) {
    var name = SHARP[mod12(c.root + shift)] + simplifyQual(c.qual);
    if (name in EASY) return EASY[name];
    var triad = SHARP[mod12(c.root + shift)] + (isMinorQual(c.qual) ? 'm' : '');
    if (triad in EASY) return EASY[triad] + 0.3;
    return 3;
  }
  function simplifyQual(q) {
    if (/^maj7/.test(q)) return 'maj7';
    if (/^m7/.test(q)) return 'm7';
    if (/^m(?!aj)/.test(q)) return 'm';
    if (/^7/.test(q)) return '7';
    if (/^sus4/.test(q)) return 'sus4';
    if (/^sus2/.test(q)) return 'sus2';
    return '';
  }
  /** Mejor cejilla (0-7) para que la guitarra toque formas abiertas en el tono que suena. */
  function suggestCapo(chords, soundShift) {
    var uniq = {}, list = [];
    chords.forEach(function (c) { var k = c.root + '|' + simplifyQual(c.qual); if (!uniq[k]) { uniq[k] = 1; list.push(c); } });
    var best = { capo: 0, cost: Infinity };
    for (var capo = 0; capo <= 7; capo++) {
      var cost = capo * 0.45;
      list.forEach(function (c) { cost += shapeCost(c, soundShift - capo); });
      if (cost < best.cost - 1e-9) best = { capo: capo, cost: cost };
    }
    return best.capo;
  }

  /* ---------------- Notas del acorde (para el piano) ---------------- */
  function chordIntervals(q) {
    var iv;
    if (/^(dim|°)/.test(q)) iv = [0, 3, 6];
    else if (/^(aug|\+)/.test(q)) iv = [0, 4, 8];
    else if (/^m(?!aj)|^min/.test(q)) iv = [0, 3, 7];
    else iv = [0, 4, 7];
    if (/sus2/.test(q)) iv = [0, 2, 7];
    else if (/sus/.test(q)) iv = [0, 5, 7];
    if (/^5$/.test(q)) iv = [0, 7];
    if (/ø|m7b5/.test(q)) iv = [0, 3, 6, 10];
    else if (/dim7|°7/.test(q)) iv = [0, 3, 6, 9];
    else if (/maj7|M7|maj9/.test(q)) iv = iv.concat([11]);
    else if (/(^|[^d])(7|9|11|13)/.test(q) && !/add/.test(q)) iv = iv.concat([10]);
    if (/(^|[^j])6/.test(q) && !/13/.test(q)) iv = iv.concat([9]);
    if (/add9|add2|(^|[^d])9/.test(q)) iv = iv.concat([14]);
    if (/add4|11/.test(q)) iv = iv.concat([17]);
    if (/13/.test(q)) iv = iv.concat([21]);
    return iv;
  }
  /** Voz sencilla para principiantes: mano derecha en posición fundamental desde Do4, bajo en la izquierda. */
  function pianoVoicing(core) {
    var c = parseChord(splitTok(core).core);
    if (!c) return null;
    var iv = chordIntervals(c.qual);
    var rootMidi = 60 + c.root;                 // desde Do central
    if (rootMidi > 66) rootMidi -= 12;          // no subir demasiado (Sol# en adelante baja una octava)
    var right = iv.map(function (i) { return rootMidi + i; });
    var bassPc = c.bass !== null ? c.bass : c.root;
    var left = right[0] - (mod12(right[0] - bassPc) || 12);   // bajo justo debajo de la mano derecha
    return { right: right, left: left, root: c.root, bass: bassPc, intervals: iv };
  }

  /* ---------------- Exportar a texto (acordes encima de la letra) ---------------- */
  /* Posición cercana: de las inversiones posibles, la que menos mueve la mano desde el acorde anterior.
     Mano derecha entre Fa3 y La5; bajo (fundamental o nota del bajo) cerca del bajo anterior. */
  function closeVoicing(core, prev) {
    var c = parseChord(splitTok(core).core);
    if (!c) return null;
    var pcs = [], seen = {};
    chordIntervals(c.qual).forEach(function (x) { var pc = mod12(c.root + x); if (!seen[pc]) { seen[pc] = 1; pcs.push({ pc: pc, iv: mod12(x) }); } });
    if (pcs.length > 4) pcs = pcs.filter(function (p) { return p.iv !== 7; }).slice(0, 4);
    var cands = [];
    for (var r = 0; r < pcs.length; r++) {
      var order = pcs.slice(r).concat(pcs.slice(0, r));
      for (var base = 48; base <= 76; base++) {
        if (mod12(base) !== order[0].pc) continue;
        var notes = [base];
        for (var k = 1; k < order.length; k++) { var nx = notes[k - 1] + 1; while (mod12(nx) !== order[k].pc) nx++; notes.push(nx); }
        if (notes[0] < 53 || notes[notes.length - 1] > 81) continue;
        cands.push({ notes: notes, inv: r });
      }
    }
    if (!cands.length) return pianoVoicing(core);
    var center = function (n) { return (n[0] + n[n.length - 1]) / 2; };
    var cost = function (n, inv) {
      if (!prev || !prev.right) return inv * 3 + Math.abs(center(n) - 64) / 4;
      var d = 0;
      n.forEach(function (x) { var b = 99; prev.right.forEach(function (y) { b = Math.min(b, Math.abs(x - y)); }); d += b; });
      prev.right.forEach(function (y) { var b = 99; n.forEach(function (x) { b = Math.min(b, Math.abs(x - y)); }); d += b; });
      return d + Math.abs(center(n) - 64) * 0.15;
    };
    cands.sort(function (a, b) { return cost(a.notes, a.inv) - cost(b.notes, b.inv) || a.inv - b.inv; });
    // bajo siempre en la misma octava (Mi2 a Re#3): la mano izquierda se queda en su lugar y solo cambia de tecla
    var best = cands[0], bassPc = c.bass !== null ? c.bass : c.root, left = 40 + mod12(bassPc - 40);
    var n = best.notes.length;
    var fingers = n === 3 ? (best.inv === 1 ? [1, 2, 5] : [1, 3, 5]) : n === 4 ? [1, 2, 3, 5] : n === 2 ? [1, 5] : [1, 2, 3, 4, 5];
    return { right: best.notes, left: left, fingers: fingers, inv: best.inv, root: c.root, bass: bassPc };
  }

  function lineToText(line, fmt) {
    if (line.type === 'blank') return [''];
    if (line.type === 'label') return ['[' + line.text + ']'];
    if (line.type === 'note') return [line.text];
    if (line.type === 'instr') return [line.segs.map(function (s) { return (s.c !== null ? fmt(s.c) + ' ' : '') + s.t; }).join('').replace(/\s+/g, ' ').trim()];
    var lyric = '', chordRow = '', hasChord = false;
    line.segs.forEach(function (s) {
      if (s.c !== null) {
        hasChord = true;
        var ch = fmt(s.c), col = lyric.length;
        if (chordRow.length > 0 && col < chordRow.length + 1) col = chordRow.length + 1;
        while (chordRow.length < col) chordRow += ' ';
        chordRow += ch;
        if (lyric.length < col && s.t === '' ) { /* acorde colgando al final */ }
      }
      lyric += s.t;
    });
    return hasChord ? [chordRow.replace(/\s+$/, ''), lyric.replace(/\s+$/, '')] : [lyric.replace(/\s+$/, '')];
  }
  function songToText(lines, fmt) {
    var out = [];
    lines.forEach(function (l) { out.push.apply(out, lineToText(l, fmt)); });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  /* ---------------- Importar texto pegado ----------------
     Acepta: formato propio con [acordes], ChordPro básico, o acordes encima de la letra. */
  var REPEAT_RE = /^\(?[xX]\s?\d+\)?[,.]?$/;
  var LABEL_RE = /^\s*[\[({]?\s*(coro|estribillo|verso|estrofa|puente|pre-?coro|precoro|intro|introducci[oó]n|final|outro|interludio|instrumental|secci[oó]n|solo|bridge|chorus|verse)(\s*\d+|\s+[ivx]+)?\s*[\])}]?\s*:?\s*$/i;

  function chordLineInfo(line) {
    var toks = [], re = /\S+/g, m, chords = 0, other = 0;
    while ((m = re.exec(line))) {
      var t = m[0];
      if (isChordTok(t)) { chords++; toks.push({ t: t, col: m.index, chord: true }); }
      else if (REPEAT_RE.test(t) || /^[|\-–\/xX½]$/.test(t)) { toks.push({ t: t, col: m.index, chord: false }); }
      else { other++; toks.push({ t: t, col: m.index, chord: false, word: true }); }
    }
    return { toks: toks, chords: chords, other: other };
  }

  function bracketInline(text) {
    return text.replace(/(^|[\s(|,\-])([A-G][#b]?(?:maj|min|aug|dim|sus|add|m|M|\+|°|ø)*\d*(?:(?:sus|add|maj|b|#)\d+)*(?:\/[A-G][#b]?)?)(?=$|[\s)|,.:;\-])/g,
      function (all, pre, ch) { return pre + '[' + ch + ']'; });
  }

  function importText(text) {
    var raw = String(text || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
    var meta = { title: '', author: '', key: '' };
    var hasBrackets = /\[[A-G][#b]?[^\]\s]{0,8}\]/.test(text);
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i].replace(/\s+$/, '');
      var d = /^\s*\{\s*([a-z_]+)\s*:?\s*(.*?)\s*\}\s*$/i.exec(line);
      if (d) {
        var k = d[1].toLowerCase(), v = d[2];
        if (k === 'title' || k === 't') meta.title = v;
        else if (k === 'artist' || k === 'subtitle' || k === 'st' || k === 'composer') meta.author = meta.author || v;
        else if (k === 'key') meta.key = v;
        else if (k === 'c' || k === 'comment' || k === 'ci' || k === 'comment_italic') out.push((LABEL_RE.test(v) ? '# ' : '> ') + v);
        else if (k === 'soc' || k === 'start_of_chorus') out.push('# ' + (v || 'Coro'));
        else if (k === 'sov' || k === 'start_of_verse') out.push('# ' + (v || 'Verso'));
        else if (/^(eoc|eov|end_of_chorus|end_of_verse)$/.test(k)) out.push('');
        continue;
      }
      if (!line.trim()) { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
      if (/^[#>!]/.test(line)) { out.push(line); continue; }
      if (hasBrackets) { out.push(line); continue; }
      var info = chordLineInfo(line);
      if (info.chords > 0 && info.other === 0) {
        var next = raw[i + 1] !== undefined ? raw[i + 1].replace(/\s+$/, '') : '';
        var nextInfo = next ? chordLineInfo(next) : null;
        var nextIsLyric = next.trim() && !(nextInfo.chords > 0 && nextInfo.other === 0) && !LABEL_RE.test(next) && !/^[#>!{]/.test(next);
        if (nextIsLyric) {
          var lyric = next, res = '', last = 0;
          var toks = info.toks.slice().sort(function (a, b) { return a.col - b.col; });
          toks.forEach(function (t) {
            var col = Math.min(t.col, lyric.length);
            if (col < last) col = last;
            res += lyric.slice(last, col) + '[' + t.t + ']';
            last = col;
          });
          res += lyric.slice(last);
          out.push(res.replace(/^\s+/, function (s) { return s.length > 12 ? s.slice(0, 12) : s; }));
          i++;
        } else {
          out.push('! ' + info.toks.map(function (t) { return t.chord ? '[' + t.t + ']' : t.t; }).join(' '));
        }
        continue;
      }
      if (LABEL_RE.test(line) && info.chords === 0) { out.push('# ' + line.trim().replace(/^[\[({]\s*|\s*[\])}]?\s*:?\s*$/g, '')); continue; }
      if (/:\s/.test(line) && info.chords >= 2 && info.chords >= info.other) { out.push('! ' + bracketInline(line.trim())); continue; }
      out.push(line);
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    while (out.length && out[0] === '') out.shift();
    return { src: out.join('\n'), meta: meta };
  }

  /* ---------------- Mayúsculas y minúsculas ---------------- */
  var PROPER = ['Dios', 'Señor', 'Jesús', 'Jesucristo', 'Cristo', 'María', 'Israel', 'Judá', 'Jerusalén', 'Elohim', 'Shaddai',
    'Adonai', 'Yahvé', 'Teruah', 'Apu', 'Taytayku', 'Sumaq', 'Pentecostés', 'Padre', 'Hijo', 'Espíritu', 'Santo', 'Rey', 'Shofar', 'Aleluya'];
  var PROPER_MAP = {};
  PROPER.forEach(function (w) { PROPER_MAP[w.toLowerCase()] = w; });
  var ACRONYMS = { RCC: 1, RCCES: 1, ECCE: 1, GDL: 1, MMC: 1, ID: 1, YT: 1, DEI: 1, SS: 1, 'PBRO.': 0 };

  function sentenceCase(s) {
    if (!s) return s;
    var letters = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
    var upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
    if (letters.length < 2 || upper / letters.length < 0.7) return s;
    var low = s.toLowerCase();
    var holy = /(espíritu)(\s+)(santo|de dios|divino)/g;
    low = low.replace(/[a-záéíóúñü]+/g, function (w) {
      if (w === 'santo' || w === 'espíritu' || w === 'rey' || w === 'padre' || w === 'hijo' || w === 'aleluya') return w;
      return PROPER_MAP[w] || w;
    });
    low = low.replace(holy, function (a, e, sp, rest) { return 'Espíritu' + sp + (rest === 'santo' ? 'Santo' : rest); });
    low = low.replace(/^([^A-Za-zÁÉÍÓÚÑÜáéíóúñü]*)([a-záéíóúñü])/, function (a, p, c) { return p + c.toUpperCase(); });
    low = low.replace(/([.!?¡¿]\s*|\(\s*)([a-záéíóúñü])/g, function (a, p, c) { return p + c.toUpperCase(); });
    return low;
  }
  function nameCase(s) {
    if (!s) return s;
    var letters = s.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
    var upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
    if (letters.length < 2 || upper / letters.length < 0.7) return s;
    return s.split(/(\s+|\(|\)|-|\/)/).map(function (w) {
      if (!w || /^\s+$/.test(w) || /^[()\-\/]$/.test(w)) return w;
      if (ACRONYMS[w] === 1) return w;
      var bare = w.replace(/[^A-Za-zÁÉÍÓÚÑÜ]/g, '');
      if (bare && !/[AEIOUÁÉÍÓÚ]/.test(bare)) return w;
      var l = w.toLowerCase();
      if (/^(de|del|la|las|los|y|el|al)$/.test(l)) return l;
      return l.replace(/^([^a-záéíóúñü]*)([a-záéíóúñü])/, function (a, p, c) { return p + c.toUpperCase(); });
    }).join('');
  }

  function normalize(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /* ================= Editor visual: modelo de la canción =================
     Línea de letra:     { type: 'lyric', text, chords: [{ i, c }] }   (i = letra donde cae el acorde)
     Línea de acordes:   { type: 'instr', segs: [{ c, t }] }
     Sección / nota:     { type: 'label' | 'note', text }
     Espacio:            { type: 'blank' } */
  function lineToModel(l) {
    if (l.type === 'lyric') {
      var text = '', chords = [];
      l.segs.forEach(function (s) { if (s.c !== null) chords.push({ i: text.length, c: s.c }); text += s.t; });
      return { type: 'lyric', text: text, chords: chords };
    }
    if (l.type === 'instr') return { type: 'instr', segs: l.segs.map(function (s) { return { c: s.c, t: s.t }; }) };
    if (l.type === 'blank') return { type: 'blank' };
    return { type: l.type, text: l.text };
  }
  function normalizeModel(lines) {
    var out = [];
    lines.forEach(function (l) { if (l.type === 'blank' && (!out.length || out[out.length - 1].type === 'blank')) return; out.push(l); });
    while (out.length && out[out.length - 1].type === 'blank') out.pop();
    return out;
  }
  function srcToModel(src) { return normalizeModel(parseSong(src).map(lineToModel)); }
  function sortChords(chords) {
    return chords.map(function (c, k) { return { c: c, k: k }; })
      .sort(function (a, b) { return a.c.i - b.c.i || a.k - b.k; }).map(function (x) { return x.c; });
  }
  function lyricToSrc(text, chords) {
    var out = '', last = 0;
    sortChords(chords).forEach(function (c) {
      var i = Math.max(0, Math.min(text.length, c.i));
      out += text.slice(last, i) + '[' + c.c + ']'; last = i;
    });
    return out + text.slice(last);
  }
  function instrToSrc(segs) { return segs.map(function (s) { return (s.c !== null ? '[' + s.c + ']' : '') + s.t; }).join(''); }
  function modelLineToSrc(l) {
    if (l.type === 'blank') return '';
    if (l.type === 'label') return '# ' + l.text;
    if (l.type === 'note') return '> ' + l.text;
    if (l.type === 'instr') return '! ' + instrToSrc(l.segs);
    return lyricToSrc(l.text, l.chords);
  }
  function modelToSrc(lines) { return normalizeModel(lines).map(modelLineToSrc).join('\n'); }

  /* ---------- Pestaña «Letra»: texto normal ---------- */
  function instrPlain(l) { return l.segs.map(function (s) { return (s.c !== null ? s.c : '') + s.t; }).join(''); }
  function modelToLetra(lines) {
    return normalizeModel(lines).map(function (l) {
      if (l.type === 'blank') return '';
      if (l.type === 'label') return '[' + l.text + ']';
      if (l.type === 'note') return '> ' + l.text;
      if (l.type === 'instr') return '! ' + instrPlain(l);
      return l.text;
    }).join('\n');
  }
  function instrFromText(t) { return { type: 'instr', segs: segsOf(bracketInline(t)).map(function (s) { return { c: s.c, t: s.t }; }) }; }
  /* Lee lo escrito en «Letra»: [Coro] es sección, «> » nota, «! » línea de acordes;
     también entiende canciones pegadas con los acordes en la línea de arriba. */
  function parseLetra(text) {
    var raw = String(text || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n'), out = [], m;
    for (var i = 0; i < raw.length; i++) {
      var line = raw[i], t = line.trim();
      if (!t) { if (out.length && out[out.length - 1].type !== 'blank') out.push({ type: 'blank' }); continue; }
      if ((m = /^\[([^\]]+)\]$/.exec(t)) && !isChordTok(m[1].trim())) { out.push({ type: 'label', text: m[1].trim() }); continue; }
      if (t[0] === '>') { out.push({ type: 'note', text: t.replace(/^>\s?/, '') }); continue; }
      if (t[0] === '!') { out.push(instrFromText(t.replace(/^!\s?/, ''))); continue; }
      if (/\[[^\]]+\]/.test(line)) {
        var lm = lineToModel(parseLine(line.replace(/\s+$/, '')));
        if (lm.type === 'lyric' && lm.chords.some(function (c) { return isChordTok(c.c); })) { out.push(lm); continue; }
      }
      var info = chordLineInfo(line);
      if (info.chords > 0 && info.other === 0) {
        var next = raw[i + 1] !== undefined ? raw[i + 1] : '', nt = next.trim(), ni = nt ? chordLineInfo(next) : null;
        var nextIsLyric = nt && !(ni.chords > 0 && ni.other === 0) && !LABEL_RE.test(next) && !/^[\[>!]/.test(nt);
        if (nextIsLyric) {
          var lyr = next.replace(/\s+$/, '');
          out.push({ type: 'lyric', text: lyr, chords: info.toks.map(function (tk) { return { i: Math.min(tk.col, lyr.length), c: tk.t }; }) });
          i++;
        } else {
          out.push({ type: 'instr', segs: segsOf(info.toks.map(function (tk) { return tk.chord ? '[' + tk.t + ']' : tk.t; }).join(' ')).map(function (s) { return { c: s.c, t: s.t }; }) });
        }
        continue;
      }
      if (LABEL_RE.test(line) && info.chords === 0) { out.push({ type: 'label', text: t.replace(/^[\[({]\s*|\s*[\])}]?\s*:?\s*$/g, '') }); continue; }
      if (/:\s/.test(line) && info.chords >= 2 && info.chords >= info.other) { out.push(instrFromText(t)); continue; }
      out.push({ type: 'lyric', text: line, chords: [] });
    }
    return normalizeModel(out);
  }

  /* ---------- Reubicar acordes cuando cambia la letra ---------- */
  function lcsPairs(a, b, eq) {
    var n = a.length, m = b.length, dp = [], i, j;
    for (i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var pairs = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (eq(a[i], b[j])) { pairs.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return pairs;
  }
  function same(x, y) { return x === y; }
  function lineKey(l) {
    if (l.type === 'blank') return 'B';
    if (l.type === 'label') return 'H:' + l.text;
    if (l.type === 'note') return 'N:' + l.text;
    if (l.type === 'instr') return 'I:' + instrPlain(l);
    return 'L:' + l.text;
  }
  /* Cada acorde sigue a su letra. Si esa letra se borró o se reemplazó, el acorde va al inicio del texto nuevo:
     justo después de la última letra que se conservó antes de él. */
  function transferChords(oldLine, newText) {
    var a = oldLine.text, pairs = lcsPairs(a.split(''), newText.split(''), same), map = [], k;
    for (k = 0; k <= a.length; k++) map.push(-1);
    pairs.forEach(function (p) { map[p[0]] = p[1]; });
    return oldLine.chords.map(function (c) {
      var i = Math.max(0, Math.min(a.length, c.i));
      if (i >= a.length) return { i: newText.length, c: c.c };
      if (map[i] >= 0) return { i: map[i], c: c.c };
      var p = i - 1; while (p >= 0 && map[p] < 0) p--;
      return { i: p < 0 ? 0 : Math.min(newText.length, map[p] + 1), c: c.c };
    });
  }
  function similarity(a, b) {
    a = normalize(a); b = normalize(b);
    if (!a.length && !b.length) return 1;
    return 2 * lcsPairs(a.split(''), b.split(''), same).length / (a.length + b.length);
  }
  function cloneLine(l) { return JSON.parse(JSON.stringify(l)); }
  /* Une lo que había (con acordes) con lo nuevo escrito en «Letra». */
  function reconcile(oldL, newL) {
    var pairs = lcsPairs(oldL.map(lineKey), newL.map(lineKey), same), out = [], oi = 0, ni = 0;
    pairs.push([oldL.length, newL.length]);
    pairs.forEach(function (p) {
      var olds = [], k;
      for (k = oi; k < p[0]; k++) if (oldL[k].type === 'lyric' && oldL[k].chords.length) olds.push(oldL[k]);
      for (k = ni; k < p[1]; k++) {
        var nl = newL[k];
        if (nl.type === 'lyric' && !nl.chords.length && olds.length) {
          var best = -1, bs = 0.5;
          olds.forEach(function (o, q) { var sc = similarity(o.text, nl.text); if (sc >= bs) { bs = sc; best = q; } });
          if (best >= 0) { out.push({ type: 'lyric', text: nl.text, chords: transferChords(olds[best], nl.text) }); olds.splice(best, 1); continue; }
        }
        out.push(cloneLine(nl));
      }
      if (p[0] < oldL.length) {
        var n = newL[p[1]];
        out.push(n.type === 'lyric' && n.chords.length ? cloneLine(n) : cloneLine(oldL[p[0]]));
      }
      oi = p[0] + 1; ni = p[1] + 1;
    });
    return normalizeModel(out);
  }

  /* ---------- Sílabas en español (para copiar acordes de una estrofa a otra) ---------- */
  var VOWELS = 'aeiouáéíóúü', STRONG = 'aeoáéó', ACC_WEAK = 'íú';
  var INSEP = { pr: 1, br: 1, tr: 1, dr: 1, cr: 1, gr: 1, fr: 1, kr: 1, pl: 1, bl: 1, cl: 1, gl: 1, fl: 1, kl: 1 };
  function hiatus(x, y) {
    if (ACC_WEAK.indexOf(x) >= 0 || ACC_WEAK.indexOf(y) >= 0) return true;
    return STRONG.indexOf(x) >= 0 && STRONG.indexOf(y) >= 0;
  }
  function wordSyllableStarts(w) {
    var units = [], i = 0;
    while (i < w.length) {
      var ch = w[i], nx = w[i + 1] || '', nn = w[i + 2] || '';
      if ((ch === 'c' && nx === 'h') || (ch === 'l' && nx === 'l') || (ch === 'r' && nx === 'r')) { units.push({ s: i, v: false, t: ch + nx }); i += 2; continue; }
      if ((ch === 'q' || ch === 'g') && nx === 'u' && 'eiéí'.indexOf(nn) >= 0 && nn) { units.push({ s: i, v: false, t: ch + 'u' }); i += 2; continue; }
      if (ch === 'y') { units.push({ s: i, v: i > 0 && (!nx || VOWELS.indexOf(nx) < 0), t: 'i' }); i++; continue; }
      units.push({ s: i, v: VOWELS.indexOf(ch) >= 0, t: ch }); i++;
    }
    var nuclei = [], cur = null;
    units.forEach(function (u, k) {
      if (!u.v) return;
      if (cur && cur.end === k - 1 && !hiatus(units[k - 1].t, u.t)) cur.end = k;
      else { cur = { start: k, end: k }; nuclei.push(cur); }
    });
    var starts = [0];
    for (var n = 1; n < nuclei.length; n++) {
      var a = nuclei[n - 1].end + 1, b = nuclei[n].start, cons = b - a, st;
      if (cons <= 0) st = b;
      else if (cons === 1) st = a;
      else if (cons === 2) st = INSEP[units[a].t + units[a + 1].t] ? a : a + 1;
      else st = INSEP[units[b - 2].t + units[b - 1].t] ? b - 2 : b - 1;
      starts.push(units[st].s);
    }
    return starts;
  }
  function syllableStarts(text) {
    var out = [], re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, m;
    while ((m = re.exec(text))) {
      var base = m.index;
      wordSyllableStarts(m[0].toLowerCase()).forEach(function (s) { out.push(base + s); });
    }
    return out;
  }
  /* El acorde de la sílaba N de una línea pasa a la sílaba N de la otra. */
  function copyChordsBySyllable(src, dstText) {
    var ss = syllableStarts(src.text), ds = syllableStarts(dstText);
    return src.chords.map(function (c) {
      if (c.i >= src.text.length) return { i: dstText.length, c: c.c };
      if (!ds.length) return { i: Math.min(c.i, dstText.length), c: c.c };
      var k = -1;
      for (var q = 0; q < ss.length; q++) if (ss[q] <= c.i) k = q;
      return { i: k < 0 ? 0 : ds[Math.min(k, ds.length - 1)], c: c.c };
    });
  }

  /* ---------- Acordes del tono (paleta) ---------- */
  function diatonic(key, spell) {
    var list = key.minor
      ? [[0, 'm'], [3, ''], [5, 'm'], [7, ''], [7, '7'], [8, ''], [10, '']]
      : [[0, ''], [2, 'm'], [4, 'm'], [5, ''], [7, ''], [7, '7'], [9, 'm']];
    return list.map(function (x) { return noteName(key.pc + x[0], spell || spellForKey(key.pc, key.minor), 'en') + x[1]; });
  }

  /* ---------- Recorrido por compases ----------
     Cada paso del recorrido es [acorde, tiempos, segundo del video opcional]. Los segundos reales salen del tempo. */
  function tlRound(x) {
    var i = Math.round(x);
    if (Math.abs(x - i) <= 0.4) return Math.max(0.5, i);      // lo normal: cambios en el tiempo (medido: umbral 0,4)
    return Math.max(0.5, Math.round(x * 2) / 2);             // si no, a medio tiempo (anticipaciones)
  }
  /* Cuadrícula que se engancha a los toques: cada toque se ubica en el tiempo más cercano de la cuadrícula,
     la fase se corrige un poco en cada toque y el tempo se ajusta despacio (sigue un video que acelera). */
  function tlFollow(times, spb0, shift) {
    var spb = spb0, ref = times[0] + shift * spb0, pos = [0], cur = 0, cost = shift * shift;
    for (var k = 1; k < times.length; k++) {
      var t = Math.max(times[k], ref + 0.5 * spb), q = tlRound((t - ref) / spb), pred = ref + q * spb, e = t - pred;
      cost += (e / spb) * (e / spb) + (q % 1 ? 0.12 : 0);
      spb = spb * (1 + Math.max(-0.02, Math.min(0.02, 0.35 * e / (q * spb))));
      ref = pred + 0.3 * e; cur += q; pos.push(cur);
    }
    return { pos: pos, cost: cost };
  }
  /* Toques (segundos) -> tiempos musicales. No se supone que el primer toque sea exacto: se prueban varios
     arranques (primer toque algo antes o después, tempo ±2 %) y se elige el que mejor explica todos los toques. */
  function tlQuantize(marks, end, bpm) {
    if (!marks.length) return [];
    var times = marks.map(function (m) { return m[1]; }).concat([end]), best = null;
    for (var sh = -0.3; sh <= 0.3001; sh += 0.05) {
      for (var f = 0.98; f <= 1.0201; f += 0.01) {
        var r = tlFollow(times, 60 / (bpm * f), sh);
        if (!best || r.cost < best.cost) best = r;
      }
    }
    return marks.map(function (m, k) { return [m[0], best.pos[k + 1] - best.pos[k], Math.round(m[1] * 100) / 100]; });
  }
  /* Tempo sugerido a partir de los toques: duraciones en tiempos enteros, idealmente en compases o medios compases,
     y una preferencia suave por tempos habituales. Es una sugerencia: se confirma escuchando. */
  function tlEstimateBpm(marks, end, bpb) {
    var ds = [];
    for (var k = 0; k + 1 < marks.length; k++) ds.push(marks[k + 1][1] - marks[k][1]);
    if (ds.length < 2) { if (marks.length === 1 && end > marks[0][1]) ds.push(end - marks[0][1]); else return null; }
    var best = null;
    for (var bpm = 55; bpm <= 170; bpm += 0.5) {
      var spb = 60 / bpm, score = 0;
      ds.forEach(function (d) {
        var beats = d / spb, eb = Math.abs(beats - Math.round(beats)), bars = beats / bpb, ebar = Math.abs(bars * 2 - Math.round(bars * 2)) / 2;
        score += (0.5 - eb) + 0.6 * (0.25 - ebar) - (beats < 0.9 ? 0.4 : 0);
      });
      score = score / ds.length - Math.abs(bpm - 100) / 600;
      if (!best || score > best.score) best = { bpm: bpm, score: score };
    }
    return best ? Math.round(best.bpm) : null;
  }
  /* Tempo por toques de pulso: recta de mejor ajuste, así un toque desviado pesa poco. */
  function tlTapBpm(ts) {
    var n = ts.length; if (n < 3) return null;
    var sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (var i = 0; i < n; i++) { sx += i; sy += ts[i]; sxy += i * ts[i]; sxx += i * i; }
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return slope > 0 ? Math.round(600000 / slope) / 10 : null;
  }
  function tlStarts(steps) { var out = [0]; steps.forEach(function (s) { out.push(out[out.length - 1] + s[1]); }); return out; }
  /* Segundo del video de cada paso: el tocado, o interpolado por tiempos entre los pasos conocidos. */
  function tlVideoTimes(steps, bpm) {
    var st = tlStarts(steps), out = steps.map(function (s) { return typeof s[2] === 'number' ? s[2] : null; });
    var known = []; out.forEach(function (v, k) { if (v !== null) known.push(k); });
    var slope = function (p, q) { return (out[q] - out[p]) / Math.max(1e-6, st[q] - st[p]); };     // segundos por tiempo del video
    for (var k = 0; k < out.length; k++) {
      if (out[k] !== null) continue;
      var p = -1, q = -1;
      known.forEach(function (x) { if (x < k) p = x; else if (q < 0 && x > k) q = x; });
      if (p >= 0 && q >= 0) out[k] = out[p] + (st[k] - st[p]) * slope(p, q);
      else if (p >= 0) { var pp = known.indexOf(p) > 0 ? known[known.indexOf(p) - 1] : -1; out[k] = out[p] + (st[k] - st[p]) * (pp >= 0 ? slope(pp, p) : 60 / bpm); }
      else if (q >= 0) { var qq = known.indexOf(q) + 1 < known.length ? known[known.indexOf(q) + 1] : -1; out[k] = out[q] - (st[q] - st[k]) * (qq >= 0 ? slope(q, qq) : 60 / bpm); }
      else out[k] = st[k] * 60 / bpm;
    }
    return out;
  }
  /* ---------- Tempo escuchando la música ----------
     1) Envolvente de ataques: cuánto crece el espectro de un cuadro al siguiente (flujo espectral), 100 veces por segundo.
     2) Autocorrelación: el intervalo que más se repite entre ataques es el pulso.
     3) Preferencia suave por tempos habituales para escoger entre la mitad y el doble (siempre se ofrecen ambos).
     4) Fase: dónde caen los pulsos, para comprobar con un clic sobre la música. */
  function fftRadix2(re, im) {
    var n = re.length, i, j = 0, k, len, t;
    for (i = 1; i < n; i++) { var bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < half; k++) {
          var a = i + k, b = a + half, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  function onsetEnvelope(x, sr) {
    var N = sr > 30000 ? 2048 : 1024, hop = Math.max(1, Math.round(sr / 100)), fps = sr / hop, i, k;
    var rms = 0; for (i = 0; i < x.length; i++) rms += x[i] * x[i]; rms = Math.sqrt(rms / Math.max(1, x.length)) || 1;
    var g = 0.1 / rms, win = new Float64Array(N), re = new Float64Array(N), im = new Float64Array(N);
    for (i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    var k0 = Math.max(1, Math.floor(30 * N / sr)), k1 = Math.min(N >> 1, Math.ceil(5000 * N / sr)), prev = new Float64Array(k1), raw = [];
    for (var s = 0; s + N <= x.length; s += hop) {
      for (i = 0; i < N; i++) { re[i] = x[s + i] * win[i] * g; im[i] = 0; }
      fftRadix2(re, im);
      var flux = 0;
      for (k = k0; k < k1; k++) { var m = Math.log(1 + 100 * Math.sqrt(re[k] * re[k] + im[k] * im[k])), d = m - prev[k]; if (d > 0) flux += d; prev[k] = m; }
      raw.push(raw.length ? flux : 0);
    }
    // se resta la media local (~1 s) para quedarse solo con los ataques
    var n = raw.length, w = Math.round(fps / 2), pre = [0], env = new Float64Array(n);
    for (i = 0; i < n; i++) pre.push(pre[i] + raw[i]);
    for (i = 0; i < n; i++) { var lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1); env[i] = Math.max(0, raw[i] - (pre[hi] - pre[lo]) / (hi - lo)); }
    return { env: env, fps: fps, offset: N / 2 / sr };
  }
  function tempoFromEnvelope(e, fps) {
    var n = e.length, minLag = Math.floor(fps * 60 / 200), maxLag = Math.ceil(fps * 60 / 50), L, t;
    if (n < maxLag * 3) return null;
    var mean = 0; for (t = 0; t < n; t++) mean += e[t] / n;
    var top = Math.min(n - 1, 4 * maxLag + 2), ac = new Float64Array(top + 1);
    for (L = 1; L <= top; L++) { var sum = 0; for (t = 0; t + L < n; t++) sum += (e[t] - mean) * (e[t + L] - mean); ac[L] = sum / (n - L); }
    var at = function (x) { var i = Math.floor(x), f = x - i; return i + 1 <= top ? ac[i] * (1 - f) + ac[i + 1] * f : 0; };
    var sc = new Float64Array(maxLag + 2), best = -1, bestL = minLag, tot = 0, cnt = 0;
    for (L = minLag; L <= maxLag; L++) {
      var bpm = 60 * fps / L, prior = Math.exp(-0.5 * Math.pow(Math.log(bpm / 110) / Math.LN2 / 0.9, 2));
      // un pulso verdadero se repite en sus múltiplos (2, 3 y 4 tiempos: el compás) y en su mitad (corcheas);
      // un patrón de rasgueo que se repite cada tiempo y medio, no
      sc[L] = Math.max(0, ac[L] + 0.6 * at(2 * L) + 0.4 * at(3 * L) + 0.5 * at(4 * L) + 0.3 * at(L / 2)) * prior;
      if (sc[L] > best) { best = sc[L]; bestL = L; }
      tot += sc[L]; cnt++;
    }
    // nivel del pulso: se compara con la mitad y el doble, prefiriendo los tempos habituales de alabanza
    var w2 = tempoFromEnvelope.w2, c2 = tempoFromEnvelope.c2;
    if (w2) {
      var pick = bestL, pv = -1;
      [bestL / 2, bestL, bestL * 2].forEach(function (Lc) {
        var Li = Math.round(Lc); if (Li < minLag || Li > maxLag) return;
        var b = 60 * fps / Li, v = sc[Li] / Math.exp(-0.5 * Math.pow(Math.log(b / 110) / Math.LN2 / 0.9, 2)) * Math.exp(-0.5 * Math.pow(Math.log(b / c2) / Math.LN2 / w2, 2));
        if (v > pv) { pv = v; pick = Li; }
      });
      bestL = pick;
    }
    // afinar el máximo con una parábola sobre la autocorrelación
    var y0 = ac[bestL - 1], y1 = ac[bestL], y2 = ac[bestL + 1], den = y0 - 2 * y1 + y2, dl = den < 0 ? 0.5 * (y0 - y2) / den : 0;
    var lag = bestL + Math.max(-0.5, Math.min(0.5, dl));
    return { bpm: 60 * fps / lag, confidence: cnt && tot ? best / (tot / cnt) : 0 };
  }
  tempoFromEnvelope.w2 = 0.6; tempoFromEnvelope.c2 = 105;   // medido: 37 de 48 exactos, el resto casi todo en mitad o doble
  function beatPhase(e, fps, period) {
    var best = 0, bs = -1;
    for (var ph = 0; ph < period; ph += 0.5) {
      var s = 0, c = 0;
      for (var t = ph; t < e.length - 1; t += period) { var i = Math.floor(t), f = t - i; s += e[i] * (1 - f) + e[i + 1] * f; c++; }
      if (c && s / c > bs) { bs = s / c; best = ph; }
    }
    return best / fps;
  }
  function tempoFromSamples(x, sr) {
    var oe = onsetEnvelope(x, sr), r = tempoFromEnvelope(oe.env, oe.fps);
    if (!r) return null;
    var bpm = r.bpm;
    return { bpm: bpm, confidence: r.confidence, phase: beatPhase(oe.env, oe.fps, oe.fps * 60 / bpm) + oe.offset,
             candidates: [bpm / 2, bpm, bpm * 2].filter(function (b) { return b >= 40 && b <= 240; }).map(function (b) { return Math.round(b); }) };
  }

  /* ================= Fase 3: sugerir el recorrido escuchando la canción completa (en prueba) =================
     Los acordes ya se conocen (vienen del cancionero): solo hay que ubicarlos en el tiempo. */
  function chordTemplate(en) {
    var c = parseChord(splitTok(en).core), t = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    if (!c) return t;
    chordIntervals(c.qual).forEach(function (iv) {
      var pc = mod12(c.root + iv), m = mod12(iv), w = iv === 0 ? 1.2 : (m === 10 || m === 11 || m === 9 || iv > 12) ? 0.7 : 1;
      t[pc] = Math.max(t[pc], w);
    });
    if (c.bass !== null) t[c.bass] = Math.max(t[c.bass], 0.8);
    var n = Math.sqrt(t.reduce(function (a, x) { return a + x * x; }, 0)) || 1;
    return t.map(function (x) { return x / n; });
  }
  /* Las notas (0-11) de un acorde, con su bajo si tiene barra. */
  function chordPcs(en) {
    var c = parseChord(splitTok(en).core), out = [];
    if (!c) return out;
    chordIntervals(c.qual).forEach(function (iv) { var pc = mod12(c.root + iv); if (out.indexOf(pc) < 0) out.push(pc); });
    if (c.bass !== null && out.indexOf(c.bass) < 0) out.push(c.bass);
    return out;
  }
  /* ¿Cuánto se parece lo que suena (fuerza por nota, 0-1) a un acorde? Que estén sus notas (cada una con algo de
     fuerza) y que no suene mucho fuera de él. 1: es ese acorde; 0: nada que ver. */
  function chordScore(pcs, chord) {
    if (!chord || !chord.length) return 0;
    var cover = 0, inE = 0, tot = 0, p;
    for (p = 0; p < 12; p++) tot += pcs[p] * pcs[p];
    if (!(tot > 0)) return 0;
    chord.forEach(function (q) { cover += Math.min(1, pcs[q] / 0.25); inE += pcs[q] * pcs[q]; });
    return (cover / chord.length) * (inE / tot);
  }
  /* Lo mismo, mirando las teclas (todas, sin quitar armónicos): una tecla que puede ser armónico de otra más grave que
     suena (la quinta de arriba del bajo, su tercera de dos octavas arriba) no cuenta en contra de ningún acorde; si su
     nota es del acorde, sí cuenta a favor. Así un Do con su bajo no pierde el Sol (que es armónico del bajo). */
  var HARM_IV = { 12: 1, 19: 1, 24: 1, 28: 1, 31: 1, 34: 1, 36: 1 };
  function chordScoreKeys(keys, chord) {
    if (!chord || !chord.length) return 0;
    var ks = Object.keys(keys).map(Number), mx = 0, inPc = {}, inE = 0, outE = 0;
    ks.forEach(function (m) { if (keys[m] > mx) mx = keys[m]; });
    if (!(mx > 0)) return 0;
    ks.forEach(function (m) {
      var v = keys[m] / mx, p = mod12(m);
      if (v < 0.07) return;
      if (chord.indexOf(p) >= 0) { inPc[p] = Math.max(inPc[p] || 0, v); inE += v * v; return; }
      if (ks.some(function (n) { return n < m && HARM_IV[m - n] && keys[n] / mx >= 0.07; })) return;
      outE += v * v;
    });
    var cover = 0; chord.forEach(function (q) { cover += Math.min(1, (inPc[q] || 0) / 0.25); });
    return (cover / chord.length) * (inE / ((inE + outE) || 1));
  }
  function rotT(t, s) { var o = []; for (var i = 0; i < 12; i++) o[mod12(i + s)] = t[i]; return o; }
  function dot12(a, b) { var s = 0; for (var i = 0; i < 12; i++) s += a[i] * b[i]; return s; }
  function hannWin(n) { var w = new Float64Array(n); for (var i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }
  function median(a) { var b = Array.prototype.slice.call(a).sort(function (x, y) { return x - y; }); return b.length ? b[b.length >> 1] : 0; }
  /* Extrae, mientras llega el audio, lo único que hace falta: ataques (100 por segundo) y notas (cromagrama, 20 por segundo).
     No guarda el audio: 5 minutos ocupan unos pocos megas. Pensado para ~11 kHz. */
  function featureStream(sr) {
    var NF = 1 << Math.round(Math.log(sr * 0.046) / Math.LN2), NC = NF * 4, hop = Math.max(1, Math.round(sr / 100));
    var ring = new Float32Array(NC), pos = 0, count = 0, since = 0, frame = 0, level = 0, k;
    var wF = hannWin(NF), wC = hannWin(NC), reF = new Float64Array(NF), imF = new Float64Array(NF), reC = new Float64Array(NC), imC = new Float64Array(NC);
    var k0 = Math.max(1, Math.floor(30 * NF / sr)), k1 = Math.min(NF >> 1, Math.ceil(5000 * NF / sr)), prev = new Float64Array(k1), cmap = [];
    for (k = 1; k < NC >> 1; k++) {
      var f = k * sr / NC; if (f < 100 || f > 2600) continue;
      var midi = 69 + 12 * Math.log(f / 440) / Math.LN2, r = Math.round(midi), w = 1 - Math.min(1, Math.abs(midi - r) * 2);
      if (w > 0) cmap.push([k, mod12(r), w]);
    }
    var raw = [], chroma = [], energy = [];
    function frameNow() {
      var i, e = 0, flux = 0;
      for (i = 0; i < NF; i++) { var v = ring[(pos - NF + i + NC) % NC]; reF[i] = v * wF[i]; imF[i] = 0; e += v * v; }
      e = Math.sqrt(e / NF); level = level ? level * 0.995 + e * 0.005 : Math.max(e, 1e-4);
      var g = 0.1 / Math.max(1e-4, level);
      fftRadix2(reF, imF);
      for (k = k0; k < k1; k++) { var m = Math.log(1 + 100 * g * Math.sqrt(reF[k] * reF[k] + imF[k] * imF[k])), d = m - prev[k]; if (d > 0) flux += d; prev[k] = m; }
      raw.push(raw.length ? flux : 0); energy.push(e);
      if (frame % 5 === 0) {
        for (i = 0; i < NC; i++) { reC[i] = ring[(pos + i) % NC] * wC[i]; imC[i] = 0; }
        fftRadix2(reC, imC);
        var ch = new Float32Array(12), nn = 0;
        for (var q = 0; q < cmap.length; q++) { var c = cmap[q]; ch[c[1]] += Math.sqrt(reC[c[0]] * reC[c[0]] + imC[c[0]] * imC[c[0]]) * c[2]; }
        for (i = 0; i < 12; i++) { ch[i] = Math.sqrt(ch[i]); nn += ch[i] * ch[i]; }
        nn = Math.sqrt(nn) || 1; for (i = 0; i < 12; i++) ch[i] /= nn;
        chroma.push(ch);
      }
      frame++;
    }
    return {
      push: function (x) { for (var i = 0; i < x.length; i++) { ring[pos] = x[i]; pos = (pos + 1) % NC; count++; if (++since >= hop) { since = 0; if (count >= NC) frameNow(); } } },
      seconds: function () { return count / sr; },
      finish: function () {
        var n = raw.length, w2 = Math.round(sr / hop / 2), pre = [0], env = new Float64Array(n), i;
        for (i = 0; i < n; i++) pre.push(pre[i] + raw[i]);
        for (i = 0; i < n; i++) { var lo = Math.max(0, i - w2), hi = Math.min(n, i + w2 + 1); env[i] = Math.max(0, raw[i] - (pre[hi] - pre[lo]) / (hi - lo)); }
        return { env: env, fps: sr / hop, chroma: chroma, energy: energy, tF0: (NC - NF / 2) / sr, tC0: NC / 2 / sr };
      }
    };
  }
  /* Seguimiento de pulsos por programación dinámica: cada pulso cae en un ataque fuerte y a una distancia
     parecida al período del anterior; así sigue a un tempo que se mueve. */
  function beatTrack(env, fps, bpm) {
    var n = env.length, p = fps * 60 / bpm, i, d, sig = Math.max(1, p / 32), rad = Math.ceil(3 * sig), ker = [], ks = 0;
    for (d = -rad; d <= rad; d++) { var kv = Math.exp(-0.5 * d * d / (sig * sig)); ker.push(kv); ks += kv; }
    var o = new Float64Array(n), mean = 0, sd = 0, omax = 0;
    for (i = 0; i < n; i++) { var s = 0; for (d = -rad; d <= rad; d++) { var j = i + d; if (j >= 0 && j < n) s += env[j] * ker[d + rad]; } o[i] = s / ks; mean += o[i] / n; }
    for (i = 0; i < n; i++) sd += (o[i] - mean) * (o[i] - mean) / n;
    sd = Math.sqrt(sd) || 1; for (i = 0; i < n; i++) { o[i] /= sd; omax = Math.max(omax, o[i]); }
    var lo = Math.max(1, Math.round(p / 2)), hi = Math.round(2 * p), C = new Float64Array(n), P = new Int32Array(n), pen = [], first = true;
    for (d = lo; d <= hi; d++) pen[d] = -100 * Math.pow(Math.log(d / p), 2);
    for (i = 0; i < n; i++) {
      var best = -Infinity, arg = -1;
      for (d = lo; d <= hi && i - d >= 0; d++) { var v = C[i - d] + pen[d]; if (v > best) { best = v; arg = i - d; } }
      C[i] = o[i] + (arg >= 0 ? best : 0);
      if (first && o[i] < 0.01 * omax) P[i] = -1; else { P[i] = arg; first = false; }
    }
    var last = n - 1, bv = -Infinity;
    for (i = Math.max(0, n - Math.round(p)); i < n; i++) if (C[i] > bv) { bv = C[i]; last = i; }
    var beats = [];
    for (i = last; i >= 0; i = P[i]) { beats.push(i); if (P[i] < 0) break; }
    return beats.reverse();
  }
  /* Notas promedio de cada pulso. */
  function beatFeatures(feat, beats) {
    var fps = feat.fps, X = [], E = [], times = beats.map(function (b) { return feat.tF0 + b / fps; }), nC = feat.chroma.length;
    for (var i = 0; i + 1 < beats.length; i++) {
      var t0 = times[i], t1 = times[i + 1], v = new Float64Array(12), q;
      var m0 = Math.max(0, Math.ceil((t0 - feat.tC0) * fps / 5)), m1 = Math.min(nC - 1, Math.floor((t1 - feat.tC0) * fps / 5));
      if (m1 < m0) m0 = m1 = Math.max(0, Math.min(nC - 1, Math.round(((t0 + t1) / 2 - feat.tC0) * fps / 5)));
      for (var m = m0; m <= m1; m++) for (q = 0; q < 12; q++) v[q] += feat.chroma[m][q];
      var nn = 0; for (q = 0; q < 12; q++) nn += v[q] * v[q]; nn = Math.sqrt(nn) || 1; for (q = 0; q < 12; q++) v[q] /= nn;
      var e = 0, ec = 0; for (var fr = beats[i]; fr < beats[i + 1]; fr++) { e += feat.energy[fr] || 0; ec++; }
      X.push(v); E.push(ec ? e / ec : 0);
    }
    return { X: X, E: E, times: times };
  }
  /* Alineación pulso a pulso (Viterbi): en cada pulso la canción está en uno de sus acordes (en orden),
     antes de empezar o después de terminar. Cambiar de acorde cuesta un poco y conviene al inicio del compás;
     volver al inicio de una sección (repetición) cuesta más. Se prueban las posibles posiciones del tiempo 1. */
  function alignSteps(X, E, T, targets, bpb) {
    var B = X.length, K = T.length, R = 8, NS = (K + 2) * R, W = 6, medE = median(E), em = [], b, k, si;
    for (b = 0; b < B; b++) {
      var row = new Float64Array(K + 2), silent = E[b] < 0.3 * medE;
      for (k = 0; k < K; k++) { var sv = dot12(X[b], T[k]); row[k + 1] = W * (silent ? Math.min(sv, 0.5) : sv); }
      row[0] = row[K + 1] = W * (silent ? 0.7 : 0.45);
      em.push(row);
    }
    var tset = targets.map(function (t) { return t + 1; }), bestAll = null;
    var durPen = function (r) { return r === 1 ? -2 : (r === 2 || r === 4 || r === 8) ? 0.2 : (r % 2 ? -0.4 : 0); };
    for (var ph = 0; ph < bpb; ph++) {
      var posB = function (x) { var m = ((x - ph) % bpb + bpb) % bpb; return m === 0 ? 1.2 : ((bpb === 4 && m === 2) || (bpb === 6 && m === 3)) ? 0.2 : -0.6; };
      var cur = new Float64Array(NS).fill(-Infinity), back = [];
      cur[0] = em[0][0]; cur[R] = em[0][1] - 0.5;
      for (b = 0; b + 1 < B; b++) {
        var nxt = new Float64Array(NS).fill(-Infinity), bk = new Int32Array(NS).fill(-1), pb = posB(b + 1), down = pb > 1, jBest = -Infinity, jArg = -1;
        for (si = 0; si < NS; si++) {
          var v = cur[si]; if (v === -Infinity) continue;
          var kk = Math.floor(si / R), r = si % R;
          var ns = kk * R + Math.min(r + 1, R - 1); if (v > nxt[ns]) { nxt[ns] = v; bk[ns] = si; }
          if (kk === K + 1) continue;
          var dp = kk === 0 ? 0 : durPen(r + 1), na = (kk + 1) * R, va = v - 1 + pb + dp;   // el silencio inicial puede durar lo que sea
          if (va > nxt[na]) { nxt[na] = va; bk[na] = si; }
          if (kk >= 1 && down && v + dp > jBest) { jBest = v + dp; jArg = si; }
        }
        if (jArg >= 0) {
          var jk = Math.floor(jArg / R);
          for (var q = 0; q < tset.length; q++) { var t = tset[q]; if (t === jk || t === jk + 1) continue; var vj = jBest - 4 + pb; if (vj > nxt[t * R]) { nxt[t * R] = vj; bk[t * R] = jArg; } }
          var ve = jBest - 3; if (ve > nxt[(K + 1) * R]) { nxt[(K + 1) * R] = ve; bk[(K + 1) * R] = jArg; }
        }
        for (si = 0; si < NS; si++) if (nxt[si] > -Infinity) nxt[si] += em[b + 1][Math.floor(si / R)];
        back.push(bk); cur = nxt;
      }
      var fb = -Infinity, fs = -1; for (si = 0; si < NS; si++) if (cur[si] > fb) { fb = cur[si]; fs = si; }
      if (!bestAll || fb > bestAll.score) bestAll = { score: fb, last: fs, back: back, ph: ph };
    }
    var path = new Int32Array(B), s2 = bestAll.last;
    for (b = B - 1; b >= 0; b--) { path[b] = Math.floor(s2 / R); if (b > 0) s2 = bestAll.back[b - 1][s2]; }
    return { path: path, phase: bestAll.ph, score: bestAll.score };
  }
  function suggestTimeline(feat, chords, targets, bpb, bpmHint) {
    var tr = tempoFromEnvelope(feat.env, feat.fps), bpm0 = bpmHint || (tr && tr.bpm) || 100;
    var beats = beatTrack(feat.env, feat.fps, bpm0);
    if (beats.length < 12) return null;
    var bf = beatFeatures(feat, beats), T = chords.map(chordTemplate), medE = median(bf.E);
    // tono de la grabación: las 3 transposiciones más probables, y se queda la que mejor alinea
    var uniq = [], seen = {};
    T.forEach(function (t) { var key = t.map(function (x) { return x.toFixed(3); }).join(); if (!seen[key]) { seen[key] = 1; uniq.push(t); } });
    var prox = [];
    for (var s = 0; s < 12; s++) {
      var Ts = uniq.map(function (t) { return rotT(t, s); }), v = 0;
      for (var b = 0; b < bf.X.length; b++) { if (bf.E[b] < 0.3 * medE) continue; var m = 0; for (var k = 0; k < Ts.length; k++) m = Math.max(m, dot12(bf.X[b], Ts[k])); v += m; }
      prox.push([s, v]);
    }
    prox.sort(function (a, c) { return c[1] - a[1]; });
    var best = null;
    prox.slice(0, 3).forEach(function (pr) {
      var TT = T.map(function (t) { return rotT(t, pr[0]); }), a = alignSteps(bf.X, bf.E, TT, targets, bpb);
      if (!best || a.score > best.score) { best = a; best.shift = pr[0]; best.TT = TT; }
    });
    var steps = [], doubt = [], path = best.path, K = chords.length, TT2 = best.TT, firstB = -1, lastB = -1, prevT = null, simSum = 0, simN = 0;
    for (b = 0; b < path.length;) {
      var kk = path[b], e = b;
      while (e + 1 < path.length && path[e + 1] === kk) e++;
      if (kk >= 1 && kk <= K) {
        var sk = kk - 1, mg = 0;
        for (var x = b; x <= e; x++) {
          var own = dot12(bf.X[x], TT2[sk]), alt = 0; simSum += own; simN++;
          for (var j = 0; j < K; j++) if (dot12(TT2[j], TT2[sk]) < 0.999) alt = Math.max(alt, dot12(bf.X[x], TT2[j]));
          mg += (own - alt) / (e - b + 1);
        }
        if (mg < 0.04 || (prevT && dot12(prevT, TT2[sk]) > 0.999)) doubt.push(steps.length);
        steps.push([sk, e - b + 1, Math.round(bf.times[b] * 100) / 100]);
        prevT = TT2[sk];
        if (firstB < 0) firstB = b; lastB = e + 1;
      }
      b = e + 1;
    }
    if (!steps.length) return null;
    var iv = [];
    for (b = Math.max(1, firstB); b <= Math.min(lastB, bf.times.length - 1); b++) iv.push(bf.times[b] - bf.times[b - 1]);
    var bpm = iv.length ? 60 / median(iv) : bpm0;
    return { bpm: Math.round(bpm * 10) / 10, beats: bpb, shift: best.shift, steps: steps, doubt: doubt, phase: best.phase, beatTimes: bf.times,
             match: simN ? simSum / simN : 0 };   // parecido promedio entre el audio y los acordes: bajo = quizá no es esta canción
  }

  /* ---------- Modo fácil: acordes simples numerados (Do = 1, Re = 2 … Si = 7) ---------- */
  var EZ_NUMS = ['1', '1#', '2', '2#', '3', '4', '4#', '5', '5#', '6', '6#', '7'];
  function simpleChord(core) {
    var c = parseChord(splitTok(core).core); if (!c) return null;
    var q = c.qual || '', suf = /dim|°|m7b5|ø/.test(q) ? 'dim' : /aug|\+/.test(q) ? 'aug' : /^(m(?!aj)|min)/.test(q) ? 'm' : '';
    return { root: c.root, suf: suf };
  }
  function numLabel(root, suf) { return EZ_NUMS[mod12(root)] + (suf === 'm' ? 'm' : suf === 'dim' ? '°' : suf === 'aug' ? '+' : ''); }

  /* ---------- Videos de YouTube y reloj ---------- */
  function ytId(u) {
    u = String(u || '').trim();
    var m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/.exec(u);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(u) ? u : '';
  }
  function parseClock(s) {
    s = String(s == null ? '' : s).trim().toLowerCase();
    if (!s) return null;
    var hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/.exec(s);
    if (hms && (hms[1] || hms[2] || hms[3])) return (+hms[1] || 0) * 3600 + (+hms[2] || 0) * 60 + (+hms[3] || 0);
    var parts = s.split(':');
    if (parts.length > 3 || parts.some(function (x) { return !/^\d+(\.\d+)?$/.test(x); })) return null;
    return parts.reduce(function (a, x) { return a * 60 + (+x); }, 0);
  }
  function ytStart(u) {
    var m = /[?&#](?:t|start)=([0-9hms:.]+)/.exec(String(u || ''));
    return m ? (parseClock(m[1]) || 0) : 0;
  }
  function fmtClock(t) {
    t = Math.max(0, Math.round(t || 0));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
  }

  /* ---------- Seguidor de la banda («Escuchando») ----------
     Sabe en qué acorde va la canción como lo haría una persona: sabe cuánto dura cada acorde (los compases),
     escucha si ya cambió, y si la banda se salta uno o dos acordes o vuelve a empezar una parte, se da cuenta.
     Modelo: cada acorde del recorrido es un estado con su tiempo transcurrido (semi-Markov). En cada cuadro:
     el tiempo avanza, la probabilidad de cambiar crece al acercarse a lo que dura el acorde, y lo que suena
     (el cromagrama) confirma o corrige. El silencio congela el tiempo (una pausa no adelanta la canción). */
  function erfA(x) {                                   // aproximación de la función de error (Abramowitz-Stegun 7.1.26)
    var s = x < 0 ? -1 : 1; x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  function followerCreate(o) {
    var N = o.tpls.length, dt = o.dt || 0.05, bpm0 = o.bpm || 90, bpm = bpm0, loose = !!o.loose;
    var kappa = o.kappa || 3, floorW = o.floor != null ? o.floor : 0.2, emaK = o.ema != null ? o.ema : 0.5;
    var jumpHold = o.jumpHold || 6, jumpMass = o.jumpMass || 0.7, pSkip = o.pSkip != null ? o.pSkip : 1;
    if (o.clear0 == null) o.clear0 = 0.62;
    var beats = o.beats.map(function (b) { return Math.max(0.5, b || 4); });
    var parts = (o.parts || []).filter(function (s) { return s >= 0 && s < N; });
    var same = [], i;
    for (i = 0; i < N; i++) { same[i] = i + 1 < N && dot12(o.tpls[i], o.tpls[i + 1]) > 0.995; }
    var cap = [], P = [], Q = [], H = [];
    for (i = 0; i < N; i++) {
      cap[i] = Math.min(900, Math.ceil(2.4 * beats[i] * 60 / (0.6 * bpm0) / dt) + 8);
      P[i] = new Float64Array(cap[i] + 1); Q[i] = new Float64Array(cap[i] + 1); H[i] = new Float64Array(cap[i] + 1);
    }
    // a dónde se va al dejar cada acorde: al siguiente casi siempre; a veces se salta uno o dos.
    // Volver a empezar una parte (el coro otra vez) o pasar a otra solo ocurre al terminar una línea, como en la música real.
    var partSet = {}; parts.forEach(function (s) { partSet[s] = 1; });
    var targets = [];
    for (i = 0; i < N; i++) {
      var t = [], add = function (j, w) { if (j < 0 || j >= N || j === i || !(w > 0)) return; for (var q = 0; q < t.length; q++) if (t[q][0] === j) { t[q][1] += w; return; } t.push([j, w]); };
      var lineEnd = i + 1 >= N || partSet[i + 1];
      if (i + 1 < N) add(i + 1, 1);
      add(i + 2, (lineEnd ? 0.02 : 0.035) * pSkip); add(i + 3, 0.01 * pSkip);
      if (lineEnd) {
        var own = -1; parts.forEach(function (s) { if (s <= i) own = Math.max(own, s); });
        var others = parts.filter(function (s) { return s !== own && s !== i + 1; });
        if (own >= 0) add(own, (i + 1 < N ? 0.06 : 0.3) * pSkip);                                // repetir la línea o parte
        others.forEach(function (s) { add(s, (i + 1 < N ? 0.03 : 0.08) * pSkip / Math.max(1, others.length)); });
      }
      var tot = t.reduce(function (a, x) { return a + x[1]; }, 0) || 1;
      targets[i] = t.map(function (x) { return [x[0], x[1] / tot]; });
    }
    function hazards() {
      for (var i2 = 0; i2 < N; i2++) {
        var spb = 60 / bpm / dt, mu = beats[i2] * spb, sd = (loose ? 0.45 : 0.13) * mu + 0.3 * spb, h = H[i2];
        for (var e = 0; e <= cap[i2]; e++) {
          var c0 = 0.5 * (1 + erfA((e - mu) / (sd * Math.SQRT2))), c1 = 0.5 * (1 + erfA((e + 1 - mu) / (sd * Math.SQRT2)));
          var surv = 1 - c0;
          h[e] = surv > 1e-9 ? Math.min(0.5, (c1 - c0) / surv) : 0.5;
          if (i2 === N - 1) h[e] = Math.min(h[e], 0.01);          // al final, se queda (salvo que vuelvan a una parte)
        }
      }
    }
    hazards();
    var st = { shown: 0, best: 0, hold: 0, enteredAt: 0, frame: 0, conf: 1, bpm: bpm, lastOnset: -99, ema: null };
    function reset(i0) {
      for (var a = 0; a < N; a++) P[a].fill(0);
      i0 = Math.max(0, Math.min(N - 1, i0 || 0));
      P[i0][0] = 1; st.shown = st.best = i0; st.hold = 0; st.enteredAt = st.frame; st.conf = 1;
    }
    reset(o.i0 || 0);
    function mass(z) { var s = 0; for (var e = 0; e < z.length; e++) s += z[e]; return s; }
    /* f: { ch: cromagrama normalizado | null, silent: bool, onset: bool }
       o, con el oído nuevo (tecla por tecla): { scores: [0-1 por acorde del recorrido], tonal: bool, silent, onset }.
       Con scores el seguidor ESPERA: el tiempo solo corre si lo que suena es el acorde actual o uno de los que pueden
       venir (el siguiente, uno o dos más allá, el comienzo de una parte). Una tecla equivocada, otro acorde o ruido:
       la canción no avanza (antes avanzaba sola con el tiempo). */
    var GATE = o.gate || 0.42, sema = null;
    if (o.waitFreeze == null) o.waitFreeze = true;
    function step(f) {
      st.frame++;
      if (f.silent) { st.ema = null; sema = null; st.why = 'silencio'; return out(false); }             // silencio: el tiempo no corre
      if (f.scores) return stepScores(f);
      if (f.onset) st.lastOnset = st.frame;
      var strum = st.frame - st.lastOnset <= 2, hm = strum ? 2.2 : 0.8, a2, e2;
      var leave = new Float64Array(N);
      for (a2 = 0; a2 < N; a2++) {
        var p = P[a2], q = Q[a2], h = H[a2], cp = cap[a2], lv = 0; q.fill(0);
        for (e2 = 0; e2 <= cp; e2++) {
          var v = p[e2]; if (v < 1e-12) continue;
          var hz = Math.min(0.6, h[e2] * hm), go = v * hz;
          lv += go; q[e2 < cp ? e2 + 1 : cp] += v - go;
        }
        leave[a2] = lv;
      }
      for (a2 = 0; a2 < N; a2++) if (leave[a2] > 0) targets[a2].forEach(function (t) { Q[t[0]][0] += leave[a2] * t[1]; });
      // lo que suena, suavizado (un rasgueo dura varios cuadros: no se cuenta la misma prueba muchas veces)
      var ch = f.ch;
      if (ch) {
        if (!st.ema || f.onset && emaK === 0) st.ema = ch.slice();
        else { var n2 = 0; for (var k = 0; k < 12; k++) { st.ema[k] = st.ema[k] * emaK + ch[k] * (1 - emaK); n2 += st.ema[k] * st.ema[k]; } n2 = Math.sqrt(n2) || 1; for (k = 0; k < 12; k++) st.ema[k] /= n2; }
        var sc = [], mx = -1, x = st.ema;
        for (a2 = 0; a2 < N; a2++) { sc[a2] = dot12(x, o.tpls[a2]); if (sc[a2] > mx) mx = sc[a2]; }
        var kap = kappa * Math.max(0, Math.min(1, (mx - o.clear0) / 0.25));             // un sonido poco claro dice poco
        for (a2 = 0; a2 < N; a2++) {
          var w = Math.max(floorW, Math.exp(kap * (sc[a2] - mx)) ), qq = Q[a2];
          if (w !== 1) for (e2 = 0; e2 < qq.length; e2++) qq[e2] *= w;
        }
      }
      var tot = 0; for (a2 = 0; a2 < N; a2++) tot += mass(Q[a2]);
      if (!(tot > 1e-300)) { reset(st.shown); return out(false); }
      for (a2 = 0; a2 < N; a2++) { var z = Q[a2], pp = P[a2]; for (e2 = 0; e2 < z.length; e2++) pp[e2] = z[e2] / tot; }
      return out(true);
    }
    function stepScores(f) {
      if (!f.tonal) { st.why = 'ruido'; return out(false); }
      // puntajes suavizados (un rasgueo dura varios cuadros)
      var sc = f.scores, a2, e2, k;
      if (!sema || f.onset) sema = sc.slice(); else for (k = 0; k < N; k++) sema[k] = sema[k] * 0.4 + (sc[k] || 0) * 0.6;
      var sCur = sema[st.shown] || 0, sT = 0, tj = -1;
      targets[st.shown].forEach(function (t) { if ((sema[t[0]] || 0) > sT) { sT = sema[t[0]]; tj = t[0]; } });
      st.heardCur = sCur; st.heardNext = sT; st.heardNextI = tj;
      if (sCur < GATE && sT < GATE) { st.why = 'otro'; return out(false); }       // no es lo que va: espera
      st.why = sCur >= sT ? 'actual' : 'siguiente';
      if (f.onset) st.lastOnset = st.frame;
      // si suena claramente el acorde actual y nada del siguiente, la banda se está quedando: el tiempo casi no empuja
      // (si el siguiente es el mismo acorde, solo el tiempo puede decir cuándo cambia)
      var s1 = st.shown + 1 < N ? (sema[st.shown + 1] || 0) : 0, holding = !same[st.shown] && sCur >= GATE && sCur > s1 + 0.2;
      // un cambio de acorde llega con un golpe (tecla o rasgueo): sin golpe reciente, lo que «suena a otro acorde» es
      // la cola del anterior con algo encima (una voz, un golpe en la mesa) y no se avanza por eso
      var fresh = st.frame - st.lastOnset <= 12;
      var strum = st.frame - st.lastOnset <= 2, hm = (strum ? 2.2 : 0.8) * (holding || (st.why === 'siguiente' && !fresh) ? 0.05 : 1);
      var leave = new Float64Array(N);
      for (a2 = 0; a2 < N; a2++) {
        var p = P[a2], q = Q[a2], h = H[a2], cp = cap[a2], lv = 0; q.fill(0);
        for (e2 = 0; e2 <= cp; e2++) {
          var v = p[e2]; if (v < 1e-12) continue;
          var hz = Math.min(0.6, h[e2] * hm), go = v * hz;
          lv += go; q[e2 < cp ? e2 + 1 : cp] += v - go;
        }
        leave[a2] = lv;
      }
      for (a2 = 0; a2 < N; a2++) if (leave[a2] > 0) targets[a2].forEach(function (t) { Q[t[0]][0] += leave[a2] * t[1]; });
      // lo que suena manda: el acorde que más se parece pesa más (y uno que no suena casi nada)
      var mx = 0; for (a2 = 0; a2 < N; a2++) if (sema[a2] > mx) mx = sema[a2];
      var kap = 6 * Math.max(0, Math.min(1, (mx - 0.3) / 0.4));
      for (a2 = 0; a2 < N; a2++) {
        var w = Math.max(0.05, Math.exp(kap * ((sema[a2] || 0) - mx))), qq = Q[a2];
        if (w !== 1) for (e2 = 0; e2 < qq.length; e2++) qq[e2] *= w;
      }
      var tot = 0; for (a2 = 0; a2 < N; a2++) tot += mass(Q[a2]);
      if (!(tot > 1e-300)) { reset(st.shown); return out(false); }
      for (a2 = 0; a2 < N; a2++) { var z = Q[a2], pp = P[a2]; for (e2 = 0; e2 < z.length; e2++) pp[e2] = z[e2] / tot; }
      return out(true);
    }
    function out(moved) {
      var best = 0, bm = -1, ms = [];
      for (var a = 0; a < N; a++) { ms[a] = mass(P[a]); if (ms[a] > bm) { bm = ms[a]; best = a; } }
      var changed = false;
      // mientras espera (silencio, ruido, otra cosa) no se cambia de acorde: la cuenta de cuadros también espera
      if (!moved && o.waitFreeze) { /* nada */ }
      else if (best !== st.shown) {
        st.hold = best === st.best ? st.hold + 1 : 1;
        var seq = best === st.shown + 1;
        // avanzar al siguiente pide poca espera; un salto (atrás o de más de uno) pide más seguridad y medio segundo
        if (seq ? ((bm > 0.55 && st.hold >= 2) || bm > 0.85) : (bm > jumpMass && st.hold >= jumpHold)) {
          var from = st.shown, spent = st.frame - st.enteredAt;
          // la banda llegó antes o después de lo previsto: el tempo se ajusta con suavidad (solo con un cambio que se oye)
          if (seq && !same[from] && spent > 0) {
            var r = spent / (beats[from] * 60 / bpm / dt);
            if (r > 0.55 && r < 1.8) {
              bpm = Math.max(0.7 * bpm0, Math.min(1.35 * bpm0, bpm / (1 + 0.3 * (r - 1))));
              if (Math.abs(bpm - st.bpm) / st.bpm > 0.015) { st.bpm = bpm; hazards(); }
            }
          }
          st.shown = best; st.enteredAt = st.frame; st.hold = 0; changed = true;
        }
      } else st.hold = 0;
      st.best = best; st.conf = ms[st.shown];
      var p = P[st.shown], m = 0, se = 0;
      for (var e = 0; e < p.length; e++) { m += p[e]; se += e * p[e]; }
      var inBeats = m > 0 ? (se / m) * dt * bpm / 60 : 0;
      return { i: st.shown, best: best, conf: st.conf, beat: Math.min(beats[st.shown] - 0.05, inBeats), bpm: bpm, changed: changed, moved: moved,
        why: st.why, cur: st.heardCur, next: st.heardNext, nextI: st.heardNextI };
    }
    return {
      step: step,
      targets: function (i2) { return (targets[i2] || []).map(function (t) { return t[0]; }); },
      jump: function (i2) { st.enteredAt = st.frame; reset(i2); },
      state: function () { return { i: st.shown, conf: st.conf, bpm: bpm }; },
      setBpm: function (b) { if (b > 20) { bpm = b; st.bpm = b; hazards(); } }
    };
  }


  /* ---------- oír el piano de casa por el micrófono (sin cable) ----------
     No reconoce cualquier sonido: tras cada golpe de tecla mira qué apareció de nuevo, descuenta lo que ya sonaba
     (la nota anterior que todavía suena) y lo compara con la nota o el acorde que tocaba y con las demás notas.
     Entrada por cuadro: energía por nota (12 valores), nivel máximo en dB y la hora en ms. */
  /* Molde de una o varias notas de piano tal como las oye el celular: con sus armónicos dentro de 100-2600 Hz
     (los graves casi sin la fundamental). reg: la nota más grave de la zona donde toca el alumno. */
  function pianoTpl(pcs, reg) {
    var t = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    pcs.forEach(function (p) {
      var m = reg != null ? reg + mod12(p - reg) : 60 + mod12(p), f0 = 440 * Math.pow(2, (m - 69) / 12);
      for (var h = 1; h <= 16; h++) {
        var f = h * f0; if (f < 100) continue; if (f > 2600) break;
        t[mod12(m + Math.round(12 * Math.log(h) / Math.LN2))] += (f0 < 150 && h === 1 ? 0.35 : 1) / h;
      }
    });
    t = t.map(Math.sqrt);
    var n = Math.sqrt(dot12(t, t)) || 1;
    return t.map(function (x) { return x / n; });
  }
  /* ---------- qué teclas suenan ----------
     El cromagrama dobla todo a 12 notas y por eso un Do solo se parece a Do-Mi-Sol (sus armónicos tienen Mi y Sol).
     Aquí el sonido se mira tecla por tecla, sin doblar: un espectro en tercios de semitono (100 Hz a 2,7 kHz) y un
     molde por tecla con sus armónicos tal como los deja la ventana de Blackman del analizador de Chrome. Con NNLS se
     calcula cuánto de cada tecla explica lo que suena. Así un Do4 solo no tiene nada en Mi4 ni en Sol4.
     Oído 3 (oct 2026), probado con grabaciones reales de pianos por parlantes de laptop, bluetooth y equipo de sonido:
     - el piano puede estar desafinado (los de casa casi siempre lo están un poco): el oído mide cuánto y corre los moldes;
     - moldes de «ruido» (jorobas anchas) se llevan el roce de las teclas del KeyLab, los golpes y el ruido de la sala,
       que antes se confundían con teclas;
     - un parlante estéreo o la sala apagan algunas frecuencias: una nota del acorde puede quedar débil; por eso basta
       que se oiga un poco (7 % de la más fuerte), siempre que se oiga en dos cuadros seguidos. */
  var SP_LO = 43.5, SP_STEP = 1 / 3, SP_N = 172, SP_M0 = 28, SP_M1 = 96, SP_NOISE = 8, spLayouts = {};
  function sincP(x) { return Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x); }
  function bmLobe(d) { d = Math.abs(d); return d >= 3.5 ? 0 : Math.abs(0.42 * sincP(d) + 0.25 * (sincP(d - 1) + sincP(d + 1)) + 0.04 * (sincP(d - 2) + sincP(d + 2))) / 0.42; }
  /* tune: cuántos centésimos de semitono está corrido el piano (+ más alto, − más bajo). Los tercios de semitono y los
     moldes se corren lo mismo, así un piano desafinado se mira igual que uno afinado. */
  function spLayout(sr, nfft, tune) {
    tune = Math.max(-50, Math.min(50, Math.round(tune || 0)));
    var key = sr + '/' + nfft + '/' + tune; if (spLayouts[key]) return spLayouts[key];
    var hz = sr / nfft, c = new Float64Array(SP_N), a = new Int32Array(SP_N), z = new Int32Array(SP_N), kmax = 0;
    for (var b = 0; b < SP_N; b++) {
      var f = 440 * Math.pow(2, (SP_LO + b * SP_STEP - 69 + tune / 100) / 12);
      c[b] = f / hz; a[b] = Math.ceil(f * Math.pow(2, -SP_STEP / 24) / hz); z[b] = Math.floor(f * Math.pow(2, SP_STEP / 24) / hz);
      if (z[b] + 2 > kmax) kmax = z[b] + 2;
    }
    return (spLayouts[key] = { hz: hz, c: c, a: a, z: z, kmax: kmax, tune: tune, atoms: {}, grams: {} });
  }
  /* magnitud lineal por bin de la FFT -> por tercio de semitono (lo más alto dentro del tercio, o interpolado al centro) */
  function spPool(L, mag) {
    var out = new Float64Array(SP_N);
    for (var b = 0; b < SP_N; b++) {
      var k0 = Math.floor(L.c[b]), fr = L.c[b] - k0, v = (mag[k0] || 0) * (1 - fr) + (mag[k0 + 1] || 0) * fr;
      for (var k = L.a[b]; k <= L.z[b]; k++) if (mag[k] > v) v = mag[k];
      out[b] = v;
    }
    return out;
  }
  function spDot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  /* Molde de una tecla: armónicos que bajan de a poco, un poco desafinados hacia arriba (como el piano), la
     fundamental débil en los graves y el micrófono del celular que casi no oye debajo de 150 Hz. */
  function spAtom(L, m) {
    if (L.atoms[m]) return L.atoms[m];
    var f0 = 440 * Math.pow(2, (m - 69) / 12 + L.tune / 1200), B = 0.0002 * Math.pow(2, (m - 48) / 18), mag = new Float64Array(L.kmax + 2), top = L.c[SP_N - 1] * L.hz * 1.03;
    for (var h = 1; h <= 30; h++) {
      var f = h * f0 * Math.sqrt(1 + B * h * h); if (f > top) break;
      var amp = Math.pow(h, -0.9) * (f0 < 150 && h === 1 ? 0.35 : 1) * (f / Math.sqrt(f * f + 22500)), kc = f / L.hz;
      for (var k = Math.max(0, Math.ceil(kc - 3.5)); k <= Math.min(L.kmax + 1, Math.floor(kc + 3.5)); k++) mag[k] += amp * bmLobe(k - kc);
    }
    var v = spPool(L, mag), n = Math.sqrt(spDot(v, v)) || 1;
    for (var b = 0; b < SP_N; b++) v[b] /= n;
    return (L.atoms[m] = v);
  }
  /* Moldes de ruido: jorobas anchas. Se llevan lo que no tiene forma de tecla (el roce de las teclas, un golpe, un
     ventilador) para que no aparezcan teclas que nadie tocó. */
  function spNoiseAtoms(L) {
    if (L.noiseA) return L.noiseA;
    var out = [], span = SP_N / SP_NOISE;
    for (var j = 0; j < SP_NOISE; j++) {
      var c = (j + 0.5) * span, v = new Float64Array(SP_N), n = 0, b;
      for (b = 0; b < SP_N; b++) { v[b] = Math.exp(-0.5 * Math.pow((b - c) / (0.6 * span), 2)); n += v[b] * v[b]; }
      n = Math.sqrt(n); for (b = 0; b < SP_N; b++) v[b] /= n;
      out.push(v);
    }
    return (L.noiseA = out);
  }
  function spGram(L, lo, hi) {
    var key = lo + ':' + hi; if (L.grams[key]) return L.grams[key];
    var A = [], G = [], i, j; for (var m = lo; m <= hi; m++) A.push(spAtom(L, m));
    var nk = A.length; A = A.concat(spNoiseAtoms(L));
    for (i = 0; i < A.length; i++) G.push(new Float64Array(A.length));
    for (i = 0; i < A.length; i++) for (j = i; j < A.length; j++) G[i][j] = G[j][i] = spDot(A[i], A[j]);
    return (L.grams[key] = { lo: lo, nk: nk, A: A, G: G });
  }
  /* NNLS por actualizaciones multiplicativas (con ~50 moldes converge bien en 150 vueltas) */
  function spNnls(W, y, iters) {
    var K = W.A.length, b = new Float64Array(K), x = new Float64Array(K), i, j;
    for (i = 0; i < K; i++) { b[i] = spDot(W.A[i], y); x[i] = Math.max(1e-12, b[i] * 0.3); }
    for (var it = 0; it < (iters || 150); it++) for (i = 0; i < K; i++) { var d = 1e-30, Gi = W.G[i]; for (j = 0; j < K; j++) d += Gi[j] * x[j]; x[i] *= b[i] / d; }
    return x;
  }
  /* Teclas que suenan en un espectro ya limpio (sin ruido de fondo): {midi: fuerza relativa a la más fuerte}.
     err: qué parte del sonido no se explica con teclas ni ruido (una voz que sube y baja); key: qué parte son teclas. */
  function spFit(L, y, lo, hi) {
    var W = spGram(L, Math.max(SP_M0, lo), Math.min(SP_M1, hi)), x = spNnls(W, y), mx = 0, out = {}, i, b, nk = W.nk;
    for (i = 0; i < nk; i++) if (x[i] > mx) mx = x[i];
    if (mx > 0) for (i = 0; i < nk; i++) if (x[i] > 0.03 * mx) out[W.lo + i] = x[i] / mx;
    var r = new Float64Array(SP_N), rk = new Float64Array(SP_N), yy = 0, e = 0, kk = 0;
    for (i = 0; i < W.A.length; i++) if (x[i] > 0) { var a = W.A[i]; for (b = 0; b < SP_N; b++) { r[b] += x[i] * a[b]; if (i < nk) rk[b] += x[i] * a[b]; } }
    for (b = 0; b < SP_N; b++) { var d = y[b] - r[b]; e += d * d; yy += y[b] * y[b]; kk += rk[b] * rk[b]; }
    return { notes: out, err: yy > 0 ? e / yy : 1, key: yy > 0 ? kk / yy : 0, top: mx };
  }
  function spNotes(L, y, lo, hi) { return spFit(L, y, lo, hi).notes; }
  /* ---------- afinación del piano ----------
     Cada pico del espectro (un armónico) cae cerca de una tecla; cuánto se aparta (en centésimos) dice si el piano
     está alto o bajo. Se promedia en círculo (−50 y +50 son lo mismo) y con memoria corta, así se ajusta a cada piano. */
  /* Picos del espectro entre 200 Hz y 2 kHz, 20 dB sobre la mediana: [{c: centésimos desde La 440, db, s: dB sobre la mediana}] */
  var pkTmp = [];
  function spPeaks(db, hz) {
    var k0 = Math.ceil(200 / hz), k1 = Math.min(db.length - 3, Math.floor(2000 / hz)), k, ref, out = [];
    if (k1 - k0 < 20) return out;
    pkTmp.length = 0; for (k = k0; k <= k1; k++) pkTmp.push(db[k]);
    pkTmp.sort(function (x, y) { return x - y; }); ref = pkTmp[pkTmp.length >> 1];
    for (k = k0; k <= k1; k++) {
      var b = db[k]; if (!(b > ref + 20 && b > db[k - 1] && b >= db[k + 1] && b > db[k - 2] && b >= db[k + 2])) continue;
      var a = db[k - 1], c = db[k + 1], den = a - 2 * b + c; if (!(den < 0)) continue;
      var d = 0.5 * (a - c) / den; if (!(Math.abs(d) <= 0.6)) continue;
      out.push({ c: 1200 * Math.log((k + d) * hz / 440) / Math.LN2, db: b, s: b - ref, k: k + d });
    }
    out.sort(function (x, y) { return y.db - x.db; });
    return out;
  }
  /* ¿Cuánto se movió el tono? Mediana de cuánto cambió cada pico fuerte respecto del cuadro anterior (centésimos).
     Un piano queda quieto (0-2); una voz sube, baja y tiembla (5-30). -1 si hay muy pocos picos para saber. */
  function spDrift(pk, prev) {
    if (!prev) return -1;
    var ds = [];
    pk.slice(0, 8).forEach(function (p) { var best = 99; prev.slice(0, 10).forEach(function (q) { var d = Math.abs(p.c - q.c); if (d < best) best = d; }); if (best < 40) ds.push(best); });
    if (ds.length < 3) return -1;
    ds.sort(function (a, b) { return a - b; });
    return ds[ds.length >> 1];
  }
  function tuneCreate(t0, w0) {
    var Z = { re: 0, im: 0, w: 0 };
    if (w0) { var a0 = 2 * Math.PI * t0 / 100; Z.re = w0 * Math.cos(a0); Z.im = w0 * Math.sin(a0); Z.w = w0; }
    return {
      add: function (pk) {
        pk.forEach(function (p) {
          if (p.c < 1200 * Math.log(250 / 440) / Math.LN2) return;
          var dev = p.c - 100 * Math.round(p.c / 100), w = Math.pow(10, p.s / 40), ang = 2 * Math.PI * dev / 100;
          Z.re = Z.re * 0.997 + w * Math.cos(ang); Z.im = Z.im * 0.997 + w * Math.sin(ang); Z.w = Z.w * 0.997 + w;
        });
      },
      get: function () { if (!(Z.w > 0)) return { t: 0, r: 0, w: 0 }; return { t: Math.atan2(Z.im, Z.re) * 100 / (2 * Math.PI), r: Math.sqrt(Z.re * Z.re + Z.im * Z.im) / Z.w, w: Z.w }; }
    };
  }
  function hearCreate3(opt) {
    opt = opt || {};
    var OK = opt.ok || 0.8, BAD = opt.bad || 0.84, REL = opt.rel || 0.3, KEEP = opt.keep || 0.97;
    var S = { cands: [], tgt: [], allow: {}, hist: [], pre: null, noise: null, onT: -1e9, lastOn: -1e9, fr: 99, ok: 0, bad: 0, done: true, hit: false, heard: null, vp: null, dbg: null };
    /* Tecla por tecla. RHO: una nota del acorde cuenta si suena al menos así de fuerte respecto de la más fuerte (los
       dedos de un niño no tocan parejo, y un parlante estéreo apaga algunas frecuencias). Se acumula lo que se oyó
       durante JUNTAR ms: si toca el acorde de a poco (Do, luego Mi y Sol), también vale. FRMAX: cuadros que se mira
       después de cada golpe (900 ms: el sonido del KeyLab pasa por la laptop y el equipo y llega un poco tarde). */
    var RHO = opt.rho || 0.07, WRONG = opt.wrong || 0.4, JUNTAR = opt.join || 1600, COVER = 0.35, FRMAX = opt.frmax || 18;
    var NOPIANO = opt.nopiano || 0.42, KEYMIN = opt.keymin || 0.35;
    var SR0 = opt.sr || 0, NF = opt.nfft || 8192, T0 = Math.max(-50, Math.min(50, +opt.tune || 0));
    var SPL = SR0 ? spLayout(SR0, NF, T0) : null, KMAX = SR0 ? spLayout(SR0, NF, 50).kmax : 0;
    var TT = SR0 && opt.autotune !== false ? tuneCreate(T0, opt.tune ? 30 : 0) : null, tuneN = 0, lastTgt = null;
    var Q = { on: false, find: false, ring: [], hist: [], pre: null, exp: [], win: {}, cover: {}, got: {}, struck: {}, seen: {}, h3: {}, fr: 99, done: true, okN: 0, badN: 0, part: false, onT: -1e9, dbg: null, prev: {}, tg: [], chgT: 0, lastT: 0, hold: {}, lastOn: -1e9 };
    function skey(a) { return a.slice().sort(function (x, y) { return x - y; }).join(','); }
    function target(pcs, allow, reg, now, notes) {
      var tg = [];
      (pcs || []).forEach(function (p) { p = mod12(p); if (tg.indexOf(p) < 0) tg.push(p); });
      S.tgt = tg; S.allow = {}; S.reg = reg;
      tg.concat(allow || []).forEach(function (p) { S.allow[mod12(p)] = 1; });
      var seen = {}, list = [];
      var add = function (a, kind) {
        var k = skey(a); if (seen[k]) return; seen[k] = 1;
        list.push({ pcs: a, kind: kind, t: pianoTpl(a, reg), okish: a.every(function (p) { return S.allow[p]; }) });
      };
      if (tg.length) add(tg, 'tgt');
      for (var r = 0; r < 12; r++) add([r], 'note');
      if (tg.length >= 2) for (r = 0; r < 12; r++) {
        add([r, mod12(r + 4), mod12(r + 7)], 'chord'); add([r, mod12(r + 3), mod12(r + 7)], 'chord');
        add(tg.map(function (p) { return mod12(p - tg[0] + r); }), 'shape');
      }
      S.cands = list; S.ok = S.bad = 0;
      // un golpe de hace muy poco que no fue acierto se juzga otra vez con la nota nueva (la tocó un poquito antes)
      var again = now != null && now - S.onT < 350 && !S.hit && S.pre;
      S.done = !again;
      lastTgt = [tg, reg, notes];
      qTarget(tg, reg, notes, again);
    }
    /* Las teclas que pide la pantalla (o, si no se saben, cada nota en la octava de la zona). */
    function qTarget(tg, reg, notes, again, keep) {
      if (!keep) {
        var pv = {}; (Q.tg || []).forEach(function (p) { pv[p] = 1; }); Q.prev = pv; Q.tg = tg.slice(); Q.chgT = Q.lastT || 0;
        Q.got = {}; Q.okN = Q.badN = 0; Q.seen = {}; Q.hold = {}; Q.h3 = {}; Q.part = false;
        Q.sus = { k: 0, base: null, cnt: 0, first: -1, done: false };
        if (!again) Q.done = true;
      }
      // con micrófono y espectro: siempre tecla por tecla (una nota sola también: el cromagrama fallaba con pianos reales)
      Q.on = !!(SPL && tg.length >= 1 && opt.single !== 'croma' || SPL && tg.length >= 2);
      Q.find = !!(SPL && !tg.length);
      if (!Q.on) return;
      var base = reg != null ? reg : 60, exp = [];
      (notes && notes.length ? notes : tg.map(function (p) { return base + mod12(p - base); })).forEach(function (m) {
        m = Math.round(m); if (tg.indexOf(mod12(m)) >= 0 && exp.indexOf(m) < 0) exp.push(m);
      });
      tg.forEach(function (p) { if (!exp.some(function (m) { return mod12(m) === p; })) exp.push(base + mod12(p - base)); });
      exp.sort(function (a, b) { return a - b; });
      // sin teclas muy por debajo de la más grave: un acorde con su bajo es casi la serie de armónicos de la nota
      // una octava más abajo (Fa3-Do4-Fa4-La4 = armónicos 2, 3, 4 y 5 de Fa2) y esa nota «fantasma» se robaba el acorde
      Q.exp = exp; Q.lo = Math.max(SP_M0, exp[0] - 7); Q.hi = Math.min(SP_M1, exp[exp.length - 1] + 24);
      // cuenta la tecla que pide la pantalla, o la misma una octava más abajo o más arriba
      Q.win = {}; exp.forEach(function (e) { for (var m = e - 12; m <= e + 23; m++) if (mod12(m) === mod12(e) && m >= Q.lo && m <= Q.hi) (Q.win[mod12(e)] = Q.win[mod12(e)] || [])[m] = 1; });
      // una nota que es armónico de otra más grave del acorde (la quinta de la mano derecha con el bajo de la izquierda)
      // no se puede oír aparte: si la grave suena, se da por buena
      Q.cover = {};
      exp.forEach(function (e) { exp.forEach(function (j) { if (j < e && mod12(j) !== mod12(e) && spDot(spAtom(SPL, j), spAtom(SPL, e)) >= COVER) (Q.cover[e] = Q.cover[e] || []).push(j); }); });
    }
    /* el piano está corrido: se cambian los tercios de semitono y los moldes (solo entre golpes, nunca a mitad de uno) */
    function setTune(t) {
      SPL = spLayout(SR0, NF, t);
      if (lastTgt) qTarget(lastTgt[0], lastTgt[1], lastTgt[2], false, true);
    }
    function qFrame(f) {
      Q.lastT = f.t;
      // espectro por teclas, ruido de fondo (lo mínimo de los últimos 3 s) y lo que suena ahora
      var sp = spPool(SPL, f.mag), b, q, cur = new Float64Array(SP_N);
      Q.ring.push(sp); if (Q.ring.length > 60) Q.ring.shift();
      for (b = 0; b < SP_N; b++) { var nf = sp[b]; for (q = 0; q < Q.ring.length; q++) if (Q.ring[q][b] < nf) nf = Q.ring[q][b]; cur[b] = Math.max(0, sp[b] - nf); }
      Q.hist.push(cur); if (Q.hist.length > 5) Q.hist.shift();
      // picos: para saber si el tono se mueve (voz) y para la afinación
      var pk = f.db ? spPeaks(f.db, SR0 / NF) : null;
      Q.drift0 = Q.drift1; Q.drift1 = pk ? spDrift(pk, Q.pk) : -1; Q.pk = pk;
      // afinación: se aprende de lo que suena después de un golpe (el piano), no del silencio ni de una voz
      if (TT && pk && S.noise != null && f.peak > S.noise + 12 && Q.drift1 >= 0 && Q.drift1 <= 4) {
        TT.add(pk);
        if (++tuneN % 5 === 0 && (Q.done || !Q.tuned)) {
          var g = TT.get();
          if (g.r >= 0.3 && g.w >= (Q.tuned ? 25 : 8) && Math.abs(g.t - SPL.tune) >= (Q.tuned ? 7 : 4)) { setTune(Math.round(g.t)); Q.tuned = true; }
          else if (g.w >= 25) Q.tuned = true;
        }
      }
      return cur;
    }
    /* Qué tan fuerte suena la nota p (en la tecla pedida o una octava arriba o abajo). Si al lado (un semitono) suena
       mucho más fuerte una tecla que no va, lo poquito que aparece en p es «derrame» de esa vecina: no cuenta. */
    function qPresent(notes, p, all) {
      var best = 0; all = all || notes;
      Object.keys(notes).forEach(function (m) {
        if (!(Q.win[p] && Q.win[p][m] && notes[m] > best)) return;
        m = +m; var v = notes[m];
        if ([m - 1, m + 1].some(function (k) { return (notes[k] || 0) >= 3 * v && !S.allow[mod12(k)]; })) return;
        // la misma nota en otra octava (no la tecla pedida) no cuenta si puede ser armónico de una tecla más grave que
        // suena: con un parlante chico el bajo pierde su fundamental y su quinto armónico (Mi5 para Do3) parece tocado
        if (Q.exp.indexOf(m) < 0 && Object.keys(all).some(function (n) { n = +n; return n < m && HARM[m - n] && all[n] >= 0.05; })) return;
        // y en otra octava tiene que sonar de verdad (no un rastro débil del eco o de una vecina)
        if (Q.exp.indexOf(m) < 0 && v < 0.25) return;
        best = v;
      });
      return best;
    }
    /* Quita los armónicos «fantasma»: una tecla que es armónico de otra más grave que suena (su octava, su quinta de
       arriba…) y que suena menos que ella. Un Do4 solo deja algo en Sol5 y en Do5: eso no es tocar Sol. */
    var HARM = { 12: 1, 19: 1, 24: 1, 28: 1, 31: 1, 34: 1, 36: 1 };     // octava, quinta de arriba, 2 octavas, tercera…
    function qReal(notes) {
      var ks = Object.keys(notes).map(Number).sort(function (a, b) { return a - b; }), out = {};
      ks.forEach(function (m) {
        var v = notes[m];
        if (!ks.some(function (n) { return n < m && HARM[m - n] && notes[n] >= RHO && notes[n] >= v; })) out[m] = v;
      });
      return out;
    }
    /* No es error: (1) en los graves el micrófono no separa bien teclas vecinas: la vecina más débil de una tecla que sí
       va; (2) un armónico de una tecla que sí va (la quinta o la tercera de arriba de su serie): cada piano los tiene
       más o menos fuertes, y el molde no puede saber cuánto. */
    function excused(nw, all, m) {
      return Object.keys(all).some(function (k) {
        k = +k; if (k === m || !S.allow[mod12(k)]) return false;
        if (m < 64 && Math.abs(k - m) <= 2 && (nw[k] || 0) * 0.7 >= nw[m]) return true;
        // (aunque suene más que la tecla de abajo: el parlante de una laptop casi borra la fundamental de los graves)
        return k < m && HARM[m - k] && all[k] >= 0.05;
      });
    }
    /* sin objetivo («¿Qué tecla es?»): la tecla más fuerte que no es armónico de otra, dos cuadros seguidos */
    function qFind(f, cur) {
      if (Q.done || !Q.pre || Q.fr >= FRMAX) return null;
      Q.fr++;
      var keep = Math.pow(KEEP, Q.fr + 4), y = new Float64Array(SP_N), e = 0;
      for (var b = 0; b < SP_N; b++) { y[b] = Math.max(0, cur[b] - Q.pre[b] * keep); e += y[b]; }
      if (!(e > 0)) return null;
      var fit = spFit(SPL, y, 36, 96), nw = qReal(fit.notes), best = -1, bv = 0;
      if (fit.err > NOPIANO || fit.key < KEYMIN) { Q.fbest = -1; return null; }
      Object.keys(nw).forEach(function (m) { if (nw[m] > bv) { bv = nw[m]; best = +m; } });
      if (best >= 0 && best === Q.fbest) { Q.done = true; S.heard = { pc: mod12(best), conf: 0.9, t: f.t, midi: best }; return { type: 'note', t: Q.onT, pc: mod12(best), conf: 0.9, midi: best }; }
      Q.fbest = best;
      if (Q.fr >= FRMAX) Q.done = true;
      return null;
    }
    function qAnalyze(f, cur) {
      if (Q.done || !Q.pre || Q.fr >= FRMAX) return null;
      Q.fr++;
      var keep = Math.pow(KEEP, Q.fr + 4), y = new Float64Array(SP_N), e = 0;
      for (var b = 0; b < SP_N; b++) { y[b] = Math.max(0, cur[b] - Q.pre[b] * keep); e += y[b]; }
      if (!(e > 0)) return null;
      var fit = spFit(SPL, y, Q.lo, Q.hi), all = fit.notes, nw = qReal(all), tg = S.tgt, now = f.t, have = {}, wrong = [];
      // ¿suena a teclas? Sí si el molde calza (piano), o si es un tono simple y quieto que se repite igual (un piano
      // eléctrico o un teclado sencillo suenan casi sin armónicos y el molde no les calza). Una voz se mueve: no cuenta.
      var tops = Object.keys(nw).filter(function (m) { return nw[m] >= 0.5; }).sort().join(','), sameTop = tops && tops === Q.tops; Q.tops = tops;
      var still = (Q.drift1 < 0 || Q.drift1 <= 4) && (Q.drift0 < 0 || Q.drift0 <= 4);
      var simple = Object.keys(nw).filter(function (m) { return nw[m] >= 0.25; }).length <= 4;
      var pianoish = (fit.err <= NOPIANO && fit.key >= KEYMIN && (Q.drift1 < 0 || Q.drift1 <= 12)) || (simple && sameTop && still && fit.key >= 0.15);
      if (!pianoish) {
        tg.forEach(function (p) { Q.seen[p] = 0; }); Q.okN = Q.badN = 0; Q.wset = null;
        if (opt.debug) Q.dbg = { t: now, nw: nw, all: all, err: fit.err, key: fit.key, miss: [], wrong: [], have: [], skip: true };
        if (Q.fr >= FRMAX) Q.done = true;
        return null;
      }
      // una nota sola tiene que ser la que más suena (25 %); en un acorde basta que se oiga (RHO)
      var need = tg.length === 1 ? 0.25 : RHO;
      tg.forEach(function (p) {
        if (qPresent(nw, p, all) >= need) { Q.seen[p] = (Q.seen[p] || 0) + 1; if (Q.seen[p] >= 2 && (!Q.got[p] || now - Q.got[p].t > 300)) Q.got[p] = { t: now, on: Q.onT }; }
        else Q.seen[p] = 0;
      });
      Object.keys(nw).forEach(function (m) { if (nw[m] >= 0.2) Q.struck[mod12(+m)] = now; });
      // notas de otro acorde que sonaron fuerte (y que no son armónicos de lo que suena). Solo si el sonido es de
      // piano (una voz no se parece a los moldes) y si son las mismas cuadro tras cuadro (la voz sube y baja)
      // las del acorde anterior que siguen sonando no son error (un piano real sube y baja un poco al apagarse)
      var late = Math.abs(Q.onT - Q.chgT) < 2000 ? Q.prev : {};
      // («Oigo otra tecla» solo con sonido de teclas y tono quieto: una voz se mueve; el eco de la sala sube el error
      // del ajuste, por eso aquí no se pide más que para contar las notas)
      var clean = still && fit.err <= NOPIANO && fit.key >= KEYMIN;
      var fresh = function (m) { var a = spAtom(SPL, m), nc = spDot(a, cur); return !(nc > 0) || spDot(a, y) / nc >= 0.5; };
      // (si el micrófono se satura, el sonido se deforma y aparecen notas que nadie tocó: entonces no se dice «otra tecla»)
      if (clean && !f.clip) Object.keys(nw).forEach(function (m) { m = +m; if (nw[m] >= WRONG && !S.allow[mod12(m)] && !late[mod12(m)] && !excused(nw, all, m) && fresh(m)) wrong.push(m); });
      var wk = wrong.map(function (m) { return mod12(m); });
      Q.wset = Q.badN && Q.wset ? Q.wset.filter(function (p) { return wk.indexOf(p) >= 0; }) : wk;
      if (!Q.wset.length) wrong = [];
      // lo que falta: ¿sigue sonando de hace poco (una nota que se repite del acorde anterior)?
      var miss = tg.filter(function (p) { return !(Q.got[p] && now - Q.got[p].t <= JUNTAR); });
      // (después del golpe, cuando el ruido del martillo ya pasó, y solo si lo que suena es de piano)
      if (Q.fr >= 3 && miss.length && miss.some(function (p) { return Q.struck[p] && now - Q.struck[p] < 2500 && Q.onT - Q.struck[p] > 120; })) {
        var fn = spFit(SPL, cur, Q.lo, Q.hi), nn = fn.err <= NOPIANO ? qReal(fn.notes) : {}; Q.nnDbg = nn;
        miss.forEach(function (p) {
          if (Q.struck[p] && now - Q.struck[p] < 2500 && Q.onT - Q.struck[p] > 120 && qPresent(nn, p) >= 0.2) { Q.hold[p] = (Q.hold[p] || 0) + 1; if (Q.hold[p] >= 2) Q.got[p] = { t: now, on: Q.onT }; }
          else Q.hold[p] = 0;
        });
        miss = tg.filter(function (p) { return !(Q.got[p] && now - Q.got[p].t <= JUNTAR); });
      }
      // La fundamental puede quedar apagada (un parlante chico, dos parlantes, la sala): si suena su tercer armónico
      // (la quinta de la octava de arriba: Sol5 para Do4) y nada más de lo que se toca lo explica, la nota está.
      // (solo en acordes, y si esa nota no sonó hace poco: una nota anterior que sigue sonando también la da)
      if (tg.length >= 2) miss = miss.filter(function (p) {
        var ok3 = Q.exp.some(function (e) {
          if (mod12(e) !== p) return false;
          var h3 = e + 19, v = all[h3] || 0;
          // (si esa nota también va en el acorde, la puede estar dando otra tecla: no es prueba)
          if (v < 0.15 || S.allow[mod12(h3)] || (Q.struck[mod12(h3)] && now - Q.struck[mod12(h3)] < 2500 && Q.struck[mod12(h3)] < Q.onT)) return false;
          return !Object.keys(all).some(function (j) { j = +j; return j !== e && j < h3 && HARM[h3 - j] && (all[j] || 0) >= 0.1 && S.allow[mod12(j)]; });
        });
        if (ok3) { Q.h3[p] = (Q.h3[p] || 0) + 1; if (Q.h3[p] >= 2) { Q.got[p] = { t: now, on: Q.onT }; return false; } }
        else Q.h3[p] = 0;
        return true;
      });
      // la que no se puede oír aparte se da por buena si suena la grave que la tapa
      miss = miss.filter(function (p) {
        var es = Q.exp.filter(function (m) { return mod12(m) === p; });
        return !es.every(function (m) { return (Q.cover[m] || []).some(function (j) { return (all[j] || 0) >= 0.25; }); });
      });
      tg.forEach(function (p) { if (Q.got[p] && now - Q.got[p].t <= JUNTAR) have[p] = 1; });
      if (opt.debug) { Q.dbg = { t: now, nw: nw, all: all, err: fit.err, key: fit.key, miss: miss, wrong: wrong, have: Object.keys(have), nn: Q.nnDbg, got: JSON.stringify(Q.got), tune: SPL.tune }; Q.nnDbg = null; }
      Q.badN = wrong.length ? Q.badN + 1 : 0;
      Q.okN = !miss.length && !wrong.length ? Q.okN + 1 : 0;
      if (Q.okN >= 2) {
        var t0 = Q.onT; tg.forEach(function (p) { if (Q.got[p] && Q.got[p].on < t0 && now - Q.got[p].on <= JUNTAR) t0 = Q.got[p].on; });
        Q.done = true; S.hit = true; return { type: 'ok', t: t0, conf: 0.9 };
      }
      if (Q.badN >= 3) {
        var wp = Q.wset.filter(function (p, i, a) { return a.indexOf(p) === i; });
        Q.done = true; return { type: 'bad', t: Q.onT, conf: wrong.some(function (m) { return nw[m] >= 0.6; }) ? 0.9 : 0.85, pcs: wp, extra: !miss.length };
      }
      // a los 400 ms: le falta algo (oí parte del acorde); no es error, se le dice qué falta
      if (Q.fr === 8 && !Q.part && tg.length >= 2 && Object.keys(have).length && miss.length && !wrong.length) {
        Q.part = true; return { type: 'partial', t: Q.onT, have: tg.filter(function (p) { return have[p]; }), miss: miss.slice() };
      }
      if (Q.fr >= FRMAX) Q.done = true;
      return null;
    }
    /* Segunda oportunidad (oct 2026): el oído juzga justo después de cada golpe. Si no notó el golpe (el acorde anterior
       seguía sonando fuerte, el celular sobre el teclado recibe el golpe de las teclas por la madera, el sonido llega
       suave por el parlante) o si el juicio de 900 ms no alcanzó, el alumno tenía que tocar otra vez. Ahora, si las notas
       que este acorde agrega (las que no estaban en el anterior) aparecen después del cambio y se quedan sonando claras,
       quietas y con todas las del acorde, durante unos 300 ms, también vale. Si el acorde se repite (no agrega notas),
       hace falta un golpe de verdad: lo que sigue sonando del anterior no cuenta. */
    var SUS = opt.sustain !== false, SUSN = opt.susn || 3;
    function qSustain(f, cur) {
      var SU = Q.sus; if (!SUS || !SU || SU.done) return null;
      var tg = S.tgt, need = tg.length === 1 ? 0.25 : RHO, fit, nw, pres;
      if (SU.base == null) {                     // lo que ya sonaba al cambiar de acorde
        fit = spFit(SPL, cur, Q.lo, Q.hi); nw = qReal(fit.notes); pres = {};
        tg.forEach(function (p) { pres[p] = fit.err <= 0.8 ? qPresent(nw, p, fit.notes) : 0; });
        SU.base = pres; return null;
      }
      if (!Q.done || ++SU.k % 2) return null;    // mientras juzga un golpe, espera; y mira cada 100 ms
      var fresh = tg.filter(function (p) { return !Q.prev[p]; });
      if (!fresh.length) return null;
      fit = spFit(SPL, cur, Q.lo, Q.hi); nw = qReal(fit.notes);
      var still = (Q.drift1 < 0 || Q.drift1 <= 4) && (Q.drift0 < 0 || Q.drift0 <= 6);
      if (!(fit.err <= NOPIANO && fit.key >= KEYMIN && still)) { SU.cnt = 0; SU.first = -1; return null; }
      pres = {}; tg.forEach(function (p) { pres[p] = qPresent(nw, p, fit.notes); });
      var allIn = tg.every(function (p) { return pres[p] >= need; });
      var rose = fresh.every(function (p) { return (SU.base[p] || 0) < need * 0.6 && pres[p] >= Math.max(need, 0.2); });
      var wrong = Object.keys(nw).some(function (m) { m = +m; return nw[m] >= WRONG && !S.allow[mod12(m)] && !Q.prev[mod12(m)] && !excused(nw, fit.notes, m); });
      if (allIn && rose && !wrong) { if (SU.first < 0) SU.first = f.t; SU.cnt++; } else { SU.cnt = 0; SU.first = -1; }
      if (opt.debug) Q.susDbg = { t: f.t, pres: pres, allIn: allIn, rose: rose, wrong: wrong, cnt: SU.cnt };
      if (SU.cnt >= SUSN) { SU.done = true; Q.done = true; S.hit = true; return { type: 'ok', t: SU.first, conf: 0.85, sus: true }; }
      return null;
    }
    function frame(f) {
      var raw = [], tot = 0, p, out = null, H = S.hist, cur = null;
      if (SPL && f.mag) cur = qFrame(f);
      // ruido de fondo por nota: lo mínimo de los últimos 3 segundos (entre nota y nota el piano se apaga; el ventilador no)
      S.ring = S.ring || []; S.ring.push(f.raw.slice()); if (S.ring.length > 60) S.ring.shift();
      for (p = 0; p < 12; p++) {
        var nf = f.raw[p];
        for (var q = 0; q < S.ring.length; q++) if (S.ring[q][p] < nf) nf = S.ring[q][p];
        raw[p] = Math.max(0, f.raw[p] - nf); tot += raw[p];
      }
      if (S.noise == null) S.noise = f.peak;
      var loud = f.peak > S.noise + 9;
      S.noise = f.peak < S.noise ? S.noise * 0.6 + f.peak * 0.4 : S.noise + Math.min(0.03, (f.peak - S.noise) * 0.002);
      var prev = H.length ? H[H.length - 1] : null, base = H.length >= 3 ? H[H.length - 3] : H[0], rs1 = 0, rs3 = 0, rmax = 0;
      if (prev) for (p = 0; p < 12; p++) {
        var d1 = raw[p] - prev[p], d3 = raw[p] - base[p];
        if (d1 > 0) rs1 += d1;
        if (d3 > 0) { rs3 += d3; if (d3 > rmax) rmax = d3; }
      }
      var rel = tot > 0 ? rs3 / tot : 0, rel1 = tot > 0 ? rs1 / tot : 0, conc = rs3 > 0 ? rmax / rs3 : 0;
      // golpe: mucho sonido nuevo respecto de hace 150 ms, que todavía está subiendo, y concentrado en pocas notas
      var onset = !!prev && loud && rel > REL && rel1 > 0.1 && conc > 0.16 && f.t - S.lastOn > 200;
      // Con el espectro tecla por tecla el golpe se mira ahí (y el de las 12 notas no se usa): lo nuevo tiene que
      // superar con margen lo más alto de hace 150-250 ms (el piano real sube y baja un poco solo, por sus cuerdas que
      // laten) y estar en pocos tercios de semitono (armónicos), no repartido (el roce de las teclas, un golpe en la mesa).
      // Así se oyen también los bajos graves, cuyos armónicos se reparten entre muchas notas.
      if (cur) {
        onset = false;
        if (loud && f.t - S.lastOn > 200 && Q.hist.length >= 5) {
          var h1 = Q.hist[Q.hist.length - 2], hA = Q.hist[Q.hist.length - 4], hB = Q.hist[Q.hist.length - 5], ct = 0, s3 = 0, s1 = 0, dd = [];
          for (var b2 = 0; b2 < SP_N; b2++) {
            var mp = Math.max(hA[b2], hB[b2]), u3 = cur[b2] - 1.3 * mp, u1 = cur[b2] - h1[b2];
            ct += cur[b2]; if (u1 > 0) s1 += u1; if (u3 > 0) { s3 += u3; dd.push(u3); }
          }
          if (ct > 0 && s3 / ct > REL && s1 / ct > 0.1 && dd.length) {
            dd.sort(function (x, y) { return y - x; });
            var topS = 0, nTop = Math.round(0.12 * SP_N); for (var k2 = 0; k2 < nTop && k2 < dd.length; k2++) topS += dd[k2];
            if (topS / s3 >= 0.3) {
              // y lo nuevo tiene forma de teclas (no de roce o golpe): al soltar las teclas del KeyLab suena un «clac»
              var rise = new Float64Array(SP_N); for (b2 = 0; b2 < SP_N; b2++) rise[b2] = Math.max(0, cur[b2] - 1.3 * Math.max(hA[b2], hB[b2]));
              var rf = spFit(SPL, rise, 36, 96);
              if (rf.key >= (opt.onkey || 0.3)) onset = true;
              if (opt.debug) Q.onDbg = { t: f.t, key: rf.key, err: rf.err, ok: onset };
            }
          }
        }
      }
      if (onset) {
        S.pre = (H.length >= 4 ? H[H.length - 4] : H[0]).slice();
        S.onT = f.t; S.lastOn = f.t; S.fr = 0; S.done = false; S.ok = S.bad = 0; S.hit = false; S.vp = null;
        if (cur) { Q.pre = Q.hist.length >= 5 ? Q.hist[Q.hist.length - 5] : Q.hist[0]; Q.fr = 0; Q.done = false; Q.okN = Q.badN = 0; Q.seen = {}; Q.hold = {}; Q.h3 = {}; Q.part = false; Q.onT = f.t; Q.lastOn = f.t; Q.fbest = -1; }
        out = { type: 'onset', t: f.t };
      }
      H.push(raw.slice()); if (H.length > 5) H.shift();
      if ((Q.on || Q.find) && cur) {
        // tecla por tecla (el cromagrama aceptaba una sola tecla del acorde y fallaba con pianos reales)
        var ev = Q.on ? qAnalyze(f, cur) : qFind(f, cur);
        if (!ev && Q.on && !f.clip) ev = qSustain(f, cur);
        if (ev) out = ev;
        if (!S.done && S.pre && S.fr < FRMAX) { S.fr++; if (S.fr >= FRMAX) S.done = true; }
        return out;
      }
      if (!S.done && S.pre && S.fr < 14) {
        S.fr++;
        var keep = Math.pow(KEEP, S.fr + 4), v = [], nn = 0;
        for (p = 0; p < 12; p++) { var e = raw[p] - S.pre[p] * keep; v[p] = e > 0 ? Math.sqrt(e) : 0; nn += v[p] * v[p]; }
        nn = Math.sqrt(nn);
        if (nn > 0) {
          for (p = 0; p < 12; p++) v[p] /= nn;
          var stable = S.vp ? dot12(v, S.vp) : 0; S.vp = v;
          var sT = -1, bO = -1, bestO = null, bN = -1, bestN = null;
          S.cands.forEach(function (c) {
            var sc = dot12(v, c.t);
            if (c.kind === 'tgt') sT = sc; else if (sc > bO) { bO = sc; bestO = c; }
            if (c.kind === 'note' && sc > bN) { bN = sc; bestN = c; }
          });
          if (opt.debug) S.dbg = { t: f.t, sT: sT, bO: bO, best: bestO && bestO.pcs, stable: stable };
          if (bestN && bN >= 0.8 && stable > 0.85) S.heard = { pc: bestN.pcs[0], conf: bN, t: f.t };
          if (S.tgt.length) {
            var okNow = sT >= OK && sT >= bO - 0.01;
            var badNow = !!bestO && !bestO.okish && bO >= BAD && bO - sT >= 0.08 && stable > 0.9;
            S.ok = okNow ? S.ok + 1 : 0; S.bad = badNow ? S.bad + 1 : 0;
            if ((S.ok >= 2 && stable > 0.85) || (okNow && sT >= 0.95 && S.fr >= 2)) { S.done = true; S.hit = true; out = { type: 'ok', t: S.onT, conf: sT }; }
            else if (S.bad >= 3) { S.done = true; out = { type: 'bad', t: S.onT, conf: bO, pcs: bestO.pcs }; }
          } else if (S.fr >= 2 && bestN && bN >= 0.85 && stable > 0.85) { S.done = true; out = { type: 'note', t: S.onT, pc: bestN.pcs[0], conf: bN }; }
        }
        if (!S.done && S.fr >= 14) S.done = true;
      }
      return out;
    }
    return { target: target, frame: frame, heard: function () { return S.heard; }, noise: function () { return S.noise; }, dbg: function () { return Q.on ? Q.dbg : S.dbg; },
      tune: function () { return SPL ? SPL.tune : 0; }, tuneInfo: function () { return TT ? TT.get() : null; },
      kmax: KMAX, chords: !!SPL };
  }

  /* ---------- voz sin internet: órdenes cortas aprendidas con la voz de cada uno ----------
     Cada 10 ms: espectro (FFT de 1024 muestras), energía en la banda de la voz (250-3500 Hz) y 12 coeficientes MFCC.
     Un trozo corto de sonido (0,2 a 1,4 s) con silencio antes y después es una orden posible: se compara (DTW) con las
     grabaciones de cada orden. Cantar o tocar seguido no es un trozo corto entre silencios: no manda nada. */
  function vozCreate(opt) {
    opt = opt || {};
    var SR = opt.sr || 48000, N = 1024, HOP = Math.round(SR * 0.01), NB = 24, NC = 12, RING = 320;
    var win = new Float64Array(N), re = new Float64Array(N), im = new Float64Array(N), ring = new Float32Array(N), rw = 0, since = 0, i, b, k;
    for (i = 0; i < N; i++) win[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1));
    var mel = function (f) { return 2595 * Math.log(1 + f / 700) / Math.LN10; }, imel = function (m) { return 700 * (Math.pow(10, m / 2595) - 1); };
    var mLo = mel(120), mHi = mel(Math.min(7000, SR / 2 - 200)), pts = [], bank = [], dct = [];
    for (b = 0; b < NB + 2; b++) pts.push(imel(mLo + (mHi - mLo) * b / (NB + 1)) * N / SR);
    for (b = 0; b < NB; b++) {
      var lo = pts[b], mid = pts[b + 1], hi = pts[b + 2], row = [];
      for (k = Math.max(1, Math.floor(lo)); k <= Math.ceil(hi) && k < N / 2; k++) { var w = k < mid ? (k - lo) / (mid - lo) : (hi - k) / (hi - mid); if (w > 0) row.push(k, w); }
      bank.push(row);
    }
    for (var q = 1; q <= NC; q++) { var r = new Float64Array(NB); for (b = 0; b < NB; b++) r[b] = Math.cos(Math.PI * q * (b + 0.5) / NB); dct.push(r); }
    var kA = Math.round(250 * N / SR), kZ = Math.round(3500 * N / SR), lb = new Float64Array(NB);
    var F = [], E = new Float64Array(RING), T = 0, floor = -60, S = { st: 'idle', quiet: 999, act: 0, pre: 0, s0: -1, last: -1 };
    var MINDB = opt.mindb != null ? opt.mindb : -62, UP = opt.up || 11, PCT = opt.pct != null ? opt.pct : 0.2, PREQ = opt.preq || 18, POSTQ = opt.postq || 22, DMIN = opt.dmin || 18, DMAX = opt.dmax || 140;
    function frame() {
      for (i = 0; i < N; i++) { re[i] = ring[(rw + i) % N] * win[i]; im[i] = 0; }
      fftRadix2(re, im);
      var band = 0;
      for (k = kA; k <= kZ; k++) band += re[k] * re[k] + im[k] * im[k];
      var e = 10 * Math.log(band / (N * N) + 1e-14) / Math.LN10 + 20;
      for (b = 0; b < NB; b++) { var row2 = bank[b], s2 = 1e-10; for (var j = 0; j < row2.length; j += 2) { var kk = row2[j]; s2 += row2[j + 1] * (re[kk] * re[kk] + im[kk] * im[kk]); } lb[b] = Math.log(s2 / (N * N)); }
      var c = new Float32Array(NC + 1);
      for (q = 0; q < NC; q++) { var d = dct[q], v = 0; for (b = 0; b < NB; b++) v += d[b] * lb[b]; c[q] = v; }
      c[NC] = e;
      F[T % RING] = c; E[T % RING] = e;
      // fondo: el nivel que se supera solo el 80 % del tiempo en los últimos 3 s (con música de fondo, la música es el fondo)
      if (T % 10 === 0) { var n = Math.min(T + 1, RING), srt = Array.prototype.slice.call(E, 0, n).sort(function (x, y) { return x - y; }); floor = srt[Math.floor(n * PCT)]; }
      step(e, T); T++;
    }
    function step(e, t) {
      var act = e > Math.max(floor + UP, MINDB);
      if (act) { if (S.act === 0) S.pre = S.quiet; S.act++; S.quiet = 0; } else { S.quiet++; S.act = 0; }
      if (S.st === 'idle') {
        if (act && S.act >= 3) { S.st = 'voz'; S.s0 = t - 2; S.last = t; S.preq = S.pre; }
      } else if (S.st === 'voz') {
        if (act) S.last = t;
        if (t - S.s0 > DMAX + 20) S.st = 'largo';
        else if (!act && t - S.last >= POSTQ) {
          S.st = 'idle';
          var dur = S.last - S.s0 + 1;
          if (S.preq >= PREQ && dur >= DMIN && dur <= DMAX && opt.onSeg) emit(S.s0 - 3, S.last + 3);
        }
      } else if (S.st === 'largo' && S.quiet >= POSTQ) S.st = 'idle';
    }
    function emit(a, z) {
      var seq = [], n = z - a + 1, mean = new Float64Array(NC), mx = -1e9, t;
      if (T - a > RING) return;
      for (t = a; t <= z; t++) { var c = F[t % RING]; if (!c) return; seq.push(c); if (c[NC] > mx) mx = c[NC]; for (q = 0; q < NC; q++) mean[q] += c[q] / n; }
      // sin el color del micrófono (se resta el promedio) y con la forma de la energía (sílabas)
      opt.onSeg(seq.map(function (c) { var o = new Float32Array(NC + 1); for (q = 0; q < NC; q++) o[q] = c[q] - mean[q]; o[NC] = 0.25 * Math.max(-30, c[NC] - mx); return o; }), { frames: n, db: mx });
    }
    function push(blk) {
      for (var p = 0; p < blk.length; p++) { ring[rw] = blk[p]; rw = rw + 1 === N ? 0 : rw + 1; if (++since >= HOP) { since = 0; frame(); } }
    }
    return { push: push, level: function () { return { e: E[(T + RING - 1) % RING], floor: floor, st: S.st }; } };
  }
  function vozDtw(A, B) {
    var n = A.length, m = B.length, band = Math.max(10, Math.ceil(0.3 * Math.max(n, m))), INF = 1e18, j;
    var prev = new Float64Array(m + 1), cur = new Float64Array(m + 1);
    for (j = 0; j <= m; j++) prev[j] = INF; prev[0] = 0;
    for (var i = 1; i <= n; i++) {
      for (j = 0; j <= m; j++) cur[j] = INF;
      var jc = Math.round(i * m / n), j0 = Math.max(1, jc - band), j1 = Math.min(m, jc + band), a = A[i - 1];
      for (j = j0; j <= j1; j++) {
        var bb = B[j - 1], d = 0; for (var q = 0; q < a.length; q++) { var x = a[q] - bb[q]; d += x * x; }
        cur[j] = Math.sqrt(d) + Math.min(prev[j], prev[j - 1], cur[j - 1]);
      }
      var tt = prev; prev = cur; cur = tt;
    }
    return prev[m] / (n + m);
  }
  /* umbral de cada orden: cuánto se parecen entre sí sus grabaciones (con un margen) */
  function vozThresholds(model, k) {
    var out = {}; k = k || 1.55;
    Object.keys(model).forEach(function (c) {
      var ts = model[c], ds = [];
      for (var a = 0; a < ts.length; a++) for (var b = a + 1; b < ts.length; b++) ds.push(vozDtw(ts[a], ts[b]));
      var m = ds.length ? ds.reduce(function (x, y) { return x + y; }, 0) / ds.length : 6;
      out[c] = Math.max(3.5, Math.min(12, m * k));
    });
    return out;
  }
  function vozClassify(model, thr, seq) {
    var best = null, bd = 1e18, sd = 1e18;
    Object.keys(model).forEach(function (c) {
      var d = 1e18; model[c].forEach(function (t) { var x = vozDtw(seq, t); if (x < d) d = x; });
      if (d < bd) { sd = bd; bd = d; best = c; } else if (d < sd) sd = d;
    });
    var ok = !!best && bd <= thr[best] && (sd === 1e18 || bd <= 0.86 * sd);
    return { cmd: ok ? best : null, best: best, d: bd, second: sd, thr: best ? thr[best] : 0 };
  }

  /* ---------- oír qué suena ahora (modo «Escuchando» del director y «¿Qué oye el celular?») ----------
     Lo mismo que el oído del alumno (tecla por tecla, con la afinación del piano, sin roces ni golpes), pero sin
     saber qué se espera: cada 50 ms dice qué teclas suenan y cuánto pesa cada nota. Sirve con piano o guitarra. */
  function listenCreate3(opt) {
    opt = opt || {};
    var SR0 = opt.sr, NF = opt.nfft || 8192, T0 = Math.max(-50, Math.min(50, +opt.tune || 0));
    var SPL = spLayout(SR0, NF, T0), KMAX = spLayout(SR0, NF, 50).kmax, TT = tuneCreate(T0, opt.tune ? 30 : 0);
    var LO = opt.lo || 40, HI = opt.hi || 90, RING = opt.ring || 120, HARM = { 12: 1, 19: 1, 24: 1, 28: 1, 31: 1, 34: 1, 36: 1 };
    var S = { ring: [], hist: [], noise: null, lastOn: -1e9, pk: null, d1: -1, n: 0, tuned: !!opt.tune, lvl: null };
    function frame(f) {
      var sp = spPool(SPL, f.mag), b, q, cur = new Float64Array(SP_N);
      // ruido de fondo: lo mínimo de los últimos 6 s (una banda suena seguido: con 3 s se comía las notas largas)
      S.ring.push(sp); if (S.ring.length > RING) S.ring.shift();
      for (b = 0; b < SP_N; b++) { var nf = sp[b]; for (q = 0; q < S.ring.length; q++) if (S.ring[q][b] < nf) nf = S.ring[q][b]; cur[b] = Math.max(0, sp[b] - nf); }
      S.hist.push(cur); if (S.hist.length > 6) S.hist.shift();
      if (S.noise == null) S.noise = f.peak;
      var loud = f.peak > S.noise + 9;
      S.noise = f.peak < S.noise ? S.noise * 0.6 + f.peak * 0.4 : S.noise + Math.min(0.03, (f.peak - S.noise) * 0.002);
      var pk = f.db ? spPeaks(f.db, SR0 / NF) : null; S.d1 = pk ? spDrift(pk, S.pk) : -1; S.pk = pk;
      if (pk && loud && S.d1 >= 0 && S.d1 <= 4) {
        TT.add(pk);
        if (++S.n % 10 === 0) { var g = TT.get(); if (g.r >= 0.3 && g.w >= (S.tuned ? 25 : 8) && Math.abs(g.t - SPL.tune) >= (S.tuned ? 7 : 4)) { SPL = spLayout(SR0, NF, Math.round(g.t)); S.tuned = true; } }
      }
      // golpe (tecla o rasgueo): lo nuevo supera con margen lo de hace 150-250 ms y está en pocos tercios de semitono
      var onset = false;
      if (loud && f.t - S.lastOn > 150 && S.hist.length >= 5) {
        var H = S.hist, h1 = H[H.length - 2], hA = H[H.length - 4], hB = H[H.length - 5], ct = 0, s3 = 0, s1 = 0, dd = [], rise = new Float64Array(SP_N);
        for (b = 0; b < SP_N; b++) { var u3 = cur[b] - 1.3 * Math.max(hA[b], hB[b]), u1 = cur[b] - h1[b]; ct += cur[b]; if (u1 > 0) s1 += u1; if (u3 > 0) { s3 += u3; dd.push(u3); rise[b] = u3; } }
        if (ct > 0 && s3 / ct > 0.3 && s1 / ct > 0.1 && dd.length) {
          dd.sort(function (x, y) { return y - x; });
          var top = 0, nT = Math.round(0.12 * SP_N); for (q = 0; q < nT && q < dd.length; q++) top += dd[q];
          if (top / s3 >= 0.3 && spFit(SPL, rise, LO, HI).key >= 0.3) onset = true;
        }
      }
      if (onset) S.lastOn = f.t;
      var out = { t: f.t, peak: f.peak, loud: loud, onset: onset, keys: {}, pcs: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tonal: false, key: 0, err: 1, tune: SPL.tune, drift: S.d1 };
      if (!loud) return out;
      var fit = spFit(SPL, cur, LO, HI), all = fit.notes, ks = Object.keys(all).map(Number).sort(function (a, c) { return a - c; }), nw = {};
      // sin armónicos «fantasma» (la octava o la quinta de arriba de una tecla más grave que suena más)
      ks.forEach(function (m) { var v = all[m]; if (!ks.some(function (n) { return n < m && HARM[m - n] && all[n] >= 0.07 && all[n] >= v; })) nw[m] = v; });
      var mx = 0, p;
      Object.keys(nw).forEach(function (m) { if (nw[m] >= 0.07) out.pcs[mod12(+m)] += nw[m]; });
      for (p = 0; p < 12; p++) if (out.pcs[p] > mx) mx = out.pcs[p];
      if (mx > 0) for (p = 0; p < 12; p++) out.pcs[p] /= mx;
      out.keys = nw; out.all = all; out.key = fit.key; out.err = fit.err;
      // una voz sola (alguien que habla) mueve el tono: no es música para seguir; con la guitarra sonando, la mayoría
      // de los picos quedan quietos y sí cuenta
      out.tonal = mx > 0 && fit.key >= 0.3 && !(S.d1 > 6 && fit.key < (opt.voiceKey || 0.55));
      if (out.tonal) S.lvl = S.lvl == null ? f.peak : S.lvl * 0.97 + f.peak * 0.03;
      out.lvl = S.lvl;
      return out;
    }
    return { frame: frame, kmax: KMAX, tune: function () { return SPL.tune; }, tuneInfo: function () { return TT.get(); } };
  }

  /* ================= Oído 4 (oct 2026): una red neuronal pequeña que sabe cómo suena un piano de verdad =================
     El oído 3 calzaba moldes de piano hechos a mano (NNLS) y después decidía con muchas reglas sueltas («si la quinta
     es armónico del bajo, vale», «basta un 7 %»…). Cada regla aflojaba la exigencia y, juntas, dejaban pasar acordes
     equivocados (con una tecla de más, con el bajo cambiado) sobre todo con eco o con parlantes.
     Ahora una red neuronal pequeña (unos 12 mil números, entrenada con miles de acordes de pianos, pianos eléctricos y
     guitarras grabados de verdad, pasados por parlantes, salas, micrófonos de celular, voces y golpes) dice para cada
     tecla dos cosas: si SUENA y si la acaban de TOCAR. Mira cada tecla con sus armónicos (como lo hace el oído de un
     músico) y también a las teclas vecinas y a las de una octava o una quinta, así aprende sola que el Sol5 que aparece
     con un Do4 es su armónico y no una tecla tocada.
     Rejilla: el espectro del analizador (FFT de 8192, ventana de Blackman, en dB) pasado a tercios de semitono desde el
     Re1 hasta el Mi8 (36 Hz a 5,3 kHz), corrida según la afinación del piano. Es la misma en la app y al entrenar. */
  var O4_P0 = 26, O4_NB = 259, O4_M0 = 29, O4_NK = 68, o4Layouts = {};
  function o4Layout(sr, nfft, tune) {
    tune = Math.max(-50, Math.min(50, Math.round(tune || 0)));
    var key = sr + '/' + nfft + '/' + tune; if (o4Layouts[key]) return o4Layouts[key];
    var hz = sr / nfft, c = new Float64Array(O4_NB), a = new Int32Array(O4_NB), z = new Int32Array(O4_NB);
    for (var b = 0; b < O4_NB; b++) {
      var f = 440 * Math.pow(2, (O4_P0 + b / 3 - 69 + tune / 100) / 12);
      c[b] = f / hz; a[b] = Math.ceil(f * Math.pow(2, -1 / 72) / hz); z[b] = Math.floor(f * Math.pow(2, 1 / 72) / hz);
    }
    return (o4Layouts[key] = { sr: sr, nfft: nfft, hz: hz, c: c, a: a, z: z, tune: tune });
  }
  /* dB por bin de la FFT -> dB por tercio de semitono (lo más alto dentro del tercio, o el valor en el centro) */
  function o4Grid(L, db, out) {
    out = out || new Float32Array(O4_NB);
    var n = db.length;
    for (var b = 0; b < O4_NB; b++) {
      var k0 = Math.floor(L.c[b]), fr = L.c[b] - k0;
      if (k0 + 1 >= n) { out[b] = -160; continue; }
      var d0 = db[k0] > -160 ? db[k0] : -160, d1 = db[k0 + 1] > -160 ? db[k0 + 1] : -160, v = d0 * (1 - fr) + d1 * fr;
      for (var k = L.a[b]; k <= L.z[b] && k < n; k++) if (db[k] > v) v = db[k];
      out[b] = v > -160 ? v : -160;
    }
    return out;
  }
  /* La red: por tecla, su fundamental y armónicos (1/2, 1…8, con el tercio de al lado) en el cuadro de ahora y en los
     de hace ~50 y ~150 ms; luego una capa que mira a las teclas relacionadas. Pesos: O4W (entrenados en entrenar/). */
  var O4_HOFF = [-36, 0, 36, 57, 72, 84, 93, 101, 108], O4_OFFS = [], O4_DOFF = [-36, -31, -28, -24, -19, -17, -12, -7, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 7, 12, 19, 24, 28, 31];
  O4_HOFF.forEach(function (h) { O4_OFFS.push(h - 1, h, h + 1); }); O4_OFFS.push(-3, -2, 2, 3);
  var O4_NO = O4_OFFS.length, O4_ND = O4_DOFF.length, O4_NPOS = 8, O4_DIN = 3 * O4_NO + O4_NPOS + 3, O4_IDX = new Int32Array(O4_NK * O4_NO), O4_POS = new Float32Array(O4_NK * O4_NPOS);
  (function () {
    for (var k = 0; k < O4_NK; k++) {
      var b0 = 3 * (O4_M0 + k - O4_P0), m = O4_M0 + k, p = (m - 60) / 24, cs = [36, 48, 60, 72, 84, 96];
      for (var o = 0; o < O4_NO; o++) { var b = b0 + O4_OFFS[o]; O4_IDX[k * O4_NO + o] = b >= 0 && b < O4_NB ? b : -1; }
      O4_POS[k * O4_NPOS] = p; O4_POS[k * O4_NPOS + 1] = p * p;
      for (var q = 0; q < 6; q++) O4_POS[k * O4_NPOS + 2 + q] = Math.exp(-0.5 * Math.pow((m - cs[q]) / 8, 2));
    }
  })();
  var O4W = null;
  /* pesos: {W1: [[…]], b1: […], …} (como los guarda el entrenador) o empaquetados en base64 (int16 con escala) */
  function o4SetWeights(w) {
    var out = {}, names = ['W1', 'b1', 'W2', 'b2', 'W3', 'b3', 'V1', 'c1', 'V2', 'c2'];
    if (typeof w === 'string') {
      var bin = typeof atob === 'function' ? atob(w) : Buffer.from(w, 'base64').toString('binary'), u8 = new Uint8Array(bin.length), i;
      for (i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      var dv = new DataView(u8.buffer), pos = 0;
      names.forEach(function (n) {
        var r = dv.getUint16(pos, true), c = dv.getUint16(pos + 2, true), s = dv.getFloat32(pos + 4, true); pos += 8;
        var a = new Float64Array(r * c); for (var j = 0; j < r * c; j++) { a[j] = dv.getInt16(pos, true) * s; pos += 2; }
        out[n] = a; out[n + '_c'] = c;
      });
    } else names.forEach(function (n) {
      var v = w[n], flat = [], c = 1;
      if (Array.isArray(v[0])) { c = v[0].length; v.forEach(function (row) { flat.push.apply(flat, row); }); } else { flat = v; c = v.length; }
      out[n] = Float64Array.from(flat); out[n + '_c'] = c;
    });
    out.H1 = out.b1.length; out.H2 = out.b2.length; out.H3 = out.c1.length;
    O4W = out;
    return true;
  }
  /* g0, g1, g3: rejillas (dB) de ahora, del cuadro anterior y de tres cuadros atrás. Devuelve, por tecla (Fa1 = 0),
     la probabilidad de que suene (s) y de que la acaben de tocar (a). */
  var o4Buf = null;
  function o4Net(g0, g1, g3, out) {
    var W = O4W; if (!W) return null;
    var NK = O4_NK, NB = O4_NB, NO = O4_NO, ND = O4_ND, DIN = O4_DIN, NPOS = O4_NPOS, H1 = W.H1, H2 = W.H2, H3 = W.H3, i, j, k, b, o;
    var W1 = W.W1, B1 = W.b1, W2 = W.W2, B2 = W.b2, W3 = W.W3, B3 = W.b3, V1 = W.V1, C1 = W.c1, V2 = W.V2, C2 = W.c2, IDX = O4_IDX, POS = O4_POS, DOFF = O4_DOFF;
    if (!o4Buf || o4Buf.H1 !== H1) o4Buf = { H1: H1, X: [new Float64Array(NB), new Float64Array(NB), new Float64Array(NB)], f: new Float64Array(DIN), h1: new Float64Array(H1), h2: new Float64Array(NK * H2), z1: new Float64Array(NK * 2), u: new Float64Array(H3), U: new Float64Array(2 * ND + H2 + 2) };
    var Bf = o4Buf, X0 = Bf.X[0], X1 = Bf.X[1], X3 = Bf.X[2], f = Bf.f, h1 = Bf.h1, h2 = Bf.h2, z1 = Bf.z1, U = Bf.U, u = Bf.u, NU = U.length, ref = -1e9;
    for (b = 0; b < NB; b++) { if (g0[b] > ref) ref = g0[b]; if (g1[b] > ref) ref = g1[b]; if (g3[b] > ref) ref = g3[b]; }
    var m0 = 0, m5 = 0, rise = 0, v;
    for (b = 0; b < NB; b++) {
      v = (g0[b] - ref + 70) / 70; X0[b] = v < 0 ? 0 : v > 1 ? 1 : v;
      v = (g1[b] - ref + 70) / 70; X1[b] = v < 0 ? 0 : v > 1 ? 1 : v;
      v = (g3[b] - ref + 70) / 70; X3[b] = v < 0 ? 0 : v > 1 ? 1 : v;
      m0 += X0[b]; if (X0[b] > 0.5) m5++; var d = X0[b] - X3[b]; if (d > 0) rise += d;
    }
    var glob0 = m0 / NB, glob1 = m5 / NB, glob2 = rise / NB;
    for (k = 0; k < NK; k++) {
      var ko = k * NO;
      for (o = 0; o < NO; o++) { var bi = IDX[ko + o]; if (bi >= 0) { f[o] = X0[bi]; f[NO + o] = X1[bi]; f[2 * NO + o] = X3[bi]; } else { f[o] = 0; f[NO + o] = 0; f[2 * NO + o] = 0; } }
      for (i = 0; i < NPOS; i++) f[3 * NO + i] = POS[k * NPOS + i];
      f[3 * NO + NPOS] = glob0; f[3 * NO + NPOS + 1] = glob1; f[3 * NO + NPOS + 2] = glob2;
      for (j = 0; j < H1; j++) h1[j] = B1[j];
      for (i = 0; i < DIN; i++) { var fi = f[i]; if (fi === 0) continue; var r = i * H1; for (j = 0; j < H1; j++) h1[j] += fi * W1[r + j]; }
      var hk = k * H2;
      for (j = 0; j < H2; j++) h2[hk + j] = B2[j];
      for (i = 0; i < H1; i++) { var hi = h1[i]; if (hi <= 0) continue; var r2 = i * H2; for (j = 0; j < H2; j++) h2[hk + j] += hi * W2[r2 + j]; }
      var za = B3[0], zb = B3[1];
      for (i = 0; i < H2; i++) { var hv = h2[hk + i]; if (hv < 0) { h2[hk + i] = 0; continue; } za += hv * W3[i * 2]; zb += hv * W3[i * 2 + 1]; }
      z1[k * 2] = za; z1[k * 2 + 1] = zb;
    }
    out = out || { s: new Float32Array(NK), a: new Float32Array(NK), zs: new Float32Array(NK), za: new Float32Array(NK) };
    for (k = 0; k < NK; k++) {
      for (j = 0; j < ND; j++) { var kk = k + DOFF[j]; if (kk >= 0 && kk < NK) { U[2 * j] = z1[kk * 2]; U[2 * j + 1] = z1[kk * 2 + 1]; } else { U[2 * j] = -6; U[2 * j + 1] = -6; } }
      for (j = 0; j < H2; j++) U[2 * ND + j] = h2[k * H2 + j];
      U[2 * ND + H2] = z1[k * 2]; U[2 * ND + H2 + 1] = z1[k * 2 + 1];
      for (j = 0; j < H3; j++) u[j] = C1[j];
      for (i = 0; i < NU; i++) { var ui = U[i]; if (ui === 0) continue; var r3 = i * H3; for (j = 0; j < H3; j++) u[j] += ui * V1[r3 + j]; }
      var s2 = C2[0], a2 = C2[1];
      for (j = 0; j < H3; j++) { var uj = u[j]; if (uj > 0) { s2 += uj * V2[j * 2]; a2 += uj * V2[j * 2 + 1]; } }
      var zs = z1[k * 2] + s2, zt = z1[k * 2 + 1] + a2;
      out.zs[k] = zs; out.za[k] = zt;
      out.s[k] = 1 / (1 + Math.exp(-zs)); out.a[k] = 1 / (1 + Math.exp(-zt));
    }
    return out;
  }
  /* El oído 4 en marcha (lo comparten el alumno y «Escuchando»): cada cuadro pasa por la red; se sigue el ruido de
     fondo (en silencio no hay teclas) y la afinación del piano (la rejilla se corre lo mismo); y por tecla, cada
     «golpe»: desde que la red dice que la acaban de tocar hasta que deja de decirlo. */
  var O4_HARM = { 12: 1, 19: 1, 24: 1, 28: 1, 31: 1, 34: 1, 36: 1 }, O4_RISEH = [0, 36, 57, 72];
  /* cuánto sobresale el espectro en un tercio de semitono (el mejor de tres) respecto de un semitono al lado (el lado
     más bajo: si al lado suena otra tecla del acorde, por el otro lado igual se nota el pico) */
  function o4Peak(g, bc, both) {
    var best = -1e9, bb = -1;
    for (var d = -1; d <= 1; d++) { var b = bc + d; if (b >= 3 && b < O4_NB - 3 && g[b] > best) { best = g[b]; bb = b; } }
    return bb < 0 ? -99 : g[bb] - (both ? Math.max(g[bb - 3], g[bb + 3]) : Math.min(g[bb - 3], g[bb + 3]));
  }
  /* el «valle» de un espectro por tercios de semitono: en cada lugar, el percentil 30 de ±2 semitonos (13 tercios).
     Se queda con el fondo y deja afuera los picos de las notas (cada nota ocupa uno a tres tercios) */
  function o4Valley(g) {
    var out = new Float32Array(O4_NB), w = [];
    for (var b = 0; b < O4_NB; b++) {
      w.length = 0;
      for (var q = b - 6; q <= b + 6; q++) if (q >= 0 && q < O4_NB) w.push(g[q]);
      w.sort(function (x, y) { return x - y; });
      out[b] = w[Math.floor(w.length * 0.3)];
    }
    return out;
  }
  function o4Create(opt) {
    var SR0 = opt.sr, NF = opt.nfft || 8192, T0 = Math.max(-50, Math.min(50, +opt.tune || 0)), L4 = o4Layout(SR0, NF, T0);
    var TT = opt.autotune === false ? null : tuneCreate(T0, opt.tune ? 30 : 0), tuneN = 0, tuned = !!opt.tune;
    var THA = opt.tha || 0.5, NK = O4_NK, ring = [], RISE = opt.rise != null ? opt.rise : 2, UPN = opt.upn || 2, PK = opt.pk != null ? opt.pk : 6;
    var S = { noise: null, pk: null, d0: -1, d1: -1, lastOn: -1e9, epT: new Float64Array(NK).fill(-1e9), epLast: new Float64Array(NK).fill(-1e9), prevA: new Float32Array(NK), n: 0, conf: new Int16Array(NK), lplay: null };
    /* «Mapa del silencio» (7 oct): cuánto suena el fondo —ventilador, calle, el zumbido del parlante o de la laptop—
       en cada tercio de semitono. La red mira el espectro relativo a lo más fuerte del cuadro: en silencio, el ruido
       queda «estirado» y lo lee como notas (las notas fantasma que vio Ram). Con el mapa, una tecla solo cuenta si
       alguno de sus armónicos propios sobresale de su fondo SNR dB. El mapa se aprende solo: sigue al fondo donde no
       suena nada, baja enseguida si el fondo baja, y casi no se mueve donde suena una nota (así no «aprende» la música);
       si todo el espectro sube junto y se queda (un ventilador que se prende), lo sigue. */
    var PUERTA = opt.puerta !== false, NFON = PUERTA && opt.nf !== false, SNR = opt.snr != null ? opt.snr : 15, SNRF = opt.snrf != null ? opt.snrf : SNR, RLEV = opt.rlev != null ? opt.rlev : 35, NP = null, npN = 0, skip = 0, wideN = 0;
    var NPWARM = 10, NFLO = 3 * (36 - O4_P0), ZK = new Float32Array(NK);
    function nothing(f) {
      S.prevA.fill(0);
      return { t: f.t, s: new Float32Array(NK), a: new Float32Array(NK), rise: ZK, trend: 0, loud: false, peak: f.peak, onset: false, news: [], clip: !!f.clip, drift: S.d1, drift0: S.d0, tune: L4.tune, noise: S.noise, ex: ZK, warm: true };
    }
    function step(f) {
      var g = o4Grid(L4, f.db, new Float32Array(O4_NB));
      ring.push(g); if (ring.length > 4) ring.shift();
      // el micrófono recién prendido entrega ceros, y el análisis (0,17 s de sonido) tarda en llenarse: con eso no se
      // oye nada ni se aprende el fondo (antes el fondo quedaba en −160 dB y por minutos cualquier ruido «sonaba»).
      // Lo mismo si a medio camino llegan ceros (otra app tomó el micrófono): no se oye nada y el fondo no se toca
      if (PUERTA && !(f.peak > -150)) { if (!S.seen) skip = 4; return nothing(f); }
      if (PUERTA && skip > 0) { skip--; return nothing(f); }
      S.seen = true;
      var g1 = ring[Math.max(0, ring.length - 2)], g3 = ring[0], b;
      // cuánto sobresale cada tercio de semitono de su fondo (con el mapa de antes de este cuadro)
      var ex = null, exMax = 99;
      if (NFON) {
        // el mapa empieza con el «valle» del primer cuadro (lo más bajo de cada zona de ±2 semitonos): así, aunque ya
        // estén tocando cuando se prende el micrófono, no toma las notas como si fueran el fondo
        if (!NP) NP = o4Valley(g);
        ex = new Float32Array(O4_NB); exMax = -99;
        for (b = 0; b < O4_NB; b++) { ex[b] = g[b] - NP[b]; if (b >= NFLO && ex[b] > exMax) exMax = ex[b]; }
      }
      if (S.noise == null) S.noise = f.peak;
      // ¿suena algo? Con el mapa: si algo sobresale SNR dB de su fondo (o suena cerca del nivel al que se toca). Ya no se usa
      // el «piso» de antes (el mínimo del volumen): si se prendía con música sonando, quedaba alto y dejaba sordo al oído
      var loud = NFON ? npN >= NPWARM && (exMax >= SNRF || (S.lplay != null && f.peak >= S.lplay - RLEV)) : f.peak > S.noise + 9;
      S.noise = f.peak < S.noise ? S.noise * 0.6 + f.peak * 0.4 : S.noise + Math.min(0.03, (f.peak - S.noise) * 0.002);
      // afinación: de los picos quietos de lo que suena (un piano), no de una voz ni del silencio
      var pk = spPeaks(f.db, SR0 / NF); S.d0 = S.d1; S.d1 = spDrift(pk, S.pk); S.pk = pk;
      if (TT && loud && S.d1 >= 0 && S.d1 <= 4) {
        TT.add(pk);
        if (++tuneN % 5 === 0) {
          var tg = TT.get();
          if (tg.r >= 0.3 && tg.w >= (tuned ? 25 : 8) && Math.abs(tg.t - L4.tune) >= (tuned ? 7 : 4)) { L4 = o4Layout(SR0, NF, Math.round(tg.t)); tuned = true; }
          else if (tg.w >= 25) tuned = true;
        }
      }
      var r = o4Net(g, g1, g3), s = Float32Array.from(r.s), a = Float32Array.from(r.a), k;
      if (!loud) { s.fill(0); a.fill(0); }
      // una tecla recién tocada tiene que SUBIR: alguno de sus primeros armónicos más fuerte que hace 150 ms. Al soltar
      // las teclas (el apagador y el «clac» del teclado) el sonido baja: eso no es tocar, aunque la red dude
      var rs = new Float32Array(NK), tot = 0, tot3 = 0, bb;
      for (bb = 0; bb < O4_NB; bb++) { tot += Math.pow(10, g[bb] / 10); tot3 += Math.pow(10, g3[bb] / 10); }
      var trend = 10 * Math.log10((tot + 1e-30) / (tot3 + 1e-30));
      // y no basta con que suba UN armónico (puede ser el de otra tecla que coincide: el Sol3 que «aparece» con Do4
      // y Mi4 por el armónico 784 Hz): tienen que subir al menos dos de los cuatro primeros, y desde el Do3 hacia
      // arriba, la fundamental o el segundo (en los graves el parlante y el celular se comen la fundamental)
      for (k = 0; k < NK; k++) {
        if (a[k] < 0.25) continue;
        var b0 = 3 * (k + O4_M0 - O4_P0), rise = -99, nUp = 0, avail = 0, up01 = false;
        for (var h = 0; h < 4; h++) {
          var pr = -99, inR = false;
          for (var d = -1; d <= 1; d++) { var b = b0 + O4_RISEH[h] + d; if (b >= 0 && b < O4_NB) { inR = true; if (g[b] - g3[b] > pr) pr = g[b] - g3[b]; } }
          if (!inR) continue;
          avail++; if (pr > rise) rise = pr;
          if (pr >= RISE) { nUp++; if (h < 2) up01 = true; }
        }
        rs[k] = rise;
        if (nUp < Math.min(UPN, avail) || (k + O4_M0 >= 48 && !up01 && UPN > 1)) a[k] = 0;
      }
      // una tecla que suena de verdad deja un PICO en el espectro (más fuerte que a un semitono de cada lado) en su
      // fundamental o su segundo armónico (en los graves, en el 2.º, 3.º o 4.º). La red a veces «completa» un acorde
      // por costumbre (Do y Mi le hacen imaginar el Sol): sin pico propio, esa nota no está
      if (PK > 0) for (k = 0; k < NK; k++) {
        if (a[k] < 0.25 && s[k] < 0.25) continue;
        var c0 = 3 * (k + O4_M0 - O4_P0), low = k + O4_M0 < 48, okp = false;
        // (desde el Do4 el pico tiene que sobresalir de los dos lados; más abajo el espectro no separa bien las vecinas
        // y basta un lado: un bajo corrido un semitono, pegado a una tecla del acorde, igual se nota)
        for (var hh = low ? 1 : 0; hh < (low ? 4 : 2) && !okp; hh++) if (o4Peak(g, c0 + O4_RISEH[hh], k + O4_M0 >= 60) >= PK) okp = true;
        if (!okp) { a[k] = 0; s[k] = Math.min(s[k], 0.2); }
      }
      // y ese pico tiene que sobresalir del FONDO de su frecuencia (el mapa del silencio): si no, es ruido que la red
      // «leyó» como nota. Se mira lo mismo que para el pico propio: la fundamental o el 2.º (en los graves, 2.º a 4.º)
      // Y además, una vez que se oyó tocar de verdad (notas claras varios cuadros seguidos), lo que suena MUCHO más bajo
      // que eso (RLEV dB) no es tocar: es el fondo, un eco lejano o un ruidito. Si el mapa del fondo quedó alto porque ya
      // estaban tocando cuando se prendió el micrófono (el fondo nunca se oyó), en esas frecuencias manda esto otro
      var kx = ZK;
      if (NFON) {
        kx = new Float32Array(NK);
        var lev = new Float32Array(NK), lnb = new Int16Array(NK);
        for (k = 0; k < NK; k++) {
          var c1 = 3 * (k + O4_M0 - O4_P0), low1 = k + O4_M0 < 48, best = -99, lv = -999, nb = c1;
          for (var h1 = low1 ? 1 : 0; h1 < (low1 ? 4 : 2); h1++) for (var d1 = -1; d1 <= 1; d1++) {
            b = c1 + O4_RISEH[h1] + d1; if (b < 0 || b >= O4_NB) continue;
            if (ex[b] > best) best = ex[b];
            if (g[b] > lv) { lv = g[b]; nb = b; }
          }
          kx[k] = best; lev[k] = lv; lnb[k] = nb;
          // ¿se está tocando de verdad? (la red segura tres cuadros seguidos, con pico propio)
          S.conf[k] = loud && s[k] >= 0.9 ? S.conf[k] + 1 : 0;
          if (S.conf[k] >= 3) S.lplay = S.lplay == null ? lv : Math.max(S.lplay, lv);
        }
        // (la regla del nivel vale solo en las pausas: mientras suena un acorde, una de sus notas puede quedar muy baja
        // por el eco de dos parlantes —en la casa de Ram— y no por eso deja de estar)
        var musica = S.lplay != null && f.peak > S.lplay - 30;
        for (k = 0; k < NK; k++) {
          if (!(a[k] > 0 || s[k] > 0.15)) continue;
          var fondoOk = S.lplay == null || NP[lnb[k]] < S.lplay - 40;
          if ((fondoOk && kx[k] < SNR) || (S.lplay != null && !musica && lev[k] < S.lplay - RLEV)) { a[k] = 0; s[k] = Math.min(s[k], 0.15); }
        }
        if (S.lplay != null) S.lplay -= 0.025;                          // lo de «tocar fuerte» se olvida de a poco (0,5 dB/s)
        // aprender el fondo con este cuadro. Donde suena algo (más de 6 dB sobre el fondo) casi no se mueve; si casi
        // todo el espectro subió junto durante medio segundo, es el fondo el que cambió (o el celular se movió): se sigue
        var up = [], med = 0;
        for (b = NFLO; b < O4_NB; b += 2) up.push(ex[b]);
        up.sort(function (x, y) { return x - y; }); med = up[up.length >> 1];
        wideN = med > 6 ? wideN + 1 : 0;
        // Mientras suena música (cerca del nivel al que se toca) el mapa solo puede BAJAR: con eco y una canción entera
        // seguida, los «valles» entre notas suben y el mapa se iba subiendo con ellos hasta no oír las teclas más suaves
        var warm = npN < NPWARM;
        for (b = 0; b < O4_NB; b++) {
          var dd = ex[b];
          if (warm) { if (dd < 6) NP[b] += 0.3 * dd; }                    // el primer medio segundo: rápido (sin tomar notas)
          else if (dd < -6) NP[b] += 0.15 * dd;                           // el fondo bajó: se baja enseguida
          else if (musica) { if (dd < 0) NP[b] += 0.05 * dd; }            // suena música: solo baja
          else if (dd < 6) NP[b] += 0.05 * dd;                            // donde no suena nada: sigue al fondo
          else if (wideN >= 10) NP[b] += 0.1 * Math.min(dd, med);         // todo subió y se quedó: es el fondo
          else NP[b] += Math.min(0.02, 0.002 * dd);                       // suena una nota: casi quieto
        }
        npN++;
      }
      var news = [];
      for (k = 0; k < NK; k++) {
        if (a[k] >= THA) {
          if (S.prevA[k] < THA && f.t - S.epLast[k] > 120) { S.epT[k] = f.t; news.push(k); }
          S.epLast[k] = f.t;
        }
        S.prevA[k] = a[k];
      }
      var onset = news.length > 0 && f.t - S.lastOn > 120;
      if (onset) S.lastOn = f.t;
      S.n++;
      return { t: f.t, s: s, a: a, rise: rs, trend: trend, loud: loud, peak: f.peak, onset: onset, news: news, clip: !!f.clip, drift: S.d1, drift0: S.d0, tune: L4.tune, noise: S.noise, ex: kx, warm: NFON && npN <= NPWARM, exMax: exMax, g: g };
    }
    return { step: step, tune: function () { return L4.tune; }, tuneInfo: function () { return TT ? TT.get() : null; }, noise: function () { return S.noise; } };
  }
  /* ---------- el alumno: ¿tocó lo que pide la pantalla? (oído 4) ----------
     Cada intento empieza con un golpe y junta lo que se toca durante 1,6 s (un acorde de a poco también vale).
     - «¡Eso es!» solo si TODAS las notas del acorde se acaban de tocar (en la tecla que se ve o una octava más arriba o
       más abajo) y no se tocó ninguna tecla que no va. Una nota del acorde anterior que se mantiene apretada también
       cuenta (los dedos que no se mueven). Una tecla que es armónico exacto de otra del acorde (Do3 con Do4 y Sol4) no
       se puede oír aparte: ahí basta un rastro.
     - Una tecla que no va (de más, el bajo cambiado, un manotazo) frena SIEMPRE: «Oigo otra tecla» o «Sobra…».
     - Le falta algo: «Falta el …» (no es error).
     - Segunda oportunidad: si no se notó el golpe (muy suave), vale cuando las notas nuevas del acorde aparecen después
       del cambio y se quedan sonando claras, con todas las demás y sin teclas de más. */
  function hearCreate4(opt) {
    opt = opt || {};
    // (la «puerta del ruido» del 7 oct todavía no va en la práctica: en el navegador la escena del alumno de t_oido3 no
    // acepta los acordes con ella; se prende con opt.puerta = true para seguir probando)
    var E = o4Create(Object.assign({ puerta: false }, opt)), NK = O4_NK, M0 = O4_M0;
    var THA = opt.tha || 0.5, THW = opt.thw || 0.6, THS = opt.ths || 0.35, THSUS = opt.thsus || 0.6;
    var JUNTAR = opt.join || 1600, GRACE = 350, SETTLE = opt.settle || 150, PARTIAL = 400, BADSET = opt.badset || 250, NW = opt.nw || 4, TREND = opt.trend != null ? opt.trend : -2;
    var ADJA = opt.adja != null ? opt.adja : 0.9, PREVRISE = opt.prevrise != null ? opt.prevrise : 6, ADJ2 = opt.adj2 || 60;
    var SBAD = opt.sbad != null ? opt.sbad : 0.85, PRES = opt.pres != null ? opt.pres : 0.6;
    var NEWT = opt.newt != null ? opt.newt : 250, RETA = opt.reta !== false;
    var T = { tg: [], al: {}, acc: {}, exp: [], expK: {}, mask: {}, t0: -1e9, prev: {}, on: false };
    var A = null, S = { heard: null, hit: false, last: -1e9, sus: null, dbg: null, lastS: null };
    function keyOk(k) { return k >= 0 && k < NK; }
    function target(pcs, allow, reg, now, notes) {
      var tg = [];
      (pcs || []).forEach(function (p) { p = mod12(p); if (tg.indexOf(p) < 0) tg.push(p); });
      var pv = {}; T.tg.forEach(function (p) { pv[p] = 1; });
      T.prev = pv; T.tg = tg; T.al = {};
      tg.concat(allow || []).forEach(function (p) { T.al[mod12(p)] = 1; });
      var base = reg != null ? reg : 60, exp = [];
      (notes && notes.length ? notes : tg.map(function (p) { return base + mod12(p - base); })).forEach(function (m) {
        m = Math.round(m); if (tg.indexOf(mod12(m)) >= 0 && exp.indexOf(m) < 0) exp.push(m);
      });
      tg.forEach(function (p) { if (!exp.some(function (m) { return mod12(m) === p; })) exp.push(base + mod12(p - base)); });
      exp.sort(function (a, b) { return a - b; });
      T.exp = exp; T.acc = {}; T.mask = {}; T.expK = {};
      exp.forEach(function (e) {
        var p = mod12(e), L = T.acc[p] || (T.acc[p] = []);
        [0, 12, -12, 24].forEach(function (d) { var k = e + d - M0; if (keyOk(k) && L.indexOf(k) < 0) L.push(k); });
        T.expK[e - M0] = 1;
        // ¿es armónico exacto de otra tecla del acorde más grave? (Do4 y Sol4 sobre Do3)
        exp.forEach(function (j) { if (j < e && O4_HARM[e - j]) (T.mask[p] = T.mask[p] || []).push({ e: e - M0, by: j - M0 }); });
      });
      T.on = tg.length > 0;
      var t = now != null ? now : S.last;
      // un intento de hace muy poco que no fue acierto se juzga otra vez con lo nuevo (lo tocó un poquito antes)
      if (A && A.verdict !== 'ok' && t - A.start < GRACE) { A.verdict = null; A.partial = false; }
      else if (A && A.verdict !== 'ok' && A.verdict !== 'bad') A.closed = true;
      if (A && A.verdict === 'ok') A.closed = true;
      T.t0 = t;
      S.hit = false;
      // para la segunda oportunidad: cuánto sonaba cada nota al cambiar
      S.sus = { base: {}, cnt: 0, first: -1, done: false };
      if (S.lastS) tg.forEach(function (p) { S.sus.base[p] = pcMax(S.lastS, p); });
    }
    function pcMax(s, p) { var m = 0; for (var k = mod12(p - M0); k < NK; k += 12) if (s[k] > m) m = s[k]; return m; }
    function judge(r, now) {
      var out = null, tg = T.tg, age = now - A.start, have = [], miss = [], wrong = [], cand = 0, i;
      // acorde «parecido» al anterior (comparten dos notas o más, como Sim y Sol): las notas que siguen sonando del
      // anterior ya casi lo forman, así que la nota NUEVA tiene que SEGUIR sonando: 250 ms después de tocarla y clara
      // ahora (7 oct, noche, grabación de Ram: tocando Sim, un golpe grave más el Re que seguía sonando le hicieron imaginar
      // un Sol grave que duró 0,2 s y aceptó el Sol; una tecla de verdad sigue sonando)
      var parecido = NEWT > 0 && tg.filter(function (p) { return T.prev[p]; }).length >= 2;
      tg.forEach(function (p) {
        // (y que siga sonando clara ahora: la red a veces «completa» un acorde por costumbre —Do y Mi le hacen
        // imaginar el Sol— y esa nota imaginada suena débil o se le cae enseguida)
        var nueva = parecido && !T.prev[p];
        var ok = (T.acc[p] || []).some(function (k) { var x = A.keys[k]; return x && x.a >= THA && x.n >= 2 && (r.s[k] >= PRES || (x.s >= 0.9 && x.n >= 3)) && (!nueva || (now - x.t >= NEWT && r.s[k] >= PRES)); });
        // la tecla se mantiene apretada desde el acorde anterior (nota en común) y sigue sonando clara
        if (!ok && T.prev[p]) ok = (T.acc[p] || []).some(function (k) { return r.s[k] >= 0.55 && A.held && A.held[k]; });
        // armónico exacto de otra tecla del acorde que sí se tocó: basta un rastro
        if (!ok && T.mask[p]) ok = T.mask[p].some(function (q) { var b = A.keys[q.by]; return b && b.a >= THA && (r.s[q.e] >= 0.15 || (A.keys[q.e] && A.keys[q.e].a >= 0.2)); });
        (ok ? have : miss).push(p);
      });
      Object.keys(A.keys).forEach(function (k) {
        k = +k; var x = A.keys[k], p = mod12(k + M0);
        if (T.al[p] || x.a < THW) return;
        // (lo del acorde anterior que todavía suena justo al cambiar no es error: la red a veces lo nota un cuadro tarde;
        // pero si se VUELVE a tocar después del cambio, con un golpe de verdad —salto de volumen claro—, sí: 7 oct, noche: Ram
        // seguía tocando Sim con el Sol en pantalla y el Fa# contaba como «lo de antes» porque se miraba solo su primer
        // golpe; el eco o un parpadeo de la red no cuentan como golpe nuevo, y un golpe cuenta desde su primer cuadro:
        // con el último, un acorde bueno en un piano desafinado quedaba justo fuera de los 250 ms y se acusaba; y la
        // tecla tuvo que apagarse un poco antes —no cuenta el «latido» de una nota desafinada que sigue sonando—)
        if (T.prev[p] && (x.ta || x.t) < T.t0 + 250) return;
        // (una nota del acorde anterior que seguía sonando, con pedal o eco: para acusarla tiene que haberse tocado de
        // nuevo de verdad, con un salto claro de volumen)
        if (T.prev[p] && A.held && A.held[k] && x.rise < PREVRISE) return;
        // (la vecina de una tecla del acorde que sí se tocó —un semitono, o dos en los graves— puede ser derrame del
        // sonido o del eco: para acusarla la red tiene que estar segura)
        if (x.a < ADJA && Object.keys(A.keys).some(function (j) { j = +j; var dj = Math.abs(j - k); return T.al[mod12(j + M0)] && A.keys[j].a >= THA && (dj === 1 || (dj === 2 && k + M0 < ADJ2)); })) return;
        // (un armónico fuerte de una tecla que sí va, con la red dudando, no se acusa)
        // (los armónicos lejanos —desde dos octavas— de un bajo grave suenan fuerte por parlantes chicos: ahí la red
        // tiene que estar segurísima; la octava y la quinta de arriba, como antes)
        var hcl = 0;
        Object.keys(A.keys).forEach(function (j) { j = +j; if (j < k && O4_HARM[k - j] && T.al[mod12(j + M0)] && A.keys[j].a >= THA) hcl = Math.max(hcl, k - j >= 24 ? 2 : 1); });
        if (hcl === 2 && !(x.a >= 0.97 && x.s >= 0.95)) return;
        if (hcl === 1 && x.a < 0.8) return;
        // una tecla de más tiene que seguir sonando (un golpe o el «clac» de una tecla se apagan enseguida);
        // mientras suena y no se confirma, no se acusa pero tampoco se acepta. Para acusarla, además, la red tiene que
        // haber estado segura de que sonaba (una voz o un eco dejan dudas)
        if (r.s[k] < 0.3) return;
        if (x.n >= NW && now - x.t >= BADSET && x.s >= SBAD) wrong.push(k); else cand++;
      });
      if (opt.debug) S.dbg = { t: now, age: age, have: have, miss: miss, wrong: wrong.map(function (k) { return k + M0; }), held: Object.keys(A.held || {}).map(function (k) { return +k + M0; }), prev: Object.keys(T.prev), keys: Object.keys(A.keys).map(function (k) { var x = A.keys[k]; return [+k + M0, +x.a.toFixed(2), x.n, +x.s.toFixed(2), +(x.rise || 0).toFixed(1), +(r.s[k]).toFixed(2), Math.round(now - x.t)]; }) };
      if (wrong.length && !r.clip && age >= SETTLE) {
        A.verdict = 'bad'; S.badT = now;
        var wp = []; wrong.forEach(function (k) { var p = mod12(k + M0); if (wp.indexOf(p) < 0) wp.push(p); });
        var top = 0; wrong.forEach(function (k) { if (A.keys[k].a > top) top = A.keys[k].a; });
        return { type: 'bad', t: A.start, conf: top >= 0.85 ? 0.9 : 0.85, pcs: wp, extra: !miss.length, ks: wrong.map(function (k) { return [k + M0, +A.keys[k].a.toFixed(2), +A.keys[k].s.toFixed(2), A.keys[k].n]; }) };
      }
      if (!miss.length && !wrong.length && !cand && age >= SETTLE) {
        A.verdict = 'ok'; S.hit = true;
        return { type: 'ok', t: A.start, conf: 0.9 };
      }
      if (!A.partial && age >= PARTIAL && tg.length >= 2 && have.length && miss.length && !wrong.length) {
        A.partial = true;
        return { type: 'partial', t: A.start, have: have, miss: miss };
      }
      return out;
    }
    /* «¿Qué tecla es?»: la tecla que se acaba de tocar con más seguridad */
    function find(r, now) {
      if (now - A.start < SETTLE) return null;
      var best = -1, bv = 0;
      Object.keys(A.keys).forEach(function (k) { var x = A.keys[k]; if (x.n >= 1 && x.a > bv) { bv = x.a; best = +k; } });
      if (best < 0) return null;
      A.verdict = 'note';
      var m = best + M0; S.heard = { pc: mod12(m), conf: 0.9, t: now, midi: m };
      return { type: 'note', t: A.start, pc: mod12(m), conf: 0.9, midi: m };
    }
    function sustain(r, now) {
      var SU = S.sus; if (!SU || SU.done || !T.on || S.hit || now - (S.badT || -1e9) < 1500) return null;
      if (A && !A.closed && A.verdict !== 'ok' && now - A.last < 600) { SU.cnt = 0; return null; }   // mientras juzga un golpe, espera
      var fresh = T.tg.filter(function (p) { return !T.prev[p]; });
      if (!fresh.length || !r.loud || r.clip) { SU.cnt = 0; return null; }
      var allIn = T.tg.every(function (p) { return (T.acc[p] || []).some(function (k) { return r.s[k] >= THSUS; }) || (T.mask[p] && T.mask[p].some(function (q) { return r.s[q.by] >= THSUS; })); });
      var rose = fresh.every(function (p) { return (SU.base[p] || 0) < 0.3; });
      var extra = false;
      for (var k = 0; k < NK; k++) if (r.s[k] >= 0.5 && !T.al[mod12(k + M0)] && !T.prev[mod12(k + M0)]) { extra = true; break; }
      if (allIn && rose && !extra) { if (SU.first < 0) SU.first = now; SU.cnt++; } else { SU.cnt = 0; SU.first = -1; }
      if (SU.cnt >= (opt.susn || 5)) { SU.done = true; S.hit = true; if (A) A.verdict = 'ok'; return { type: 'ok', t: SU.first, conf: 0.85, sus: true }; }
      return null;
    }
    function frame(f) {
      if (!f.db) return null;
      var r = E.step(f), now = r.t, out = null, k;
      S.last = now;
      if (r.onset) out = { type: 'onset', t: now };
      // cuando el sonido total BAJA (se sueltan teclas: apagadores y «clac»), lo que la red crea oír no es un golpe
      var falling = r.trend < TREND, strong = function (k) { return r.a[k] >= 0.9 && r.rise[k] >= 10; };
      var news = falling ? r.news.filter(strong) : r.news;
      if (news.length) {
        if (!A || A.closed || A.verdict === 'ok' || A.verdict === 'bad' || A.verdict === 'note' || now - A.last > JUNTAR) {
          // notas que ya sonaban y se mantienen (para las notas en común con el acorde anterior)
          var held = {}; if (S.lastS) for (k = 0; k < NK; k++) if (S.lastS[k] >= 0.55) held[k] = 1;
          A = { start: now, last: now, keys: {}, verdict: null, partial: false, held: held };
        }
        else {
          // se junta con lo de antes (un acorde de a poco: «Falta el 5» y la toca), pero lo que ya no suena y nunca
          // sonó claro no cuenta (un golpe dudoso, el «clac» al soltar): ni a favor ni en contra
          Object.keys(A.keys).forEach(function (kk) { var x = A.keys[kk]; if (r.s[kk] < 0.3 && news.indexOf(+kk) < 0 && !(x.n >= 2 && x.s >= 0.6)) delete A.keys[kk]; });
        }
        A.last = now;
      }
      if (A && !A.verdict && !A.closed) {
        for (k = 0; k < NK; k++) {
          var x = A.keys[k];
          if (r.a[k] >= THA && (!falling || x || strong(k))) { if (!x) x = A.keys[k] = { t: now, a: 0, n: 0, s: 0, rise: -99 }; if (r.a[k] > x.a) x.a = r.a[k]; if (r.rise[k] > x.rise) x.rise = r.rise[k]; if (RETA && r.rise[k] >= PREVRISE && !(S.lastA && S.lastA[k] >= THA) && (x.ta == null || x.low)) { x.ta = now; x.low = false; } }
          if (x && r.s[k] >= THS && now > x.t) x.n++;
          if (x && r.s[k] < 0.5) x.low = true;             // (para contar un golpe nuevo, la tecla tuvo que bajar antes)
          if (x && r.s[k] > x.s) x.s = r.s[k];
        }
        var ev = T.on ? judge(r, now) : find(r, now);
        if (ev) out = ev;
        else if (now - A.last > JUNTAR) A.closed = true;
      }
      if (!out || out.type === 'onset') { var sv = sustain(r, now); if (sv) out = sv; }
      S.lastS = r.s; S.lastA = r.a;
      return out;
    }
    return { target: target, frame: frame, heard: function () { return S.heard; }, noise: function () { return E.noise(); }, dbg: function () { return S.dbg; },
      tune: function () { return E.tune(); }, tuneInfo: function () { return E.tuneInfo(); }, kmax: 0, chords: true, v: 4 };
  }
  /* ---------- «Escuchando» del director y «¿Qué oye el celular?» (oído 4) ----------
     Cada 50 ms: qué teclas suenan (probabilidad de la red) y cuánto pesa cada nota (lo más claro de sus teclas). */
  function listenCreate4(opt) {
    opt = opt || {};
    var E = o4Create(opt), lvl = null, LO = opt.lo || 28, HI = opt.hi || 100;
    function frame(f) {
      var r = E.step(f), pcs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], keys = {}, all = {}, mx = 0, ak = {};
      var out = { t: r.t, peak: f.peak, loud: r.loud, onset: r.onset, keys: keys, all: all, pcs: pcs, tonal: false, key: 0, err: 1, tune: r.tune, drift: r.drift, s: r.s, a: r.a, att: ak };
      if (!r.loud) { out.lvl = lvl; return out; }
      for (var k = 0; k < O4_NK; k++) {
        var m = k + O4_M0, v = r.s[k]; if (m < LO || m > HI) continue;
        if (v >= 0.1) all[m] = v;
        if (v >= 0.3) keys[m] = v;
        if (r.a[k] >= 0.5) ak[m] = r.a[k];
        var p = mod12(m); if (v > pcs[p]) pcs[p] = v;
        if (v > mx) mx = v;
      }
      out.tonal = mx >= 0.5; out.key = mx; out.err = 1 - mx;
      if (out.tonal) lvl = lvl == null ? f.peak : lvl * 0.97 + f.peak * 0.03;
      out.lvl = lvl;
      return out;
    }
    return { frame: frame, kmax: 0, tune: function () { return E.tune(); }, tuneInfo: function () { return E.tuneInfo(); }, v: 4 };
  }
  /* ¿Cuánto se parece lo que suena a un acorde? (oído 4) Con probabilidades por nota: que estén TODAS sus notas y que no
     suene claro nada de afuera. 1: es ese acorde; 0: nada que ver. Dos acordes que comparten notas ya no empatan: al
     que le falta una nota o al que le sobra una se le nota. */
  function chordScore4(f, chord) {
    if (!chord || !chord.length || !f || !f.pcs) return 0;
    var P = f.pcs, cov = 0, out = 0, inC = {};
    chord.forEach(function (q) { inC[q] = 1; cov += Math.min(1, P[q] / 0.55); });
    cov /= chord.length;
    for (var p = 0; p < 12; p++) if (!inC[p] && P[p] > 0.3) out = Math.max(out, (P[p] - 0.3) / 0.5);
    return Math.max(0, cov * cov * cov * (1 - Math.min(1, out)));
  }
  var O4_PESOS = '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';   /* pesos de la red del oído 4 (entrenar/empaquetar.py) */
  o4SetWeights(O4_PESOS);
  /* puntaje de un acorde con lo que entrega el oyente (el 4 si trae probabilidades, si no el del oído 3) */
  function chordScoreAny(f, chord) { return f && f.s ? chordScore4(f, chord) : chordScoreKeys(f && f.all || {}, chord); }
  /* el oído que corresponde: el 4 si están los pesos de la red (siempre en la app), o el 3 */
  function hearCreate(opt) { return O4W && opt && opt.sr && !opt.v3 ? hearCreate4(opt) : hearCreate3(opt); }
  function listenCreate(opt) { return O4W && opt && opt.sr && !opt.v3 ? listenCreate4(opt) : listenCreate3(opt); }

  var api = {
    SHARP: SHARP, FLAT: FLAT, LATIN: LATIN, mod12: mod12, splitTok: splitTok, isChordTok: isChordTok, isChordCore: isChordCore,
    parseChord: parseChord, isMinorQual: isMinorQual, noteName: noteName, spellForKey: spellForKey, transposeTok: transposeTok,
    parseSong: parseSong, parseLine: parseLine, segsOf: segsOf, chordsInSong: chordsInSong, detectKey: detectKey, keyName: keyName,
    suggestCapo: suggestCapo, pianoVoicing: pianoVoicing, chordIntervals: chordIntervals, songToText: songToText,
    importText: importText, bracketInline: bracketInline, sentenceCase: sentenceCase, nameCase: nameCase, normalize: normalize,
    srcToModel: srcToModel, modelToSrc: modelToSrc, modelLineToSrc: modelLineToSrc, normalizeModel: normalizeModel, sortChords: sortChords,
    modelToLetra: modelToLetra, parseLetra: parseLetra, reconcile: reconcile, transferChords: transferChords, lineKey: lineKey,
    syllableStarts: syllableStarts, copyChordsBySyllable: copyChordsBySyllable, diatonic: diatonic, chordLineInfo: chordLineInfo,
    closeVoicing: closeVoicing, splitMulti: splitMulti, ytId: ytId, ytStart: ytStart, parseClock: parseClock, fmtClock: fmtClock,
    tlRound: tlRound, tlQuantize: tlQuantize, tlEstimateBpm: tlEstimateBpm, tlTapBpm: tlTapBpm, tlStarts: tlStarts, tlVideoTimes: tlVideoTimes,
    tempoFromSamples: tempoFromSamples, onsetEnvelope: onsetEnvelope, fftRadix2: fftRadix2, _tempoCfg: tempoFromEnvelope,
    simpleChord: simpleChord, numLabel: numLabel, EZ_NUMS: EZ_NUMS, followerCreate: followerCreate,
    chordTemplate: chordTemplate, chordPcs: chordPcs, chordScore: chordScore, chordScoreKeys: chordScoreKeys, listenCreate: listenCreate, vozCreate: vozCreate, vozDtw: vozDtw, vozThresholds: vozThresholds, vozClassify: vozClassify, pianoTpl: pianoTpl, hearCreate: hearCreate, spLayout: spLayout, spPool: spPool, spNotes: spNotes, spFit: spFit, tuneCreate: tuneCreate, spPeaks: spPeaks, spDrift: spDrift, featureStream: featureStream, o4Layout: o4Layout, o4Grid: o4Grid, o4Net: o4Net, o4SetWeights: o4SetWeights, o4Create: o4Create, chordScore4: chordScore4, chordScoreAny: chordScoreAny, hearCreate3: hearCreate3, hearCreate4: hearCreate4, listenCreate3: listenCreate3, listenCreate4: listenCreate4, O4: { P0: O4_P0, NB: O4_NB, M0: O4_M0, NK: O4_NK }, beatTrack: beatTrack, beatFeatures: beatFeatures, alignSteps: alignSteps, suggestTimeline: suggestTimeline
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(this);
