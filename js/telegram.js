/* Telegram Mini App: подключается только если страница открыта внутри Telegram. */
(function () {
  'use strict';
  var inTelegram = /tgWebAppData|tgWebAppVersion/.test(location.hash + location.search) || !!(window.TelegramWebviewProxy);
  if (!inTelegram || window.AppPreferences) return;
  var s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = function () {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    document.documentElement.classList.add('in-telegram');
    try { tg.ready(); tg.expand(); } catch (e) {}
    function sync() {
      var bg = getComputedStyle(document.body).backgroundColor;
      var m = bg.match(/\d+/g);
      if (!m) return;
      var hex = '#' + m.slice(0, 3).map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
      try { tg.setHeaderColor(hex); tg.setBackgroundColor(hex); } catch (e) {}
    }
    sync();
    new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
    tg.onEvent && tg.onEvent('themeChanged', sync);
  };
  document.head.appendChild(s);
})();
