import { signOut } from '../services/auth.js';
import { reveal, T, reduced } from '../utils/motion.js';
import { flakeSVG } from '../components/ui-loading.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Card de tela cheia: o ícone, o título e o texto entram em cascata. */
const cardIn = (root) => {
  if (reduced()) return;
  reveal([...root.querySelectorAll('.card > *')], { y: 14, each: 0.06, duration: T.l });
};

// Provisório da Etapa 1: confirma login + perfil. A árvore gigante entra na Etapa 2.
export function renderHome(root, { name, admin }) {
  root.innerHTML = `
  <main class="stage"><section class="card">
    <i class="fa-solid ${admin ? 'fa-crown' : 'fa-star'} star" aria-hidden="true"></i>
    <h1>Olá, ${esc(name)}!</h1>
    <p class="sub">${admin ? 'Você é o administrador (REI). ' : ''}Sua conta está pronta. A árvore de Natal chega na próxima etapa.</p>
    <button class="btn ghost" id="out" type="button"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>
  </section></main>`;
  root.querySelector('#out').onclick = () => signOut();
  cardIn(root);
}

/**
 * Aviso de tela cheia (erro, configuração pendente, sucesso). O ícone é o mesmo
 * floco do estado de carregamento: uma linguagem visual só em todo o sistema.
 */
export function renderNotice(root, title, text, action, onAction) {
  root.innerHTML = `<main class="stage"><section class="card">
    <span class="flake-mark" aria-hidden="true">${flakeSVG()}</span>
    <h1>${title}</h1><p class="sub">${text}</p>
    ${action ? `<button class="btn gold" id="a" type="button">${action}</button>` : ''}
  </section></main>`;
  if (action) root.querySelector('#a').onclick = onAction;
  cardIn(root);
}
