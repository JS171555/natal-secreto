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
import { reduced, reveal, hang, burst, pop, ring, T, EASE } from '../utils/motion.js';
import { LOAD, mark, showLoading, hideLoading, setBusy, lazyLoading, spinMark } from '../components/ui-loading.js';
import gsap from 'gsap';

export function mountTree(root, { user, name, admin }) {
  root.innerHTML = `<div class="tree-page">
    <div class="scene"></div><canvas class="snow" aria-hidden="true"></canvas>
    <header class="topbar"><span class="chip">${admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(name)}</span>
      <button class="icon-btn" id="out" type="button" aria-label="Sair" title="Sair"><i class="fa-solid fa-right-from-bracket"></i></button></header>
    <p class="hint" hidden>A árvore ainda está vazia. As bolas aparecem aqui quando alguém confirmar participação.</p>
    <p class="banner" hidden><span>Não foi possível carregar a árvore.</span> <button type="button" id="retry">Tentar de novo</button></p>
    <p class="banner net" role="status" hidden><span>${mark(' is-mini')}Sem conexão. Reconectando…</span></p>
    <button class="fab" id="join" type="button"></button>
    <div class="fab-left"><button class="fab" id="doDraw" type="button" hidden><i class="fa-solid fa-dice"></i> REALIZAR SORTEIO</button>
      <button class="fab alt" id="drawBtn" type="button"><i class="fa-solid fa-gift"></i> SORTEIO</button></div>
    <button class="gift" id="gift" type="button" hidden aria-label="Abrir sua surpresa do sorteio">${giftBoxHTML(76)}<small>ABRIR!</small></button>
    <div class="scroll-hint"><i class="fa-solid fa-chevron-up"></i><span>Role para cima</span></div></div>`;

  const $ = (s) => root.querySelector(s), scene = $('.scene'), el = document.documentElement;
  let list = [], adminId = null, lastW = 0, timer = 0, seen = new Set(), unsub = null, unsubDraw = null;
  let dstate = { done: false, drawnAt: null, mine: null }, stopRing = () => {}, stopNet = () => {};
  const stopSnow = startSnow($('.snow'));
  const net = $('.banner.net');

  $('#out').onclick = async () => { setBusy($('#out'), true); showLoading(LOAD.out); try { await signOut(); } catch { hideLoading(); setBusy($('#out'), false); } };
  scene.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true); // sem foto: fica a inicial

  /* -------------------------- desenho e movimento -------------------------- */

  // entrada da cena: camadas do SVG em sequência + bolas caindo dos galhos
  const intro = () => {
    if (reduced()) return;
    const layers = scene.querySelectorAll('.lyr');
    const balls = scene.querySelectorAll('.orn-in');
    if (!layers.length || !balls.length) return;
    const glowLayer = scene.querySelector('.lyr[data-lyr="glow"]');
    const tl = gsap.timeline();
    tl.from(layers, { opacity: 0, duration: T.l, ease: EASE.soft, stagger: { amount: 0.5 } })
      .from(glowLayer, { scale: 0.55, transformOrigin: '50% 50%', duration: T.xl, ease: EASE.out, clearProps: 'transform' }, '-=0.3');
    const many = balls.length > 60; // muita bola: entrada sóbria, sem mola por item
    (many ? reveal([...balls], { y: 26, amount: 0.45, duration: T.l }) : hang(balls, { amount: Math.min(0.85, 0.1 + balls.length * 0.02), distance: -54 }));
  };

  const draw = (isFirst) => {
    const W = el.clientWidth, fromBottom = el.scrollHeight - scrollY, L = computeLayout(list, W, innerHeight);
    lastW = W; scene.style.height = L.H + 'px';
    const ids = new Set(list.map((p) => p.user_id)), fresh = isFirst ? new Set() : new Set([...ids].filter((i) => !seen.has(i)));
    seen = ids;
    scene.innerHTML = buildScene(L) + `<div class="orns">${L.items.map((it) => ornamentHTML(it, L.S, it.p.user_id === adminId, fresh.has(it.p.user_id))).join('')}</div>`;
    scene.classList.toggle('many', list.length > 60); // muitas bolas: desliga o balanço para poupar celulares
    $('.hint').hidden = list.length > 0;
    updateJoin();
    scrollTo(0, isFirst ? 1e9 : el.scrollHeight - fromBottom); // começa embaixo, no tronco
    if (isFirst) intro();
    else if (fresh.size) settle(fresh);
  };

  // bolas recém-confirmadas: caem, brilham e soltam faíscas
  const settle = (fresh) => {
    const freshInns = [...fresh].map((id) => scene.querySelector(`[data-uid="${id}"] .orn-in`)).filter(Boolean);
    if (!freshInns.length) return;
    hang(freshInns, { distance: -46, each: 0.14 });
    const last = scene.querySelector(`[data-uid="${[...fresh].pop()}"]`);
    if (last) setTimeout(() => burst(last.querySelector('.ball') || last, { count: 12, min: 26, max: 78, size: 6 }), reduced() ? 0 : 620);
  };

  const onResize = () => {
    if (!scene.isConnected) { removeEventListener('resize', onResize); removeEventListener('scroll', onScroll); return; }
    clearTimeout(timer); timer = setTimeout(() => el.clientWidth !== lastW && draw(false), 150);
  };
  const onScroll = () => { if (!scene.isConnected) return; $('.scroll-hint').classList.toggle('gone', el.scrollHeight - scrollY - innerHeight > 160); };
  addEventListener('resize', onResize); addEventListener('scroll', onScroll, { passive: true });

  /* ----------------------------- participação ------------------------------ */

  const join = $('#join'), mine = () => list.some((p) => p.user_id === user.id);
  const updateJoin = () => {
    const done = mine(), closed = !done && dstate.done;
    const was = join.innerHTML;
    join.classList.toggle('done', done || closed); join.disabled = done || closed;
    join.innerHTML = done ? '<i class="fa-solid fa-circle-check"></i> PARTICIPAÇÃO CONFIRMADA' : closed ? '<i class="fa-solid fa-lock"></i> PARTICIPAÇÕES ENCERRADAS' : '<i class="fa-solid fa-star"></i> PARTICIPAR';
    if (!done && !closed && was !== join.innerHTML && !reduced()) pop(join, { scale: 1.06 }); // o botão se anuncia ao aparecer
  };
  const sig = (l) => l.map((p) => p.user_id + p.photo_path).join();
  const refresh = async () => { // realtime / pós-confirmação: só redesenha se algo mudou
    try { const next = await fetchParticipants(); if (sig(next) !== sig(list)) { list = next; draw(false); } } catch { /* mantém a árvore atual */ }
  };
  const showMine = () => {
    const o = scene.querySelector(`[data-uid="${user.id}"]`); if (!o) return;
    o.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    setTimeout(() => { pop(o.querySelector('.orn-in'), { scale: 1.1 }); burst(o.querySelector('.ball'), { count: 14, min: 30, max: 92, size: 6 }); }, reduced() ? 0 : 520);
  };
  const joinNow = async () => { const stop = lazyLoading(LOAD.tree, {}, 350); await refresh(); stop(); showMine(); };
  join.onclick = () => openParticipate({ userId: user.id, name, onDone: joinNow });
  const openOrn = (o) => { const p = list.find((x) => x.user_id === o.dataset.uid); if (!p) return; const a = p.user_id === adminId;
    pop(o.querySelector('.orn-in'), { scale: 1.08 });
    openCard({ name: a ? 'REI' : p.profiles?.display_name || 'Participante', path: p.photo_path, admin: a }); };
  scene.addEventListener('click', (e) => { const o = e.target.closest('.orn'); if (o) openOrn(o); });
  scene.addEventListener('keydown', (e) => { const o = e.target.closest?.('.orn'); if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openOrn(o); } });

  /* -------------------------------- sorteio -------------------------------- */

  const gift = $('#gift'), doDraw = $('#doDraw'), drawBtn = $('#drawBtn');
  let giftShown = false;
  const updateDraw = () => {
    gift.hidden = !(dstate.done && dstate.mine && !dstate.mine.revealed_at);
    doDraw.hidden = !(admin && !dstate.done); updateJoin();
    if (!gift.hidden && !giftShown) { // a caixa chega quicando e com anel de chamada
      giftShown = true; stopRing();
      if (!reduced()) {
        gsap.fromTo(gift, { opacity: 0, scale: 0.5, y: 26 }, { opacity: 1, scale: 1, y: 0, duration: T.xl, ease: EASE.spring, clearProps: 'transform' });
        reveal(gift.querySelector('small'), { y: 8, delay: 0.25 });
        stopRing = ring(gift.querySelector('.gb-ring'), { duration: 1.8 });
      }
    } else if (gift.hidden) giftShown = false;
  };
  const refreshDraw = async () => { try { dstate = await fetchDrawState(); updateDraw(); } catch { /* mantém o estado atual */ } };
  const resolveReceiver = async (id) => {
    let p = list.find((x) => x.user_id === id); if (!p) { await refresh(); p = list.find((x) => x.user_id === id); }
    return p && { name: id === adminId ? 'REI' : p.profiles?.display_name || 'Participante', path: p.photo_path, admin: id === adminId };
  };
  const openBox = () => openReveal({ reveal: revealMyResult, resolve: resolveReceiver, revealed: !!dstate.mine?.revealed_at, onClose: refreshDraw });
  gift.onclick = openBox;
  $('#drawBtn').onclick = async () => {
    setBusy(drawBtn, true);
    await refreshDraw(); let status = null;
    if (admin && dstate.done) { try { status = await fetchDrawStatus(); } catch { /* sem status */ } }
    setBusy(drawBtn, false);
    openDrawInfo({ ...dstate, isParticipant: mine(), admin, status, count: list.length, onOpenBox: openBox });
  };
  doDraw.onclick = () => openConfirmDraw({ count: list.length, run: async () => { await runDraw(); await refreshDraw(); } });

  /* ------------------------------- conexão --------------------------------- */

  const onOffline = () => {
    if (!scene.isConnected || !net.hidden) return;
    net.hidden = false;
    stopNet = spinMark(net.querySelector('.load-mark')); // mesmo floco do padrão, aqui miúdo
    if (!reduced()) reveal(net.querySelector('span'), { y: -10, duration: T.m });
  };
  const onOnline = () => {
    if (!scene.isConnected) { removeEventListener('offline', onOffline); removeEventListener('online', onOnline); return; }
    stopNet();
    refreshDraw();
    showLoading(LOAD.net);
    refresh().then(() => { hideLoading(); net.hidden = true; });
  };
  addEventListener('offline', onOffline); addEventListener('online', onOnline); if (!navigator.onLine) onOffline();

  /* -------------------------------- carga ---------------------------------- */

  const load = async () => {
    showLoading(LOAD.tree);
    try { [list, adminId] = await Promise.all([fetchParticipants(), fetchAdminId()]); $('.banner').hidden = true; }
    catch { $('.banner').hidden = false; }
    draw(true); hideLoading();
  };
  $('#retry').onclick = async () => { setBusy($('#retry'), true); await load(); setBusy($('#retry'), false); };
  load().then(() => {
    unsub = subscribeParticipants(() => (scene.isConnected ? refresh() : unsub?.()));
    unsubDraw = subscribeDraw(() => (scene.isConnected ? refreshDraw() : unsubDraw?.()));
    refreshDraw();
  });
  return {
    update(next) { list = next; draw(false); },
    destroy() { stopSnow(); stopRing(); stopNet(); unsub?.(); unsubDraw?.(); },
  };
}
