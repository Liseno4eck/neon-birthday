/* ============================================================
   Heart-shaped QR, reference style.
   - fat heart, single bezier path
   - QR grid rotated 45 deg: the three finder patterns sit at the
     TOP / LEFT / RIGHT vertices of the diamond (the thick parts of
     the heart) and the free corner points at the tip
   - the finder squares MUST stay fully inside the heart, otherwise
     no scanner can lock on the code; the data modules are allowed
     to be cropped by the silhouette (that is what makes the jagged
     pixel edge) and level-H error correction recovers them
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;
  var COS = Math.cos(ANGLE), SIN = Math.sin(ANGLE);

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

  /* grid coords (u,v) -> screen, rotated 45 deg about (cx,gy) */
  function toScreen(cx, gy, u, v) {
    return [cx + u * COS - v * SIN, gy + u * SIN + v * COS];
  }

  /* Largest 45deg grid whose three finder squares are FULLY inside.
     Grid square side = D*sqrt(2) where D is the half diagonal; the four
     grid corners land on the diamond vertices: TL=top, TR=right, BL=left,
     BR=bottom(tip). Finder blocks are anchored at TL, TR, BL. */
  function fitGrid(inPath, cx, cy, hw, n) {
    var topY = cy - hw * 0.75;
    var tipY = cy + hw * 1.20;
    for (var D = hw * 1.30; D >= hw * 0.55; D -= 3) {
      var side = D * Math.SQRT2;
      var f = side / n * 7;                 // finder square side
      var half = side / 2;
      // three finder blocks described by their grid-space corner + growth dirs
      var blocks = [
        [-half, -half,  1,  1],   // TL  -> top vertex
        [ half - f, -half, -1,  1],// TR  -> right vertex
        [-half,  half - f,  1, -1] // BL  -> left vertex
      ];
      for (var gy = cy - hw * 0.15; gy <= cy + hw * 0.45; gy += 4) {
        var ok = true;
        for (var k = 0; k < 3 && ok; k++) {
          var b = blocks[k];
          var pts = [
            [b[0], b[1]],
            [b[0] + f * b[2], b[1]],
            [b[0], b[1] + f * b[3]],
            [b[0] + f * b[2], b[1] + f * b[3]]
          ];
          for (var j = 0; j < 4; j++) {
            var s = toScreen(cx, gy, pts[j][0], pts[j][1]);
            if (!inPath(s[0], s[1])) { ok = false; break; }
          }
        }
        // the free (bottom) corner may stick out only slightly, and never
        // above the tip - otherwise the tip area stays empty
        if (ok) {
          var bot = toScreen(cx, gy, half, half);
          if (bot[1] > tipY + f * 0.6) ok = false;
        }
        if (ok) return { D: D, gy: gy };
      }
    }
    return null;
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

    var fit = fitGrid(inPath, cx, cy, hw, n);
    var D, gy;
    if (fit) { D = fit.D; gy = fit.gy; }
    else { D = hw * 1.0; gy = cy + hw * 0.05; }   // fallback: still scannable

    var side = D * Math.SQRT2;
    var cell = side / n;
    var half = side / 2;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(path);

    /* ---- modules, clipped to the heart ---- */
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