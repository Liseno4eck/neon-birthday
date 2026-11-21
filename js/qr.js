/* ============================================================
   Heart-shaped QR, reference style.
   - heart drawn with a single bezier path (no subpaths, no holes)
   - a compact tilted QR sits whole inside the heart (never cropped),
     so all three finder patterns are readable
   - remaining heart area is filled with random pink pixel modules
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var TILT = 12 * DEG;
  var TCOS = Math.cos(TILT), TSIN = Math.sin(TILT);

  /* Draw a heart outline on ctx (does NOT begin/fill, just traces path).
     cx, cy = center; hw = half-width. */
  function traceHeart(ctx, cx, cy, hw) {
    var top = cy - hw * 0.75;
    var tip = cy + hw * 1.20;
    var notch = cy - hw * 0.20;
    ctx.moveTo(cx, notch);
    // left lobe
    ctx.bezierCurveTo(cx - hw * 0.1, notch - hw * 0.5,
                      cx - hw * 0.9, top,
                      cx - hw, top + hw * 0.3);
    ctx.bezierCurveTo(cx - hw * 1.0, top + hw * 0.8,
                      cx - hw * 0.6, cy + hw * 0.3,
                      cx, tip);
    // right lobe
    ctx.bezierCurveTo(cx + hw * 0.6, cy + hw * 0.3,
                      cx + hw * 1.0, top + hw * 0.8,
                      cx + hw, top + hw * 0.3);
    ctx.bezierCurveTo(cx + hw * 0.9, top,
                      cx + hw * 0.1, notch - hw * 0.5,
                      cx, notch);
    ctx.closePath();
  }

  /* Build a Path2D for the heart (for clip/fill) */
  function heartPath2D(cx, cy, hw) {
    var p = new Path2D();
    traceHeart(p, cx, cy, hw);
    return p;
  }

  /* Pixel-based hit test: draw heart on an offscreen canvas, then check pixels */
  function makeHitTester(W, H, path) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var pctx = c.getContext('2d');
    pctx.fillStyle = '#000';
    pctx.fill(path);
    var imgData = pctx.getImageData(0, 0, W, H).data;
    return function (x, y) {
      var xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || xi >= W || yi < 0 || yi >= H) return false;
      return imgData[(yi * W + xi) * 4 + 3] > 128;
    };
  }

  function squareCorners(cx, gy, S) {
    var h = S / 2;
    var pts = [[-h, -h], [h, -h], [h, h], [-h, h]];
    return pts.map(function (q) {
      return [cx + q[0] * TCOS - q[1] * TSIN, gy + q[0] * TSIN + q[1] * TCOS];
    });
  }

  /* largest tilted square fully inside the heart */
  function fitPlate(inPath, W, H) {
    var best = null;
    var cx = W / 2;
    var cy = H / 2;
    for (var S = W * 0.6; S >= W * 0.2; S -= 2) {
      for (var gy = cy - H * 0.1; gy <= cy + H * 0.1; gy += 3) {
        var c = squareCorners(cx, gy, S);
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

  /* deterministic PRNG */
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

    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();

    var hw = 200;
    var pad = 26;
    var W = Math.round(hw * 2 + pad * 2);
    var H = Math.round(hw * 2.2 + pad * 2);
    var cx = W / 2;
    var cy = H / 2;

    var S = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);

    var path = heartPath2D(cx, cy, hw);
    var inPath = makeHitTester(W, H, path);

    var fit = fitPlate(inPath, W, H);
    if (!fit) throw new Error('Не удалось вписать QR в сердце');

    var plate = fit.S;
    var plateCy = fit.gy;
    var quiet = plate * 0.06;
    var qrSide = plate - quiet * 2;
    var cell = qrSide / n;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(path);

    /* ---- decoration: pixel modules in the free part of the heart ---- */
    ctx.save();
    ctx.clip(path);
    var rnd = rng(Math.round(plate * 1000) + n);
    var guard = plate / 2 + cell * 2;
    for (var dy = -H; dy <= H; dy += cell) {
      for (var dx = -W; dx <= W; dx += cell) {
        var sx = cx + dx, sy = cy + dy;
        if (!inPath(sx, sy)) continue;
        var ux =  dx * TCOS + (sy - plateCy) * TSIN;
        var uy = -dx * TSIN + (sy - plateCy) * TCOS;
        if (Math.abs(ux) < guard && Math.abs(uy) < guard) continue;
        if (rnd() > 0.42) continue;
        ctx.fillStyle = accent;
        ctx.fillRect(sx - cell / 2, sy - cell / 2, cell, cell);
      }
    }
    ctx.restore();

    /* ---- the QR itself, tilted, drawn whole ---- */
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

  window.addEventListener('load', function () {
    if (location.hash === '#qr') show();
  });
})();