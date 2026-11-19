import { saveDisplayName } from '../services/profile.js';
import { friendlyError } from '../services/auth.js';

export function renderProfileSetup(root, user, onDone) {
  const suggestion = (user.user_metadata?.full_name || user.user_metadata?.name || '').slice(0, 40);
  root.innerHTML = `
  <main class="stage"><section class="card">
    <i class="fa-solid fa-star star" aria-hidden="true"></i>
    <h1>Como devemos te chamar?</h1>
    <p class="sub">Este nome aparecerá na sua bola de Natal. Os amigos verão exatamente assim.</p>
    <form id="f" novalidate>
      <label class="field" for="name"><span>Nome na árvore</span>
        <input id="name" name="name" type="text" minlength="2" maxlength="40" required autocomplete="nickname" /></label>
      <label class="check"><input type="checkbox" name="ok" required /><span>Confirmo que é assim que quero aparecer.</span></label>
      <button class="btn gold" type="submit">Confirmar e entrar</button>
    </form>
    <p class="msg" role="alert" hidden></p>
  </section></main>`;
  const form = root.querySelector('#f'), msg = root.querySelector('.msg'), btn = form.querySelector('button');
  form.name.value = suggestion;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const name = form.name.value.trim().replace(/\s+/g, ' ');
    const fail = (t) => { msg.textContent = t; msg.className = 'msg err'; msg.hidden = false; };
    if (name.length < 2) return fail('O nome precisa ter pelo menos 2 letras.');
    if (!form.ok.checked) return fail('Marque a caixa para confirmar o nome.');
    btn.disabled = true; btn.classList.add('busy');
    try { await saveDisplayName(user.id, name); onDone(name); }
    catch (e) { fail(friendlyError(e)); btn.disabled = false; btn.classList.remove('busy'); }
  });
}
