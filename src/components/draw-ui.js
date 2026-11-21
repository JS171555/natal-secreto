import { dialog } from './participation.js';
import { photoUrl } from '../services/participants.js';
import { esc } from '../pages/home.js';
import { T, reveal, shake } from '../utils/motion.js';
import { LOAD, showLoading, hideLoading } from './ui-loading.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ERR = {
  forbidden: 'Somente o administrador pode realizar o sorteio.', already_done: 'O sorteio já foi realizado.',
  not_enough: 'São necessários pelo menos 2 participantes confirmados.', participants_changed: 'Alguém entrou durante o sorteio. Nada foi gravado; tente de novo.',
  network: 'Falha de conexão. Confira se o sorteio foi feito antes de tentar de novo.', unauthenticated: 'Sua sessão expirou. Entre novamente.',
};

export const giftBoxHTML = (g = 120) => `<span class="gb" style="--g:${g}px"><span class="gb-glow"></span><span class="gb-body"></span><span class="gb-rib"></span><span class="gb-lid"><i class="gb-bow"></i></span></span>`;

// Janela do botão SORTEIO (todos): mostra o estado, sem nenhum par além do próprio.
export function openDrawInfo({ done, drawnAt, mine, isParticipant, admin, status, count, onOpenBox }) {
  let body;
  if (!done) {
    body = `<p class="sub">O sorteio ainda não foi realizado. Quando acontecer, uma caixa de presente aparece na sua tela.</p>
      ${admin ? `<p class="sub">Participantes confirmados: <strong>${count}</strong>. Use REALIZAR SORTEIO quando todos estiverem na árvore.</p>` : ''}`;
  } else {
    const when = drawnAt ? new Date(drawnAt).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : '';
    body = `<p class="pill-ok"><i class="fa-solid fa-circle-check"></i> Sorteio concluído</p><p class="sub">Realizado em ${esc(when)}.</p>
      ${mine ? `<button class="btn gold" id="box" type="button"><i class="fa-solid fa-gift"></i> ${mine.revealed_at ? 'Ver quem eu tirei' : 'Abrir minha caixa'}</button>`
        : isParticipant ? '' : '<p class="sub">Você não estava entre os participantes confirmados.</p>'}
      ${admin && status ? `<p class="sub">${status.revealed} de ${status.assignments} participantes já abriram a caixa.</p>` : ''}`;
  }
  const d = dialog(`<div class="sheet"><i class="fa-solid fa-gift star"></i><h2>Sorteio</h2>${body}<button class="btn ghost" id="x" type="button">Fechar</button></div>`);
  d.querySelector('#x').onclick = () => d.close();
  d.querySelector('#box')?.addEventListener('click', () => d.close(onOpenBox)); // encadeia depois da saída, sem empilhar
}

// Confirmação do administrador antes de executar a operação.
export function openConfirmDraw({ count, run }) {
  const d = dialog(`<div class="sheet"><h2>Realizar o sorteio?</h2>
    <p class="sub"><strong>${count}</strong> participante${count === 1 ? '' : 's'} confirmado${count === 1 ? '' : 's'}. Depois do sorteio ninguém mais entra na árvore e a ação <strong>não pode ser repetida</strong>.</p>
    ${count === 2 ? '<p class="msg err">Com 2 pessoas, o sorteio é apenas uma troca entre elas.</p>' : ''}
    <button class="btn gold" id="go" type="button" ${count < 2 ? 'disabled' : ''}>Sim, realizar sorteio</button>
    <button class="btn ghost" id="no" type="button">Cancelar</button>
    <p class="msg err" role="alert" ${count < 2 ? '' : 'hidden'}>${count < 2 ? ERR.not_enough : ''}</p></div>`);
  const $ = (s) => d.querySelector(s), sheet = $('.sheet'), go = $('#go'), no = $('#no'), msg = $('.sheet > .msg:last-child');
  d.blocked = false;
  no.onclick = () => d.close();
  go.onclick = async () => {
    d.blocked = true; go.disabled = no.disabled = true; msg.hidden = true;
    showLoading(LOAD.draw, { in: sheet }); // mesmo padrão do app, agora dentro do painel
    try {
      await run();
      hideLoading({ in: sheet });
      sheet.innerHTML = `<i class="fa-solid fa-gift star"></i><h2>Sorteio realizado!</h2><p class="sub">Cada participante já pode abrir sua caixa de presente.</p><button class="btn gold" id="fim" type="button">Fechar</button>`;
      reveal([...sheet.children], { y: 12, each: 0.07, delay: 0.05 });
      $('#fim').onclick = () => d.close();
    } catch (e) {
      hideLoading({ in: sheet });
      msg.textContent = ERR[e.code] || 'Não foi possível realizar o sorteio. Nada foi gravado.'; msg.hidden = false;
      reveal(msg, { y: 8, duration: T.m }); shake(msg, { dist: 5 });
      go.disabled = e.code === 'already_done'; no.disabled = false;
    }
    d.blocked = false;
  };
}

// Revelação individual: caixa → suspense → "VOCÊ TIROU!" + foto + nome.
export function openReveal({ reveal: revealIt, resolve, revealed, onClose }) {
  const d = dialog(`<div class="sheet reveal" tabindex="-1" autofocus>
    <div class="rv-box"><button class="gb-btn" type="button" aria-label="Abrir a caixa de presente">${giftBoxHTML(150)}</button>
      <h2>Uma surpresa para você!</h2><p class="sub">Toque na caixa para descobrir quem você tirou.</p></div>
    <div class="rv-res" hidden><p class="tiro">VOCÊ TIROU!</p><div class="pvwrap"></div><h2 class="who"></h2>
      <p class="sub">Guarde segredo até o dia da troca!</p></div>
    <button class="btn gold" id="fim" type="button" hidden>Fechar</button>
    <p class="msg err" role="alert" hidden></p></div>`);
  const $ = (s) => d.querySelector(s), msg = $('.msg'), gb = $('.gb'), box = $('.rv-box'), res = $('.rv-res'), closeBtn = $('#fim');
  let busy = false;
  d.blocked = false;
  d.addEventListener('close', () => onClose?.());
  $('#fim').onclick = () => d.close();

  const go = async () => {
    if (busy) return; busy = true; d.blocked = true; msg.hidden = true;
    if (!revealed) gb.classList.add('shake');
    try {
      const [id] = await Promise.all([revealIt(), sleep(revealed ? 150 : 1200)]);
      const who = id && (await resolve(id));
      if (!who) throw new Error('sem resultado');
      gb.classList.remove('shake'); gb.classList.add('opening');
      await sleep(revealed ? 250 : 800);
      box.hidden = true;
      $('.pvwrap').innerHTML = `<span class="ball${who.admin ? ' gold' : ''}" style="--s:200px"><b class="ini">${esc(who.name.charAt(0).toUpperCase())}</b>${who.path ? `<img src="${esc(photoUrl(who.path))}" alt="Foto de ${esc(who.name)}">` : ''}</span>`;
      $('.pvwrap img')?.addEventListener('error', (e) => e.target.remove());
      $('.who').innerHTML = `${who.admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(who.name)}`;
      res.hidden = false; closeBtn.hidden = false;
    } catch {
      gb.classList.remove('shake');
      msg.textContent = 'Não foi possível abrir agora. Verifique a conexão e toque na caixa de novo.'; msg.hidden = false;
      reveal(msg, { y: 8, duration: T.m }); shake(msg, { dist: 5 });
    }
    busy = false; d.blocked = false;
  };
  $('.gb-btn').onclick = go;
  if (revealed) go(); // já revelado: mostra o resultado sem refazer o suspense
}
