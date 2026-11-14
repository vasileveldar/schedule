/* Загрузчик: подтягивает данные (data/*.json), затем подключает скрипты приложения по порядку. */
(function () {
  'use strict';
  var APP_SCRIPTS = ['js/app.js']; /*SCRIPTS*/
  // грузятся при первом использовании: игры — при открытии вкладки «Игры»
  var LAZY = {"game": ["js/lazy-game.js"]}; /*LAZY*/
  var DATA = { 'schedule-data': 'data/schedule.json', 'assessment-data': 'data/assessment.json', 'translation-data': 'data/translations.json' };
  var CACHE_KEY = 'schedule-json-cache';
  var OPTIONAL = { 'app-config': 'data/app-config.json' }; // необязательные файлы: нет — не страшно

  function put(id, text) {
    var s = document.createElement('script');
    s.id = id; s.type = 'application/json'; s.textContent = text;
    document.body.appendChild(s);
  }
  function load(url) {
    return new Promise(function (ok, fail) {
      var s = document.createElement('script');
      s.src = url; s.async = false;
      s.onload = ok; s.onerror = function () { fail(new Error(url)); };
      document.body.appendChild(s);
    });
  }
  // все скрипты запрашиваются сразу, а выполняются строго по порядку списка (async = false), поэтому поведение прежнее
  function loadAll(list) {
    return Promise.all(list.map(function (src) { return load(src); }));
  }
  var lazyLoads = {};
  window.scheduleLazy = {
    load: function (name) {
      if (!LAZY[name]) return Promise.resolve();
      if (!lazyLoads[name]) {
        lazyLoads[name] = loadAll(LAZY[name]).then(function () {
          window.dispatchEvent(new CustomEvent('lazy:loaded', { detail: name }));
        }, function (err) { lazyLoads[name] = null; throw err; });
      }
      return lazyLoads[name];
    }
  };
  function getText(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.text();
    });
  }
  function validSchedule(text) {
    var d = JSON.parse(text);
    return d && Array.isArray(d.days) && Array.isArray(d.events) ? d : null;
  }
  // Расписание: сеть (или кэш Service Worker/APK) -> при ошибке последняя удачная копия из localStorage
  function getSchedule() {
    return getText(DATA['schedule-data']).then(function (text) {
      if (!validSchedule(text)) throw new Error('bad schedule');
      try { localStorage.setItem(CACHE_KEY, text); } catch (e) {}
      return text;
    }).catch(function (err) {
      var saved = null;
      try { saved = localStorage.getItem(CACHE_KEY); } catch (e) {}
      if (saved && validSchedule(saved)) return saved;
      throw err;
    });
  }
  function fail(err) {
    var p = document.createElement('p');
    p.style.cssText = 'padding:24px;font:16px system-ui;text-align:center';
    p.textContent = 'Не удалось загрузить расписание. Проверьте интернет и откройте ещё раз. / Could not load the schedule.';
    document.body.appendChild(p);
    if (window.console) console.error(err);
  }

  Promise.all([
    getSchedule(),
    getText(DATA['assessment-data']),
    getText(DATA['translation-data']),
    getText(OPTIONAL['app-config']).then(function (t) { JSON.parse(t); return t; }, function () { return '{}'; })
  ]).then(function (r) {
    put('schedule-data', r[0]); put('assessment-data', r[1]); put('translation-data', r[2]); put('app-config', r[3]);
    return loadAll(APP_SCRIPTS);
  }).catch(fail);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.AppPreferences) {
    navigator.serviceWorker.register('./service-worker.js', { scope: './', updateViaCache: 'none' }).catch(function () {});
  }
})();
