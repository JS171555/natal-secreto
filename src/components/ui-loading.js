import gsap from 'gsap';
import { reduced, EASE, T } from '../utils/motion.js';

/* =============================================================================
   ESTADO DE CARREGAMENTO PADRÃO DO SISTEMA — o modelo “Carregando a árvore”.

   É sempre o mesmo par: floco de neve em rotação + texto de status. Muda apenas
   o rótulo e o lugar onde aparece:
     • showLoading(label)             → cobertura da tela inteira
     • showLoading(label, { in: el }) → cobertura dentro de um painel/modal aberto
     • setBusy(btn, true)             → a mesma marca, miúda, dentro do botão
     • loadingBlock(label)            → o mesmo bloco para caber dentro de um card

   A rotação é um tween do GSAP (pausa com a aba oculta; com “reduzir movimento”
   vira respiração de opacidade no texto). O floco é SVG: funciona antes do
   bundle carregar e não depende do Font Awesome.
   ========================================================================== */

let uid = 0;

/** Floco de neve em SVG: seis braços iguais, cor = currentColor. */
export const flakeSVG = () => {
  const id = `flk${++uid}`;
  const arm = 'M12 12V2.4M12 5.4 9.4 3.2M12 5.4l2.6-2.2M12 8.8 10 7.1M12 8.8l2-1.7';
  return `<svg class="flake" viewBox="0 0 24 24" aria-hidden="true" focusable="false">`
    + `<defs><path id="${id}" d="${arm}"/></defs>`
    + [0, 60, 120, 180, 240, 300].map((r) => `<use href="#${id}"${r ? ` transform="rotate(${r} 12 12)"` : ''}/>`).join('')
    + `<circle cx="12" cy="12" r="1.15" stroke="none"/></svg>`;
};

/** Ícone que gira. `is-mini` = dentro de botão. */
export const mark = (cls = '') => `<span class="load-mark${cls}">${flakeSVG()}</span>`;

export const LOAD = {
  tree: 'Carregando a árvore…',
  photo: 'Preparando sua foto…',
  hang: 'Pendurando sua bola…',
  draw: 'Realizando o sorteio…',
  box: 'Abrindo sua caixa…',
  card: 'Consultando o sorteio…',
  in: 'Entrando no Natal…',
  out: 'Saindo…',
  send: 'Enviando…',
  save: 'Salvando…',
  net: 'Reconectando…',
};

const inner = (label) => `<span class="load-pop">${mark()}</span><p class="load-text">${label}</p>`;

/** Bloco pronto para viver dentro de um card (avisos, telas de status). */
export const loadingBlock = (label = LOAD.tree) => `<div class="load is-card" role="status">${inner(label)}</div>`;

/* --------------------------- cobertura de tela ---------------------------- */

const hosts = new Map(); // host (document.body | painel) → { el, spin, timer }
const SPIN = 2.6;

/**
 * Floco isolado fora do overlay (banner de conexão, card de status): mesmo
 * movimento do padrão. Devolve a função que desliga — chame ao esconder.
 */
export function spinMark(el, { duration = SPIN } = {}) {
  const tw = !el || reduced() ? null : gsap.to(el, { rotate: 360, duration, ease: 'none', repeat: -1 });
  const off = () => { tw?.kill(); if (el) el.style.transform = ''; };
  off.pause = () => tw?.pause();
  off.play = () => tw?.play();
  return off;
}

function mount(host, inset, label) {
  const found = hosts.get(host);
  if (found) { found.el.querySelector('.load-text').textContent = label; return found; }

  let el;
  if (inset) {
    el = document.createElement('div');
    el.className = 'load is-inset';
    el.setAttribute('role', 'status');
    el.innerHTML = inner(label);
    host.append(el);
  } else {
    el = document.getElementById('boot') ?? Object.assign(document.createElement('div'), { id: 'boot' });
    el.className = 'load is-boot';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = inner(label);
    document.body.append(el);
  }

  const spin = spinMark(el.querySelector('.load-mark'));
  if (reduced()) el.classList.add('is-still');
  if (document.hidden) spin.pause();
  const st = { el, spin, timer: 0 };
  hosts.set(host, st);
  return st;
}

