/* ============================================================
   Heart-shaped pixel QR (reference style).
   - the module grid is rotated 45 deg, so the three finder
     patterns land at top / left / right of the heart
   - everything is clipped to the heart silhouette, which gives
     the jagged pixel edge
   - pink modules on a white field (white bg is mandatory for
     a scannable code)
   - level H error correction (30 %) compensates for cropped data
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;          // 45 deg
  var COS = Math.cos(ANGLE), SIN = Math.sin(ANGLE);

  /* classic parametric heart, centred at (cx,cy), half-width hw */
  function heartPath(ctx, cx, cy, hw) {
    var hh = hw * (31 / 32);
    ctx.beginPath();
    for (var i = 0; i <= 720; i++) {
      var t = (i / 720) * Math.PI * 2;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      var px = cx + x * (hw / 16);
      var py = cy - y * (hh / 16);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* grid space (u,v) -> screen space, rotated 45 deg about (cx,cy) */
  function toScreen(cx, cy, u, v) {
    return [cx + u * COS - v * SIN, cy + u * SIN + v * COS];
  }

  /* biggest rotated grid whose three finder boxes stay fully inside.
     The heart has a notch on top, so the grid centre is searched over a
     wide vertical range; for every candidate centre we take the largest
     grid that keeps all three finder squares (eroded a bit) inside. */
  function fitGrid(inPathFull, inPathSafe, cx, cy, hw, n) {
    var hh = hw * (31 / 32);
    var best = null;

    for (var f = -0.45; f <= 0.45; f += 0.02) {
      var cyTry = cy + f * hh;
      for (var L = hw * 2.2; L >= hw * 0.6; L -= 1.5) {
        var cell = L / n;
        var side = cell * 7;                   // finder box side
        var h = L / 2;
        // finders sit at the TL / TR / BL corners of the grid
        var corners = [
          [-h, -h, 1, 1],    // TL -> top
          [ h, -h, -1, 1],   // TR -> right
          [-h,  h, 1, -1]    // BL -> left
        ];
        var ok = true;
        for (var k = 0; k < corners.length && ok; k++) {
          var o = corners[k];
          var pts = [
            [o[0], o[1]],
            [o[0] + side * o[2], o[1]],
            [o[0], o[1] + side * o[3]],
            [o[0] + side * o[2], o[1] + side * o[3]]
          ];
          for (var j = 0; j < 4; j++) {
            var s = toScreen(cx, cyTry, pts[j][0], pts[j][1]);
            if (!inPathSafe(s[0], s[1])) { ok = false; break; }
          }
        }
        // the free BR corner should not stick out of the tip either
        if (ok) {
          var br = toScreen(cx, cyTry, h, h);
          if (!inPathFull(br[0], br[1])) ok = false;
        }
        if (ok) {
          if (!best || L > best.L) best = { L: L, cy: cyTry, cell: cell };
          break;
        }
      }
    }
    return best;
  }

  function isFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index.html$/, '');
  }

  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || '#e5188c';

    var qr = window.qrcode(0, 'H');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();

    var hw = 200;                       // heart half width (css px)
    var hh = hw * (31 / 32);
    var pad = 26;
    var capH = 54;
    var W = Math.round(hw * 2 + pad * 2);
    var cx = W / 2;
    var cy = pad + hh;
    var H = Math.round(cy + hh + pad + capH);

    var S = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);

    var path = new Path2D();
    for (var i = 0; i <= 720; i++) {
      var t = (i / 720) * Math.PI * 2;
      var hx = 16 * Math.pow(Math.sin(t), 3);
      var hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      var px = cx + hx * (hw / 16);
      var py = cy - hy * (hh / 16);
      if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
    }
    path.closePath();

    var probe = document.createElement('canvas').getContext('2d');
    probe.canvas.width = W; probe.canvas.height = H;
    heartPath(probe, cx, cy, hw);
    function inPathFull(x, y) { return probe.isPointInPath(x, y); }

    // eroded heart: finder boxes must fit inside this to stay unclipped
    var probe2 = document.createElement('canvas').getContext('2d');
    probe2.canvas.width = W; probe2.canvas.height = H;
    heartPath(probe2, cx, cy + hw * 0.012, hw * 0.965);
    function inPathSafe(x, y) { return probe2.isPointInPath(x, y); }

    var fit = fitGrid(inPathFull, inPathSafe, cx, cy, hw, n);
    if (!fit) throw new Error('сердце слишком маленькое для этой ссылки');
    var cell = fit.cell;
    var L = fit.L;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(path);

    /* ---- modules, clipped to the heart ---- */
    ctx.save();
    ctx.clip(path);
    ctx.translate(cx, fit.cy);
    ctx.rotate(ANGLE);
    ctx.translate(-L / 2, -L / 2);

    ctx.fillStyle = accent;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
      }
    }

    /* finder patterns: 7x7 ring + 3x3 core, same pink as the rest */
    var anchors = [[0, 0], [n - 7, 0], [0, n - 7]];
    anchors.forEach(function (a) {
      var x = a[1] * cell, y = a[0] * cell;
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, cell * 7, cell * 7);
      ctx.fillStyle = '#fffdf9';
      ctx.fillRect(x + cell, y + cell, cell * 5, cell * 5);
      ctx.fillStyle = accent;
      ctx.fillRect(x + cell * 2, y + cell * 2, cell * 3, cell * 3);
    });

    ctx.restore();

    /* ---- caption ---- */
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a0f2a';
    ctx.font = '600 13px Manrope, system-ui, sans-serif';
    ctx.fillText('наведи камеру на сердечко', W / 2, H - capH + 20);
    ctx.fillStyle = '#a06a90';
    ctx.font = '400 11px Manrope, system-ui, sans-serif';
    var url = text.length > 44 ? text.slice(0, 42) + '…' : text;
    ctx.fillText(url, W / 2, H - capH + 38);

    return cv;
  }

  function show(opts) {
    opts = opts || {};
    var old = document.getElementById('qrModal');
    if (old) old.remove();

    var cv;
    try {
      if (!window.qrcode) throw new Error('qr-lib not loaded');
      cv = draw({ text: opts.text, accent: opts.accent });
    } catch (e) {
      if (window.TOAST) window.TOAST('Не удалось построить QR: ' + e.message);
      return;
    }

    var t = document.createElement('div');
    t.id = 'qrModal';
    t.innerHTML =
      '<div class="qr-card">' +
        '<button class="qr-x" id="qrClose" aria-label="Закрыть">&#10005;</button>' +
        '<b>Отсканируй сердечко</b>' +
        '<div class="qr-canvas" id="qrHolder"></div>' +
        '<div class="qr-url" id="qrUrl"></div>' +
        '<div class="qr-actions">' +
          '<button class="a-btn" id="qrPng">Скачать PNG</button>' +
          '<button class="a-btn" id="qrCopy">Скопировать ссылку</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(t);

    function $(s) { return t.querySelector(s); }
    $('#qrHolder').appendChild(cv);
    $('#qrUrl').textContent = opts.text || siteUrl();

    $('#qrClose').onclick = close;
    t.addEventListener('click', function (e) { if (e.target === t) close(); });
    $('#qrPng').onclick = function () {
      var a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'birthday-heart-qr.png';
      a.click();
    };
    $('#qrCopy').onclick = function () {
      var txt = opts.text || siteUrl();
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () {
        if (window.TOAST) window.TOAST('Ссылка скопирована');
      });
    };
    function close() { t.remove(); }
    document.addEventListener('keydown', function h(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', h); }
    });
  }

  function close() {
    var m = document.getElementById('qrModal');
    if (m) m.remove();
  }

  window.QR_SHOW = show;
  window.QR_CLOSE = close;
  window.SITE_URL = siteUrl;
})();