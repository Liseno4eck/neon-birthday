/* ============================================================
   Heart-shaped QR, reference style.
   - fat heart = two circles (lobes) + triangle (tip), all subpaths
     wound the SAME way so nonzero fill unions them into one shape
   - the QR itself is a compact tilted square drawn fully INSIDE the
     heart, so its three finder patterns are never cropped and every
     scanner can read it; the white heart is its quiet zone
   - the remaining heart area is filled with random pink modules of
     the same size, clipped by the silhouette => jagged pixel edge
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var TILT = 12 * DEG;              // slight tilt, still scannable
  var TCOS = Math.cos(TILT), TSIN = Math.sin(TILT);

  /* fat heart: two circles + triangle, consistent winding */
  function buildHeart(cx, topY, hw) {
    var r = hw * 0.55;
    var lobeY = topY + r;
    var tipY = topY + hw * 1.95;
    var p = new Path2D();
    p.moveTo(cx - hw * 0.45 + r, lobeY);
    p.arc(cx - hw * 0.45, lobeY, r, 0, Math.PI * 2);
    p.closePath();
    p.moveTo(cx + hw * 0.45 + r, lobeY);
    p.arc(cx + hw * 0.45, lobeY, r, 0, Math.PI * 2);
    p.closePath();
    p.moveTo(cx - hw, lobeY);          // clockwise, same as the arcs
    p.lineTo(cx + hw, lobeY);
    p.lineTo(cx, tipY);
    p.closePath();
    return { path: p, topY: topY, lobeY: lobeY, tipY: tipY, hw: hw, cx: cx };
  }

  /* corners of a square of side S centred at (cx,gy), tilted by TILT */
  function squareCorners(cx, gy, S) {
    var h = S / 2;
    var pts = [[-h, -h], [h, -h], [h, h], [-h, h]];
    return pts.map(function (q) {
      return [cx + q[0] * TCOS - q[1] * TSIN, gy + q[0] * TSIN + q[1] * TCOS];
    });
  }

  /* largest tilted square fully inside the heart */
  function fitPlate(inPath, heart) {
    var best = null;
    for (var S = heart.hw * 1.25; S >= heart.hw * 0.4; S -= 2) {
      for (var gy = heart.topY + S * 0.35; gy <= heart.tipY - S * 0.4; gy += 3) {
        var c = squareCorners(heart.cx, gy, S);
        if (inPath(c[0][0], c[0][1]) && inPath(c[1][0], c[1][1]) &&
            inPath(c[2][0], c[2][1]) && inPath(c[3][0], c[3][1])) {
          best = { S: S, gy: gy };
          break;
        }
      }
      if (best) break;
    }
    return best;
  }

  /* deterministic PRNG so the decoration looks the same on every redraw */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index.html$/, '');
  }

  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || '#e5188c';

    var qr = window.qrcode(0, 'M');   // whole symbol => light EC, bigger modules
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();

    var hw = 200;
    var pad = 26;
    var W = Math.round(hw * 2 + pad * 2);
    var H = Math.round(hw * 1.95 + pad * 2);
    var cx = W / 2;
    var topY = pad;

    var S = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);

    var heart = buildHeart(cx, topY, hw);

    var probe = document.createElement('canvas').getContext('2d');
    probe.canvas.width = W; probe.canvas.height = H;
    function inPath(x, y) { return probe.isPointInPath(heart.path, x, y); }

    var fit = fitPlate(inPath, heart);
    if (!fit) throw new Error('Не удалось вписать QR в сердце');

    var plate = fit.S;
    var plateCy = fit.gy;
    var quiet = plate * 0.06;                 // white margin around the symbol
    var qrSide = plate - quiet * 2;
    var cell = qrSide / n;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(heart.path);

    /* ---- decoration: pixel modules in the free part of the heart ---- */
    ctx.save();
    ctx.clip(heart.path);
    var rnd = rng(Math.round(plate * 1000) + n);
    var guard = plate / 2 + cell * 2;         // keep the quiet zone clean
    for (var dy = -H; dy <= H; dy += cell) {
      for (var dx = -W; dx <= W; dx += cell) {
        var sx = cx + dx, sy = topY + dy;
        if (!inPath(sx, sy)) continue;
        /* distance to the plate measured in the plate's own axes */
        var ux =  dx * TCOS + (sy - plateCy) * TSIN;
        var uy = -dx * TSIN + (sy - plateCy) * TCOS;
        if (Math.abs(ux) < guard && Math.abs(uy) < guard) continue;
        if (rnd() > 0.42) continue;
        ctx.fillStyle = accent;
        ctx.fillRect(sx - cell / 2, sy - cell / 2, cell, cell);
      }
    }
    ctx.restore();

    /* ---- the QR itself, tilted, drawn whole (never cropped) ---- */
    ctx.save();
    ctx.translate(cx, plateCy);
    ctx.rotate(TILT);
    ctx.fillStyle = accent;
    var o = -qrSide / 2;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillRect(o + c * cell, o + r * cell, cell + 0.4, cell + 0.4);
      }
    }
    ctx.restore();

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

  /* open the QR straight from the address bar: site/#qr */
  window.addEventListener('load', function () {
    if (location.hash === '#qr') show();
  });
})();