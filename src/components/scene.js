import { rng } from '../utils/rand.js';

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => '#' + [0, 1, 2].map((i) => Math.round(lerp(parseInt(c1.slice(1 + 2 * i, 3 + 2 * i), 16), parseInt(c2.slice(1 + 2 * i, 3 + 2 * i), 16), t)).toString(16).padStart(2, '0')).join('');

// Galho em camada: triângulo com a borda inferior em "babados" (visual ilustrado).
function tier(cx, yb, w, h) {
  const n = Math.max(3, Math.round(w / 44)), sw = w / n, d = sw * 0.3, L = cx - w / 2, Rr = cx + w / 2;
  let p = `M${cx} ${yb - h}Q${cx + w * 0.2} ${yb - h * 0.45} ${Rr} ${yb}`;
  for (let i = n; i > 0; i--) { const x1 = L + (i - 1) * sw, x0 = L + i * sw; p += `Q${(x0 + x1) / 2} ${yb + d * 2} ${x1} ${yb}`; }
  return p + `Q${cx - w * 0.2} ${yb - h * 0.45} ${cx} ${yb - h}Z`;
}
const pine = (cx, y, w, h) => tier(cx, y, w, h * 0.5) + tier(cx, y - h * 0.28, w * 0.78, h * 0.5) + tier(cx, y - h * 0.52, w * 0.55, h * 0.48);
function starPath(cx, cy, R) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.52 : R; pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`); }
  return 'M' + pts.join('L') + 'Z';
}

export function buildScene(L) {
  const { W, H, P, Wmax, cx, R, crown, B, star, taper, yb } = L, rnd = rng(7);
  const defs = [`<linearGradient id="trunk" x1="0" x2="1"><stop offset="0" stop-color="#1f120a"/><stop offset=".5" stop-color="#4a2e18"/><stop offset="1" stop-color="#1a0f08"/></linearGradient>
    <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9bfe6"/><stop offset="1" stop-color="#4d6694"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#FFE79A" stop-opacity=".55"/><stop offset="1" stop-color="#FFE79A" stop-opacity="0"/></radialGradient>
    <pattern id="gr" width="90" height="90" patternUnits="userSpaceOnUse">${Array.from({ length: 60 }, () => `<circle cx="${(rnd() * 90).toFixed(1)}" cy="${(rnd() * 90).toFixed(1)}" r="${(0.5 + rnd() * 0.9).toFixed(1)}" fill="#cdeaa8" opacity="${(0.12 + rnd() * 0.25).toFixed(2)}"/>`).join('')}</pattern>`];

  // Céu: pontos luminosos e estrelinhas penduradas por fios.
  let sky = '';
  for (let i = 0, n = Math.round(H / 80); i < n; i++) {
    const big = rnd() > 0.88;
    sky += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H * 0.78).toFixed(0)}" r="${big ? (2.5 + rnd() * 1.6).toFixed(1) : (0.6 + rnd() * 1.3).toFixed(1)}" fill="${big ? '#b5c25e' : rnd() > 0.5 ? '#DDEBFF' : '#FFE79A'}" opacity="${big ? 0.3 : (0.3 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W, len = 40 + rnd() * 300, s = 5 + rnd() * 5;
    sky += `<line x1="${x.toFixed(0)}" y1="0" x2="${x.toFixed(0)}" y2="${len.toFixed(0)}" stroke="#3f6a3f" stroke-opacity=".5"/><path d="${starPath(x, len + s, s)}" fill="#8a9a45" opacity=".7"/>`;
  }

  // Floresta ao fundo, em três profundidades (a árvore principal a ultrapassa em altura).
  const ground = H - 80; let forest = '';
  [['#0a1f3b', 0.55, 150, 1.0], ['#072a1e', 0.42, 190, 0.8], ['#0a3322', 0.3, 230, 0.62]].forEach(([c, hv, w, o], li) => {
    const col = mix(c, '#031A14', 0.1);
    for (let x = -w * 0.3 - li * 40; x < W + w; x += w * 0.62) {
      const h = (0.5 + rnd() * 0.5) * (L.S * 6 + hv * 600);
      forest += `<path d="${pine(x, ground + 20 - li * 6, w * (0.8 + rnd() * 0.4), h)}" fill="${col}" opacity="${o}"/>`;
    }
  });

  // Árvore principal.
  const total = R + crown, crownW = [0.72, 0.48, 0.26];
  let tiers = '';
  for (let r = 0; r < total; r++) {
    const w = r < R ? Wmax * taper(r) : Wmax * taper(R - 1) * crownW[r - R], t = r / (total - 1);
    const c = mix('#082a1a', '#2f7a4a', t * 0.9), d = tier(cx, yb(r), w, P * 1.55);
    defs.push(`<linearGradient id="t${r}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c, '#9ecb6a', 0.18)}"/><stop offset="1" stop-color="${mix(c, '#031A14', 0.35)}"/></linearGradient>`);
    tiers += `<path d="${d}" fill="url(#t${r})" stroke="${mix(c, '#7fd39a', 0.4)}" stroke-opacity=".45" stroke-width="1.5"/><path d="${d}" fill="url(#gr)"/>`;
  }
  const apex = yb(total - 1) - P * 1.3, sy = apex - star * 0.3, tw = Wmax * 0.13, ty = yb(0) - 40;
  const trunk = `<path d="M${cx - tw / 2} ${ty}H${cx + tw / 2}L${cx + tw * 0.65} ${H - 68}H${cx - tw * 0.65}Z" fill="url(#trunk)"/>`;
  const snow = `<path d="M0 ${H - 72}Q${W * 0.25} ${H - 112} ${W * 0.5} ${H - 84}T${W} ${H - 96}V${H}H0Z" fill="url(#snow)"/>`;
  const glow = `<circle cx="${cx}" cy="${sy}" r="${star * 5.5}" fill="url(#glow)"/>`;
  const sparks = Array.from({ length: 10 }, () => `<circle cx="${(cx + (rnd() - 0.5) * star * 3).toFixed(0)}" cy="${(sy + (rnd() - 0.5) * star * 3).toFixed(0)}" r="${(0.8 + rnd() * 1.4).toFixed(1)}" fill="#FFE79A" opacity=".8"/>`).join('');
  const starEl = `<g class="star-g"><path d="${starPath(cx, sy, star)}" fill="#FFE79A" stroke="#E9C45A" stroke-width="${(star * 0.28).toFixed(0)}" stroke-linejoin="round"/></g>${sparks}`;

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${defs.join('')}</defs>${sky}${forest}${trunk}${tiers}${glow}${starEl}${snow}</svg>`;
}
