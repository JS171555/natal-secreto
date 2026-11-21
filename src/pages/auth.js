import * as auth from '../services/auth.js';
import { reveal, shake, T, reduced } from '../utils/motion.js';
import { busyRun } from '../components/ui-loading.js';

const field = (id, label, type, attrs = '') =>
  `<label class="field" for="${id}"><span>${label}</span><input id="${id}" name="${id}" type="${type}" ${attrs} required /></label>`;

const shell = (sub, body) => `
  <main class="stage"><section class="card">
    <i class="fa-solid fa-star star" aria-hidden="true"></i>
    <h1>Natal Secreto</h1><p class="sub">${sub}</p>
    ${body}
    <p class="msg" role="alert" hidden></p>
  </section></main>`;

/** Card entra em cascata: ícone → título → campos → botões. */
const cardIn = (root) => {
  if (reduced()) return;
  reveal([...root.querySelectorAll('.card > *')], { y: 14, each: 0.07, duration: T.l });
};

/** Bloco de erro padrão: aparece deslizando e avisa com um empurrão discreto. */
const showError = (msg, text, at) => {
  msg.textContent = text; msg.className = 'msg err'; msg.hidden = false;
  reveal(msg, { y: 10, duration: T.m });
  if (at) shake(at, { dist: 5 }); else shake(msg, { dist: 5 });
};

// Campo obrigatório em branco não deveria virar ida ao servidor.
// Devolve o .field do primeiro input vazio (para o shake apontar para ele)
// ou `null` quando o formulário está pronto para enviar — nunca `true`,
// senão o handler confunde "válido" com "inválido" e bloqueia o envio.
const precheck = (form) => {
  let bad = null;
  form.querySelectorAll('input[required]').forEach((i) => {
    const wrap = i.closest('.field'), empty = !i.value.trim();
    wrap.classList.toggle('is-bad', empty);
    if (empty && !bad) bad = i;
  });
  if (!bad) return null;
  bad.focus({ preventScroll: true });
  return bad.closest('.field');
};

function wire(root, id, fn) {
  const form = root.querySelector(id), msg = root.querySelector('.msg'), btn = form.querySelector('button[type=submit]');
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-bad'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msg.hidden = true;
    const bad = precheck(form);
    if (bad) return showError(msg, 'Preencha os campos destacados para continuar.', bad);
    try { await busyRun(btn, () => fn(Object.fromEntries(new FormData(form)))); }
    catch (e) { showError(msg, e.userMessage || auth.friendlyError(e)); }
  });
  return (text) => { msg.textContent = text; msg.className = 'msg ok'; msg.hidden = false; reveal(msg, { y: 10, duration: T.m }); };
}

function links(root, go) {
  root.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); go(a.dataset.go); }));
}

export function renderLogin(root, go, notice) {
  root.innerHTML = shell('Bem-vindo! Entre para pendurar sua bola na árvore.', `
    <form id="f" novalidate>
      ${field('email', 'E-mail', 'email', 'autocomplete="email"')}
      ${field('password', 'Senha', 'password', 'autocomplete="current-password"')}
      <button class="btn gold" type="submit">Entrar</button>
    </form>
    <div class="or"><span>ou</span></div>
    <button class="btn ghost" id="google" type="button"><i class="fa-brands fa-google"></i> Entrar com Google</button>
    <nav class="links"><a href="#" data-go="register">Criar conta</a><a href="#" data-go="forgot">Esqueci a senha</a></nav>`);
  wire(root, '#f', ({ email, password }) => auth.signIn(email.trim(), password));
  if (notice) showError(root.querySelector('.msg'), notice);
  root.querySelector('#google').onclick = async (e) => {
    const btn = e.currentTarget;
    try { await busyRun(btn, () => auth.signInWithGoogle()); }
    catch (err) { showError(root.querySelector('.msg'), auth.friendlyError(err), btn); }
  };
  links(root, go); cardIn(root);
}

export function renderRegister(root, go) {
  root.innerHTML = shell('Crie sua conta para participar do amigo secreto.', `
    <form id="f" novalidate>
      ${field('name', 'Nome', 'text', 'autocomplete="name" minlength="2" maxlength="40"')}
      ${field('email', 'E-mail', 'email', 'autocomplete="email"')}
      ${field('password', 'Senha', 'password', 'autocomplete="new-password" minlength="6"')}
      ${field('confirm', 'Confirmar senha', 'password', 'autocomplete="new-password" minlength="6"')}
      <button class="btn gold" type="submit">Criar conta</button>
    </form>
    <nav class="links"><a href="#" data-go="login">Já tenho conta</a></nav>`);
  const ok = wire(root, '#f', async (v) => {
    if (v.name.trim().length < 2) throw { userMessage: 'Informe seu nome.' };
    if (v.password.length < 6) throw { userMessage: 'A senha precisa ter pelo menos 6 caracteres.' };
    if (v.password !== v.confirm) throw { userMessage: 'As senhas não são iguais.' };
    const data = await auth.signUp(v.name.trim(), v.email.trim(), v.password);
    if (!data.session) ok('Conta criada! Enviamos um link de confirmação para o seu e-mail.');
  });
  links(root, go); cardIn(root);
}

export function renderForgot(root, go) {
  root.innerHTML = shell('Informe seu e-mail e enviaremos um link para criar uma nova senha.', `
    <form id="f" novalidate>
      ${field('email', 'E-mail', 'email', 'autocomplete="email"')}
      <button class="btn gold" type="submit">Enviar link</button>
    </form>
    <nav class="links"><a href="#" data-go="login">Voltar para entrar</a></nav>`);
  const ok = wire(root, '#f', async ({ email }) => { await auth.sendRecovery(email.trim()); ok('Link enviado. Confira sua caixa de entrada.'); });
  links(root, go); cardIn(root);
}

export function renderReset(root, onDone) {
  root.innerHTML = shell('Escolha sua nova senha.', `
    <form id="f" novalidate>
      ${field('password', 'Nova senha', 'password', 'autocomplete="new-password" minlength="6"')}
      ${field('confirm', 'Confirmar nova senha', 'password', 'autocomplete="new-password" minlength="6"')}
      <button class="btn gold" type="submit">Salvar nova senha</button>
    </form>`);
  wire(root, '#f', async (v) => {
    if (v.password.length < 6) throw { userMessage: 'A senha precisa ter pelo menos 6 caracteres.' };
    if (v.password !== v.confirm) throw { userMessage: 'As senhas não são iguais.' };
    await auth.updatePassword(v.password);
    onDone();
  });
  cardIn(root);
}
