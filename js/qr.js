/* ============================================================
   Heart-styled QR renderer.
   Draws the QR modules as small hearts on a white card so it
   still scans reliably, and frames the whole thing in a heart.
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  function heartPath(ctx, x, y, s) {
    // heart centred at (x,y), size s
    var t = s / 2;
    ctx.beginPath();
    ctx.moveTo(x, y + t * 0.75);
    ctx.bezierCurveTo(x, y + t * 0.35, x - t, y - t * 0.1, x - t, y - t * 0.5);
    ctx.bezierCurveTo(x - t, y - t, x - t * 0.45, y - t, x, y - t * 0.45);
    ctx.bezierCurveTo(x + t * 0.45, y - t, x + t, y - t, x + t, y - t * 0.5);
    ctx.bezierCurveTo(x + t, y - t * 0.1, x, y + t * 0.35, x, y + t * 0.75);
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

  function isFinder(r, c, n) {
    return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  }
  function isQuiet(r, c, n) {
    return (r < 9 && c < 9) || (r < 9 && c >= n - 9) || (r >= n - 9 && c < 9);
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index\.html$/, '');
  }

  /* Draw QR for `text` into a canvas. Returns canvas. */
  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || '#ff2bd1';
    var accent2 = opts.accent2 || '#7b5cff';
    var scale = opts.scale || 2;

    var qr = window.qrcode(0, 'Q');
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();

    var quiet = 2;                 // quiet zone in modules
    var cell = 10;                 // module size in css px
    var pad = 22;                  // white card padding
    var capH = 46;                 // caption strip
    var size = (n + quiet * 2) * cell;
    var W = size + pad * 2;
    var H = W + capH;

    var cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);

    // ---- outer heart frame ----
    ctx.save();
    ctx.shadowColor = accent; ctx.shadowBlur = 26;
    heartPath(ctx, W / 2, 16, Math.min(W, H) * 0.055);
    ctx.fillStyle = accent; ctx.fill();
    ctx.restore();

    // ---- white card (needed for reliable scanning) ----
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 0, 30, W, W, 20); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    roundRect(ctx, 1, 31, W - 2, W - 2, 19); ctx.stroke();

    ctx.translate(pad, 30 + pad);

    // ---- modules ----
    var grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, accent);
    grad.addColorStop(1, accent2);
    ctx.fillStyle = grad;

    var dark = '#2a0b3d';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (isQuiet(r, c, n)) continue;      // keep finder surroundings clean
        var x = (c + quiet) * cell, y = (r + quiet) * cell;
        if (isFinder(r, c, n)) continue;     // finders drawn separately
        heartPath(ctx, x + cell / 2, y + cell / 2, cell * 1.06);
        ctx.fill();
      }
    }

    // ---- finder patterns: rounded squares + heart in the middle ----
    ctx.fillStyle = dark;
    var anchors = [[0, 0], [n - 7, 0], [0, n - 7]];
    anchors.forEach(function (a) {
      var x = (a[1] + quiet) * cell, y = (a[0] + quiet) * cell;
      roundRect(ctx, x, y, cell * 7, cell * 7, cell * 2.2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x + cell, y + cell, cell * 5, cell * 5, cell * 1.6); ctx.fill();
      ctx.fillStyle = grad;
      heartPath(ctx, x + cell * 3.5, y + cell * 3.5, cell * 3.2); ctx.fill();
      ctx.fillStyle = dark;
    });

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    // ---- caption ----
    ctx.textAlign = 'center';
    ctx.fillStyle = dark;
    ctx.font = '600 13px Manrope, system-ui, sans-serif';
    ctx.fillText('наведи камеру', W / 2, 30 + W + 20);
    ctx.fillStyle = '#8a6f9e';
    ctx.font = '400 11px Manrope, system-ui, sans-serif';
    var url = text.length > 42 ? text.slice(0, 40) + '...' : text;
    ctx.fillText(url, W / 2, 30 + W + 37);

    return cv;
  }

  /* Build + show the modal. */
  function show(opts) {
    opts = opts || {};
    var old = document.getElementById('qrModal');
    if (old) old.remove();

    var cv;
    try {
      if (!window.qrcode) throw new Error('qr-lib not loaded');
      cv = draw({ text: opts.text, accent: opts.accent, accent2: opts.accent2 });
    } catch (e) {
      if (window.TOAST) window.TOAST('Не удалось построить QR: ' + e.message);
      return;
    }

    var t = document.createElement('div');
    t.id = 'qrModal';
    t.innerHTML =
      '<div class="qr-card">' +
        '<button class="qr-x" id="qrClose" aria-label="Закрыть">&#10005;</button>' +
        '<div class="qr-canvas" id="qrHolder"></div>' +
        '<div class="qr-url" id="qrUrl"></div>' +
        '<div class="qr-actions">' +
          '<button class="a-btn" id="qrPng">Скачать PNG</button>' +
          '<button class="a-btn" id="qrCopy">Скопировать ссылку</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(t);

    $('#qrHolder').appendChild(cv);
    $('#qrUrl').textContent = opts.text || siteUrl();

    function $(s) { return t.querySelector(s); }
    $('#qrClose').onclick = close;
    t.addEventListener('click', function (e) { if (e.target === t) close(); });
    $('#qrPng').onclick = function () {
      var a = document.createElement('a');
      a.href = cv.toDataURL('image/png');
      a.download = 'birthday-qr.png';
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