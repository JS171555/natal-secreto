import { startSnow } from '../components/snow.js';
import { buildScene } from '../components/scene.js';
import { ornamentHTML } from '../components/ornament.js';
import { computeLayout } from '../utils/layout.js';
import { fetchParticipants, fetchAdminId } from '../services/participants.js';
import { signOut } from '../services/auth.js';
import { esc } from './home.js';

export function mountTree(root, { user, name, admin }) {
  root.innerHTML = `<div class="tree-page">
    <div class="scene"></div><canvas class="snow" aria-hidden="true"></canvas>
    <header class="topbar"><span class="chip">${admin ? '<i class="fa-solid fa-crown"></i> ' : ''}${esc(name)}</span>
      <button class="icon-btn" id="out" type="button" aria-label="Sair" title="Sair"><i class="fa-solid fa-right-from-bracket"></i></button></header>
    <p class="hint" hidden>A árvore ainda está vazia. As bolas aparecem aqui quando alguém confirmar participação.</p>
    <p class="banner" hidden><span>Não foi possível carregar a árvore.</span> <button type="button" id="retry">Tentar de novo</button></p>
    <div class="scroll-hint"><i class="fa-solid fa-chevron-up"></i><span>Role para cima</span></div></div>`;

  const $ = (s) => root.querySelector(s), scene = $('.scene'), el = document.documentElement;
  let list = [], adminId = null, lastW = 0, timer = 0;
  const stopSnow = startSnow($('.snow'));
  $('#out').onclick = () => signOut();
  scene.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.remove(); }, true); // sem foto: fica a inicial

  const draw = (first) => {
    const W = el.clientWidth, fromBottom = el.scrollHeight - scrollY, L = computeLayout(list, W, innerHeight);
    lastW = W; scene.style.height = L.H + 'px';
    scene.innerHTML = buildScene(L) + `<div class="orns">${L.items.map((it) => ornamentHTML(it, L.S, it.p.user_id === adminId)).join('')}</div>`;
    $('.hint').hidden = list.length > 0;
    scrollTo(0, first ? 1e9 : el.scrollHeight - fromBottom); // começa embaixo, no tronco
  };
  const onResize = () => {
    if (!scene.isConnected) { removeEventListener('resize', onResize); removeEventListener('scroll', onScroll); return; }
    clearTimeout(timer); timer = setTimeout(() => el.clientWidth !== lastW && draw(false), 150);
  };
  const onScroll = () => { if (!scene.isConnected) return; $('.scroll-hint').classList.toggle('gone', el.scrollHeight - scrollY - innerHeight > 160); };
  addEventListener('resize', onResize); addEventListener('scroll', onScroll, { passive: true });

  const load = async () => {
    try { [list, adminId] = await Promise.all([fetchParticipants(), fetchAdminId()]); $('.banner').hidden = true; }
    catch { $('.banner').hidden = false; }
    draw(true);
  };
  $('#retry').onclick = load;
  load();
  return { update(next) { list = next; draw(false); }, destroy: stopSnow };
}
