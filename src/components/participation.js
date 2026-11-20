import { processPhoto } from '../utils/image.js';
import { confirmParticipation, photoUrl } from '../services/participants.js';
import { friendlyError } from '../services/auth.js';
import { esc } from '../pages/home.js';

export function dialog(html) {
  const d = document.createElement('dialog');
  d.className = 'modal'; d.innerHTML = html; document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); }); // clique no fundo fecha
  d.showModal();
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
  const $ = (s) => d.querySelector(s), msg = $('.msg'), ball = $('.ball'), file = $('#file'), ok = $('#ok');
  let blob = null, url = '', busy = false;
  const say = (t, cls = 'err') => { msg.textContent = t; msg.className = 'msg ' + cls; msg.hidden = !t; };
  const lock = (v) => { busy = v; ['#pick', '#cancel'].forEach((s) => ($(s).disabled = v)); ok.disabled = v || !blob; ok.classList.toggle('busy', v); };
  d.addEventListener('cancel', (e) => busy && e.preventDefault()); // ESC não interrompe o envio
  d.addEventListener('close', () => url && URL.revokeObjectURL(url));

  $('#pick').onclick = () => file.click();
  $('#cancel').onclick = () => d.close();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    say(''); lock(true);
    try {
      blob = await processPhoto(f);
      url && URL.revokeObjectURL(url); url = URL.createObjectURL(blob);
      ball.querySelector('img')?.remove(); ball.insertAdjacentHTML('beforeend', `<img src="${url}" alt="Pré-visualização da sua foto">`);
      $('#pick span').textContent = 'Trocar foto';
    } catch (e) { blob = null; say(e.userMessage || 'Não foi possível usar essa foto.'); }
    file.value = ''; lock(false);
  };
  ok.onclick = async () => {
    if (!blob) return; say(''); lock(true);
    try { await confirmParticipation(userId, blob); d.close(); onDone(); }
    catch (e) { say(e.userMessage || friendlyError(e)); lock(false); if (e.already) { d.close(); onDone(); } }
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
