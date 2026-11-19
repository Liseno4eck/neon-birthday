/* ============================================================
   Neon Birthday - site logic
   Content is loaded from a public GitHub repo (content repo),
   so every change the owner publishes is visible to everyone.
   ============================================================ */
(function () {
  'use strict';

  var STORE = {
    owner: 'Liseno4eck',
    repo: 'bday-content',
    branch: 'main',
    path: 'content.json'
  };

  var DEFAULTS = {
    secret: '1234',
    birthday: '19.11',
    theme: { n1: '#ff2bd1', n2: '#7b5cff', n3: '#00e5ff', bg: '#07000f', hearts: true },
    intro: {
      title: 'Приветик',
      text: 'Думаю, ты знаешь, что я увлекаюсь программированием.',
      button: 'Далее'
    },
    check: {
      title: 'Так что...',
      text: 'Знаю, что у тебя сегодня день рождения. Давай проверим, не ошибся ли я.',
      button: 'Далее'
    },
    date: {
      title: 'Когда у тебя ДР?',
      button: 'Проверить',
      hint: 'введи дату в формате дд.мм',
      error: 'Хм, не похоже. Попробуй ещё раз'
    },
    letter: {
      envelopeTitle: 'Тебе письмо',
      hint: 'Нажми на конверт, чтобы открыть',
      title: 'С днём рождения!',
      text: 'Текст письма ты напишешь в админке.',
      sign: '',
      photos: [],
      button: 'Продолжить'
    },
    final: {
      title: 'С Днём Рождения',
      subtitle: '',
      again: 'Ещё раз',
      photos: [],
      interval: 2500
    }
  };

  var ORDER = ['intro', 'check', 'date', 'letter', 'final'];
  var cfg = clone(DEFAULTS);
  var keyBuf = '';
  var letterOpened = false;
  var sliders = [];

  /* ---------- utils ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function merge(base, over) {
    for (var k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var v = over[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        merge(base[k], v);
      } else if (v !== undefined && v !== null) {
        base[k] = v;
      }
    }
    return base;
  }
  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, cfg);
  }
  function rawUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    return 'https://raw.githubusercontent.com/' + STORE.owner + '/' + STORE.repo + '/' + STORE.branch + '/' +
      path.replace(/^\/+/, '');
  }
  window.RAW_URL = rawUrl;
  window.STORE = STORE;

  /* ---------- content load ---------- */
  function loadContent() {
    var url = rawUrl(STORE.path) + '?t=' + Date.now();
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (json) { merge(cfg, json); })
      .catch(function () { /* offline / first run: keep defaults */ });
  }

  /* ---------- photo slider ---------- */
  function createSlider(wrapId, trackId, dotsId, photos, interval, arrows) {
    var wrap = $(wrapId), track = $(trackId), dots = $(dotsId);
    if (!wrap || !track || !dots) return null;
    track.innerHTML = '';
    dots.innerHTML = '';
    if (!photos.length) { wrap.hidden = true; return null; }
    wrap.hidden = false;
    var idx = 0, timer = null;
    var slides = [];
    photos.forEach(function (p, i) {
      var div = document.createElement('div');
      div.className = 'slider-slide' + (i === 0 ? ' active' : '');
      var img = document.createElement('img');
      img.src = rawUrl(p.src || p);
      img.alt = p.caption || ('фото ' + (i + 1));
      img.loading = i === 0 ? 'eager' : 'lazy';
      div.appendChild(img);
      track.appendChild(div);
      slides.push(div);
      var dot = document.createElement('span');
      if (i === 0) dot.className = 'on';
      dot.addEventListener('click', function () { show(i); restart(); });
      dots.appendChild(dot);
    });
    var dotEls = Array.prototype.slice.call(dots.children);
    function show(i) {
      slides[idx].classList.remove('active');
      dotEls[idx].classList.remove('on');
      idx = (i + slides.length) % slides.length;
      slides[idx].classList.add('active');
      dotEls[idx].classList.add('on');
    }
    function next() { show(idx + 1); }
    function prev() { show(idx - 1); }
    function restart() { clearInterval(timer); if (interval >= 1000 && slides.length > 1) timer = setInterval(next, interval); }
    if (arrows) {
      var ap = $(arrows.prev), an = $(arrows.next);
      if (ap) ap.onclick = function () { prev(); restart(); };
      if (an) an.onclick = function () { next(); restart(); };
    }
    restart();
    // swipe support
    var sx = 0;
    track.addEventListener('touchstart', function (e) { sx = e.changedTouches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); restart(); }
    }, { passive: true });
    return { stop: function () { clearInterval(timer); timer = null; }, start: restart };
  }
  function stopSliders() { sliders.forEach(function (s) { if (s) s.stop(); }); }
  function startSliders() { sliders.forEach(function (s) { if (s) s.start(); }); }

  /* ---------- render ---------- */
  function applyTheme() {
    var t = cfg.theme || {}, r = document.documentElement.style;
    r.setProperty('--n1', t.n1 || DEFAULTS.theme.n1);
    r.setProperty('--n2', t.n2 || DEFAULTS.theme.n2);
    r.setProperty('--n3', t.n3 || DEFAULTS.theme.n3);
    r.setProperty('--bg', t.bg || DEFAULTS.theme.bg);
    document.body.style.background = t.bg || DEFAULTS.theme.bg;
  }
  function render() {
    applyTheme();
    $$('[data-bind]').forEach(function (el) { el.textContent = get(el.dataset.bind) || ''; });
    $('#dateInput').placeholder = 'ддмм';

    // letter photos slider
    var lPhotos = (cfg.letter && cfg.letter.photos) || [];
    // backwards compat: single photo string
    if (cfg.letter && cfg.letter.photo && !lPhotos.length) lPhotos = [cfg.letter.photo];
    sliders[0] = createSlider('#letterSlider', '#letterSlider .slider-track', '#letterDots', lPhotos, 2500);

    // final photos
    var photos = (cfg.final && cfg.final.photos) || [];
    var gal = $('#gallery');
    gal.innerHTML = '';
    if (!photos.length) {
      $('#finalSlider').hidden = true;
      var note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = 'Здесь появятся фотографии. Добавь их в админ-панели.';
      gal.appendChild(note);
    } else {
      var interval = (cfg.final && cfg.final.interval) || 2500;
      sliders[1] = createSlider('#finalSlider', '#finalTrack', '#finalDots', photos, interval,
        { prev: '#finalPrev', next: '#finalNext' });
      // mini thumbnails below slider
      photos.forEach(function (p, i) {
        var f = document.createElement('figure');
        f.className = 'shot';
        f.style.animationDelay = (i * 0.08) + 's';
        var img = document.createElement('img');
        img.src = rawUrl(p.src || p);
        img.alt = (p.caption || 'фото ' + (i + 1));
        img.loading = 'lazy';
        f.appendChild(img);
        if (p.caption) {
          var cap = document.createElement('figcaption');
          cap.textContent = p.caption;
          f.appendChild(cap);
        }
        gal.appendChild(f);
      });
    }

    buildDots();
  }

  function buildDots() {
    var d = $('#dots');
    d.innerHTML = '';
    ORDER.forEach(function (name) {
      var s = document.createElement('span');
      if (name === current()) s.className = 'on';
      d.appendChild(s);
    });
  }
  function current() {
    var a = $('.screen.is-active');
    return a ? a.id.replace('s-', '') : 'intro';
  }
  function go(name) {
    if (ORDER.indexOf(name) < 0) return;
    stopSliders();
    var from = $('.screen.is-active');
    if (from) {
      from.style.transition = 'opacity .28s, transform .28s';
      from.style.opacity = '0';
      from.style.transform = 'translateY(-18px)';
      setTimeout(function () { from.classList.remove('is-active'); from.style.opacity = ''; from.style.transform = ''; }, 260);
    }
    setTimeout(function () {
      var to = $('#s-' + name);
      to.classList.add('is-active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      buildDots();
      startSliders();
      if (name === 'final') burst();
    }, from ? 280 : 0);
  }
  window.GO = go;

  /* ---------- hearts background ---------- */
  var cv = $('#hearts'), ctx = cv.getContext('2d'), hearts = [], W = 0, H = 0, raf = null;
  function sizeCv() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.width = Math.floor(innerWidth * dpr);
    H = cv.height = Math.floor(innerHeight * dpr);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function newH(start) {
    var t = cfg.theme || DEFAULTS.theme;
    var cols = [t.n1, t.n2, t.n3, '#ffffff'];
    return {
      x: Math.random() * innerWidth,
      y: start ? Math.random() * innerHeight : innerHeight + 30,
      s: 6 + Math.random() * 20,
      vy: .25 + Math.random() * .85,
      drift: (Math.random() - .5) * .7,
      a: .10 + Math.random() * .45,
      rot: (Math.random() - .5) * .7,
      vr: (Math.random() - .5) * .012,
      c: cols[(Math.random() * cols.length) | 0]
    };
  }
  function drawHeart(x, y, s, rot, c, a) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 20, s / 20);
    ctx.globalAlpha = a; ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.bezierCurveTo(0, 0, -10, -2, -10, 6);
    ctx.bezierCurveTo(-10, 13, 0, 18, 0, 23);
    ctx.bezierCurveTo(0, 18, 10, 13, 10, 6);
    ctx.bezierCurveTo(10, -2, 0, 0, 0, 6);
    ctx.fill(); ctx.restore();
  }
  function loop() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (cfg.theme && cfg.theme.hearts) {
      if (hearts.length < 34) hearts.push(newH(false));
      for (var i = hearts.length - 1; i >= 0; i--) {
        var h = hearts[i];
        h.y -= h.vy; h.x += h.drift + Math.sin(h.y / 90) * .35; h.rot += h.vr;
        if (h.y < -50) hearts[i] = newH(false);
        drawHeart(h.x, h.y, h.s, h.rot, h.c, h.a);
      }
    } else if (hearts.length) {
      hearts = []; ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
    raf = requestAnimationFrame(loop);
  }
  function burst() {
    for (var i = 0; i < 26; i++) {
      var h = newH(false);
      h.y = innerHeight * (0.55 + Math.random() * 0.45);
      h.vy = .8 + Math.random() * 1.8;
      h.a = .3 + Math.random() * .5;
      hearts.push(h);
    }
  }
  window.BURST = burst;

  /* ---------- secret combo ---------- */
  function checkSecret() {
    var s = (cfg.secret || DEFAULTS.secret).toLowerCase();
    if (s && keyBuf.length >= s.length && keyBuf.slice(-s.length) === s) {
      keyBuf = '';
      if (window.openAdmin) window.openAdmin();
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && window.closeAdmin) { window.closeAdmin(); return; }
    if (!e.key || e.key.length !== 1) return;
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    keyBuf = (keyBuf + e.key.toLowerCase()).slice(-40);
    checkSecret();
  });

  /* ---------- flow ---------- */
  function normDate(v) {
    var s = String(v).trim().replace(/[-\s]/g, '');
    var m = s.match(/^(\d{1,2})(\d{1,2})$/);
    if (!m) return null;
    var d = parseInt(m[1], 10), mo = parseInt(m[2], 10);
    if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
    return (d < 10 ? '0' + d : '' + d) + '.' + (mo < 10 ? '0' + mo : '' + mo);
  }
  function isBirthday(v) {
    var want = normDate(cfg.birthday || DEFAULTS.birthday);
    return want && v === want;
  }
  window.IS_BIRTHDAY = isBirthday;

  function init() {
    sizeCv();
    window.addEventListener('resize', sizeCv);
    loop();

    $$('[data-next]').forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.next); });
    });

    var input = $('#dateInput'), err = $('#dateError');
    input.addEventListener('input', function () {
      input.classList.remove('bad');
      err.textContent = '';
      // secret can also be typed straight into the date field
      var flat = input.value.trim().toLowerCase();
      var sec = String(cfg.secret || DEFAULTS.secret).toLowerCase();
      if (sec && flat === sec) {
        input.value = '';
        keyBuf = '';
        if (window.openAdmin) window.openAdmin();
      }
    });
    $('#dateForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var flat = input.value.trim().toLowerCase();
      var sec = String(cfg.secret || DEFAULTS.secret).toLowerCase();
      if (sec && flat === sec) {
        input.value = '';
        keyBuf = '';
        if (window.openAdmin) window.openAdmin();
        else window.TOAST('Админ-панель не загрузилась');
        return;
      }
      var v = normDate(input.value);
      if (!v) {
        input.classList.add('bad');
        err.textContent = (cfg.date.hint || '') ? 'Нужна дата в формате дд.мм' : 'Не похоже на дату';
        return;
      }
      if (isBirthday(v)) { go('letter'); }
      else {
        input.classList.add('bad');
        err.textContent = cfg.date.error || 'Не угадал';
        input.select();
      }
    });

    $('#envelope').addEventListener('click', openLetter);
    $('#letterNext').addEventListener('click', function () { go('final'); });
    $('#restart').addEventListener('click', function () {
      letterOpened = false;
      $('#paper').hidden = true;
      $('#letterNext').hidden = true;
      var env = $('#envelope');
      env.classList.remove('open');
      $('#envHint').classList.remove('gone');
      go('intro');
    });

    render();
    loadContent().then(render).then(function () {
      if (window.AdminBoot) window.AdminBoot();
    });
  }

  function openLetter() {
    if (letterOpened) return;
    letterOpened = true;
    $('#envelope').classList.add('open');
    $('#envHint').classList.add('gone');
    setTimeout(function () {
      $('#paper').hidden = false;
      burst();
      setTimeout(function () { $('#letterNext').hidden = false; }, 900);
    }, 620);
  }

  /* ---------- helpers for admin ---------- */
  window.CFG = function () { return cfg; };
  window.SET_CFG = function (next) { cfg = merge(clone(DEFAULTS), next || {}); render(); };
  window.DEFAULTS = DEFAULTS;
  window.TOAST = function (msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove('on'); }, 2600);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();