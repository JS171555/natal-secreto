import gsap from 'gsap';

/* =============================================================================
   SISTEMA DE MOVIMENTO (GSAP) — fonte única de animação do app.

   Regras do projeto:
   1. nenhuma animação nova nasce fora daqui: durações e eases são tokens;
   2. "reduzir movimento" (SO do sistema) desliga todo tween sem esconder nada;
   3. o GSAP só transforma elementos que o CSS não anima. A classe `motion-on`
      no <html> é o combinado: ela remove do CSS as transições de transform que
      passaram a ser conduzidas pelo GSAP (evita as duas engines no mesmo frame);
   4. tudo que entra em cena usa clearProps ao terminar, para que o hover/estilo
      natural volte a valer sem inline preso no elemento.
   ========================================================================== */

const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => reduceMq.matches;
export const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
export const coarse = matchMedia('(pointer: coarse)').matches;

// tokens de timing: xs toque, s UI, m entrada, l cena
export const T = { xs: 0.12, s: 0.22, m: 0.34, l: 0.55, xl: 0.9 };
export const EASE = {
  out: 'power3.out', soft: 'power2.out', in: 'power2.in', inOut: 'power2.inOut',
  spring: 'back.out(1.7)', pop: 'elastic.out(1,0.55)', settle: 'power4.out',
};

gsap.defaults({ ease: EASE.out, duration: T.m, overwrite: 'auto', force3D: true });
document.documentElement.classList.add('motion-on');

/** Aceita seletor, elemento, NodeList ou array e devolve sempre um array. */
export const nodes = (t, scope = document) =>
  typeof t === 'string' ? [...scope.querySelectorAll(t)]
    : !t ? [] : t instanceof Element ? [t] : [...t];

/* ------------------------------ entrada ---------------------------------- */

/** Reveal escalonado: fade + subida leve. Não faz nada com movimento reduzido. */
export function reveal(target, {
  y = 16, x = 0, scale = 0, delay = 0, each = 0.06, amount = 0,
  duration = T.l, ease = EASE.out, from = 'start', clear = 'transform,opacity',
} = {}) {
  const els = nodes(target);
  if (!els.length) return null;
  if (reduced()) { gsap.set(els, { clearProps: clear }); return null; }
  return gsap.from(els, {
    opacity: 0, y, x, ...(scale ? { scale } : {}), duration, delay, ease,
    stagger: amount ? { amount, from } : { each, from }, clearProps: clear,
  });
}

/** Queda de bola de Natal: cai do galho e assenta com mola. */
export function hang(target, { amount = 0.5, each = 0.05, delay = 0, distance = -64 } = {}) {
  const els = nodes(target);
  if (!els.length) return null;
  if (reduced()) { gsap.set(els, { clearProps: 'transform,opacity' }); return null; }
  return gsap.from(els, {
    opacity: 0, y: distance, scale: 0.55, duration: T.xl, delay,
    ease: EASE.spring, transformOrigin: '50% 0',
    stagger: amount ? { amount } : { each }, clearProps: 'transform,opacity',
  });
}

/* --------------------------- transição de tela ---------------------------- */

/**
 * Troca o conteúdo de um container com saída suave e monta o novo.
 * `mode: 'auto'` usa subida apenas quando a tela antiga não tem elementos
 * `position: fixed` (transformo em ancestral quebra fixed, então a árvore
 * entra/sai só em fade).
 */
export function swap(container, render, { mode = 'auto' } = {}) {
  return new Promise((resolve) => {
    const kids = [...container.children];
    const rise = mode === 'rise' || (mode === 'auto' && !kids.some((k) => k.classList?.contains('tree-page')));
    if (!kids.length || reduced()) { render(); resolve(); return; }
    gsap.to(kids, {
      opacity: 0, ...(rise ? { y: -14, scale: 0.985 } : {}),
      duration: T.s, ease: EASE.in,
      onComplete: () => { gsap.set(kids, { clearProps: 'transform,opacity' }); render(); resolve(); },
    });
  });
}

/** Transição de dentro de uma mesma tela (ex.: card → resultado). */
export function flip(outEl, inEl, { label } = {}) {
  const a = nodes(outEl), b = nodes(inEl);
  if (reduced() || !a.length || !b.length) {
    a.forEach((e) => { e.hidden = true; }); b.forEach((e) => { e.hidden = false; }); return null;
  }
  return gsap.timeline()
    .to(a, { opacity: 0, y: -10, duration: T.s, ease: EASE.in })
    .add(() => { a.forEach((e) => { e.hidden = true; }); gsap.set(a, { clearProps: 'transform,opacity' }); })
    .add(() => { b.forEach((e) => { e.hidden = false; }); })
    .from(b, { opacity: 0, y: label ? 18 : 10, duration: T.l, ease: EASE.out, clearProps: 'transform,opacity' });
}

/* --------------------------- microinterações ------------------------------ */

/* Só elementos cujo transform não pertence a uma animação CSS: a caixa .gb-btn
   (bounce) fica de fora — ela já tem coreografia própria no modal de revelação. */
const PRESS = '.btn, .tb-btn, .icon-btn, .banner button';
const HOVER = '.btn, .tb-btn, .icon-btn';

export function press(el, on) {
  if (!el || reduced()) return;
  gsap.to(el, on
    ? { scale: 0.955, duration: T.xs, ease: EASE.in }
    : { scale: 1, duration: T.m, ease: EASE.spring, clearProps: 'transform' });
}

export function hoverLift(el, on, y = -2) {
  if (!canHover || !el || reduced()) return;
  gsap.to(el, on ? { y, duration: T.s, ease: EASE.out }
    : { y: 0, duration: T.m, ease: EASE.spring, clearProps: 'transform' });
}

