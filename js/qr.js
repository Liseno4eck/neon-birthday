/* ============================================================
   Heart-shaped pixel QR, reference style:
   - fat rounded heart (two circles + triangle), almost square
   - module grid rotated 45 deg: the three finder patterns sit in
     the notch / left / right thick parts, the free corner aims
     at the tip; everything is clipped by the silhouette, which
     gives the jagged pixel edge
   - grid size and vertical placement are searched numerically so
     that all three finder squares stay >= 92 % visible
   - level H (30 %) error correction makes the cropped code
     scannable; pink modules on white
   Depends on qrcode-generator (window.qrcode).
   ============================================================ */
(function () {
  'use strict';

  var ANGLE = Math.PI / 4;
  var COS = Math.cos(ANGLE), SIN = Math.sin(ANGLE);

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

  /* grid coords (u,v) relative to grid centre -> screen coords */
  function toScreen(cx, gy, u, v) {
    return [cx + u * COS - v * SIN, gy + u * SIN + v * COS];
  }

  /* Largest rotated grid whose three finder squares stay visible.
     Returns { D: half-diagonal, gy: grid centre y } or null. */
  function fitGrid(inPath, heart, n) {
    for (var D = heart.hw * 1.2; D >= heart.hw * 0.5; D -= 2) {
      var side = D * Math.SQRT2;          // grid square side
      var cell = side / n;
      var f = cell * 7;                    // finder square side
      var half = side / 2;
      // finders in grid space: [u0, v0] = top-left corner of the 7x7 block
      var finders = [
        [-half, -half],          // TL -> top vertex (notch)
        [ half - f, -half],      // TR -> right vertex
        [-half,  half - f]       // BL -> left vertex
      ];
      for (var gy = heart.topY + D * 0.15; gy <= heart.tipY - D * 0.85; gy += 3) {
        var ok = true;
        for (var k = 0; k < 3 && ok; k++) {
          var hits = 0, total = 0;
          for (var i = 0; i <= 6; i++) {
            for (var j = 0; j <= 6; j++) {
              var s = toScreen(heart.cx, gy,
                finders[k][0] + f * i / 6,
                finders[k][1] + f * j / 6);
              if (inPath(s[0], s[1])) hits++;
              total++;
            }
          }
          if (hits / total < 0.92) ok = false;
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
    var pad = 24;
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

    var fit = fitGrid(inPath, heart, n);
    if (!fit) throw new Error('Не удалось подобрать сетку под сердце');

    /* white heart field */
    ctx.fillStyle = '#fffdf9';
    ctx.fill(heart.path);

    /* modules clipped to the heart */
    ctx.save();
    ctx.clip(heart.path);
    ctx.translate(cx, fit.gy);
    ctx.rotate(ANGLE);
    var side = fit.D * Math.SQRT2;
    var cell = side / n;
    var half = side / 2;
    ctx.fillStyle = accent;
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        ctx.fillRect(c * cell - half, r * cell - half, cell + 0.5, cell + 0.5);
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