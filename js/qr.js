/* ============================================================
   Heart-shaped QR (reference style).
   - a compact QR code is drawn WHOLE in the middle of the heart,
     tilted by a small angle so every scanner can still read it
   - a white plate under it keeps the mandatory quiet zone free,
     which is what actually makes the code scannable
   - the rest of the heart is filled with random pink modules in
     the same pixel style (decoration only, kept away from the
     quiet zone)
   - level H error correction, pink on white
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var TILT = -12;                   // degrees: tilted look, still scannable

  /* classic parametric heart as a Path2D, centred at (cx,cy), half-width hw */
  function heartPath2D(cx, cy, hw) {
    var hh = hw * (31 / 32);
    var p = new Path2D();
    for (var i = 0; i <= 720; i++) {
      var t = (i / 720) * Math.PI * 2;
      var x = 16 * Math.pow(Math.sin(t), 3);
      var y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      var px = cx + x * (hw / 16);
      var py = cy - y * (hh / 16);
      if (i === 0) p.moveTo(px, py); else p.lineTo(px, py);
    }
    p.closePath();
    return p;
  }

  /* deterministic pseudo random, so the decoration is stable between redraws */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* biggest tilted square plate that still fits inside the heart.
     The heart is pinched on top (notch) and ends in a tip below, so the
     plate centre is searched over a vertical range. */
  function fitPlate(inPath, cx, cy, hw, tilt) {
    var hh = hw * (31 / 32);
    var co = Math.cos(tilt), si = Math.sin(tilt);
    var best = 0, bestCy = cy;
    for (var f = -0.06; f <= 0.30; f += 0.02) {
      var y = cy + f * hh;
      for (var S = hw * 2; S >= hw * 0.5; S -= 2) {
        var h = S / 2;
        var pts = [[-h, -h], [h, -h], [h, h], [-h, h]];
        var ok = true;
        for (var k = 0; k < 4; k++) {
          var px = cx + pts[k][0] * co - pts[k][1] * si;
          var py = y + pts[k][0] * si + pts[k][1] * co;
          if (!inPath(px, py)) { ok = false; break; }
        }
        if (ok) { if (S > best) { best = S; bestCy = y; } break; }
      }
    }
    return { size: best, cy: bestCy };
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index.html$/, '');
  }

  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || '#e5188c';

    /* The symbol is drawn whole now, so heavy error correction is not
       needed. Lower level => smaller version => bigger modules => the
       phone camera locks on much faster. */
    var qr = window.qrcode(0, 'M');
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

    var path = heartPath2D(cx, cy, hw);
    var probe = document.createElement('canvas').getContext('2d');
    probe.canvas.width = W; probe.canvas.height = H;
    function inPath(x, y) { return probe.isPointInPath(path, x, y); }

    /* ---- tilted plate that fits inside the heart ---- */
    var PLATE_TILT = TILT * DEG;
    var fit = fitPlate(inPath, cx, cy, hw, PLATE_TILT);
    var maxPlate = fit.size;
    var plateSize = Math.min(maxPlate, hw * 0.95);    // keep it "small"
    if (plateSize < hw * 0.5) throw new Error('сердце слишком маленькое для QR');
    var plateCy = fit.cy;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(path);

    /* ---- decoration: random pink modules in the empty parts of the heart ---- */
    var RND_CELL = 9;
    var halfW = W / 2, halfH = H / 2;
    var rnd = rng(Math.round(hw * 1000));
    ctx.save();
    ctx.clip(path);
    for (var dy = -halfH; dy < halfH; dy += RND_CELL) {
      for (var dx = -halfW; dx < halfW; dx += RND_CELL) {
        var sx = cx + dx, sy = cy + dy;
        if (!inPath(sx, sy)) continue;
        /* skip if inside or close to the plate (keep quiet zone clear) */
        var ddx = dx, ddy = dy - (plateCy - cy);
        var rdx =  ddx * Math.cos(-PLATE_TILT) - ddy * Math.sin(-PLATE_TILT);
        var rdy =  ddx * Math.sin(-PLATE_TILT) + ddy * Math.cos(-PLATE_TILT);
        if (Math.abs(rdx) < plateSize * 0.72 && Math.abs(rdy) < plateSize * 0.72) continue;
        if (rnd() > 0.36) continue;
        ctx.fillStyle = accent;
        ctx.fillRect(sx - RND_CELL / 2, sy - RND_CELL / 2, RND_CELL, RND_CELL);
      }
    }
    ctx.restore();

    /* ---- QR on white plate, tilted ---- */
    ctx.save();
    ctx.translate(cx, plateCy);
    ctx.rotate(PLATE_TILT);

    /* white plate background */
    ctx.fillStyle = '#fffdf9';
    var pH = plateSize / 2;
    ctx.fillRect(-pH, -pH, plateSize, plateSize);

    /* QR modules. 1/10 of the plate side on each margin = 4+ modules of
       quiet zone, which the spec requires around the symbol. */
    var QR = Math.min(plateSize / 1.25, 190);
    var cell = QR / n;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillStyle = accent;
        ctx.fillRect(c * cell - QR / 2, r * cell - QR / 2, cell + 0.5, cell + 0.5);
      }
    }

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

  /* open the QR straight from the address bar: site/#qr */
  window.addEventListener('load', function () {
    if (location.hash === '#qr') show();
  });
})();