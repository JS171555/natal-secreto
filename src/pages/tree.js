import { startSnow } from '../components/snow.js';
import { buildScene } from '../components/scene.js';
import { ornamentHTML } from '../components/ornament.js';
import { computeLayout } from '../utils/layout.js';
import { fetchParticipants, fetchAdminId, subscribeParticipants } from '../services/participants.js';
import { signOut } from '../services/auth.js';
import { openParticipate, openCard } from '../components/participation.js';
import { openDrawInfo, openConfirmDraw, openReveal, giftBoxHTML } from '../components/draw-ui.js';
import { fetchDrawState, fetchDrawStatus, revealMyResult, runDraw, subscribeDraw } from '../services/draw.js';
import { esc } from './home.js';

export function mountTree(root, { user, name, admin }) {
  root.innerHTML = `<div class="tree-page">
    <div class="scene"></div><canvas class="snow" aria-hidden="true"></canvas>
    <header class="topbar"><span class="chip">${admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(name)}</span>
      <button class="icon-btn" id="out" type="button" aria-label="Sair" title="Sair"><i class="fa-solid fa-right-from-bracket"></i></button></header>
    <p class="hint" hidden>A árvore ainda está vazia. As bolas aparecem aqui quando alguém confirmar participação.</p>
    <p class="banner" hidden><span>Não foi possível carregar a árvore.</span> <button type="button" id="retry">Tentar de novo</button></p>
    <button class="fab" id="join" type="button"></button>
    <div class="fab-left"><button class="fab" id="doDraw" type="button" hidden><i class="fa-solid fa-dice"></i> REALIZAR SORTEIO</button>
      <button class="fab alt" id="drawBtn" type="button"><i class="fa-solid fa-gift"></i> SORTEIO</button></div>
    <button class="gift" id="gift" type="button" hidden aria-label="Abrir sua surpresa do sorteio">${giftBoxHTML(76)}<small>ABRIR!</small></button>
    <div class="scroll-hint"><i class="fa-solid fa-chevron-up"></i><span>Role para cima</span></div></div>`;

  const $ = (s) => root.querySelector(s), scene = $('.scene'), el = document.documentElement;
  let list = [], adminId = null, lastW = 0, timer = 0, seen = new Set(), unsub = null, unsubDraw = null, dstate = { done: false, drawnAt: null, mine: null };
  const stopSnow = startSnow($('.snow'));
  $('#out').onclick = () => signOut();
  scene.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true); // sem foto: fica a inicial

  const draw = (first) => {
    const W = el.clientWidth, fromBottom = el.scrollHeight - scrollY, L = computeLayout(list, W, innerHeight);
    lastW = W; scene.style.height = L.H + 'px';
    const ids = new Set(list.map((p) => p.user_id)), fresh = first ? new Set() : new Set([...ids].filter((i) => !seen.has(i)));
    seen = ids;
    scene.innerHTML = buildScene(L) + `<div class="orns">${L.items.map((it) => ornamentHTML(it, L.S, it.p.user_id === adminId, fresh.has(it.p.user_id))).join('')}</div>`;
    $('.hint').hidden = list.length > 0;
    updateJoin();
    scrollTo(0, first ? 1e9 : el.scrollHeight - fromBottom); // começa embaixo, no tronco
  };
  const onResize = () => {
    if (!scene.isConnected) { removeEventListener('resize', onResize); removeEventListener('scroll', onScroll); return; }
    clearTimeout(timer); timer = setTimeout(() => el.clientWidth !== lastW && draw(false), 150);
  };
  const onScroll = () => { if (!scene.isConnected) return; $('.scroll-hint').classList.toggle('gone', el.scrollHeight - scrollY - innerHeight > 160); };
  addEventListener('resize', onResize); addEventListener('scroll', onScroll, { passive: true });

  const join = $('#join'), mine = () => list.some((p) => p.user_id === user.id);
  const updateJoin = () => {
    const done = mine(), closed = !done && dstate.done; join.classList.toggle('done', done || closed); join.disabled = done || closed;
    join.innerHTML = done ? '<i class="fa-solid fa-circle-check"></i> PARTICIPAÇÃO CONFIRMADA' : closed ? '<i class="fa-solid fa-lock"></i> PARTICIPAÇÕES ENCERRADAS' : '<i class="fa-solid fa-star"></i> PARTICIPAR';
  };
  const sig = (l) => l.map((p) => p.user_id + p.photo_path).join();
  const refresh = async () => { // realtime / pós-confirmação: só redesenha se algo mudou
    try { const next = await fetchParticipants(); if (sig(next) !== sig(list)) { list = next; draw(false); } } catch { /* mantém a árvore atual */ }
  };
  const showMine = () => scene.querySelector(`[data-uid="${user.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  join.onclick = () => openParticipate({ userId: user.id, name, onDone: async () => { await refresh(); showMine(); } });
  const openOrn = (o) => { const p = list.find((x) => x.user_id === o.dataset.uid); if (!p) return; const a = p.user_id === adminId;
    openCard({ name: a ? 'REI' : p.profiles?.display_name || 'Participante', path: p.photo_path, admin: a }); };
  scene.addEventListener('click', (e) => { const o = e.target.closest('.orn'); if (o) openOrn(o); });
  scene.addEventListener('keydown', (e) => { const o = e.target.closest?.('.orn'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openOrn(o); } });

  const gift = $('#gift'), doDraw = $('#doDraw');
  const updateDraw = () => { gift.hidden = !(dstate.done && dstate.mine && !dstate.mine.revealed_at); doDraw.hidden = !(admin && !dstate.done); updateJoin(); };
  const refreshDraw = async () => { try { dstate = await fetchDrawState(); updateDraw(); } catch { /* mantém o estado atual */ } };
  const resolveReceiver = async (id) => {
    let p = list.find((x) => x.user_id === id); if (!p) { await refresh(); p = list.find((x) => x.user_id === id); }
    return p && { name: id === adminId ? 'REI' : p.profiles?.display_name || 'Participante', path: p.photo_path, admin: id === adminId };
  };
  const openBox = () => openReveal({ reveal: revealMyResult, resolve: resolveReceiver, revealed: !!dstate.mine?.revealed_at, onClose: refreshDraw });
  gift.onclick = openBox;
  $('#drawBtn').onclick = async () => {
    await refreshDraw(); let status = null;
    if (admin && dstate.done) { try { status = await fetchDrawStatus(); } catch { /* sem status */ } }
    openDrawInfo({ ...dstate, isParticipant: mine(), admin, status, count: list.length, onOpenBox: openBox });
  };
  doDraw.onclick = () => openConfirmDraw({ count: list.length, run: async () => { await runDraw(); await refreshDraw(); } });

  const load = async () => {
    try { [list, adminId] = await Promise.all([fetchParticipants(), fetchAdminId()]); $('.banner').hidden = true; }
    catch { $('.banner').hidden = false; }
    draw(true);
  };
  $('#retry').onclick = load;
  load().then(() => {
    unsub = subscribeParticipants(() => (scene.isConnected ? refresh() : unsub?.()));
    unsubDraw = subscribeDraw(() => (scene.isConnected ? refreshDraw() : unsubDraw?.()));
    refreshDraw();
  });
  return { update(next) { list = next; draw(false); }, destroy() { stopSnow(); unsub?.(); unsubDraw?.(); } };
}