/** Feedback de toque/tecla em algo que não pode ser escalado por fora. */
export function pop(el, { scale = 1.07, duration = T.l } = {}) {
  const els = nodes(el); if (!els.length || reduced()) return;
  gsap.fromTo(els, { scale }, { scale: 1, duration, ease: EASE.pop, clearProps: 'transform' });
}

export function shake(el, { dist = 7 } = {}) {
  const els = nodes(el); if (!els.length || reduced()) return;
  gsap.to(els, {
    keyframes: { x: [-dist, dist, -dist * 0.55, dist * 0.55, 0] },
    duration: 0.46, ease: EASE.inOut, stagger: 0.02, clearProps: 'transform',
  });
}

export function ripple(el, clientX, clientY) {
  if (!el || reduced() || el.dataset.fx === 'noripple') return;
  const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 1.1;
  const s = document.createElement('span');
  s.className = 'fx-ripple';
  s.style.cssText = `left:${(clientX ?? r.left + r.width / 2) - r.left - d / 2}px;top:${(clientY ?? r.top + r.height / 2) - r.top - d / 2}px;width:${d}px;height:${d}px`;
  el.append(s);
  gsap.fromTo(s, { scale: 0, opacity: 0.5 }, { scale: 1, opacity: 0, duration: 0.62, ease: EASE.soft, onComplete: () => s.remove() });
}

/** Faíscas de comemoração (bola nova, caixa aberta, sorteio concluído). */
export function burst(host, { count = 16, colors = ['#FFE79A', '#E9C45A', '#DDEBFF', '#F5F7FF'], min = 34, max = 118, size = 7, life = 0.85 } = {}) {
  const el = nodes(host)[0];
  if (!el || reduced()) return;
  const parts = [];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'fx-part';
    s.style.cssText = `--sz:${size}px;background:${colors[i % colors.length]}`;
    el.append(s); parts.push(s);
  }
  gsap.fromTo(parts, { x: 0, y: 0, scale: 1, opacity: 1 }, {
    x: () => Math.cos(Math.random() * 6.283) * (min + Math.random() * (max - min)),
    y: () => Math.sin(Math.random() * 6.283) * (min + Math.random() * (max - min)) - 16,
    scale: 0.2, opacity: 0,
    duration: () => life * (0.7 + Math.random() * 0.6),
    ease: 'power2.out', onComplete: () => parts.forEach((p) => p.remove()),
  });
}

/** Pulso de atenção em loop. Devolve a função que desliga (chame no destroy). */
export function pulse(target, { scale = 1.05, duration = 1.6 } = {}) {
  const els = nodes(target);
  if (!els.length || reduced()) return () => {};
  const tw = gsap.to(els, { scale, duration, ease: 'sine.inOut', repeat: -1, yoyo: true });
  return () => { tw.kill(); gsap.set(els, { clearProps: 'transform' }); };
}

/** Anel expansivo em loop (caixa de presente chamando). */
export function ring(host, { duration = 1.9 } = {}) {
  const el = nodes(host)[0];
  if (!el || reduced()) return () => {};
  const tw = gsap.fromTo(el, { scale: 0.75, opacity: 0.55 }, { scale: 1.85, opacity: 0, duration, ease: EASE.soft, repeat: -1 });
  return () => { tw.kill(); gsap.set(el, { clearProps: 'transform,opacity' }); };
}

/* --------------------------- ligação global ------------------------------- */

let wired = false;

/** Um único conjunto de listeners delegados para todo o app (nada de bind por tela). */
export function initInteractions() {
  if (wired) return; wired = true;

  const at = (e, sel) => (e.target?.nodeType === 1 ? e.target.closest(sel) : null);
  let held = null;

  addEventListener('pointerdown', (e) => {
    const el = at(e, PRESS); if (!el || el.disabled) return;
    held = el; press(el, true); ripple(el, e.clientX, e.clientY);
  }, { capture: true });
  const release = () => { if (held) press(held, false); held = null; };
  addEventListener('pointerup', release, { capture: true });
  addEventListener('pointercancel', release, { capture: true });

  addEventListener('keydown', (e) => {
    if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
    const el = document.activeElement?.closest?.(PRESS); if (!el || el.disabled) return;
    press(el, true); ripple(el);
  });
  addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || e.key === ' ') press(document.activeElement?.closest?.(PRESS), false);
  });

  if (canHover) {
    addEventListener('pointerover', (e) => { const el = at(e, HOVER); if (el && !el.disabled) hoverLift(el, true); }, { capture: true });
    addEventListener('pointerout', (e) => { const el = at(e, HOVER); if (el) hoverLift(el, false); }, { capture: true });
  }

  // campos: label sobe e o input dá um "settle" ao receber foco
  const field = (input, on) => {
    if (!(input instanceof HTMLInputElement)) return;
    const wrap = input.closest('.field'); if (!wrap) return;
    wrap.classList.toggle('is-focus', on);
    const label = wrap.querySelector(':scope > span');
    if (label) gsap.to(label, on
      ? { y: -2, duration: T.s, ease: EASE.out }
      : { y: 0, duration: T.m, ease: EASE.spring, clearProps: 'transform' });
    if (on && !reduced()) gsap.fromTo(input, { scale: 0.994 }, { scale: 1, duration: T.m, ease: EASE.spring, clearProps: 'transform' });
  };
  addEventListener('focusin', (e) => field(e.target, true), true);
  addEventListener('focusout', (e) => field(e.target, false), true);
}
