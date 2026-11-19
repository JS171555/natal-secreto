import { signOut } from '../services/auth.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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
}

export function renderNotice(root, title, text, action, onAction) {
  root.innerHTML = `<main class="stage"><section class="card"><i class="fa-solid fa-snowflake star" aria-hidden="true"></i><h1>${title}</h1><p class="sub">${text}</p>${action ? `<button class="btn gold" id="a" type="button">${action}</button>` : ''}</section></main>`;
  if (action) root.querySelector('#a').onclick = onAction;
}
