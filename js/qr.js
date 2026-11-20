/* ============================================================
   Heart-shaped QR: the QR matrix is fitted INSIDE a heart
   silhouette (white background, dark modules), so the code
   itself looks like a heart and still scans.
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  function heartPath(ctx, cx, cy, s) {
    var t = s / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy + t * 0.75);
    ctx.bezierCurveTo(cx, cy + t * 0.35, cx - t, cy - t * 0.1, cx - t, cy - t * 0.5);
    ctx.bezierCurveTo(cx - t, cy - t, cx - t * 0.45, cy - t, cx, cy - t * 0.45);
    ctx.bezierCurveTo(cx + t * 0.45, cy - t, cx + t, cy - t, cx + t, cy - t * 0.5);
    ctx.bezierCurveTo(cx + t, cy - t * 0.1, cx, cy + t * 0.35, cx, cy + t * 0.75);
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
  function isTiming(r, c, n) {
    return r === 6 || c === 6;
  }

  function siteUrl() {
    return location.origin + location.pathname.replace(/index.html$/, '');
  }

  /* Draw heart-shaped QR into a canvas. Returns canvas. */
  function draw(opts) {
    var text = opts.text || siteUrl();
    var accent = opts.accent || '#ff2bd1';
    var accent2 = opts.accent2 || '#7b5cff';
    var scale = opts.scale || 2;

    var qr = window.qrcode(0, 'H');  // level H = 30% recovery, safe for cropping
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();

    // canvas: heart + caption
    var heartSize = 340;   // heart bounding box width/height
    var W = heartSize + 40;
    var H = W + 70;        // caption area
    var cx = W / 2;
    var cy = heartSize / 2 + 20;

    var cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(scale, scale);

    // ---- outer glow heart (decorative) ----
    ctx.save();
    ctx.shadowColor = accent; ctx.shadowBlur = 40;
    heartPath(ctx, cx, cy, heartSize);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // ---- clip QR to heart shape ----
    ctx.save();
    heartPath(ctx, cx, cy, heartSize * 0.94);
    ctx.clip();

    // white background inside heart
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - heartSize / 2, cy - heartSize / 2, heartSize, heartSize);

    // QR matrix: center it, leave margins for heart curvature
    // we draw a square QR but clip makes it heart-shaped
    var cell = Math.floor(heartSize * 0.82 / n);
    var qrSize = cell * n;
    var ox = cx - qrSize / 2;
    var oy = cy - qrSize / 2 - 5;  // slightly up to fill heart lobes

    // dark modules as small hearts
    var dark = '#2a0b3d';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        var x = ox + c * cell;
        var y = oy + r * cell;
        if (isFinder(r, c, n)) {
          // finder squares drawn strictly to keep scanner lock
          ctx.fillStyle = dark;
          ctx.fillRect(x, y, cell, cell);
        } else if (isTiming(r, c, n)) {
          ctx.fillStyle = dark;
          ctx.fillRect(x, y, cell, cell);
        } else {
          // data modules as tiny hearts
          ctx.fillStyle = dark;
          heartPath(ctx, x + cell / 2, y + cell / 2, cell * 1.25);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // ---- neon border heart on top ----
    ctx.save();
    var grad = ctx.createLinearGradient(cx - heartSize / 2, 0, cx + heartSize / 2, 0);
    grad.addColorStop(0, accent);
    grad.addColorStop(0.5, accent2);
    grad.addColorStop(1, '#00e5ff');
    heartPath(ctx, cx, cy, heartSize);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.shadowColor = accent; ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();

    // ---- caption ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a0b3d';
    ctx.font = '600 13px Manrope, system-ui, sans-serif';
    ctx.fillText('наведи камеру на сердечко', cx, cy + heartSize / 2 + 26);
    ctx.fillStyle = '#8a6f9e';
    ctx.font = '400 11px Manrope, system-ui, sans-serif';
    var url = text.length > 42 ? text.slice(0, 40) + '...' : text;
    ctx.fillText(url, cx, cy + heartSize / 2 + 44);

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