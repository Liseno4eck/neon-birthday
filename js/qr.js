/* ============================================================
   Heart-shaped QR, reference style.
   - fat heart drawn with a single bezier path
   - the QR grid is rotated 45 deg and drawn FULL SIZE, clipped
     by the heart silhouette => jagged pixel edge everywhere,
     finder patterns also clipped by the contour
   - level H (30 %) error correction keeps it scannable
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;
  var COS = Math.cos(ANGLE), SIN = Math.sin(ANGLE);

  /* Draw heart outline on ctx (single bezier, no subpaths).
     cx, cy = center; hw = half-width. */
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

  /* Pixel-based hit test */
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

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(path);

    /* ---- 45 deg rotated QR grid, clipped to heart ---- */
    ctx.save();
    ctx.clip(path);
    ctx.translate(cx, cy);
    ctx.rotate(ANGLE);

    /* Grid size: the heart is roughly hw x 1.95hw.
       At 45 deg a square of side L projects to a diamond of diagonal L*sqrt(2).
       We want the diamond to span the heart, so L*sqrt(2) ≈ 2*hw => L = hw*sqrt(2).
       But the heart is taller than wide, so we scale a bit larger. */
    var side = hw * 2.2;
    var cell = side / n;
    var half = side / 2;

    ctx.fillStyle = accent;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillRect(c * cell - half, r * cell - half, cell + 0.6, cell + 0.6);
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