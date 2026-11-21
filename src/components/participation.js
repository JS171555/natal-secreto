import gsap from 'gsap';
import { processPhoto } from '../utils/image.js';
import { confirmParticipation, photoUrl } from '../services/participants.js';
import { friendlyError } from '../services/auth.js';
import { esc } from '../pages/home.js';
import { EASE, T, reduced, reveal, pop, burst } from '../utils/motion.js';
import { lazyLoading, LOAD } from './ui-loading.js';

const nativeClose = HTMLDialogElement.prototype.close;

/**
 * Modal padrão do sistema: fundo que escurece com CSS e painel que entra e sai
 * conduzido pelo GSAP. `d.close()` pode receber um callback para depois da saída
 * (é o que evita dois modais empilhados ao encadear janelas).
 * `d.blocked = true` segura o ESC enquanto um envio estiver em andamento.
 */
export function dialog(html) {
  const d = document.createElement('dialog');
  d.className = 'modal'; d.innerHTML = html; document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // clique no fundo fecha
  d.addEventListener('cancel', (e) => { e.preventDefault(); if (!d.blocked) d.close(); });

  d.close = (onDone) => {
    if (d.closing) { onDone?.(); return; }
    d.closing = true; d.classList.add('closing');
    const fin = () => { d.closing = false; nativeClose.call(d); onDone?.(); };
    if (reduced()) return fin();
    gsap.to(d, { opacity: 0, y: 10, scale: 0.97, duration: T.s, ease: EASE.in, overwrite: 'auto', onComplete: fin });
  };

  d.showModal();
  if (!reduced()) {
    gsap.from(d, { opacity: 0, y: 18, scale: 0.96, duration: T.l, ease: EASE.spring, clearProps: 'transform,opacity' });
    reveal(d.querySelector('.sheet') ? [...d.querySelector('.sheet').children].filter((el) => !el.hidden) : d, { y: 12, each: 0.05, delay: 0.08 });
  }
  return d;
}

export function openParticipate({ userId, name, onDone }) {
  const d = dialog(`<div class="sheet">
    <h2>Sua bola de Natal</h2>
    <p class="sub">Escolha uma foto para aparecer na árvore como <strong>${esc(name)}</strong>.</p>
    <div class="pvwrap"><span class="ball" style="--s:176px"><b class="ini"><i class="fa-solid fa-camera"></i></b></span></div>
    <input id="file" type="file" accept="image/jpeg,image/png,image/webp" hidden />
    <button class="btn ghost" id="pick" type="button"><i class="fa-solid fa-image"></i> <span>Escolher foto</span></button>
    <button class="btn gold" id="ok" type="button" disabled>Confirmar participação</button>
    <button class="btn ghost" id="cancel" type="button">Cancelar</button>
    <p class="msg" role="alert" hidden></p></div>`);
  const $ = (s) => d.querySelector(s), sheet = $('.sheet'), msg = $('.msg'), ball = $('.ball'), file = $('#file'), ok = $('#ok');
  let blob = null, url = '', busy = false;
  const say = (t, cls = 'err') => { msg.textContent = t; msg.className = 'msg ' + cls; msg.hidden = !t; if (!msg.hidden && !reduced()) reveal(msg, { y: 8, duration: T.m }); };
  const lock = (v) => { busy = v; d.blocked = v; ['#pick', '#cancel'].forEach((s) => ($(s).disabled = v)); ok.disabled = v || !blob; ok.classList.toggle('busy', v); };

  d.addEventListener('close', () => url && URL.revokeObjectURL(url));

  $('#pick').onclick = () => file.click();
  $('#cancel').onclick = () => d.close();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    say(''); lock(true);
    const done = lazyLoading(LOAD.photo, { in: sheet }); // só aparece se a foto demorar
    try {
      blob = await processPhoto(f);
      url && URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
      ball.querySelector('img')?.remove(); ball.insertAdjacentHTML('beforeend', `<img src="${url}" alt="Pré-visualização da sua foto">`);
      $('#pick span').textContent = 'Trocar foto';
      pop(ball, { scale: 1.06 }); // a bola “veste” a foto
    } catch (e) { blob = null; say(e.userMessage || 'Não foi possível usar essa foto.'); }
    file.value = ''; done(); lock(false);
  };
  ok.onclick = async () => {
    if (!blob) return; say(''); lock(true);
    const done = lazyLoading(LOAD.hang, { in: sheet }, 140);
    try {
      await confirmParticipation(userId, blob);
      burst($('.pvwrap'), { count: 18, min: 40, max: 130 }); // comemora antes de fechar
      await new Promise((r) => setTimeout(r, reduced() ? 0 : 420));
      done(); d.close(onDone);
    } catch (e) {
      done();
      say(e.userMessage || friendlyError(e)); lock(false);
      if (e.already) d.close(onDone);
    }
  };
}

// Cartão público de um participante: só foto, nome e confirmação (nada de e-mail ou dados de login).
export function openCard({ name, path, admin }) {
  const d = dialog(`<div class="sheet">
    <div class="pvwrap"><span class="ball${admin ? ' gold' : ''}" style="--s:200px"><b class="ini">${esc(name.charAt(0).toUpperCase())}</b>${path ? `<img src="${esc(photoUrl(path))}" alt="Foto de ${esc(name)}">` : ''}</span></div>
    <h2>${admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(name)}</h2>
    <p class="pill-ok"><i class="fa-solid fa-circle-check"></i> Participação confirmada</p>
    <button class="btn ghost" id="close" type="button">Fechar</button></div>`);
  d.querySelector('img')?.addEventListener('error', (e) => e.target.remove());
  d.querySelector('#close').onclick = () => d.close();
}
