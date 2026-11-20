import { clamp } from '../utils/rand.js';

// Neve em canvas: 3 profundidades, balanço lateral, leve paralaxe com a rolagem.
// Pausa com a aba oculta e respeita "reduzir movimento". Para sozinha se o canvas sair da página.
export function startSnow(canvas) {
  const ctx = canvas.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let W, H, flakes = [], last = performance.now(), raf = 0, lastScroll = scrollY;

  const make = () => {
    flakes = Array.from({ length: clamp(Math.round((W * H) / 9000), 45, 130) }, () => {
      const z = Math.random();
      return { x: Math.random() * W, y: Math.random() * H, z, r: 0.6 + z * z * 2.8, vy: 14 + z * 70 + Math.random() * 10, ph: Math.random() * 6.28, fr: 0.4 + Math.random() * 0.8, amp: 6 + z * 18, a: 0.35 + z * 0.55 };
    });
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#F5F7FF';
    for (const f of flakes) { ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(f.x + Math.sin(t * f.fr + f.ph) * f.amp, f.y, f.r, 0, 6.283); ctx.fill(); }
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); make(); draw(0);
  };
  const tick = (now) => {
    if (!canvas.isConnected) return stop();
    const dt = Math.min((now - last) / 1000, 0.05), ds = scrollY - lastScroll; last = now; lastScroll = scrollY;
    for (const f of flakes) {
      f.y += f.vy * dt - ds * f.z * 0.25;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; } else if (f.y < -6) { f.y = H + 6; f.x = Math.random() * W; }
    }
    draw(now / 1000); raf = requestAnimationFrame(tick);
  };
  const run = () => { cancelAnimationFrame(raf); if (!reduce.matches && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } else draw(0); };
  const stop = () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', run); reduce.removeEventListener('change', run); };

  resize(); run();
  addEventListener('resize', resize); document.addEventListener('visibilitychange', run); reduce.addEventListener('change', run);
  return stop;
}