function animateIn(el) {
  if (reduced()) { gsap.set(el, { clearProps: 'opacity' }); return; }
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: T.m, ease: EASE.out, overwrite: 'auto' });
  gsap.from(el.querySelector('.load-pop'), { scale: 0.8, duration: T.l, ease: EASE.spring, clearProps: 'transform' });
  gsap.from(el.querySelector('.load-text'), { y: 8, opacity: 0, duration: T.l, ease: EASE.out, clearProps: 'transform,opacity' });
}

/** Mostra — ou só troca o rótulo de — um carregamento do padrão. */
export function showLoading(label = LOAD.tree, { in: host, timeout = 24000 } = {}) {
  const target = host ?? document.body;
  const st = mount(target, !!host, label);
  st.el.hidden = false;
  animateIn(st.el);
  clearTimeout(st.timer);
  if (!host && timeout) st.timer = setTimeout(() => hideLoading(), timeout); // rede de proteção
  return st.el;
}

export function hideLoading({ in: host } = {}) {
  const key = host ?? document.body;
  let st = hosts.get(key);
  if (!st) {
    // splash estático do index.html: existe antes de qualquer showLoading e precisa
    // ser encerrado pela mesma porta de saída, senão fica cobrindo a tela inteira.
    const boot = key === document.body && document.getElementById('boot');
    if (!boot || boot.hidden) return;
    st = { el: boot, spin: null, timer: 0 };
    hosts.set(key, st);
  }
  if (st.el.hidden) return;
  clearTimeout(st.timer);
  // spin é o controlador devolvido por spinMark: chamar como função encerra o tween
  const kill = () => { st.spin?.(); st.el.remove(); hosts.delete(host ?? document.body); };
  if (reduced()) return kill();
  gsap.to(st.el, { opacity: 0, duration: T.s, ease: EASE.in, overwrite: 'auto', onComplete: kill });
}

/** Há um carregamento do padrão visível? (usado pela rede de segurança do boot) */
export const isLoading = (host) => {
  const st = hosts.get(host ?? document.body);
  return !!st && !st.el.hidden;
};

// aba em segundo plano não gasta CPU com spinner
document.addEventListener('visibilitychange', () => {
  for (const { spin } of hosts.values()) document.hidden ? spin?.pause() : spin?.play();
});

/* ------------------------------ em botões -------------------------------- */

const origin = new WeakMap();

/** Mesmo floco, miúdo, no lugar do ícone do botão. */
export function setBusy(btn, on, label) {
  if (!btn) return;
  if (on) {
    if (origin.has(btn)) return; // já está ocupado
    const text = label ?? btn.textContent.trim();
    origin.set(btn, btn.innerHTML);
    btn.classList.add('is-busy'); btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `${mark(' is-mini')}<span>${text}</span>`;
  } else {
    if (!origin.has(btn)) return;
    btn.classList.remove('is-busy'); btn.disabled = false; btn.removeAttribute('aria-busy');
    btn.innerHTML = origin.get(btn); origin.delete(btn);
  }
}

/** Envolve uma promise: abre o padrão e fecha no fim, com ou sem erro. */
export async function withLoading(label, fn, opts = {}) {
  showLoading(label, opts);
  try { return await fn(); } finally { hideLoading(opts); }
}

/**
 * Spinner atrasado: só aparece se demorar mais de `ms`. Operações rápidas não
 * piscam um loading na tela — o padrão recomendado para não poluir o app.
 * Devolve a função que encerra (chame no finally).
 */
export function lazyLoading(label, opts = {}, ms = 240) {
  let shown = false;
  const t = setTimeout(() => { shown = true; showLoading(label, opts); }, ms);
  return () => { clearTimeout(t); if (shown) hideLoading(opts); };
}

/** Botão ocupado + promise: padrão para todo envio de formulário. */
export async function busyRun(btn, fn, label) {
  setBusy(btn, true, label);
  try { return await fn(); } finally { setBusy(btn, false); }
}
