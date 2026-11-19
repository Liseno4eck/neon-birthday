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
        '<div class="a-fld"><span>Фото в письме</span><div class="a-img" id="aLetterImg"></div>' +
        '<input type="file" id="aLetterFile" accept="image/*" class="a-file"></div>') +
      sec('Экран 5 — финал', fld('final.title', 'Большой заголовок') + fld('final.subtitle', 'Подзаголовок', 1) +
        fld('final.again', 'Кнопка') +
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
        '<p class="a-mini">Опубликованное сразу видно всем посетителям. Без токена изменения живут только в этом браузере.</p>') +
    '</div>';
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
  }
  function publish() {
    if (!tok()) { window.TOAST('Сначала вставь GitHub token'); return; }
    state('публикую...');
    var json = JSON.stringify(window.CFG(), null, 2);
    var body = {
      message: 'update birthday content',
      content: btoa(unescape(encodeURIComponent(json)))
    };
    if (sha) body.sha = sha;
    gh('/repos/' + window.STORE.owner + '/' + window.STORE.repo + '/contents/' + window.STORE.path,
      { method: 'PUT', body: JSON.stringify(body) })
      .then(function (r) {
        sha = r && r.content && r.content.sha;
        localStorage.setItem(LS.sha, sha || '');
        localStorage.removeItem(LS.draft);
        state('опубликовано', true);
        window.TOAST('Сохранено — теперь это видят все');
      })
      .catch(function (e) { state('ошибка сохранения'); window.TOAST('Не удалось: ' + e.message); });
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
      });
  }

  /* ---------- photos ---------- */
  function renderPhotos() {
    if (!el.photos) return;
    var list = (window.CFG().final && window.CFG().final.photos) || [];
    el.photos.innerHTML = '';
    list.forEach(function (p, i) {
      var src = p.src || p;
      var cap = p.caption || '';
      var d = document.createElement('div');
      d.className = 'a-thumb';
      d.innerHTML = '<img src="' + esc(window.RAW_URL(src)) + '" alt="">' +
        '<input data-cap="' + i + '" placeholder="подпись" value="' + esc(cap) + '">' +
        (i > 0 ? '<button class="a-mv" data-mv="' + i + '" data-dir="-1">&#8592;</button>' : '') +
        (i < list.length - 1 ? '<button class="a-mv r" data-mv="' + i + '" data-dir="1">&#8594;</button>' : '') +
        '<button class="a-del" data-del="' + i + '" title="Удалить">&#10005;</button>';
      el.photos.appendChild(d);
    });
    if (!list.length) el.photos.innerHTML = '<span class="a-mini">пока пусто</span>';

    var lp = get('letter.photo');
    el.letter.innerHTML = lp
      ? '<img src="' + esc(window.RAW_URL(lp)) + '"><button class="a-btn" id="aLetterDel">Убрать фото</button>'
      : '<span class="a-mini">фото не добавлено</span>';
    var del = $('#aLetterDel', el.letter);
    if (del) del.onclick = function () { setCfg('letter.photo', ''); mark(); renderPhotos(); };
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
    el.letter = $('#aLetterImg', el.root);
    bindInputs();
    renderPhotos();

    var d = localStorage.getItem(LS.draft);
    if (d) { try { window.SET_CFG(JSON.parse(d)); bindInputs(); renderPhotos(); state('черновик из этого браузера'); } catch (e) {} }

    el.root.addEventListener('input', function (e) {
      var n = e.target;
      if (!n.dataset || !n.dataset.f) return;
      setCfg(n.dataset.f, n.type === 'checkbox' ? n.checked : n.value);
      mark();
      if (/^theme\./.test(n.dataset.f)) window.SET_CFG(window.CFG());
    });

    el.photos.addEventListener('click', function (e) {
      var t = e.target;
      var list = (window.CFG().final.photos || []).slice();
      if (t.dataset.del != null) {
        list.splice(+t.dataset.del, 1);
        setCfg('final.photos', list); mark(); renderPhotos();
      } else if (t.dataset.mv != null) {
        var i = +t.dataset.mv, j = i + (+t.dataset.dir);
        if (list[j]) { var tmp = list[i]; list[i] = list[j]; list[j] = tmp; setCfg('final.photos', list); mark(); renderPhotos(); }
      }
    });
    el.photos.addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.cap == null) return;
      var list = (window.CFG().final.photos || []).slice();
      var it = list[+t.dataset.cap];
      list[+t.dataset.cap] = (typeof it === 'string') ? { src: it, caption: t.value } : Object.assign({}, it, { caption: t.value });
      window.CFG().final.photos = list;
      mark();
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
      var f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      state('загружаю фото письма...');
      uploadImage(f).then(function (url) {
        setCfg('letter.photo', url); mark(); renderPhotos();
        state('готово — не забудь Опубликовать');
      }).catch(function (err) { state('ошибка'); window.TOAST(err.message); });
    };
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
  };
  init();
})();