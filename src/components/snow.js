import { clamp } from '../utils/rand.js';
import { drawSnowflake } from '../utils/snowflake.js';

let sprite = null;
function bokehSprite() { // floco grande e macio pré-renderizado uma única vez
  if (sprite) return sprite;
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'), rg = g.createRadialGradient(24, 24, 2, 24, 24, 24);
  rg.addColorStop(0, 'rgba(245,247,255,.55)'); rg.addColorStop(.6, 'rgba(221,235,255,.18)'); rg.addColorStop(1, 'rgba(221,235,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 48, 48);
  g.shadowColor = 'rgba(221,235,255,.78)'; g.shadowBlur = 4;
  drawSnowflake(g, 24, 24, 38);
  return (sprite = c);
}

// Neve em canvas: 3 profundidades, balanço lateral, lufadas de vento lentas,
// leve cintilância e alguns flocos "bokeh" maiores na frente da cena.
// Paralaxe com a rolagem. Pausa com a aba oculta e respeita "reduzir movimento".
export function startSnow(canvas) {
  const ctx = canvas.getContext('2d'), reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let W, H, flakes = [], last = performance.now(), raf = 0, lastScroll = scrollY;

  const make = () => {
    const n = clamp(Math.round((W * H) / 14000), 30, 82);
    flakes = Array.from({ length: n + 4 }, (_, i) => {
      const z = Math.random();
      if (i >= n) { // poucos bokeh em primeiro plano para limitar o custo do canvas
        return { bok: true, x: Math.random() * W, y: Math.random() * H, z: 1, r: 9 + Math.random() * 13, vy: 5 + Math.random() * 9, ph: Math.random() * 6.28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.28, fr: 0.1 + Math.random() * 0.16, amp: 24 + Math.random() * 30, a: 0.1 + Math.random() * 0.15 };
      }
      return { x: Math.random() * W, y: Math.random() * H, z, size: 7 + z * z * 8, vy: 14 + z * 70 + Math.random() * 10, ph: Math.random() * 6.28, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.7, fr: 0.4 + Math.random() * 0.8, amp: 6 + z * 18, a: 0.35 + z * 0.55 };
    });
  };
  const windAt = (t) => Math.sin(t * 0.11) * 0.6 + Math.sin(t * 0.043 + 1.7) * 0.4; // lufada suave, sem período óbvio
  const draw = (t) => {
    ctx.clearRect(0, 0, W, H);
    const sp = bokehSprite(), wind = reduce.matches ? 0 : windAt(t);
    for (const f of flakes) {
      const tw = f.bok ? 1 : 0.85 + 0.15 * Math.sin(t * f.fr * 3 + f.ph);
      const x = f.x + Math.sin(t * f.fr + f.ph) * f.amp + wind * (0.3 + f.z) * 24;
      ctx.globalAlpha = f.a * tw;
      if (f.bok) {
        ctx.save(); ctx.translate(x, f.y); ctx.rotate(f.rot); ctx.drawImage(sp, -f.r, -f.r, f.r * 2, f.r * 2); ctx.restore();
      } else drawSnowflake(ctx, x, f.y, f.size, f.rot);
    }
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); make(); draw(0);
  };
  const tick = (now) => {
    if (!canvas.isConnected) return stop();
    const dt = Math.min((now - last) / 1000, 0.05), ds = scrollY - lastScroll; last = now; lastScroll = scrollY;
    const t = now / 1000, wind = windAt(t);
    for (const f of flakes) {
      f.rot += f.vr * dt;
      f.y += f.vy * dt - ds * f.z * 0.25;
      f.x += wind * (12 + f.z * 46) * dt;
      if (f.x > W + 40) f.x -= W + 80; else if (f.x < -40) f.x += W + 80;
      if (f.y > H + 6) { f.y = -6; f.x = Math.random() * W; } else if (f.y < -6) { f.y = H + 6; f.x = Math.random() * W; }
    }
    draw(t); raf = requestAnimationFrame(tick);
  };
  const run = () => { cancelAnimationFrame(raf); if (!reduce.matches && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(tick); } else draw(0); };
  const stop = () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', run); reduce.removeEventListener('change', run); };

  resize(); run();
  addEventListener('resize', resize); document.addEventListener('visibilitychange', run); reduce.addEventListener('change', run);
  return stop;
}
