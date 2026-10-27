/* Publications page: cite toggles and the two interactive highlight figures. */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  };
  var SUB = '₀₁₂₃₄₅₆₇₈₉';
  var sub = function (n) { return String(n).split('').map(function (d) { return SUB[+d]; }).join(''); };
  var fmt = function (x, d) { return (x < 0 ? '−' : '') + Math.abs(x).toFixed(d); };

  // Segmented buttons: one pressed per group, calls onPick(value).
  function bindSeg(group, onPick) {
    var buttons = group.querySelectorAll('button');
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        onPick(b.dataset.v);
      });
    });
  }

  // ---------- cite boxes ----------
  document.querySelectorAll('.pub-cite-toggle').forEach(function (t) {
    t.addEventListener('click', function () {
      var box = $(t.getAttribute('aria-controls')), open = box.hidden;
      box.hidden = !open;
      t.setAttribute('aria-expanded', String(open));
    });
  });
  document.querySelectorAll('.pub-cite__copy').forEach(function (b) {
    b.addEventListener('click', function () {
      var pre = $(b.dataset.copy);
      var done = function (ok) { b.textContent = ok ? 'Copied' : 'Select and copy'; setTimeout(function () { b.textContent = 'Copy'; }, 1600); };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(pre);
        var s = getSelection(); s.removeAllRanges(); s.addRange(r); done(false);
      };
      try { navigator.clipboard.writeText(pre.textContent).then(function () { done(true); }, fallback); } catch (e) { fallback(); }
    });
  });

  // ---------- DAGFormer: cross-layer weight matrix ----------
  (function () {
    var D = window.PUB_DAGFORMER, plot = $('dag-plot');
    if (!D || !plot) return;
    var NAME = { q: 'query', k: 'key', v: 'value', r: 'residual' };
    var S = { model: 2, stream: 'q', mode: 'refined', hover: null };

    function weights(M) {
      if (S.mode !== 'vanilla') return M[S.mode][S.stream];
      var rows = [];
      for (var l = 2; l <= M.L; l++) {
        var r = []; for (var j = 0; j < l; j++) r.push(j === l - 1 ? 1 : 0);
        rows.push(r);
      }
      return rows;
    }

    // Colour is set in CSS through --a (0..1) and a sign class, so it follows the site theme.
    function render() {
      var M = D.models[S.model], W = weights(M), n = M.L, cell = 26, gap = 2, padL = 58, padT = 10, padB = 44;
      var w = padL + n * (cell + gap), h = padT + (n - 1) * (cell + gap) + padB;
      var s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="group" aria-label="Weight matrix, ' + M.name + ' model, ' + NAME[S.stream] + ' read">';
      for (var i = 0; i < W.length; i++) {
        var l = i + 2, y = padT + i * (cell + gap);
        s += '<text class="dag-lab" x="' + (padL - 8) + '" y="' + (y + cell / 2 + 4) + '" text-anchor="end">layer ' + l + '</text>';
        for (var j = 0; j < W[i].length; j++) {
          var a = W[i][j], x = padL + j * (cell + gap), mag = Math.min(1, Math.abs(a));
          s += '<rect tabindex="0" class="dag-cell ' + (a < 0 ? 'neg' : 'pos') + (j === l - 1 ? ' prev' : '') +
               '" data-i="' + i + '" data-j="' + j + '" x="' + x + '" y="' + y + '" width="' + cell + '" height="' + cell +
               '" rx="3" style="--a:' + mag.toFixed(3) + '"><title>Layer ' + l + ' ' + NAME[S.stream] + ' reads X' + sub(j) + ': ' + fmt(a, 2) + '</title></rect>';
        }
      }
      var yb = padT + (n - 1) * (cell + gap) + 16;
      for (var c = 0; c < n; c++) {
        s += '<text class="dag-lab" x="' + (padL + c * (cell + gap) + cell / 2) + '" y="' + yb + '" text-anchor="middle">X' + sub(c) + '</text>';
      }
      s += '<text class="dag-lab dag-lab--axis" x="' + (padL + n * (cell + gap) / 2) + '" y="' + (yb + 20) + '" text-anchor="middle">source read: embedding X₀, then layer outputs</text>';
      plot.innerHTML = s + '</svg>';
      plot.style.setProperty('--plot-max', (w * 1.25) + 'px');
      stat(M, W);
      readout();
    }

    // Share of the |weight| that skips the previous layer, over all layers.
    function stat(M, W) {
      var off = 0, tot = 0;
      W.forEach(function (row, i) { row.forEach(function (a, j) { tot += Math.abs(a); if (j !== i + 1) off += Math.abs(a); }); });
      $('dag-stat').innerHTML = S.mode === 'vanilla'
        ? 'Vanilla: every ' + NAME[S.stream] + ' read takes the previous layer only.'
        : '<b>' + Math.round(100 * off / (tot || 1)) + '%</b> of the total |α| on ' + NAME[S.stream] + ' reads in the ' + M.name + ' model goes to sources other than the previous layer.';
    }

    function readout() {
      var el = $('dag-readout'), M = D.models[S.model];
      if (!S.hover) { el.textContent = 'Hover a cell to read its weight.'; return; }
      var i = S.hover[0], j = S.hover[1], l = i + 2, a = weights(M)[i][j];
      var src = j === 0 ? 'the embedding X₀' : j === l - 1 ? 'X' + sub(j) + ', the previous layer,' : 'X' + sub(j) + ', the output of layer ' + j + ',';
      var per = S.stream === 'r' ? '' : ', mean over ' + M.H + ' heads';
      el.innerHTML = '<b>Layer ' + l + '</b> ' + NAME[S.stream] + ' reads ' + src + ' with weight <b>' + fmt(a, 2) + '</b>' + per + '.';
    }

    function setHover(t) {
      var c = t && t.closest && t.closest('.dag-cell');
      S.hover = c ? [+c.dataset.i, +c.dataset.j] : null;
      plot.querySelectorAll('.dag-cell.on').forEach(function (x) { x.classList.remove('on'); });
      if (c) c.classList.add('on');
      readout();
    }
    plot.addEventListener('mouseover', function (e) { setHover(e.target); });
    plot.addEventListener('focusin', function (e) { setHover(e.target); });
    plot.addEventListener('mouseleave', function () { setHover(null); });

    document.querySelectorAll('#fig-dag .pub-seg').forEach(function (g) {
      bindSeg(g, function (v) {
        var k = g.dataset.key;
        S[k] = k === 'model' ? +v : v;
        S.hover = null;
        render();
      });
    });
    render();
  })();

  // ---------- SAE-IDF: ranking of DBpedia candidates ----------
  (function () {
    var D = window.PUB_SAEIDF, cols = $('sae-cols');
    if (!D || !cols) return;
    var REPS = ['dense', 'sae', 'idf'], RNAME = { dense: 'Dense', sae: 'SAE unweighted', idf: 'SAE-IDF' };
    var RSUB = { dense: 'cosine of hidden states', sae: 'cosine of sparse codes', idf: 'sparse codes × idf' };
    var Q = D.queries, C = D.cands, sel = $('sae-q');
    var PAPER = Q.findIndex(function (q) { return q.q === 'trainstation'; });

    // Options sorted by name; label shows where the gold lands under Dense and SAE-IDF.
    Q.map(function (q, i) { return i; })
      .sort(function (a, b) { return Q[a].q.localeCompare(Q[b].q); })
      .forEach(function (i) {
        var q = Q[i], o = document.createElement('option');
        o.value = i;
        o.textContent = q.q + ' → ' + C[q.g] + '  (Dense #' + q.rank.dense + ', SAE-IDF #' + q.rank.idf + ')';
        sel.appendChild(o);
      });

    function column(q, m) {
      var top = q.top[m], max = top[0][1] || 1, hasGold = top.some(function (t) { return t[0] === q.g; });
      var h = '<section class="sae-col sae-col--' + m + '"><header><b>' + RNAME[m] + '</b><span>' + RSUB[m] + '</span></header>' +
              '<p class="sae-rank' + (q.rank[m] === 1 ? ' hit' : '') + '">gold ranked <b>#' + q.rank[m] + '</b> of ' + C.length + '</p><ol>';
      top.forEach(function (t, r) {
        var gold = t[0] === q.g;
        h += '<li class="' + (gold ? 'gold' : '') + '"><span class="sae-r">' + (r + 1) + '</span><span class="sae-c">' + esc(C[t[0]]) +
             (gold ? ' <em>gold</em>' : '') + '</span><span class="sae-bar"><i style="width:' + Math.max(2, 100 * t[1] / max).toFixed(1) + '%"></i></span>' +
             '<span class="sae-s">' + t[1].toFixed(3) + '</span></li>';
      });
      h += '</ol>';
      if (!hasGold) h += '<p class="sae-miss">gold <b>' + esc(C[q.g]) + '</b> at #' + q.rank[m] + ', cosine ' + q.gs[m].toFixed(3) + '</p>';
      return h + '</section>';
    }

    function why(q) {
      if (!q.f.length) return '';
      var bar = '', leg = '', used = 0;
      q.f.forEach(function (f, i) {
        var pct = Math.max(0, f[2]) * 100; used += pct;
        bar += '<i class="sw' + i + '" style="width:' + pct.toFixed(1) + '%"></i>';
        leg += '<li><i class="sw' + i + '"></i><b>' + Math.round(pct) + '%</b> “' + esc(f[1]) + '”</li>';
      });
      return '<p class="sae-why__title">Why SAE-IDF scores <b>' + esc(q.q) + '</b> → <b>' + esc(C[q.g]) + '</b> at ' + q.gs.idf.toFixed(3) +
             ': the cosine splits into named features</p><div class="sae-stack">' + bar + '<i class="rest" style="width:' + Math.max(0, 100 - used).toFixed(1) + '%"></i></div><ul>' + leg + '</ul>';
    }

    function show(i) {
      var q = Q[i];
      sel.value = i;
      cols.innerHTML = REPS.map(function (m) { return column(q, m); }).join('');
      $('sae-why').innerHTML = why(q);
    }

    var mrr = function (m) { return Q.reduce(function (s, q) { return s + 1 / q.rank[m]; }, 0) / Q.length; };
    var hit = function (m) { return Q.filter(function (q) { return q.rank[m] === 1; }).length; };
    $('sae-run').innerHTML = 'Over all ' + Q.length + ' queries in this run, gold ranked first: ' +
      REPS.map(function (m) { return RNAME[m] + ' <b>' + hit(m) + '</b>'; }).join(' · ') +
      '. MRR: ' + REPS.map(function (m) { return RNAME[m] + ' <b>' + mrr(m).toFixed(3) + '</b>'; }).join(' · ') + '.';

    sel.addEventListener('change', function () { show(+sel.value); });
    $('sae-paper').addEventListener('click', function () { show(PAPER); });
    $('sae-rand').addEventListener('click', function () {
      var i; do { i = Math.floor(Math.random() * Q.length); } while (i === +sel.value && Q.length > 1);
      show(i);
    });
    show(PAPER);
  })();
})();
