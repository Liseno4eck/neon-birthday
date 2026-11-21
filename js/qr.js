/* ============================================================
   Heart-shaped pixel QR, reference style:
   - fat rounded heart (two circles + triangle), almost square
   - module grid rotated 45 deg: finder patterns sit at the top /
     left / right vertices of the diamond, the free corner aims at
     the tip; the silhouette clips everything, which gives the
     jagged pixel edge
   - level H (30 %) error correction keeps the cropped code
     scannable; pink modules on a white heart
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;

  /* fat heart: two circles for the lobes + triangle down to the tip */
  function buildHeart(cx, topY, hw) {
    var r = hw * 0.55;
    var lobeY = topY + r;
    var tipY = topY + hw * 1.95;
    var p = new Path2D();
    p.arc(cx - hw * 0.45, lobeY, r, 0, Math.PI * 2);
    p.arc(cx + hw * 0.45, lobeY, r, 0, Math.PI * 2);
    p.moveTo(cx - hw, lobeY);
    p.lineTo(cx, tipY);
    p.lineTo(cx + hw, lobeY);
    p.closePath();
    return { path: p, topY: topY, lobeY: lobeY, tipY: tipY, hw: hw, cx: cx };
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
    var H = Math.round(hw * 1.95 + pad * 2 + 40);
    var cx = W / 2;
    var topY = pad;

    var S = Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    var cv = document.createElement('canvas');
    cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var ctx = cv.getContext('2d');
    ctx.scale(S, S);

    var heart = buildHeart(cx, topY, hw);

    /* Diamond that spans the heart: half-diagonal D, centre (cx, gy).
       Choose D so the diamond covers the heart width and height. */
    var D = hw * 1.08;
    var gy = (topY + heart.tipY) / 2 + hw * 0.04;
    /* keep the bottom vertex above the tip so the tip stays pixel-clipped */
    if (gy + D > heart.tipY + hw * 0.10) gy = heart.tipY + hw * 0.10 - D;

    var side = D * Math.SQRT2;
    var cell = side / n;
    var half = side / 2;

    /* ---- white heart field ---- */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(heart.path);

    /* ---- modules, clipped to the heart ---- */
    ctx.save();
    ctx.clip(heart.path);
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

    /* ---- caption ---- */
    ctx.textAlign = 'center';
    ctx.fillStyle = '#3a0f2a';
    ctx.font = '600 13px Manrope, system-ui, sans-serif';
    ctx.fillText('наведи камеру на сердечко', cx, H - 22);

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