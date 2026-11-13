
/* Тактильный отклик: волна и вибрация при нажатии, анимация выбора. Раньше файл назывался feedback.js; поведение не менялось. */
(() => {
const pulse = (element, className) => {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  const clear = () => element.classList.remove(className);
  element.addEventListener('animationend', clear, { once: true });
  window.setTimeout(clear, 650);
};
document.addEventListener('change', event => {
  if (event.target.matches('.language-select, .palette-select')) {
    pulse(event.target, 'selection-feedback');
    pulse(document.querySelector('header'), 'theme-feedback');
  }
});
window.addEventListener('palette:change', () => pulse(document.querySelector('header'), 'theme-feedback'));
window.addEventListener('language:change', () => pulse(document.querySelector('header'), 'theme-feedback'));
})();
