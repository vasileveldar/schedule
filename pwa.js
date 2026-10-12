// Only public application files belong in the service worker cache.
// Assignment, lecture and account data are never stored by this module.
const labels = {
  ru: { title: 'Доступна новая версия', body: 'Обновите приложение, когда закончите работу.', apply: 'Обновить', later: 'Позже', busy: 'Обновление…', blocked: 'Сначала сохраните или отмените изменения.', failed: 'Обновление пока не применилось. Попробуйте ещё раз.' },
  en: { title: 'A new version is available', body: 'Update the app when you have finished your work.', apply: 'Update', later: 'Later', busy: 'Updating…', blocked: 'Save or discard your changes first.', failed: 'The update has not been applied yet. Please try again.' },
  de: { title: 'Eine neue Version ist verfügbar', body: 'Aktualisiere die App, wenn du deine Arbeit beendet hast.', apply: 'Aktualisieren', later: 'Später', busy: 'Wird aktualisiert…', blocked: 'Speichere oder verwirf zuerst deine Änderungen.', failed: 'Das Update wurde noch nicht angewendet. Versuche es erneut.' }
};

const styles = `
.pwa-update{position:fixed;z-index:1000;inset:auto max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));max-width:620px;margin-inline:auto;padding:17px 18px;background:var(--surface,#fff);color:var(--ink,#182d49);border:1px solid var(--line,#dadfe5);border-top:3px solid var(--burgundy,#722d45);border-radius:16px;box-shadow:0 10px 40px #0003;font:inherit;text-align:start}
.pwa-update[hidden]{display:none}.pwa-update h2{font-size:1rem;line-height:1.35;margin:0 0 5px}.pwa-update p{font-size:.9rem;line-height:1.5;margin:0;color:var(--muted,#576577)}
.pwa-update__actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:13px}.pwa-update button{min-height:42px;padding:9px 16px;border-radius:9px;font:inherit;font-size:.92rem;cursor:pointer;border:1px solid var(--button-border,#aeb9c8);background:var(--button,#f0f3f7);color:var(--ink,#182d49)}
.pwa-update .pwa-update__apply{background:var(--selected,#182d49);color:var(--selected-text,#fff);border-color:transparent;font-weight:650}.pwa-update button:focus-visible{outline:3px solid var(--focus,#9a4762);outline-offset:3px}.pwa-update button:disabled{cursor:wait;opacity:.7}
@media print{.pwa-update{display:none!important}}
`;

