/* O caso real que o usuário relata: um slide projetado visto do fundo da sala.
   O mesmo slide, em cinco tamanhos dentro do quadro. */
const W = 640, H = 480;
let seed = 4242;
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
/** Escrita em traços finos, como no gerador adversário já validado. */
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
 * Um slide projetado ocupando `fracao` da largura do quadro, sobre a parede
 * escura da sala. Contraste do projetor cai com a luz ambiente.
 */
export function slideAoLonge(fracao, { contraste = 1, ruido = 6 } = {}) {
  seed = 4242;
  const g = new Float64Array(W * H);
  g.fill(52);                                   // parede da sala
  const sw = Math.round(W * fracao);
  const sh = Math.round(sw * 9 / 16);
  const x0 = Math.round((W - sw) / 2);
  const y0 = Math.round((H - sh) / 2);
  const fundo = 52 + (205 - 52) * contraste;    // tela iluminada
  const tinta = 52 + (30 - 52) * contraste;
  rect(g, x0, y0, sw, sh, fundo);

  // Título e cinco bullets, proporcionais ao tamanho da tela.
  const tituloAlt = Math.max(2, Math.round(sh * 0.13));
  const bulletAlt = Math.max(2, Math.round(sh * 0.085));
  textLine(g, x0 + sw * 0.07, y0 + sh * 0.08, sw * 0.62, tinta, tituloAlt);
  for (let i = 0; i < 5; i++)
    textLine(g, x0 + sw * 0.11, y0 + sh * (0.32 + i * 0.13), sw * 0.78, tinta, bulletAlt);

  blur(g, 2);
  for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * ruido;
  return g;
}

const SW = 128, SH = 96, BX = W / SW, BY = H / SH;
export function amostra(g) {
  const out = new Uint8Array(SW * SH);
  for (let ty = 0; ty < SH; ty++) for (let tx = 0; tx < SW; tx++) {
    let s = 0;
    for (let by = 0; by < BY; by++) for (let bx = 0; bx < BX; bx++)
      s += Math.max(0, Math.min(255, g[(ty * BY + by) * W + tx * BX + bx]));
    out[ty * SW + tx] = s / (BX * BY);
  }
  return out;
}
/** A mesma cena, mas amostrando só a janela central — o efeito do zoom. */
export function amostraComZoom(g, zoom) {
  const out = new Uint8Array(SW * SH);
  const sw = W / zoom, sh = H / zoom;
  const ox = (W - sw) / 2, oy = (H - sh) / 2;
  for (let ty = 0; ty < SH; ty++) for (let tx = 0; tx < SW; tx++) {
    let s = 0, n = 0;
    const y1 = oy + (ty / SH) * sh, y2 = oy + ((ty + 1) / SH) * sh;
    const x1 = ox + (tx / SW) * sw, x2 = ox + ((tx + 1) / SW) * sw;
    for (let y = Math.floor(y1); y < Math.ceil(y2); y++)
      for (let x = Math.floor(x1); x < Math.ceil(x2); x++) {
        s += Math.max(0, Math.min(255, g[y * W + x])); n++;
      }
    out[ty * SW + tx] = s / n;
  }
  return out;
}
