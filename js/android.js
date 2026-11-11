(() => {
  'use strict';

  const labels = {
    ru: {
      next: 'Следующая пара', now: 'Сейчас идёт', today: 'Сегодня', noClass: 'Ближайших занятий нет',
      starts: 'Начнётся через {time}', ends: 'До конца пары {time}',
      search: 'Поиск по расписанию', searchPlaceholder: 'Предмет, преподаватель или аудитория',
      searchEmpty: 'Совпадений не найдено. Измените запрос.', current: 'Сейчас',
      reminder: 'Напоминать о парах', reminderHint: 'Уведомление за 5 минут до начала пары',
      testBtn: 'Проверить уведомление', testSent: 'Отправлено. Посмотрите шторку уведомлений.',
      testPermission: 'Разрешите уведомления в окне Android — проверка отправится сама.',
      testBlocked: 'Уведомления отключены. Включите их в настройках Android для этого приложения.',
      weekdays: ['понедельник','вторник','среду','четверг','пятницу','субботу','воскресенье'],
      dayIn: 'Следующая пара: {day}, {date}',
      dayLine: 'Сегодня: {total} · осталось: {left} · конец в {end}', dayGap: 'Сейчас окно · осталось пар: {left} · конец в {end}', dayOver: 'Сегодня пары закончились (всего {total})', dayNone: 'Сегодня пар нет',
    },
    en: {
      next: 'Next class', now: 'In progress', today: 'Today', noClass: 'No upcoming classes',
      starts: 'Starts in {time}', ends: 'Ends in {time}',
      search: 'Search timetable', searchPlaceholder: 'Subject, teacher, or room',
      searchEmpty: 'No matches. Try another search.', current: 'Now',
      reminder: 'Class reminders', reminderHint: 'Notification 5 minutes before class',
      testBtn: 'Send test notification', testSent: 'Sent. Check your notification shade.',
      testPermission: 'Allow notifications in the Android prompt — the test will be sent automatically.',
      testBlocked: 'Notifications are turned off. Enable them for this app in Android settings.',
      weekdays: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
      dayIn: 'Next class: {day}, {date}',
      dayLine: 'Today: {total} · left: {left} · ends at {end}', dayGap: 'Break now · classes left: {left} · ends at {end}', dayOver: 'Classes are over for today ({total} total)', dayNone: 'No classes today',
    },
    de: {
      next: 'Nächste Unterrichtsstunde', now: 'Findet gerade statt', today: 'Heute', noClass: 'Keine weiteren Stunden',
      starts: 'Beginnt in {time}', ends: 'Endet in {time}',
      search: 'Stundenplan durchsuchen', searchPlaceholder: 'Fach, Lehrkraft oder Raum',
      searchEmpty: 'Keine Treffer. Bitte Suche ändern.', current: 'Jetzt',
      reminder: 'Stundenerinnerungen', reminderHint: 'Benachrichtigung 5 Minuten vor Beginn',
      testBtn: 'Test-Benachrichtigung senden', testSent: 'Gesendet. Schauen Sie in die Benachrichtigungen.',
      testPermission: 'Erlauben Sie Benachrichtigungen im Android-Dialog — der Test wird automatisch gesendet.',
      testBlocked: 'Benachrichtigungen sind deaktiviert. Aktivieren Sie sie in den Android-Einstellungen.',
      weekdays: ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'],
      dayIn: 'Nächste Stunde: {day}, {date}',
      dayLine: 'Heute: {total} · noch: {left} · Ende um {end}', dayGap: 'Gerade Pause · noch {left} · Ende um {end}', dayOver: 'Heute ist Schluss ({total} insgesamt)', dayNone: 'Heute keine Stunden',
    },
  };

  const language = () => {
    const value = document.documentElement.dataset.language || document.documentElement.lang || 'ru';
    return labels[value] ? value : 'ru';
  };
  const t = key => labels[language()][key];
  const replace = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  const readJSON = id => {
    const element = document.getElementById(id);
    if (!element) return null;
    try { return JSON.parse(element.textContent); } catch (_) { return null; }
  };
  const data = readJSON('schedule-data');
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.days)) return;

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const timeMinutes = value => {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return hours * 60 + minutes;
  };
  const localDate = (year, month, day) => new Date(year, month, day, 0, 0, 0, 0);
  const iso = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const selectedGroup = () => {
    try { return JSON.parse(localStorage.getItem('combined-schedule-2026-2027-v1') || 'null')?.group || 'all'; }
    catch (_) { return 'all'; }
  };
  const groupMatches = event => {
    const group = selectedGroup();
    return group === 'all' || !event.group || event.group === 'Общее' || event.group === group;
  };

  function upcoming(now = new Date()) {
    const items = [];
    for (let offset = 0; offset <= 14; offset++) {
      const date = localDate(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      const index = (date.getDay() + 6) % 7;
      const day = data.days[index];
      if (!day) continue;
      for (const event of data.events) {
        if (event.day !== day || !groupMatches(event)) continue;
        const start = new Date(date); start.setMinutes(timeMinutes(event.start));
        const end = new Date(date); end.setMinutes(timeMinutes(event.end));
        if (end <= now) continue;
        if (window.scheduleOverrides && window.scheduleOverrides.cancelled(event, date)) continue; // пара отменена на эту дату
        items.push({ event, start, end });
      }
    }
    return items.sort((a, b) => a.start - b.start || a.end - b.end || String(a.event.group || '').localeCompare(String(b.event.group || '')));
  }

  function countdown(ms) {
    const minutes = Math.max(0, Math.ceil(ms / 60000));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours} ч ${remainder} мин`;
    if (hours) return `${hours} ч`;
    return `${minutes} мин`;
  }

  let nextCard, nextLabel, nextSubject, nextTime, nextStatus, dayText, dayBar, ringText;
  // смена текста с коротким «всплытием» (если анимации не выключены)
  function setText(node, text) {
    if (node.textContent === text) return;
    const had = node.textContent !== '';
    node.textContent = text;
    if (had) { node.classList.remove('fx-swap'); void node.offsetWidth; node.classList.add('fx-swap'); }
  }
  function createNextCard() {
    const home = document.getElementById('home-screen');
    const menu = home?.querySelector('.menu-grid');
    if (!home || !menu) return;
    nextCard = make('section', 'fork-next-card');
    nextCard.setAttribute('aria-live', 'polite');
    nextLabel = make('span', 'fork-next-label');
    nextSubject = make('strong', 'fork-next-subject');
    nextTime = make('div', 'fork-next-time');
    nextStatus = make('div', 'fork-next-status');
    dayText = make('div', 'fork-day-text');
    dayBar = make('div', 'fork-day-bar'); dayBar.setAttribute('aria-hidden', 'true');
    const ring = make('span', 'fork-ring'); ring.setAttribute('aria-hidden', 'true');
    ringText = make('span', 'fork-ring-text'); ring.append(ringText);
    nextCard.append(ring, nextLabel, nextSubject, nextTime, nextStatus, dayText, dayBar);
    home.insertBefore(nextCard, menu);
  }

  function renderNext(now = new Date()) {
    if (!nextCard) return;
    const entries = upcoming(now);
    const active = entries.find(item => item.start <= now && item.end > now);
    const item = active || entries.find(item => item.start > now);
    if (!item) {
      nextCard.classList.remove('is-current', 'is-soon');
      nextCard.classList.add('no-ring');
      setText(nextLabel, t('next'));
      setText(nextSubject, t('noClass'));
      setText(nextTime, '');
      nextStatus.textContent = '';
      return;
    }
    nextCard.classList.remove('no-ring');
    nextCard.classList.toggle('is-current', Boolean(active));
    // кольцо: у идущей пары — сколько прошло, у ближайшей — заполняется за последний час до начала
    const minutesTo = Math.max(0, Math.ceil(((active ? item.end : item.start) - now) / 60000));
    const progress = active ? (now - item.start) / (item.end - item.start) : 1 - Math.min(60, minutesTo) / 60;
    nextCard.style.setProperty('--nc', Math.max(0, Math.min(1, progress)).toFixed(3));
    nextCard.classList.toggle('is-soon', !active && minutesTo <= 5);
    ringText.textContent = minutesTo >= 100 ? `${Math.round(minutesTo / 60)}${language() === 'ru' ? 'ч' : 'h'}` : `${minutesTo}′`;
    setText(nextLabel, active ? t('now') : t('next'));
    setText(nextSubject, item.event.subject);
    const room = (window.scheduleOverrides && window.scheduleOverrides.roomFor(item.event, item.start)) || item.event.room;
    setText(nextTime, `${item.event.start}–${item.event.end}${room ? ` · ${room}` : ''}`);
    if (active) {
      const next = entries.find(candidate => candidate.start >= item.end);
      nextStatus.textContent = next ? replace(t('starts'), { time: countdown(next.start - now) }) : replace(t('ends'), { time: countdown(item.end - now) });
    } else if (iso(item.start) === iso(now)) {
      nextStatus.textContent = replace(t('starts'), { time: countdown(item.start - now) });
    } else {
      const day = labels[language()].weekdays[item.start.getDay()];
      const date = new Intl.DateTimeFormat(language() === 'ru' ? 'ru-RU' : language() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short' }).format(item.start);
      nextStatus.textContent = replace(labels[language()].dayIn, { day, date });
    }
  }

  // Полоса дня: сколько пар сегодня, сколько осталось, во сколько конец; шкала времени с пройденными и оставшимися парами
  function todaySlots(now) {
    const day = data.days[(now.getDay() + 6) % 7];
    const map = new Map();
    for (const event of data.events) {
      if (event.day !== day || !groupMatches(event) || !event.start || !event.end) continue;
      if (window.scheduleOverrides && window.scheduleOverrides.cancelled(event, now)) continue;
      const key = event.start + '|' + event.end;
      if (!map.has(key)) map.set(key, { s: timeMinutes(event.start), e: timeMinutes(event.end), end: event.end });
    }
    return [...map.values()].sort((a, b) => a.s - b.s || a.e - b.e);
  }
  let daySig = '', dayPin = null;
  function renderDay(now = new Date()) {
    if (!dayText) return;
    const slots = todaySlots(now);
    const minutes = now.getHours() * 60 + now.getMinutes();
    dayBar.hidden = !slots.length;
    if (!slots.length) { setText(dayText, t('dayNone')); daySig = ''; dayBar.replaceChildren(); return; }
    const left = slots.filter(slot => slot.e > minutes);
    const current = slots.some(slot => slot.s <= minutes && slot.e > minutes);
    const values = { total: slots.length, left: left.length, end: slots[slots.length - 1].end.replace(/^(\d):/, '0$1:') };
    setText(dayText, replace(t(!left.length ? 'dayOver' : current || !slots.some(slot => slot.e <= minutes) ? 'dayLine' : 'dayGap'), values));
    const from = slots[0].s, span = Math.max(1, slots[slots.length - 1].e - from);
    const sig = slots.map(slot => slot.s + '-' + slot.e).join(',');
    if (sig !== daySig) { // шкала строится заново только когда изменился набор пар; иначе указатель плавно едет
      daySig = sig; dayBar.replaceChildren();
      slots.forEach((slot, index) => {
        const part = make('i', 'fork-day-part');
        part.style.left = ((slot.s - from) / span * 100) + '%';
        part.style.width = ((slot.e - slot.s) / span * 100) + '%';
        part.style.setProperty('--i', index);
        dayBar.append(part);
      });
      dayPin = make('b', 'fork-day-pin'); dayBar.append(dayPin);
      dayBar.classList.add('draw'); setTimeout(() => dayBar.classList.remove('draw'), 1000);
    }
    dayBar.querySelectorAll('.fork-day-part').forEach((part, index) => {
      const slot = slots[index];
      part.className = 'fork-day-part ' + (slot.e <= minutes ? 'done' : slot.s <= minutes ? 'now' : 'next');
    });
    if (dayPin) {
      dayPin.hidden = !(minutes >= from && minutes <= from + span);
      dayPin.style.left = (Math.max(0, Math.min(1, (minutes - from) / span)) * 100) + '%';
    }
  }
  function createSearch() {
    const main = document.querySelector('#schedule-screen > main');
    const schedule = document.getElementById('schedule');
    if (!main || !schedule) return;
    const tools = make('div', 'fork-search-tools');
    const button = make('button', 'fork-search-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"></circle><path d="m16 16 5 5"></path></svg>';
    const panel = make('div', 'fork-search-panel'); panel.hidden = true;
    const input = make('input', 'fork-search-input'); input.type = 'search'; input.autocomplete = 'off'; input.setAttribute('aria-label', t('searchPlaceholder'));
    input.placeholder = t('searchPlaceholder');
    const empty = make('p', 'fork-search-empty', t('searchEmpty')); empty.hidden = true;
    panel.append(input, empty); tools.append(button);
    main.insertBefore(tools, schedule); main.insertBefore(panel, schedule);
    const apply = () => {
      const query = input.value.trim().toLocaleLowerCase(language());
      let matches = 0;
      for (const card of document.querySelectorAll('#schedule .lesson')) {
        const fields = [card.dataset.subject, card.dataset.teacher, card.dataset.room, card.textContent].join(' ').toLocaleLowerCase(language());
        const visible = !query || fields.includes(query);
        card.hidden = !visible; if (visible) matches++;
      }
      for (const section of document.querySelectorAll('#schedule .day-section')) {
        const visibleCards = [...section.querySelectorAll('.lesson')].some(card => !card.hidden);
        section.hidden = Boolean(query) && !visibleCards;
      }
      empty.hidden = !query || matches > 0;
    };
    button.setAttribute('aria-label', t('search'));
    button.addEventListener('click', () => {
      const opened = button.getAttribute('aria-expanded') === 'true';
      button.setAttribute('aria-expanded', String(!opened)); panel.hidden = opened;
      if (!opened) input.focus();
    });
    input.addEventListener('input', apply);
    document.addEventListener('schedule:render', apply);
    window.addEventListener('language:change', () => {
      button.setAttribute('aria-label', t('search'));
      input.placeholder = t('searchPlaceholder');
      input.setAttribute('aria-label', t('searchPlaceholder'));
      empty.textContent = t('searchEmpty');
      apply();
    });
  }

  function reminderPayload() {
    const node = document.querySelector('time[data-i18n="calendar.end"]');
    const semesterEnd = (node && node.getAttribute('datetime')) || '2026-12-11';
    const dayIndex = new Map(data.days.map((day, index) => [day, index]));
    const seen = new Set();
    const items = [];
    for (const event of data.events) {
      if (!groupMatches(event)) continue;
      const weekday = dayIndex.get(event.day);
      if (weekday === undefined || !event.start) continue;
      const group = event.group && event.group !== 'Общее' ? event.group : '';
      const id = [weekday, event.start, event.subject, group, event.room || ''].join('|');
      if (seen.has(id)) continue;
      seen.add(id);
      const key = [event.day, String(event.start).replace(/^(\d):/, '0$1:'), event.subject, group || 'Общее'].join('|'); // ключ пары (как в облаке): по нему находятся отмены и замены
      items.push({ id, weekday, start: event.start, end: event.end || '', subject: event.subject || '', room: event.room || '', group, semesterEnd, key });
    }
    return JSON.stringify(items);
  }

  let lastReminderKey = '';
  function syncReminders(force) {
    const bridge = window.AppPreferences;
    if (!bridge || typeof bridge.setClassNotifications !== 'function') return;
    try { if (!bridge.isClassNotificationsEnabled()) return; } catch (_) { return; }
    const payload = reminderPayload();
    const key = language() + '|' + payload;
    if (!force && key === lastReminderKey) return;
    lastReminderKey = key;
    try { bridge.setClassNotifications(payload, true, language()); } catch (_) {}
  }

  function createReminderControl() {
    const bridge = window.AppPreferences;
    const box = document.getElementById('notify-settings');
    if (!bridge || typeof bridge.setClassNotifications !== 'function' || !box) return;
    box.hidden = false;

    const card = make('div', 'fork-reminders');
    const copy = make('div', 'fork-reminder-copy');
    const title = make('strong', '', t('reminder'));
    const hint = make('span', '', t('reminderHint'));
    copy.append(title, hint);
    const label = make('label', 'fork-switch');
    const input = make('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', t('reminder'));
    const track = make('span', 'fork-switch-track');
    label.append(input, track);
    card.append(copy, label);

    const testButton = make('button', 'choice settings-test', t('testBtn'));
    testButton.type = 'button';
    const status = make('p', 'settings-status');
    status.setAttribute('aria-live', 'polite');
    let lastResult = '';
    const showResult = result => {
      lastResult = result;
      status.textContent = result === 'sent' ? t('testSent') : result === 'permission' ? t('testPermission') : result === 'blocked' ? t('testBlocked') : '';
    };
    box.append(card, testButton, status);

    try { input.checked = bridge.isClassNotificationsEnabled(); } catch (_) { input.checked = false; }
    input.addEventListener('change', () => {
      try { bridge.setClassNotifications(reminderPayload(), input.checked, language()); }
      catch (_) { input.checked = !input.checked; }
    });
    testButton.addEventListener('click', () => {
      if (typeof bridge.testNotification !== 'function') return;
      try { showResult(String(bridge.testNotification(language()))); } catch (_) { showResult('blocked'); }
    });
    window.scheduleNotifications = {
      onNativePermissionChanged(granted) {
        input.checked = Boolean(granted);
      },
      onTestResult(result) { showResult(String(result)); }
    };
    window.addEventListener('language:change', () => {
      title.textContent = t('reminder');
      hint.textContent = t('reminderHint');
      testButton.textContent = t('testBtn');
      input.setAttribute('aria-label', t('reminder'));
      if (lastResult) showResult(lastResult);
    });
  }
  function markCurrentLesson(now = new Date()) {
    const day = data.days[(now.getDay() + 6) % 7];
    const minutes = now.getHours() * 60 + now.getMinutes();
    for (const card of document.querySelectorAll('#schedule .lesson[data-day]')) {
      const current = card.dataset.day === day && minutes >= timeMinutes(card.dataset.start) && minutes < timeMinutes(card.dataset.end);
      card.classList.toggle('fork-current-lesson', current);
      const old = card.querySelector('.fork-current-tag'); if (old) old.remove();
      if (current) {
        const tags = card.querySelector('.tags') || card.querySelector('.details');
        if (tags) {
          const tag = make('span', 'fork-current-tag', t('current'));
          tag.setAttribute('aria-label', t('now'));
          tags.prepend(tag);
        }
      }
    }
  }

  let previousDate = '';
  function followToday(now = new Date()) {
    const today = iso(now);
    if (previousDate && previousDate !== today) {
      const button = document.querySelector('#days [data-value="today"]');
      if (button) button.click();
    }
    previousDate = today;
  }

  function refresh() {
    const now = new Date();
    followToday(now);
    renderNext(now);
    renderDay(now);
    markCurrentLesson(now);
  }

  function start() {
    createNextCard();
    createSearch();
    createReminderControl();
    refresh();
    syncReminders(true);
    document.addEventListener('schedule:render', () => { refresh(); syncReminders(false); });
    document.addEventListener('overrides:change', () => { refresh(); syncReminders(false); });
    window.addEventListener('language:change', () => { refresh(); syncReminders(false); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    window.addEventListener('focus', refresh);
    window.setInterval(refresh, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
