/* Folha sobre a mesa, que é o caso que o modo Documento existe para resolver.
   As cenas de folha que já havia são close-ups: a folha ocupa quase todo o
   quadro e não sobra mesa em volta — não há borda para detectar, e é por isso
   que o Scanner recusava. Aqui a folha tem fundo. */
const W = 640, H = 480;
let seed = 31337;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function set(g, x, y, v) {
  const xi = Math.round(x), yi = Math.round(y);
  if (xi >= 0 && xi < W && yi >= 0 && yi < H) g[yi * W + xi] = v;
}
function rect(g, x0, y0, w, h, v) {
  for (let y = Math.round(y0); y < Math.round(y0 + h); y++)
    for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(g, x, y, v);
}
function blur(g, r) {
  const t = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
      s += g[yy * W + xx]; n++;
    }
    t[y * W + x] = s / n;
  }
  g.set(t);
}
function textLine(g, x0, y, width, ink, size) {
  const stroke = Math.max(1, Math.round(size / 10));
  let x = Math.round(x0);
  const limite = Math.round(x0 + width);
  while (x < limite) {
    const palavra = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < palavra; k++) {
      const cw = Math.max(3, Math.round(size * 0.55));
      const pernas = rnd() > 0.4 ? 2 : 1;
      for (let l = 0; l < pernas; l++) {
        const lx = x + (l === 0 ? 0 : cw - stroke);
        const topo = y + (rnd() > 0.7 ? Math.round(size * 0.3) : 0);
        for (let yy = topo; yy < y + size; yy++)
          for (let xx = lx; xx < lx + stroke; xx++) set(g, xx, yy, ink);
      }
      if (rnd() > 0.5) {
        const by = y + Math.round(size * (0.25 + rnd() * 0.5));
        for (let yy = by; yy < by + stroke; yy++)
          for (let xx = x; xx < x + cw; xx++) set(g, xx, yy, ink);
      }
      x += cw + Math.max(2, Math.round(size * 0.35));
      if (x > limite) break;
    }
    x += Math.round(size * 0.9);
  }
}

/**
 * Uma folha ocupando `fracao` da largura, sobre uma mesa mais escura.
 * `inclinada` desloca a folha do centro, que é o que uma mão faz de verdade.
 */
export function folhaSobreMesa({ fracao = 0.62, mesa = 78, papel = 225, linhas = 9, desloca = 0 } = {}) {
  seed = 31337;
  const g = new Float64Array(W * H);
  // A mesa, com veio de madeira suave para não ser um fundo chapado.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    g[y * W + x] = mesa + Math.sin(y * 0.07) * 5 + (rnd() - 0.5) * 6;

  const pw = Math.round(W * fracao);
  const ph = Math.round(pw * 1.414);           // proporção A4, em pé
  const px = Math.round((W - pw) / 2 + desloca);
  const py = Math.round((H - ph) / 2);
  rect(g, px, py, pw, ph, papel);

  // Texto na folha, com margens como um documento tem.
  const alt = Math.max(5, Math.round(ph * 0.035));
  for (let i = 0; i < linhas; i++)
    textLine(g, px + pw * 0.1, py + ph * (0.12 + i * 0.08), pw * 0.8, papel - 170, alt);

  blur(g, 2);
  return g;
}

export { W, H };
