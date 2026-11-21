import { rng } from '../utils/rand.js';

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => '#' + [0, 1, 2].map((i) => Math.round(lerp(parseInt(c1.slice(1 + 2 * i, 3 + 2 * i), 16), parseInt(c2.slice(1 + 2 * i, 3 + 2 * i), 16), t)).toString(16).padStart(2, '0')).join('');

// Geometria da borda inferior de um galho (a mesma para o traçado e para o pisca-pisca).
function botGeo(cx, yb, w) {
  const n = Math.max(3, Math.round(w / 44)), sw = w / n, d = sw * 0.3, L = cx - w / 2, Rr = cx + w / 2;
  return { n, sw, d, L, Rr };
}

// Galho em camada: triângulo com a borda inferior em "babados" (visual ilustrado).
function tier(cx, yb, w, h) {
  const { n, sw, d, L, Rr } = botGeo(cx, yb, w);
  let p = `M${cx} ${yb - h}Q${cx + w * 0.2} ${yb - h * 0.45} ${Rr} ${yb}`;
  for (let i = n; i > 0; i--) { const x1 = L + (i - 1) * sw, x0 = L + i * sw; p += `Q${(x0 + x1) / 2} ${yb + d * 2} ${x1} ${yb}`; }
  return p + `Q${cx - w * 0.2} ${yb - h * 0.45} ${cx} ${yb - h}Z`;
}
function snowCap(cx, yb, w, h, coverage, layer, treeW) {
  const edge = yb - h * (1 - coverage), { L, Rr } = botGeo(cx, edge, w);
  const wave = rng(7919 + layer * 104729), scale = Math.max(1, treeW / 420);
  const cycles = Math.max(1, Math.round(w / (76 * scale)));
  const segments = cycles * 4, amp = h * (.045 + wave() * .02) * Math.sqrt(scale), phase = wave() * Math.PI * 2, tau = Math.PI * 2;
  const yAt = (s) => edge + amp * Math.sin(phase + tau * cycles * s / w);
  const slopeAt = (s) => amp * tau * cycles / w * Math.cos(phase + tau * cycles * s / w);
  let p = `M${L} ${yb - h}H${Rr}V${yAt(0)}`;
  for (let i = 0; i < segments; i++) {
    const s0 = w * i / segments, s1 = w * (i + 1) / segments, span = s1 - s0;
    const x0 = Rr - s0, x1 = i === segments - 1 ? L : Rr - s1, y0 = yAt(s0), y1 = yAt(s1);
    const c1y = y0 + slopeAt(s0) * span / 3, c2y = y1 - slopeAt(s1) * span / 3;
    // Aproxima a senoide com Béziers tangentes; as junções permanecem lisas, sem pontas.
    p += `C${x0 - span / 3} ${c1y} ${x1 + span / 3} ${c2y} ${x1} ${y1}`;
  }
  return p + 'Z';
}
const pine = (cx, y, w, h) => tier(cx, y, w, h * 0.5) + tier(cx, y - h * 0.28, w * 0.78, h * 0.5) + tier(cx, y - h * 0.52, w * 0.55, h * 0.48);
function starPath(cx, cy, R) {
  const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.52 : R; pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`); }
  return 'M' + pts.join('L') + 'Z';
}

// Pisca-pisca: fio dourado com babado + lâmpadas alternadas nos vales, em tons do projeto.
const BULB = ['#FFE79A', '#FFB4A8', '#DDEBFF', '#E9C45A'];
function lightStrand(cx, yb, w, r) {
  const { n, sw, d, L } = botGeo(cx, yb, w);
  let wire = `M${L.toFixed(1)} ${yb.toFixed(1)}`;
  for (let i = 0; i < n; i++) wire += `Q${(L + (i + 0.5) * sw).toFixed(1)} ${(yb + d * 2).toFixed(1)} ${(L + (i + 1) * sw).toFixed(1)} ${yb.toFixed(1)}`;
  const step = Math.max(1, Math.ceil(n / 8)); // no máximo 8 lâmpadas por fio
  let bulbs = '';
  for (let i = 0; i < n; i += step) {
    const x = L + (i + 0.5) * sw, y = yb + d, ci = (i + r) % BULB.length, br = w < 260 ? 2.2 : w < 460 ? 2.7 : 3.1;
    const delay = (-(i * 0.73 + r * 1.37) % 5).toFixed(2);
    bulbs += `<g class="bulb b${(i % 3) + 1}" style="--b:${delay}s">`
      + `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + 3).toFixed(1)}" stroke="#caa23f" stroke-opacity=".7" stroke-width=".9"/>`
      + `<circle cx="${x.toFixed(1)}" cy="${(y + 3 + br).toFixed(1)}" r="${(br * 3.4).toFixed(1)}" fill="url(#h${ci})"/>`
      + `<rect x="${(x - 1).toFixed(1)}" y="${(y + 2).toFixed(1)}" width="2" height="1.8" rx=".5" fill="#8a7440"/>`
      + `<circle cx="${x.toFixed(1)}" cy="${(y + 3.4 + br).toFixed(1)}" r="${br}" fill="${BULB[ci]}" opacity=".95"/></g>`;
  }
  return { wire, bulbs };
}