/** Register within the current app directory, including GitHub Pages subpaths. */
export async function setupPwa(options = {}) {
  const win = options.window ?? globalThis.window;
  const doc = options.document ?? globalThis.document;
  const nav = options.navigator ?? globalThis.navigator;
  const workerUrl = options.workerUrl ?? new URL('../service-worker.js', import.meta.url);
  const scopeUrl = options.scopeUrl ?? new URL('../', import.meta.url);
  if (!win || !doc || !nav?.serviceWorker || !win.isSecureContext) return { registered: false };

  let registration;
  let waitingWorker;
  let updateRequested = false;
  let reloadIssued = false;
  let timeout;
  let message = 'body';
  let banner;
  let title;
  let description;
  let apply;
  let later;
  let observer;
  const watched = [];

  function translate() {
    if (!banner) return;
    const language = doc.documentElement.lang.split('-')[0];
    const strings = labels[language] ?? labels.ru;
    title.textContent = strings.title;
    description.textContent = strings[message];
    apply.textContent = strings[updateRequested ? 'busy' : 'apply'];
    later.textContent = strings.later;
  }

  function reload() {
    if (!updateRequested || reloadIssued) return;
    reloadIssued = true;
    win.clearTimeout(timeout);
    if (options.reload) options.reload();
    else win.location.reload();
  }

  function resetRequest() {
    updateRequested = false;
    message = 'failed';
    apply.disabled = false;
    later.disabled = false;
    banner.removeAttribute('aria-busy');
    translate();
  }

  function requestUpdate() {
    // Editors prevent this event while there is unsaved work. No reload occurs.
    if (!win.dispatchEvent(new win.CustomEvent('service:before-update', { cancelable: true }))) {
      message = 'blocked';
      translate();
      return;
    }
    updateRequested = true;
    message = 'body';
    apply.disabled = true;
    later.disabled = true;
    banner.setAttribute('aria-busy', 'true');
    translate();
    const target = registration.waiting ?? waitingWorker;
    // Another tab may already have activated the update. This click still
    // supplies the required consent to reload this particular page.
    if (target?.state === 'activated') {
      reload();
      return;
    }
    try {
      if (!target || target.state === 'redundant') throw new Error('No waiting update');
      target.postMessage({ type: 'SKIP_WAITING' });
      timeout = win.setTimeout(resetRequest, 15000);
    } catch (_) {
      resetRequest();
    }
  }

  function showUpdate(worker) {
    waitingWorker = worker;
    if (!banner) {
      const style = doc.createElement('style');
      style.id = 'pwa-update-style';
      style.textContent = styles;
      doc.head.append(style);
      banner = doc.createElement('section');
      banner.className = 'pwa-update';
      banner.id = 'pwa-update-notice';
      banner.setAttribute('aria-labelledby', 'pwa-update-title');
      title = doc.createElement('h2');
      title.id = 'pwa-update-title';
      description = doc.createElement('p');
      description.setAttribute('aria-live', 'polite');
      const actions = doc.createElement('div');
      actions.className = 'pwa-update__actions';
      later = doc.createElement('button');
      later.type = 'button';
      later.addEventListener('click', () => { banner.hidden = true; });
      apply = doc.createElement('button');
      apply.type = 'button';
      apply.className = 'pwa-update__apply';
      apply.addEventListener('click', requestUpdate);
      actions.append(later, apply);
      banner.append(title, description, actions);
      doc.body.append(banner);
    }
    banner.hidden = false;
    translate();
  }

  function watchInstaller(worker) {
    if (!worker) return;
    const listener = () => {
      if (worker.state === 'installed' && nav.serviceWorker.controller) showUpdate(worker);
    };
    worker.addEventListener('statechange', listener);
    watched.push([worker, listener]);
    listener();
  }

  function onUpdateFound() { watchInstaller(registration.installing); }
  function onVisible() {
    if (doc.visibilityState !== 'visible') return;
    // The browser also checks on navigation; this covers a long-running tab.
    registration.update().catch(() => {});
  }

  nav.serviceWorker.addEventListener('controllerchange', reload);
  try {
    registration = await nav.serviceWorker.register(workerUrl.href, { scope: scopeUrl.href, updateViaCache: 'none' });
    registration.addEventListener('updatefound', onUpdateFound);
    watchInstaller(registration.installing);
    if (registration.waiting && nav.serviceWorker.controller) showUpdate(registration.waiting);
    win.addEventListener('language:change', translate);
    doc.addEventListener('visibilitychange', onVisible);
    if (win.MutationObserver) {
      observer = new win.MutationObserver(translate);
      observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
    return {
      registered: true,
      destroy() {
        win.clearTimeout(timeout);
        observer?.disconnect();
        nav.serviceWorker.removeEventListener('controllerchange', reload);
        registration.removeEventListener('updatefound', onUpdateFound);
        for (const [worker, listener] of watched) worker.removeEventListener('statechange', listener);
        win.removeEventListener('language:change', translate);
        doc.removeEventListener('visibilitychange', onVisible);
        banner?.remove();
        doc.getElementById('pwa-update-style')?.remove();
      }
    };
  } catch (_) {
    nav.serviceWorker.removeEventListener('controllerchange', reload);
    // Installation is optional. The live website continues to work normally.
    return { registered: false };
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') setupPwa();
