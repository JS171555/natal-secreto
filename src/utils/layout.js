import { clamp, hash } from './rand.js';

// Calcula toda a geometria da árvore. Posição depende só da ordem de entrada e da largura da tela,
// então é estável entre recargas. A árvore cresce para cima: linhas preenchem de baixo para cima.
export function computeLayout(list, W, vh) {
  const n = list.length;
  const S = clamp(Math.round(W * 0.2), 58, 94);             // diâmetro da bola
  const P = Math.round(S * 1.95 + 18);                      // distância vertical entre galhos
  const Wmax = Math.min(W * 0.98, 900), cx = W / 2;
  const taper = (r) => Math.max(0.5, 1 - 0.04 * r);
  const rowW = (r) => Wmax * taper(r) * 0.84;
  const cap = (r) => Math.max(1, Math.floor(rowW(r) / (S * 1.2)));

  let rows = 0, acc = 0;
  while (acc < n) { acc += cap(rows); rows++; }
  const R = Math.max(rows + 1, Math.ceil((vh * 2.6) / P));   // sempre bem mais alta que a tela
  const crown = 3, B = Math.round(S * 1.6 + 160), star = clamp(Math.round(W * 0.11), 34, 64);
  const H = Math.round(B + (R + crown - 1) * P + 1.3 * P + star * 1.6 + vh * 0.8);
  const yb = (r) => H - B - r * P;

  const items = []; let idx = 0;
  for (let r = 0; r < rows && idx < n; r++) {
    const c = cap(r), take = Math.min(c, n - idx), sp = rowW(r) / c;
    const slots = [...Array(c).keys()].sort((a, b) => Math.abs(a - (c - 1) / 2) - Math.abs(b - (c - 1) / 2) || a - b);
    for (let j = 0; j < take; j++, idx++) {
      const h = hash(list[idx].user_id), k = slots[j];
      items.push({
        p: list[idx], r,
        x: Math.round(cx + (k - (c - 1) / 2) * sp + ((h % 11) - 5) * S * 0.004),
        y: yb(r) + 2, cord: 12 + ((h >>> 4) % 14), delay: -((h >>> 8) % 60) / 10,
      });
    }
  }
  return { W, H, S, P, Wmax, cx, R, crown, B, star, taper, yb, items };
}
