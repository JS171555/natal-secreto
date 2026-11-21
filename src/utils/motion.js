const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => reduceMq.matches;

// Tokens mantidos para os tempos curtos das microtransições CSS.
export const T = { xs: 0.12, s: 0.22, m: 0.34, l: 0.55, xl: 0.9 };

const nodes = (target) => typeof target === 'string'
  ? [...document.querySelectorAll(target)]
  : !target ? [] : target instanceof Element ? [target] : [...target];

function animateClass(el, className, { duration = T.m, delay = 0, y = 0, x = 0, scale = 1, distance = y } = {}) {
  if (!el || reduced()) return;
  el.style.setProperty('--motion-duration', `${duration}s`);
  el.style.setProperty('--motion-delay', `${delay}s`);
  el.style.setProperty('--motion-x', `${x}px`);
  el.style.setProperty('--motion-negative-x', `${-x}px`);
  el.style.setProperty('--motion-y', `${distance}px`);
  el.style.setProperty('--motion-scale', scale);
  el.classList.remove(className);
  requestAnimationFrame(() => {
    if (!el.isConnected) return;
    el.classList.add(className);
    const finish = (event) => {
      if (event.target !== el) return;
      el.removeEventListener('animationend', finish);
      el.classList.remove(className);
      el.style.removeProperty('--motion-duration');
      el.style.removeProperty('--motion-delay');
      el.style.removeProperty('--motion-x');
      el.style.removeProperty('--motion-negative-x');
      el.style.removeProperty('--motion-y');
      el.style.removeProperty('--motion-scale');
    };
    el.addEventListener('animationend', finish);
  });
}

export function reveal(target, { y = 16, x = 0, scale = 1, delay = 0, each = 0.06, amount = 0, duration = T.l, from = 'start' } = {}) {
  const els = nodes(target);
  if (reduced()) return;
  const step = amount && els.length > 1 ? amount / (els.length - 1) : each;
  els.forEach((el, index) => {
    const order = from === 'end' ? els.length - index - 1 : index;
    animateClass(el, 'motion-reveal', { y, x, scale, duration, delay: delay + step * order });
  });
}

export function hang(target, { amount = 0.5, each = 0.05, delay = 0, distance = -64 } = {}) {
  const els = nodes(target);
  if (reduced()) return;
  const step = amount && els.length > 1 ? amount / (els.length - 1) : each;
  els.forEach((el, index) => animateClass(el, 'motion-hang', {
    duration: T.xl, delay: delay + step * index, distance, scale: 0.78,
  }));
}

export function swap(container, render) {
  render();
  return Promise.resolve();
}

export function flip(outEl, inEl) {
  nodes(outEl).forEach((el) => { el.hidden = true; });
  nodes(inEl).forEach((el) => { el.hidden = false; });
}

export function pop(target, { scale = 1.07, duration = T.l } = {}) {
  nodes(target).forEach((el) => animateClass(el, 'motion-pop', { duration, scale }));
}

export function shake(target, { dist = 7 } = {}) {
  nodes(target).forEach((el) => animateClass(el, 'motion-shake', { duration: 0.42, x: dist, distance: dist }));
}

// As partículas de comemoração foram removidas: eram decorativas e criavam dezenas
// de nós transitórios sem participar de nenhum fluxo funcional do sorteio.
export function pulse(target) {
  const els = nodes(target).filter((el) => !reduced());
  els.forEach((el) => el.classList.add('motion-pulse'));
  return () => els.forEach((el) => el.classList.remove('motion-pulse'));
}
