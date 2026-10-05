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
  function hearCreate(opt) {
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
  function listenCreate(opt) {
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
    chordTemplate: chordTemplate, chordPcs: chordPcs, chordScore: chordScore, chordScoreKeys: chordScoreKeys, listenCreate: listenCreate, vozCreate: vozCreate, vozDtw: vozDtw, vozThresholds: vozThresholds, vozClassify: vozClassify, pianoTpl: pianoTpl, hearCreate: hearCreate, spLayout: spLayout, spPool: spPool, spNotes: spNotes, spFit: spFit, tuneCreate: tuneCreate, spPeaks: spPeaks, spDrift: spDrift, featureStream: featureStream, beatTrack: beatTrack, beatFeatures: beatFeatures, alignSteps: alignSteps, suggestTimeline: suggestTimeline
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Core = api;
})(this);
