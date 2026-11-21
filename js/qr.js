/* ============================================================
   Heart-shaped QR, reference style.
   - fat heart, single bezier path, filled with pink modules on a
     white field; the modules are clipped by the silhouette, which
     gives the jagged pixel edge and means NO empty areas
   - the grid is rotated 45 deg, so the three finder patterns land
     at the top / left / right of the heart like on the reference
   - cropping a finder pattern makes a QR unreadable, so each finder
     is redrawn on a small white plate that is guaranteed to stay
     whole. The plate is the same colour as the heart background, so
     it reads as part of the design
   - level H (30 %) error correction recovers the cropped data
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;

  var WHITE = '#fffdf9';
  var ACCENT = '#e5188c';

  function traceHeart(ctx, cx, cy, hw) {
    var top = cy - hw * 0.75;
    var tip = cy + hw * 1.20;
    var notch = cy - hw * 0.20;
    ctx.moveTo(cx, notch);
    ctx.bezierCurveTo(cx - hw * 0.1, notch - hw * 0.5,
                      cx - hw * 0.9, top,
                      cx - hw, top + hw * 0.3);
    ctx.bezierCurveTo(cx - hw * 1.0, top + hw * 0.8,
                      cx - hw * 0.6, cy + hw * 0.3,
                      cx, tip);
    ctx.bezierCurveTo(cx + hw * 0.6, cy + hw * 0.3,
                      cx + hw * 1.0, top + hw * 0.8,
                      cx + hw, top + hw * 0.3);
    ctx.bezierCurveTo(cx + hw * 0.9, top,
                      cx + hw * 0.1, notch - hw * 0.5,
                      cx, notch);
    ctx.closePath();
  }

  function heartPath2D(cx, cy, hw) {
    var p = new Path2D();
    traceHeart(p, cx, cy, hw);
    return p;
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index.html$/, '');
  }

  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || ACCENT;
    var white = opts.bg || WHITE;

    var qr = window.qrcode(0, 'H');
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

    /* grid: rotated square whose diagonal spans the heart width */
    var gy = cy + hw * 0.06;
    var side = hw * Math.SQRT2 * 1.02;
    var cell = side / n;
    var half = side / 2;

    /* ---- 1. white heart ---- */
    ctx.fillStyle = white;
    ctx.fill(path);

    /* ---- 2. data modules, clipped by the heart ---- */
    ctx.save();
    ctx.clip(path);
    ctx.translate(cx, gy);
    ctx.rotate(ANGLE);
    ctx.fillStyle = accent;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillRect(c * cell - half, r * cell - half, cell + 0.6, cell + 0.6);
      }
    }
    ctx.restore();

    /* ---- 3. the three finder patterns on white plates, never cropped ---- */
    var f = cell * 7;
    var plate = f + cell * 2.6;             // quiet margin around the finder
    var blocks = [
      [-half, -half],                       // top
      [half - f, -half],                    // right
      [-half, half - f]                     // left
    ];
    ctx.save();
    ctx.translate(cx, gy);
    ctx.rotate(ANGLE);
    blocks.forEach(function (b) {
      var mx = (plate - f) / 2;
      /* white plate + quiet zone */
      ctx.fillStyle = white;
      ctx.fillRect(b[0] - mx, b[1] - mx, plate, plate);
      /* 7x7 ring */
      ctx.fillStyle = accent;
      ctx.fillRect(b[0], b[1], f, f);
      ctx.fillStyle = white;
      ctx.fillRect(b[0] + cell, b[1] + cell, cell * 5, cell * 5);
      ctx.fillStyle = accent;
      ctx.fillRect(b[0] + cell * 2, b[1] + cell * 2, cell * 3, cell * 3);
    });
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