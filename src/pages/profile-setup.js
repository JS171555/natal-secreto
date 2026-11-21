import { saveDisplayName } from '../services/profile.js';
import { friendlyError } from '../services/auth.js';
import { reveal, shake, pop, T, reduced } from '../utils/motion.js';
import { LOAD, busyRun } from '../components/ui-loading.js';

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

  const fail = (t, at) => {
    msg.textContent = t; msg.className = 'msg err'; msg.hidden = false;
    reveal(msg, { y: 10, duration: T.m }); shake(at ?? msg, { dist: 5 });
  };
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-bad'));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msg.hidden = true;
    const name = form.name.value.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { form.name.closest('.field').classList.add('is-bad'); form.name.focus({ preventScroll: true }); return fail('O nome precisa ter pelo menos 2 letras.', form.name.closest('.field')); }
    if (!form.ok.checked) { shake(form.ok.closest('.check'), { dist: 5 }); return fail('Marque a caixa para confirmar o nome.'); }
    await busyRun(btn, async () => {
      try { await saveDisplayName(user.id, name); onDone(name); }
      catch (e) { fail(friendlyError(e)); throw e; } // impede o swap achar que deu tudo certo
    }, LOAD.in);
  });

  if (suggestion) pop(root.querySelector('.field'), { scale: 1.02 }); // já vem preenchido da conta Google
  if (!reduced()) reveal([...root.querySelectorAll('.card > *')], { y: 14, each: 0.07, duration: T.l });
}
