(function () {
  'use strict';
  /* Оболочка «Управления». Сам интерфейс здесь не лежит: его отдаёт облако (GET /api/admin/app) только после проверки подписи Telegram и роли
     (владелец или староста). Без входа из Telegram или без роли страница остаётся пустой. */
  var root = document.getElementById('admin-root');
  function say(text) { root.textContent = ''; var p = document.createElement('p'); p.className = 'hw-hint'; p.textContent = text; root.appendChild(p); }
  function waitTelegram(done, tries) {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData) { done(tg); return; }
    if ((tries || 0) > 25) { done(null); return; }
    setTimeout(function () { waitTelegram(done, (tries || 0) + 1); }, 200);
  }
  waitTelegram(function (tg) {
    if (!tg) { say('Откройте эту страницу кнопкой в боте внутри Telegram.'); return; }
    fetch('../data/app-config.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (cfg) {
      var cloud = String(cfg.cloudUrl || '').replace(/\/+$/, '');
      if (!cloud) throw new Error('config');
      return fetch(cloud + '/api/admin/app', { headers: { 'x-telegram-init-data': tg.initData }, cache: 'no-store' }).then(function (r) {
        if (r.status === 403) { say('Нет доступа.'); return null; }
        if (!r.ok) throw new Error('http ' + r.status);
        return r.text().then(function (code) {
          window.__ADM = { cloud: cloud, initData: tg.initData };
          try { tg.ready(); tg.expand(); } catch (e) { /* не критично */ }
          var s = document.createElement('script'); s.textContent = code; document.body.appendChild(s);
        });
      });
    }).catch(function () { say('Не удалось загрузить. Проверьте сеть и откройте ещё раз.'); });
  });
})();