export function buildScene(L) {
  const { W, H, P, Wmax, cx, R, crown, B, S, star, taper, yb } = L, rnd = rng(7);
  const defs = [`<linearGradient id="trunk" x1="0" x2="1"><stop offset="0" stop-color="#1f120a"/><stop offset=".5" stop-color="#4a2e18"/><stop offset="1" stop-color="#1a0f08"/></linearGradient>
    <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9bfe6"/><stop offset="1" stop-color="#4d6694"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#FFE79A" stop-opacity=".55"/><stop offset="1" stop-color="#FFE79A" stop-opacity="0"/></radialGradient>
    <radialGradient id="hMoon"><stop offset="0" stop-color="#EAF0FF" stop-opacity=".5"/><stop offset=".55" stop-color="#EAF0FF" stop-opacity=".12"/><stop offset="1" stop-color="#EAF0FF" stop-opacity="0"/></radialGradient>
    <radialGradient id="moonSurface" cx="32%" cy="27%" r="78%"><stop offset="0" stop-color="#fffdf0"/><stop offset=".58" stop-color="#e8edf9"/><stop offset="1" stop-color="#aab8d6"/></radialGradient>
    <radialGradient id="hWarm"><stop offset="0" stop-color="#FFE79A" stop-opacity=".34"/><stop offset="1" stop-color="#FFE79A" stop-opacity="0"/></radialGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="aurora" x1="0" y1="0" x2="1" y2=".2"><stop offset="0" stop-color="#42e6b4" stop-opacity="0"/><stop offset=".34" stop-color="#42e6b4" stop-opacity=".16"/><stop offset=".68" stop-color="#8a8cff" stop-opacity=".18"/><stop offset="1" stop-color="#8a8cff" stop-opacity="0"/></linearGradient>
    <linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#547b91"/><stop offset="1" stop-color="#173b48"/></linearGradient>
    <linearGradient id="drift" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f6ff"/><stop offset="1" stop-color="#a9c2d8"/></linearGradient>
    <linearGradient id="branchSnow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e7f2fb"/><stop offset="1" stop-color="#b9d1e3"/></linearGradient>
    <radialGradient id="horizon"><stop offset="0" stop-color="#58b99a" stop-opacity=".19"/><stop offset="1" stop-color="#58b99a" stop-opacity="0"/></radialGradient>`
    + BULB.map((c, i) => `<radialGradient id="h${i}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('')
    + `<pattern id="gr" width="90" height="90" patternUnits="userSpaceOnUse">${Array.from({ length: 60 }, () => `<circle cx="${(rnd() * 90).toFixed(1)}" cy="${(rnd() * 90).toFixed(1)}" r="${(0.5 + rnd() * 0.9).toFixed(1)}" fill="#cdeaa8" opacity="${(0.12 + rnd() * 0.25).toFixed(2)}"/>`).join('')}</pattern>`];

  // Céu profundo com aurora boreal suave, pontos luminosos, lua e estrela cadente.
  let sky = '';
  const auroraY = H * 0.17;
  sky += `<g class="aurora"><path d="M${(-W * .08).toFixed(0)} ${(auroraY + H * .12).toFixed(0)}Q${(W * .2).toFixed(0)} ${(auroraY - H * .1).toFixed(0)} ${(W * .48).toFixed(0)} ${(auroraY + H * .04).toFixed(0)}T${(W * 1.08).toFixed(0)} ${(auroraY - H * .05).toFixed(0)}L${(W * 1.08).toFixed(0)} ${(auroraY + H * .24).toFixed(0)}Q${(W * .5).toFixed(0)} ${(auroraY + H * .08).toFixed(0)} ${(-W * .08).toFixed(0)} ${(auroraY + H * .3).toFixed(0)}Z" fill="url(#aurora)"/></g>`;
  for (let i = 0, n = Math.round(H / 80); i < n; i++) {
    const big = rnd() > 0.88;
    sky += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H * 0.78).toFixed(0)}" r="${big ? (2.5 + rnd() * 1.6).toFixed(1) : (0.6 + rnd() * 1.3).toFixed(1)}" fill="${big ? '#b5c25e' : rnd() > 0.5 ? '#DDEBFF' : '#FFE79A'}" opacity="${big ? 0.3 : (0.3 + rnd() * 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W, len = 40 + rnd() * 300, s = 5 + rnd() * 5;
    sky += `<line x1="${x.toFixed(0)}" y1="0" x2="${x.toFixed(0)}" y2="${len.toFixed(0)}" stroke="#3f6a3f" stroke-opacity=".5"/><path d="${starPath(x, len + s, s)}" fill="#8a9a45" opacity=".7"/>`;
  }
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W, y = rnd() * H * 0.4;
    sky += `<circle class="tw" style="--d:${(-rnd() * 4).toFixed(2)}s" cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1.3 + rnd() * 1.1).toFixed(1)}" fill="#F5F7FF" opacity=".9"/>`;
  }
  const sy = yb(R + crown - 1) - P * 1.3 - star * .3;
  const mx = cx + Math.min(W * .28, star * 3), my = sy - star * .75;
  const mr = Math.max(20, Math.min(38, W * .055));
  const craterData = [
    [mx - mr * .3, my - mr * .16, mr * .16], [mx + mr * .3, my - mr * .28, mr * .21],
    [mx + mr * .1, my + mr * .3, mr * .12], [mx - mr * .32, my + mr * .3, mr * .08],
  ];
  const craters = craterData.map(([x, y, r]) => `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#92a1c1" opacity=".32"/>`
    + `<path d="M${(x - r * .62).toFixed(1)} ${y.toFixed(1)}Q${x.toFixed(1)} ${(y - r * .8).toFixed(1)} ${(x + r * .62).toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".46" stroke-width="${Math.max(.6, r * .16).toFixed(1)}" stroke-linecap="round"/></g>`).join('');
  sky += `<g class="moon"><circle class="moon-h" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${(mr * 3.3).toFixed(1)}" fill="url(#hMoon)"/>`
    + `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${mr.toFixed(1)}" fill="url(#moonSurface)" stroke="#fff" stroke-opacity=".68" stroke-width="${(mr * .055).toFixed(1)}"/>`
    + `<path d="M${(mx - mr * .54).toFixed(1)} ${(my - mr * .25).toFixed(1)}Q${(mx - mr * .2).toFixed(1)} ${(my - mr * .62).toFixed(1)} ${(mx + mr * .18).toFixed(1)} ${(my - mr * .55).toFixed(1)}" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="${(mr * .035).toFixed(1)}" stroke-linecap="round"/>`
    + craters + `</g>`;
  sky += `<g transform="translate(${(W * 0.66).toFixed(0)} ${(H * 0.05 + 40).toFixed(0)}) rotate(28)"><g class="meteor" style="--md:${(8 + rnd() * 6).toFixed(1)}s">`
    + `<line x1="0" y1="0" x2="-54" y2="0" stroke="url(#shine)" stroke-width="1.6"/><circle r="1.8" fill="#F5F7FF"/></g></g>`;

  // Horizonte luminoso, montanhas distantes e floresta em planos sucessivos.
  const ground = H - 80; let forest = '';
  const ridgeY = H - 310;
  forest += `<ellipse cx="${(W * .52).toFixed(0)}" cy="${(H * .56).toFixed(0)}" rx="${(W * .72).toFixed(0)}" ry="${(H * .34).toFixed(0)}" fill="url(#horizon)"/>`;
  forest += `<path d="M0 ${ridgeY + 130}L${(W * .15).toFixed(0)} ${ridgeY - 90}L${(W * .25).toFixed(0)} ${ridgeY + 5}L${(W * .42).toFixed(0)} ${ridgeY - 160}L${(W * .57).toFixed(0)} ${ridgeY + 28}L${(W * .76).toFixed(0)} ${ridgeY - 115}L${W} ${ridgeY + 76}V${H}H0Z" fill="url(#ridge)" opacity=".37"/>`;
  forest += `<path d="M${(W * .42).toFixed(0)} ${ridgeY - 160}l${(W * .09).toFixed(0)} 113l-${(W * .035).toFixed(0)} -27l-${(W * .025).toFixed(0)} 9Z M${(W * .76).toFixed(0)} ${ridgeY - 115}l${(W * .1).toFixed(0)} 99l-${(W * .04).toFixed(0)} -23l-${(W * .03).toFixed(0)} 10Z" fill="#d9e8f4" opacity=".36"/>`;
  [['#0a1f3b', 0.55, 150, 1.0], ['#072a1e', 0.42, 190, 0.8], ['#0a3322', 0.3, 230, 0.62]].forEach(([c, hv, w, o], li) => {
    const col = mix(c, '#031A14', 0.1);
    for (let x = -w * 0.3 - li * 40; x < W + w; x += w * 0.62) {
      const h = (0.5 + rnd() * 0.5) * (L.S * 6 + hv * 600);
      forest += `<path d="${pine(x, ground + 20 - li * 6, w * (0.8 + rnd() * 0.4), h)}" fill="${col}" opacity="${o}"/>`;
    }
  });
  const cabX = W * (W < 640 ? 0.055 : 0.09), cabS = Math.max(1, Math.min(1.6, W / 850)), cabY = ground - 18;
  forest += `<g class="cabin" transform="translate(${cabX.toFixed(0)} ${cabY.toFixed(0)}) scale(${cabS.toFixed(2)})">`
    + `<ellipse cx="17" cy="2" rx="32" ry="6" fill="url(#hWarm)" opacity=".62"/><circle cx="14.5" cy="-6" r="19" fill="url(#hWarm)" opacity=".85"/>`
    + `<rect x="-1" y="-20" width="7" height="9" fill="#3a5f47"/><rect x="0" y="-14" width="34" height="16" rx="1.5" fill="#2c5340"/>`
    + `<path d="M-4 -14 L17 -26 L38 -14 Z" fill="#356149"/><path d="M-4 -14 L17 -26 L38 -14" fill="none" stroke="#dfe9fb" stroke-opacity=".75" stroke-width="2.6" stroke-linecap="round"/>`
    + `<rect class="win" x="10" y="-10" width="9" height="8" rx="1" fill="#FFE79A"/><line x1="14.5" y1="-10" x2="14.5" y2="-2" stroke="#7a5c1e" stroke-width=".8"/>`
    + `<rect x="24" y="-8" width="5" height="10" rx="1" fill="#152f20"/>`
    + `<circle class="smoke s1" cx="2.5" cy="-27" r="2" fill="#dfe8f7"/><circle class="smoke s2" cx="2.5" cy="-27" r="2.6" fill="#dfe8f7"/><circle class="smoke s3" cx="2.5" cy="-27" r="3.2" fill="#dfe8f7"/></g>`;

  // A neve aumenta de cobertura dos galhos finos no topo para os galhos largos junto ao tronco.
  const total = R + crown, crownW = [0.72, 0.48, 0.26];
  let tiers = '', wires = '', bulbs = '';
  for (let r = 0; r < total; r++) {
    const w = r < R ? Wmax * taper(r) : Wmax * taper(R - 1) * crownW[r - R], t = r / (total - 1);
    const c = mix('#082a1a', '#2f7a4a', t * 0.9), d = tier(cx, yb(r), w, P * 1.55);
    defs.push(`<linearGradient id="t${r}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c, '#9ecb6a', 0.18)}"/><stop offset="1" stop-color="${mix(c, '#031A14', 0.35)}"/></linearGradient>`);
    tiers += `<path d="${d}" fill="url(#t${r})" stroke="${mix(c, '#7fd39a', 0.4)}" stroke-opacity=".45" stroke-width="1.5"/><path d="${d}" fill="url(#gr)"/>`;
    defs.push(`<clipPath id="leaf${r}" clipPathUnits="userSpaceOnUse"><path d="${d}"/></clipPath>`);
    const coverage = .4 + .4 * (1 - t);
    tiers += `<path class="snow-cap" d="${snowCap(cx, yb(r), w, P * 1.55, coverage, r, Wmax)}" fill="url(#branchSnow)" opacity=".58" clip-path="url(#leaf${r})"/>`;
    const st = lightStrand(cx, yb(r), w, r);
    wires += `<path d="${st.wire}" fill="none" stroke="#E9C45A" stroke-opacity=".3" stroke-width="1.2"/>`;
    bulbs += st.bulbs;
  }
  const tw = Wmax * 0.13, ty = yb(0) - 40;
  const trunk = `<path d="M${cx - tw / 2} ${ty}H${cx + tw / 2}L${cx + tw * 0.65} ${H - 68}H${cx - tw * 0.65}Z" fill="url(#trunk)"/>`;
  const snow = `<path d="M0 ${H - 72}Q${W * 0.22} ${H - 158} ${W * 0.5} ${H - 138}T${W} ${H - 92}V${H}H0Z" fill="url(#snow)"/>`;
  const drifts = `<path d="M0 ${H - 58}Q${W * 0.32} ${H - 84} ${W * 0.55} ${H - 62}T${W} ${H - 70}V${H}H0Z" fill="#dfe9fb" opacity=".1"/><path d="M0 ${H - 40}Q${W * 0.4} ${H - 58} ${W * 0.7} ${H - 44}T${W} ${H - 50}V${H}H0Z" fill="#eef5ff" opacity=".08"/>`;
  const foreground = `<path d="M0 ${H - 20}Q${W * .18} ${H - 76} ${W * .38} ${H - 33}T${W * .72} ${H - 46}T${W} ${H - 22}V${H}H0Z" fill="url(#drift)" opacity=".24"/><path d="M${W * .08} ${H - 70}q18 -8 36 0 M${W * .78} ${H - 92}q15 -7 31 0" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="2" stroke-linecap="round"/>`;
  const glow = `<circle cx="${cx}" cy="${sy}" r="${star * 5.5}" fill="url(#glow)"/>`;
  const amb = `<ellipse cx="${cx}" cy="${H - 116}" rx="${(Wmax * 0.6).toFixed(0)}" ry="${(P * 0.9).toFixed(0)}" fill="url(#hWarm)" opacity=".5"/>`;
  const sparks = Array.from({ length: 10 }, () => `<circle cx="${(cx + (rnd() - 0.5) * star * 3).toFixed(0)}" cy="${(sy + (rnd() - 0.5) * star * 3).toFixed(0)}" r="${(0.8 + rnd() * 1.4).toFixed(1)}" fill="#FFE79A" opacity=".8"/>`).join('');
  const starEl = `<g class="star-g"><path d="${starPath(cx, sy, star)}" fill="#FFE79A" stroke="#E9C45A" stroke-width="${(star * 0.28).toFixed(0)}" stroke-linejoin="round"/></g>${sparks}`;

  // Presentes sob a árvore + brilhos na neve do chão.
  const gy = H - 114, gs = Math.max(26, Math.min(52, S * 0.55));
  const box = (bx, by, bw, bh, body, ribbon) => { const x = +bx, y = +by, w = +bw, h = +bh; return `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${body}"/>`
    + `<rect x="${x + w * 0.42}" y="${y - h}" width="${w * 0.16}" height="${h}" fill="${ribbon}"/>`
    + `<rect x="${x}" y="${y - h * 0.72}" width="${w}" height="${h * 0.07}" fill="${ribbon}"/>`
    + `<path d="M${x + w * 0.5} ${y - h}q-${w * 0.22} -${h * 0.22} -${w * 0.05} -${h * 0.1} M${x + w * 0.5} ${y - h}q${w * 0.22} -${h * 0.22} ${w * 0.05} -${h * 0.1}" fill="none" stroke="${ribbon}" stroke-width="2"/>`
    + `<rect class="sheen" x="${x}" y="${y - h}" width="${(w * 0.4).toFixed(1)}" height="${h}" fill="url(#shine)"/></g>`; };
  const gifts = `<g class="gifts">`
    + box(cx - gs * 2.7, gy + 2, gs, gs * 0.78, '#b3202f', '#E9C45A')
    + box(cx + gs * 2.3, gy + 2, gs * 0.86, gs * 0.66, '#2d4f82', '#DDEBFF')
    + box(cx + gs * 0.45, gy + 4, gs * 0.7, gs * 0.55, '#6b4a2b', '#FFB4A8')
    + `</g>`;
  let sparkle = '';
  for (let i = 0; i < 16; i++) sparkle += `<circle class="tw" style="--d:${(-rnd() * 5).toFixed(2)}s" cx="${(rnd() * W).toFixed(0)}" cy="${(H - 136 + rnd() * 58).toFixed(0)}" r="${(0.9 + rnd() * 1).toFixed(1)}" fill="#F5F7FF" opacity=".7"/>`;

  // Os grupos da cena são SVG estático; os detalhes vivos usam CSS e o canvas de neve.
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${defs.join('')}</defs>`
    + `<g class="lyr" data-lyr="sky">${sky}</g><g class="lyr" data-lyr="forest">${forest}</g>`
    + `<g class="lyr" data-lyr="tree">${trunk}${tiers}${wires}${bulbs}</g><g class="lyr" data-lyr="glow">${glow}</g>`
    + `<g class="lyr" data-lyr="star">${starEl}</g><g class="lyr" data-lyr="ground">${snow}${drifts}${amb}${gifts}${sparkle}${foreground}</g></svg>`;
}
