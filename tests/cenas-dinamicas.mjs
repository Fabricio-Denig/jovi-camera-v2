/* Cenas que mudam com o tempo — o que uma aula de verdade faz e um quadro
   parado nunca testa: o slide troca, o slide cresce, o professor mexe o
   cursor, a mão treme, o projetor reflete, a luz cai.
   Cada cena é uma lista de fases, e cada fase sabe desenhar um quadro. */
const W = 640, H = 480;
let seed = 99;
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
  const stroke = Math.max(1, Math.round(size / 12));
  x0 = Math.round(x0); y = Math.round(y); width = Math.round(width);
  let x = x0;
  while (x < x0 + width) {
    const word = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < word; k++) {
      const cw = Math.max(3, Math.round(size * 0.55));
      const legs = rnd() > 0.4 ? 2 : 1;
      for (let l = 0; l < legs; l++) {
        const lx = x + (l === 0 ? 0 : cw - stroke);
        const top = y + (rnd() > 0.7 ? Math.round(size * 0.3) : 0);
        for (let yy = top; yy < y + size; yy++)
          for (let xx = lx; xx < lx + stroke; xx++) set(g, xx, yy, ink);
      }
      if (rnd() > 0.5) {
        const by = y + Math.round(size * (0.2 + rnd() * 0.6));
        for (let yy = by; yy < by + stroke; yy++)
          for (let xx = x; xx < x + cw; xx++) set(g, xx, yy, ink);
      }
      x += cw + Math.max(2, Math.round(size * 0.35));
      if (x > x0 + width) break;
    }
    x += Math.round(size * 0.9);
  }
}

/**
 * Um slide projetado. `linhas` diz quantos bullets já apareceram — é assim que
 * um build se distingue de um slide novo: o build acrescenta, o slide troca.
 */
export function slide({
  fracao = 0.5,
  contraste = 1,
  linhas = 5,
  semente = 7,
  layout = "bullets",
} = {}) {
  seed = semente;
  const g = new Float64Array(W * H);
  g.fill(52);
  const sw = Math.round(W * fracao);
  const sh = Math.round(sw * 9 / 16);
  const x0 = Math.round((W - sw) / 2), y0 = Math.round((H - sh) / 2);
  const fundo = 52 + (205 - 52) * contraste;
  const tinta = 52 + (30 - 52) * contraste;
  rect(g, x0, y0, sw, sh, fundo);
  const tituloAlt = Math.max(2, Math.round(sh * 0.13));
  const bulletAlt = Math.max(2, Math.round(sh * 0.085));

  if (layout === "bullets") {
    textLine(g, x0 + sw * 0.07, y0 + sh * 0.08, sw * 0.62, tinta, tituloAlt);
    for (let i = 0; i < linhas; i++)
      textLine(g, x0 + sw * 0.11, y0 + sh * (0.32 + i * 0.13), sw * 0.78, tinta, bulletAlt);
  } else {
    /*
     * O outro slide precisa ser outro slide, e não o mesmo com outras letras.
     * Na amostra de 128×96 uma linha de texto tem dois pixels de altura: dois
     * textos diferentes na mesma linha, do mesmo comprimento, são a mesma
     * mancha. Trocar a semente não troca de slide — troca o ruído. O que troca
     * de slide é o que muda numa apresentação de verdade: quantas linhas,
     * onde elas começam, e o desenho que ocupa metade da tela.
     */
    textLine(g, x0 + sw * 0.30, y0 + sh * 0.06, sw * 0.44, tinta, tituloAlt);
    for (let i = 0; i < 3; i++)
      textLine(g, x0 + sw * 0.06, y0 + sh * (0.28 + i * 0.11), sw * 0.40, tinta, bulletAlt);
    // Um diagrama à direita: caixas ligadas, que é o que ocupa o outro meio.
    const bx = x0 + sw * 0.55, by = y0 + sh * 0.30;
    for (let i = 0; i < 3; i++) {
      const cy = by + sh * 0.18 * i;
      rect(g, bx, cy, sw * 0.32, Math.max(2, sh * 0.02), tinta);
      rect(g, bx, cy, Math.max(2, sw * 0.006), sh * 0.12, tinta);
      rect(g, bx + sw * 0.32, cy, Math.max(2, sw * 0.006), sh * 0.12, tinta);
      rect(g, bx, cy + sh * 0.12, sw * 0.32, Math.max(2, sh * 0.02), tinta);
    }
  }
  blur(g, 2);
  return { g, caixa: { x0, y0, sw, sh } };
}

/** O ponteiro do mouse do professor, andando sobre o slide. */
export function comCursor(base, t) {
  const g = Float64Array.from(base.g);
  const { x0, y0, sw, sh } = base.caixa;
  const cx = x0 + sw * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.7)));
  const cy = y0 + sh * (0.3 + 0.5 * (0.5 + 0.5 * Math.cos(t * 1.1)));
  rect(g, cx, cy, 7, 10, 20);
  return g;
}

/** Uma faixa clara que o projetor devolve no vidro, andando devagar. */
export function comReflexo(base, t) {
  const g = Float64Array.from(base.g);
  const cx = W * (0.5 + 0.35 * Math.sin(t * 0.5));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = Math.abs(x - cx) / 70;
    if (d < 1) g[y * W + x] += 45 * (1 - d) * (1 - d);
  }
  return g;
}

/** O professor passando na frente da tela. */
export function comPessoa(base, t) {
  const g = Float64Array.from(base.g);
  const cx = W * ((t * 0.22) % 1.4 - 0.2);
  rect(g, cx - 45, H * 0.25, 90, H * 0.75, 40);
  rect(g, cx - 20, H * 0.14, 40, H * 0.13, 62);
  return g;
}

/** O quadro inteiro deslocado alguns pixels — o celular apoiado que treme. */
export function comTremor(base, t, amplitude = 3) {
  const g = new Float64Array(W * H);
  const dx = Math.round(amplitude * Math.sin(t * 5.3));
  const dy = Math.round(amplitude * Math.cos(t * 4.1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(W - 1, Math.max(0, x + dx));
    const sy = Math.min(H - 1, Math.max(0, y + dy));
    g[y * W + x] = base.g[sy * W + sx];
  }
  return g;
}

export { W, H };

/**
 * A mesma sala, com o que uma sala tem em volta da tela: o batente da porta, a
 * moldura da janela, o rodapé. A guarda de reenquadramento só tem o que medir
 * quando existe periferia com marcas — numa parede lisa ela é cega de
 * qualquer jeito, e isso também é um fato sobre ela.
 */
export function salaComTela(base) {
  const g = Float64Array.from(base.g);
  rect(g, 20, 40, 5, H - 90, 120);        // batente da porta
  rect(g, 20, 40, 70, 5, 120);
  rect(g, W - 100, 60, 80, 5, 130);       // moldura da janela
  rect(g, W - 100, 60, 5, 120, 130);
  rect(g, W - 25, 60, 5, 120, 130);
  rect(g, 0, H - 22, W, 6, 110);          // rodapé
  return { g, caixa: base.caixa };
}

/** O celular sendo mexido: tudo desliza junto, tela e sala. */
export function deslocada(base, dx, dy) {
  const g = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const sx = Math.min(W - 1, Math.max(0, x - dx));
    const sy = Math.min(H - 1, Math.max(0, y - dy));
    g[y * W + x] = base.g[sy * W + sx];
  }
  return { g, caixa: base.caixa };
}
