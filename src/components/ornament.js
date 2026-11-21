import { photoUrl } from '../services/participants.js';
import { esc } from '../pages/home.js';

// .orn conduz o balanço e o brilho/hover da bola são CSS; .orn-in é a camada independente de entrada.
export function ornamentHTML(it, S, isAdmin, isNew = false) {
  const real = it.p.profiles?.display_name || 'Participante';
  const name = isAdmin ? 'REI' : real;
  const url = it.p.photo_path ? photoUrl(it.p.photo_path) : '';
  return `<div class="orn${isAdmin ? ' admin' : ''}${isNew ? ' enter' : ''}" role="button" tabindex="0" data-uid="${esc(it.p.user_id)}" aria-label="${esc(name)}" style="left:${it.x - S / 2}px;top:${it.y}px;--s:${S}px;--cord:${it.cord}px;--d:${it.delay}s">
    ${isAdmin ? '<i class="fa-solid fa-crown crown" aria-hidden="true"></i>' : ''}<span class="orn-in"><span class="cord"></span><span class="cap"></span>
    <span class="ball"><b class="ini">${esc(real.trim().charAt(0).toUpperCase())}</b>${url ? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">` : ''}</span>
    <span class="nm">${esc(name)}</span></span></div>`;
}
