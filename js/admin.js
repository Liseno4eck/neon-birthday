/* ============================================================
   Hidden admin panel.
   Opens when the secret combo is typed (default 1234).
   Content is stored in the public content repo, so published
   changes are visible to every visitor.
   ============================================================ */
(function () {
  'use strict';

  var API = 'https://api.github.com';
  var LS = { tok: 'bd.tok', draft: 'bd.draft', sha: 'bd.sha' };
  var el = {}, sha = null, ready = false;
  try { sha = localStorage.getItem(LS.sha) || null; } catch (e) {}
  var published = null;      // last settings visitors actually see
  var publishedAt = '';      // when they were published

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function tok() { return localStorage.getItem(LS.tok) || ''; }

  function gh(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({
      'Authorization': 'Bearer ' + tok(),
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }, opts.headers || {});
    opts.method = opts.method || 'GET';
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    return fetch(API + path, opts).then(function (r) {
      if (r.status === 204) return null;
      return r.text().then(function (txt) {
        var j = null;
        try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && j.message) ? j.message : ('http ' + r.status));
        return j;
      });
    });
  }

  function get(path) {
    return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, window.CFG());
  }
  function setCfg(path, val) {
    var c = window.CFG(), p = path.split('.'), o = c;
    for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]]) o[p[i]] = {}; o = o[p[i]]; }
    o[p[p.length - 1]] = val;
    window.SET_CFG(c);
  }

  /* ---------- markup ---------- */
  function fld(path, label, ta) {
    var v = esc(get(path));
    return '<label class="a-fld"><span>' + label + '</span>' +
      (ta ? '<textarea data-f="' + path + '" rows="4">' + v + '</textarea>'
          : '<input data-f="' + path + '" value="' + v + '">') + '</label>';
  }
  function sec(title, inner) { return '<section class="a-sec"><h3>' + title + '</h3>' + inner + '</section>'; }

  function tpl() {
    return '' +
    '<div class="a-head"><b>ADMIN</b><span class="a-state" id="aState">черновик</span>' +
      '<button class="a-x" id="aClose" title="Закрыть (Esc)">&#10005;</button></div>' +
    '<div class="a-body">' +
      '<section class="a-cur" id="aCur"><h4>Действующие настройки сайта</h4>' +
        '<div class="a-row2"><span>адрес</span><b>' + esc(location.origin + location.pathname.replace(/index\.html$/, '')) + '</b></div>' +
        '<div class="a-mini">загружаю опубликованную версию...</div></section>' +
      sec('Подключение',
        '<label class="a-fld"><span>GitHub token (Contents: Read and write для ' + esc(window.STORE.owner + '/' + window.STORE.repo) + ')</span>' +
        '<input id="aTok" type="password" placeholder="github_pat_..."></label>' +
        '<div class="a-row"><button class="a-btn" id="aConn">Проверить и загрузить</button>' +
        '<span class="a-mini" id="aWho">токен не задан</span></div>') +
      sec('Экран 1 — приветствие', fld('intro.title', 'Заголовок') + fld('intro.text', 'Текст', 1) + fld('intro.button', 'Кнопка')) +
      sec('Экран 2 — проверка', fld('check.title', 'Заголовок') + fld('check.text', 'Текст', 1) + fld('check.button', 'Кнопка')) +
      sec('Экран 3 — дата', fld('date.title', 'Вопрос') + fld('date.button', 'Кнопка') + fld('date.hint', 'Подсказка') +
        fld('date.error', 'Текст ошибки') +
        '<label class="a-fld"><span>Правильная дата (дд.мм)</span><input data-f="birthday" value="' + esc(get('birthday')) + '"></label>') +
      sec('Экран 4 — письмо', fld('letter.envelopeTitle', 'Подпись над конвертом') + fld('letter.hint', 'Подсказка') +
        fld('letter.title', 'Заголовок письма') + fld('letter.text', 'Текст письма', 1) +
        fld('letter.sign', 'Подпись') + fld('letter.button', 'Кнопка') +
        '<div class="a-fld"><span>Фото в письме (несколько, листаются)</span><div class="a-grid" id="aLetterPhotos"></div>' +
        '<input type="file" id="aLetterFile" accept="image/*" multiple class="a-file"></div>') +
      sec('Экран 5 — финал', fld('final.title', 'Большой заголовок') + fld('final.subtitle', 'Подзаголовок', 1) +
        fld('final.again', 'Кнопка') +
        '<label class="a-fld"><span>Интервал смены фото (мс)</span><input type="number" data-f="final.interval" value="' + esc(get('final.interval')) + '" min="1000" max="10000" step="500"></label>' +
        '<div class="a-fld"><span>Фотографии</span><div class="a-grid" id="aPhotos"></div>' +
        '<input type="file" id="aAddPhoto" accept="image/*" multiple class="a-file"></div>') +
      sec('Секрет и фон',
        '<label class="a-fld"><span>Секретная комбинация (вводится на экране с датой)</span>' +
        '<input data-f="secret" value="' + esc(get('secret')) + '"></label>' +
        '<div class="a-grid4">' +
        '<label class="a-fld"><span>Неон 1</span><input type="color" data-f="theme.n1" value="' + esc(get('theme.n1')) + '"></label>' +
        '<label class="a-fld"><span>Неон 2</span><input type="color" data-f="theme.n2" value="' + esc(get('theme.n2')) + '"></label>' +
        '<label class="a-fld"><span>Неон 3</span><input type="color" data-f="theme.n3" value="' + esc(get('theme.n3')) + '"></label>' +
        '<label class="a-fld"><span>Фон</span><input type="color" data-f="theme.bg" value="' + esc(get('theme.bg')) + '"></label></div>' +
        '<label class="a-check"><input type="checkbox" data-f="theme.hearts" ' + (get('theme.hearts') ? 'checked' : '') + '> сердца на фоне</label>') +
      sec('Сохранение',
        '<div class="a-row"><button class="a-btn a-main" id="aSave">Опубликовать для всех</button>' +
        '<button class="a-btn" id="aReload">Отменить черновик</button></div>' +
        '<div class="a-row"><button class="a-btn" id="aRefresh">Обновить действующие</button></div>' +
        '<p class="a-mini">Опубликованное сразу видно всем посетителям. Без токена изменения живут только в этом браузере.</p>') +
    '</div>';
  }

  /* ---------- current (published) settings panel ---------- */
  function siteUrl() { return location.origin + location.pathname.replace(/index\.html$/, ''); }

  function row(label, val) {
    return '<div class="a-row2"><span>' + label + '</span><b>' + val + '</b></div>';
  }
  function shortTxt(s, n) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    n = n || 28;
    return esc(s.length > n ? s.slice(0, n - 1) + '…' : s);
  }
  function swatch(c) {
    return '<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:' + esc(c) + ';margin-left:5px;vertical-align:middle"></span>';
  }

  function renderCurrent() {
    var box = $('#aCur');
    if (!box) return;
    var cur = window.CFG() || {};
    var pub = published || {};
    var diff = changedCount(pub, cur);

    var head = '<h4>Действующие настройки сайта</h4>' +
      '<div class="a-row2"><span>адрес</span><b>' + esc(siteUrl()) + '</b></div>';

    if (!published) {
      box.innerHTML = head + '<div class="a-mini">опубликованная версия не найдена — сайт показывает встроенные значения по умолчанию</div>';
      return;
    }

    var lp = (pub.letter && pub.letter.photos) || [];
    if (pub.letter && pub.letter.photo && !lp.length) lp = [pub.letter.photo];
    var fp = (pub.final && pub.final.photos) || [];

    var html = head +
      '<div class="a-row2"><span>состояние</span><b>' +
        (diff ? '<span class="a-live draft">черновик: изменено полей — ' + diff + '</span>'
              : '<span class="a-live ok">совпадает с опубликованным</span>') + '</b></div>' +
      (publishedAt ? row('опубликовано', esc(publishedAt)) : '') +
      row('дата ДР', '<b>' + shortTxt(pub.birthday, 8) + '</b>') +
      row('секрет', esc(shortTxt(pub.secret, 10))) +
      row('экран 1', shortTxt(pub.intro && pub.intro.title) + ' — ' + shortTxt(pub.intro && pub.intro.text, 22)) +
      row('экран 2', shortTxt(pub.check && pub.check.title) + ' — ' + shortTxt(pub.check && pub.check.text, 22)) +
      row('экран 3', shortTxt(pub.date && pub.date.title)) +
      row('письмо', shortTxt(pub.letter && pub.letter.title) + ', фото: ' + lp.length) +
      row('финал', shortTxt(pub.final && pub.final.title) + ', фото: ' + fp.length +
        ', интервал ' + ((pub.final && pub.final.interval) || 2500) + ' мс') +
      row('цвета', esc(pub.theme && pub.theme.n1) + swatch(pub.theme && pub.theme.n1) +
        esc(pub.theme && pub.theme.n3) + swatch(pub.theme && pub.theme.n3) +
        (pub.theme && pub.theme.hearts ? ' <span class="a-dot"></span>сердца' : ' без сердец')) +
      '<div class="a-row" style="margin-top:8px"><button class="a-btn" id="aCopyJson">Скопировать JSON</button>' +
      '<button class="a-btn" id="aUsePublished">Отменить все правки</button></div>';

    box.innerHTML = html;

    var cp = $('#aCopyJson', box);
    if (cp) cp.onclick = function () {
      var txt = JSON.stringify(published, null, 2);
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { window.TOAST('JSON скопирован'); });
    };
    var up = $('#aUsePublished', box);
    if (up) up.onclick = function () {
      localStorage.removeItem(LS.draft);
      window.SET_CFG(published);
      bindInputs(); renderPhotos();
      state('загружена опубликованная версия', true);
      renderCurrent();
    };
  }

  function changedCount(a, b) {
    var n = 0;
    (function walk(x, y, path) {
      Object.keys(y || {}).forEach(function (k) {
        var v = y[k], w = x ? x[k] : undefined;
        var p = path ? path + '.' + k : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) { walk(w, v, p); }
        else {
          var sv = JSON.stringify(v), sw = JSON.stringify(w);
          if (sv !== sw) n++;
        }
      });
    })(a, b, '');
    return n;
  }

  function fetchPublished() {
    fetch(window.RAW_URL(window.STORE.path) + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) { published = j; renderCurrent(); } else renderCurrent(); })
      .catch(function () { renderCurrent(); });
    if (tok()) {
      gh('/repos/' + window.STORE.owner + '/' + window.STORE.repo + '/commits?path=' + window.STORE.path + '&per_page=1')
        .then(function (list) {
          if (list && list[0] && list[0].commit) {
            var d = new Date(list[0].commit.author.date);
            publishedAt = d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            renderCurrent();
          }
        }).catch(function () {});
    }
  }

  /* ---------- styles ---------- */
  function css() {
    if ($('#aStyle')) return;
    var s = document.createElement('style');
    s.id = 'aStyle';
    s.textContent =
      '#admin{position:fixed;top:12px;bottom:12px;left:12px;width:min(430px,94vw);z-index:90;display:flex;flex-direction:column;' +
      'background:rgba(10,2,18,.97);border:1px solid var(--n1);border-radius:16px;color:#f4eaff;' +
      'box-shadow:0 0 60px rgba(255,43,209,.35),0 30px 80px rgba(0,0,0,.7);font-family:Manrope,system-ui,sans-serif;font-size:13px}' +
      '#admin[hidden]{display:none}' +
      '.a-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid rgba(255,255,255,.1);' +
      'font-family:Unbounded,sans-serif;letter-spacing:.16em;font-size:12px}' +
      '.a-state{margin-left:auto;font-size:11px;letter-spacing:.04em;color:#00e5ff;font-family:Manrope,sans-serif}' +
      '.a-state.pub{color:#4ade80}' +
      '.a-x{background:none;border:0;color:#b39ccd;font-size:15px;cursor:pointer;padding:2px 6px}' +
      '.a-x:hover{color:#fff}' +
      '.a-body{overflow:auto;padding:12px 14px 24px;flex:1}' +
      '.a-sec{margin:0 0 18px;padding:0 0 16px;border-bottom:1px dashed rgba(255,255,255,.09)}' +
      '.a-sec h3{font-family:Unbounded,sans-serif;font-size:11px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;' +
      'color:#ff2bd1;margin:0 0 12px}' +
      '.a-fld{display:block;margin:0 0 10px}' +
      '.a-fld span{display:block;font-size:11px;color:#b39ccd;margin-bottom:5px}' +
      '.a-fld input,.a-fld textarea{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);' +
      'border-radius:9px;color:#fff;padding:9px 11px;font:inherit;outline:none;box-sizing:border-box}' +
      '.a-fld input:focus,.a-fld textarea:focus{border-color:var(--n3);box-shadow:0 0 0 3px rgba(0,229,255,.14)}' +
      '.a-fld input[type=color]{height:40px;padding:3px;cursor:pointer}' +
      '.a-fld textarea{resize:vertical;line-height:1.5}' +
      '.a-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}' +
      '.a-btn{cursor:pointer;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:#fff;' +
      'border-radius:9px;padding:9px 13px;font:inherit;transition:.2s}' +
      '.a-btn:hover{background:rgba(255,255,255,.14)}' +
      '.a-main{background:linear-gradient(100deg,#ff2bd1,#7b5cff);border:0;box-shadow:0 8px 24px rgba(255,43,209,.4);font-weight:600}' +
      '.a-mini{font-size:11px;color:#b39ccd;line-height:1.5}' +
      '.a-check{display:flex;gap:8px;align-items:center;font-size:12px;color:#b39ccd}' +
      '.a-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}' +
      '.a-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px}' +
      '.a-thumb{position:relative;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.16);background:#000}' +
      '.a-thumb img{display:block;width:100%;height:84px;object-fit:cover;opacity:.92}' +
      '.a-thumb input{width:100%;border:0;border-radius:0;background:rgba(0,0,0,.6);color:#fff;font-size:10px;padding:4px;box-sizing:border-box}' +
      '.a-thumb .a-del,.a-thumb .a-mv{position:absolute;top:3px;border:0;border-radius:5px;background:rgba(0,0,0,.66);color:#fff;' +
      'font-size:11px;cursor:pointer;padding:2px 5px;line-height:1.3}' +
      '.a-thumb .a-del{right:3px}.a-thumb .a-del:hover{background:#e11d48}' +
      '.a-thumb .a-mv{left:3px}.a-thumb .a-mv.r{left:auto;right:24px}' +
      '.a-img{margin-bottom:6px}.a-img img{max-width:100%;border-radius:8px;display:block;margin-bottom:6px;border:1px solid rgba(255,255,255,.16)}' +
      '.a-file{font-size:11px;color:#b39ccd;width:100%}';
    document.head.appendChild(s);
  }

  /* ---------- draft / publish ---------- */
  function state(txt, pub) {
    if (!el.state) return;
    el.state.textContent = txt;
    el.state.classList.toggle('pub', !!pub);
  }
  function mark() {
    state('есть черновик');
    try { localStorage.setItem(LS.draft, JSON.stringify(window.CFG())); } catch (e) {
      state('черновик не влез (слишком большие фото)');
    }
    renderCurrent();
  }
  function publish(retried) {
    if (!tok()) { window.TOAST('Сначала вставь GitHub token'); return; }
    state('публикую...');
    var json = JSON.stringify(window.CFG(), null, 2);
    var fileApi = '/repos/' + window.STORE.owner + '/' + window.STORE.repo + '/contents/' + window.STORE.path;

    function put(withSha) {
      var body = {
        message: 'update birthday content',
        content: btoa(unescape(encodeURIComponent(json)))
      };
      if (withSha) body.sha = withSha;
      return gh(fileApi, { method: 'PUT', body: JSON.stringify(body) });
    }

    var chain = sha ? Promise.resolve(sha)
      : gh(fileApi + '?ref=' + window.STORE.branch)
          .then(function (r) { return r && r.sha; })
          .catch(function () { return null; });   // file not there yet -> create it

    chain.then(put)
      .then(function (r) {
        sha = r && r.content && r.content.sha;
        localStorage.setItem(LS.sha, sha || '');
        localStorage.removeItem(LS.draft);
        published = JSON.parse(JSON.stringify(window.CFG()));
        publishedAt = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        state('опубликовано', true);
        renderCurrent();
        window.TOAST('Сохранено — теперь это видят все');
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '';
        // stale or missing sha (409 conflict / 422): refresh it once and retry
        if (!retried && /sha|Last commit|conflict/i.test(msg)) {
          sha = null;
          localStorage.removeItem(LS.sha);
          return gh(fileApi + '?ref=' + window.STORE.branch)
            .then(function (r) { sha = r && r.sha; localStorage.setItem(LS.sha, sha || ''); })
            .catch(function () { sha = null; })
            .then(function () { return publish(true); });
        }
        state('ошибка сохранения');
        window.TOAST('Не удалось: ' + msg);
      });
  }
  function pull() {
    return gh('/repos/' + window.STORE.owner + '/' + window.STORE.repo + '/contents/' + window.STORE.path + '?ref=' + window.STORE.branch)
      .then(function (r) {
        sha = r.sha;
        localStorage.setItem(LS.sha, sha);
        var remote = JSON.parse(decodeURIComponent(escape(atob(r.content.replace(/\s/g, '')))));
        var draft = localStorage.getItem(LS.draft);
        if (draft) {
          try { window.SET_CFG(JSON.parse(draft)); bindInputs(); renderPhotos(); state('показан черновик'); return; } catch (e) {}
        }
        window.SET_CFG(remote);
        bindInputs(); renderPhotos();
        state('актуально', true);
        published = remote;
        renderCurrent();
      });
  }

  /* ---------- photos ---------- */
  function renderThumbGrid(container, list, prefix) {
    container.innerHTML = '';
    list.forEach(function (p, i) {
      var src = p.src || p;
      var cap = p.caption || '';
      var d = document.createElement('div');
      d.className = 'a-thumb';
      d.innerHTML = '<img src="' + esc(window.RAW_URL(src)) + '" alt="">' +
        '<input data-' + prefix + '-cap="' + i + '" placeholder="подпись" value="' + esc(cap) + '">' +
        (i > 0 ? '<button class="a-mv" data-' + prefix + '-mv="' + i + '" data-dir="-1">&#8592;</button>' : '') +
        (i < list.length - 1 ? '<button class="a-mv r" data-' + prefix + '-mv="' + i + '" data-dir="1">&#8594;</button>' : '') +
        '<button class="a-del" data-' + prefix + '-del="' + i + '" title="Удалить">&#10005;</button>';
      container.appendChild(d);
    });
    if (!list.length) container.innerHTML = '<span class="a-mini">пока пусто</span>';
  }

  function renderPhotos() {
    if (!el.photos) return;
    var list = (window.CFG().final && window.CFG().final.photos) || [];
    renderThumbGrid(el.photos, list, 'ph');

    var lp = (get('letter.photos') || []);
    if (get('letter.photo') && !lp.length) lp = [{ src: get('letter.photo'), caption: '' }];
    renderThumbGrid(el.letter, lp, 'lt');
  }

  function fileToData(file, maxSide, q) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var s = Math.min(1, maxSide / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', q));
        };
        img.onerror = rej; img.src = fr.result;
      };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }
  function uploadImage(file) {
    if (!tok()) return Promise.reject(new Error('для загрузки фото нужен токен'));
    return fileToData(file, 1400, 0.85).then(function (data) {
      var name = 'img/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '.jpg';
      return gh('/repos/' + window.STORE.owner + '/' + window.STORE.repo + '/contents/' + name,
        { method: 'PUT', body: JSON.stringify({ message: 'site photo', content: data.split(',')[1] }) })
        .then(function () {
          return 'https://raw.githubusercontent.com/' + window.STORE.owner + '/' + window.STORE.repo + '/' + window.STORE.branch + '/' + name;
        });
    });
  }

  /* ---------- inputs ---------- */
  function bindInputs() {
    $$('[data-f]').forEach(function (n) {
      var v = get(n.dataset.f);
      if (n.type === 'checkbox') n.checked = !!v;
      else if (n.type === 'color') n.value = v || '#ffffff';
      else n.value = v == null ? '' : v;
    });
  }
  function $$(s) { return Array.prototype.slice.call(el.root.querySelectorAll(s)); }

  function init() {
    el.root = $('#admin');
    if (!el.root || ready) return;
    ready = true;
    css();
    el.root.innerHTML = tpl();
    el.state = $('#aState', el.root);
    el.photos = $('#aPhotos', el.root);
    el.letter = $('#aLetterPhotos', el.root);
    bindInputs();
    renderPhotos();

    var d = localStorage.getItem(LS.draft);
    if (d) { try { window.SET_CFG(JSON.parse(d)); bindInputs(); renderPhotos(); state('черновик из этого браузера'); } catch (e) {} }

    el.root.addEventListener('input', function (e) {
      var n = e.target;
      if (!n.dataset) return;
      if (n.dataset.f) {
        setCfg(n.dataset.f, n.type === 'checkbox' ? n.checked : (n.type === 'number' ? +n.value : n.value));
        mark();
        if (/^theme\./.test(n.dataset.f)) window.SET_CFG(window.CFG());
      }
      // captions for final photos
      if (n.dataset.phCap != null) {
        var list = (window.CFG().final.photos || []).slice();
        var it = list[+n.dataset.phCap];
        list[+n.dataset.phCap] = (typeof it === 'string') ? { src: it, caption: n.value } : Object.assign({}, it, { caption: n.value });
        window.CFG().final.photos = list; mark();
      }
      // captions for letter photos
      if (n.dataset.ltCap != null) {
        var lp = (get('letter.photos') || []).slice();
        var li = lp[+n.dataset.ltCap];
        lp[+n.dataset.ltCap] = (typeof li === 'string') ? { src: li, caption: n.value } : Object.assign({}, li, { caption: n.value });
        window.CFG().letter.photos = lp; mark();
      }
    });

    el.root.addEventListener('click', function (e) {
      var t = e.target;
      // final photos
      if (el.photos && el.photos.contains(t)) {
        var list = (window.CFG().final.photos || []).slice();
        if (t.dataset.phDel != null) { list.splice(+t.dataset.phDel, 1); setCfg('final.photos', list); mark(); renderPhotos(); }
        else if (t.dataset.phMv != null) { var i = +t.dataset.phMv, j = i + (+t.dataset.dir); if (list[j]) { var tmp = list[i]; list[i] = list[j]; list[j] = tmp; setCfg('final.photos', list); mark(); renderPhotos(); } }
      }
      // letter photos
      if (el.letter && el.letter.contains(t)) {
        var lp = (get('letter.photos') || []).slice();
        if (t.dataset.ltDel != null) { lp.splice(+t.dataset.ltDel, 1); setCfg('letter.photos', lp); mark(); renderPhotos(); }
        else if (t.dataset.ltMv != null) { var li = +t.dataset.ltMv, lj = li + (+t.dataset.dir); if (lp[lj]) { var lt = lp[li]; lp[li] = lp[lj]; lp[lj] = lt; setCfg('letter.photos', lp); mark(); renderPhotos(); } }
      }
    });

    $('#aClose', el.root).onclick = close;
    $('#aSave', el.root).onclick = publish;
    $('#aReload', el.root).onclick = function () {
      localStorage.removeItem(LS.draft);
      if (!tok()) { window.TOAST('Нужен токен'); return; }
      pull().then(function () { window.TOAST('Загружено опубликованное'); })
             .catch(function (e) { window.TOAST(e.message); });
    };
    $('#aConn', el.root).onclick = function () {
      var v = $('#aTok', el.root).value.trim();
      if (v) localStorage.setItem(LS.tok, v);
      if (!tok()) { window.TOAST('Вставь токен'); return; }
      state('проверяю...');
      gh('/user').then(function (u) {
        $('#aWho', el.root).textContent = 'вход: ' + u.login;
        return pull();
      }).then(function () { window.TOAST('Токен принят, контент загружен'); })
        .catch(function (e) { state('ошибка'); $('#aWho', el.root).textContent = e.message; });
    };
    $('#aRefresh', el.root).onclick = function () {
      fetchPublished();
      window.TOAST('Действующие настройки обновлены');
    };
    $('#aTok', el.root).value = tok();
    $('#aWho', el.root).textContent = tok() ? 'токен сохранён в этом браузере' : 'токен не задан';

    $('#aAddPhoto', el.root).onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      state('загружаю фото...');
      files.reduce(function (p, f) {
        return p.then(function () {
          return uploadImage(f).then(function (url) {
            var a = (window.CFG().final.photos || []).slice();
            a.push({ src: url, caption: '' });
            setCfg('final.photos', a); mark(); renderPhotos();
          });
        });
      }, Promise.resolve())
        .then(function () { state('готово — не забудь Опубликовать'); window.TOAST('Фото добавлены'); })
        .catch(function (err) { state('ошибка'); window.TOAST(err.message); });
    };

    $('#aLetterFile', el.root).onchange = function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      state('загружаю фото письма...');
      files.reduce(function (p, f) {
        return p.then(function () {
          return uploadImage(f).then(function (url) {
            var lp = (get('letter.photos') || []).slice();
            lp.push({ src: url, caption: '' });
            setCfg('letter.photos', lp); mark(); renderPhotos();
          });
        });
      }, Promise.resolve())
        .then(function () { state('готово — не забудь Опубликовать'); window.TOAST('Фото письма добавлены'); })
        .catch(function (err) { state('ошибка'); window.TOAST(err.message); });
    };

    fetchPublished();
  }

  function open() { init(); if (!el.root) return; el.root.hidden = false; }
  function close() { if (el.root) el.root.hidden = true; }

  window.openAdmin = open;
  window.closeAdmin = close;
  // called by app.js after content.json has been fetched
  window.AdminBoot = function () {
    if (!ready) { init(); return; }
    var draft = null;
    try { draft = localStorage.getItem(LS.draft); } catch (e) {}
    if (!draft) { bindInputs(); renderPhotos(); state('актуально', true); }
    fetchPublished();
  };
  init();
})();