/* Cenas adversárias geradas em código: coisas para as quais um celular é
   apontado o tempo todo e que NÃO são aula. 640x480 em cinza. */
const W = 640, H = 480;
let seed = 12345;
function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function make(fill) { const g = new Float64Array(W * H); fill(g); return g; }
function px(g, x, y) { return g[y * W + x]; }
function set(g, x, y, v) { if (x >= 0 && x < W && y >= 0 && y < H) g[y * W + x] = v; }

/** Desfoque de caixa — a lente nunca entrega bordas perfeitas. */
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
/** Ruído do sensor. */
function noise(g, amp) { for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * amp; }
/** Vinheta e queda de luz — a iluminação nunca é uniforme. */
function light(g, amount = 0.25) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
    g[y * W + x] *= 1 - amount * (dx * dx + dy * dy) * 0.5 - amount * (y / H) * 0.3;
  }
}
function rect(g, x0, y0, w, h, v) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(g, x, y, v);
}
/**
 * Uma linha de escrita: palavras curtas, letras finas, muito branco entre elas.
 * Traços de 1–2 px em vez de blocos cheios — escrita real cobre entre 10 % e
 * 30 % da linha, e é isso que faz dela muitas corridas curtas em vez de uma
 * mancha.
 */
function textLine(g, x0, y, width, ink, size = 14) {
  const stroke = Math.max(1, Math.round(size / 12));
  let x = x0;
  while (x < x0 + width) {
    const word = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < word; k++) {
      const cw = Math.max(3, Math.round(size * 0.55));
      // hastes verticais
      const legs = rnd() > 0.4 ? 2 : 1;
      for (let l = 0; l < legs; l++) {
        const lx = x + (l === 0 ? 0 : cw - stroke);
        const top = y + (rnd() > 0.7 ? Math.round(size * 0.3) : 0);
        for (let yy = top; yy < y + size; yy++)
          for (let xx = lx; xx < lx + stroke; xx++) set(g, xx, yy, ink);
      }
      // uma barra horizontal ocasional
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

const scenes = {
  "parede rebocada (textura forte)": () => make(g => {
    for (let i = 0; i < g.length; i++) g[i] = 150 + (rnd() - 0.5) * 70;
    blur(g, 1); light(g, 0.4); noise(g, 8);
  }),
  "parede de tijolos": () => make(g => {
    g.fill(120);
    for (let y = 0; y < H; y += 34) {
      rect(g, 0, y, W, 6, 190);                       // argamassa horizontal
      const off = ((y / 34) | 0) % 2 ? 40 : 0;
      for (let x = off; x < W; x += 80) rect(g, x, y, 6, 34, 190); // juntas verticais
    }
    for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * 30;
    blur(g, 2); light(g, 0.3); noise(g, 6);
  }),
  "mesa de madeira, veio marcado": () => make(g => {
    for (let y = 0; y < H; y++) {
      const grain = 130 + 45 * Math.sin(y * 0.28 + Math.sin(y * 0.05) * 3);
      for (let x = 0; x < W; x++) g[y * W + x] = grain + (rnd() - 0.5) * 25;
    }
    blur(g, 2); light(g, 0.35); noise(g, 6);
  }),
  "teclado do notebook": () => make(g => {
    g.fill(60);
    for (let r = 0; r < 6; r++) {
      const y = 60 + r * 62;
      for (let c = 0; c < 14; c++) {
        const x = 30 + c * 42;
        rect(g, x, y, 34, 34, 105);                    // tecla
        rect(g, x + 12, y + 12, 10, 10, 165);          // legenda
      }
    }
    blur(g, 2); light(g, 0.3); noise(g, 7);
  }),
  "persiana": () => make(g => {
    for (let y = 0; y < H; y++) {
      const v = 90 + 120 * Math.max(0, Math.sin(y * 0.19));
      for (let x = 0; x < W; x++) g[y * W + x] = v;
    }
    blur(g, 2); light(g, 0.3); noise(g, 7);
  }),
  "estante de livros": () => make(g => {
    g.fill(70);
    let x = 10;
    while (x < W) {
      const w = 14 + Math.floor(rnd() * 26);
      const v = 60 + rnd() * 150;
      rect(g, x, 40, w, 400, v);
      rect(g, x + 2, 150 + rnd() * 120, w - 4, 30, v > 120 ? 40 : 200); // rótulo
      x += w + 3;
    }
    blur(g, 2); light(g, 0.35); noise(g, 7);
  }),
  "piso de ladrilho": () => make(g => {
    g.fill(160);
    for (let y = 0; y < H; y += 55) rect(g, 0, y, W, 4, 110);
    for (let x = 0; x < W; x += 55) rect(g, x, 0, 4, H, 110);
    for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * 22;
    blur(g, 2); light(g, 0.35); noise(g, 6);
  }),
  "cortina com dobras": () => make(g => {
    for (let x = 0; x < W; x++) {
      const v = 120 + 70 * Math.sin(x * 0.07 + Math.sin(x * 0.013) * 2);
      for (let y = 0; y < H; y++) g[y * W + x] = v + (rnd() - 0.5) * 20;
    }
    blur(g, 2); light(g, 0.3); noise(g, 7);
  }),
  "tecido / carpete": () => make(g => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      g[y * W + x] = 110 + 40 * Math.sin(x * 0.9) * Math.sin(y * 0.9) + (rnd() - 0.5) * 45;
    blur(g, 1); light(g, 0.3); noise(g, 8);
  }),
  "grade de ar-condicionado": () => make(g => {
    g.fill(150);
    for (let y = 70; y < 410; y += 16) rect(g, 60, y, 520, 9, 95);
    blur(g, 2); light(g, 0.3); noise(g, 6);
  }),
  "parede com quadro e tomada": () => make(g => {
    g.fill(175);
    rect(g, 180, 90, 280, 200, 120); rect(g, 192, 102, 256, 176, 205);
    rect(g, 520, 330, 46, 60, 232); rect(g, 534, 346, 6, 12, 90); rect(g, 548, 346, 6, 12, 90);
    for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * 18;
    blur(g, 2); light(g, 0.35); noise(g, 6);
  }),
  "tela ligada sem conteúdo": () => make(g => {
    g.fill(40); rect(g, 70, 60, 500, 340, 225);
    for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * 10;
    blur(g, 2); light(g, 0.25); noise(g, 5);
  }),
  "camisa listrada (pessoa)": () => make(g => {
    for (let y = 0; y < H; y++) {
      const v = 90 + 80 * (Math.floor(y / 11) % 2);
      for (let x = 0; x < W; x++) g[y * W + x] = v + (rnd() - 0.5) * 25;
    }
    blur(g, 3); light(g, 0.4); noise(g, 8);
  }),
  "papel amassado": () => make(g => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      g[y * W + x] = 195 + 40 * Math.sin(x * 0.03 + y * 0.05) * Math.sin(y * 0.02 - x * 0.01)
        + (rnd() - 0.5) * 20;
    blur(g, 2); light(g, 0.35); noise(g, 6);
  }),
  "mesa com caneca e caneta": () => make(g => {
    g.fill(140);
    rect(g, 120, 180, 110, 120, 205); rect(g, 230, 210, 40, 50, 205);
    rect(g, 330, 300, 220, 12, 70);
    for (let i = 0; i < g.length; i++) g[i] += (rnd() - 0.5) * 16;
    blur(g, 2); light(g, 0.35); noise(g, 6);
  }),

  /* --- e o que É aula, que precisa continuar passando --- */
  "AULA: slide projetado": () => make(g => {
    g.fill(35); rect(g, 60, 50, 520, 370, 232);
    textLine(g, 95, 85, 330, 45, 22);
    for (let i = 0; i < 5; i++) textLine(g, 110, 160 + i * 46, 420, 55, 16);
    blur(g, 2); light(g, 0.3); noise(g, 6);
  }),
  "AULA: lousa branca escrita": () => make(g => {
    g.fill(228);
    textLine(g, 70, 70, 300, 60, 26);
    for (let i = 0; i < 6; i++) textLine(g, 80, 150 + i * 48, 480, 70, 18);
    blur(g, 2); light(g, 0.3); noise(g, 6);
  }),
  "AULA: caderno escrito": () => make(g => {
    g.fill(238);
    for (let i = 0; i < 9; i++) rect(g, 60, 70 + i * 44, 520, 2, 200); // pauta
    for (let i = 0; i < 8; i++) textLine(g, 70, 74 + i * 44, 480, 55, 16);
    blur(g, 2); light(g, 0.35); noise(g, 7);
  }),
  "AULA: slide escuro": () => make(g => {
    g.fill(28);
    textLine(g, 80, 70, 320, 225, 24);
    for (let i = 0; i < 4; i++) textLine(g, 95, 170 + i * 55, 430, 215, 18);
    blur(g, 2); light(g, 0.25); noise(g, 6);
  }),
  "AULA: folha A4 escrita": () => make(g => {
    g.fill(240);
    for (let i = 0; i < 9; i++) textLine(g, 70, 50 + i * 46, 500, 45, 20);
    blur(g, 2); light(g, 0.35); noise(g, 7);
  }),
  // Limite conhecido, deixado à vista: com 14 linhas na moldura cada linha ocupa
  // ~2 das 96 fileiras da amostra e nenhuma faixa se forma. Vale para a captura
  // também, e alargar MIN_BAND para 2 deixaria entrar textura — a página densa
  // continua capturável dentro da sessão, só não é oferecida sozinha.
  "LIMITE: folha A4 muito densa (14 linhas)": () => make(g => {
    g.fill(240);
    for (let i = 0; i < 14; i++) textLine(g, 70, 40 + i * 30, 500, 45, 13);
    blur(g, 2); light(g, 0.35); noise(g, 7);
  }),
};

const SW = 128, SH = 96, BX = W / SW, BY = H / SH;
export function sample(name) {
  seed = 12345;
  const g = scenes[name]();
  const out = new Uint8Array(SW * SH);
  for (let ty = 0; ty < SH; ty++) for (let tx = 0; tx < SW; tx++) {
    let s = 0;
    for (let by = 0; by < BY; by++) for (let bx = 0; bx < BX; bx++)
      s += Math.max(0, Math.min(255, g[(ty * BY + by) * W + tx * BX + bx]));
    out[ty * SW + tx] = s / (BX * BY);
  }
  return out;
}
/** A cena em 640×480, antes de virar amostra — para gravar em vídeo. */
export function raw(name) {
  seed = 12345;
  const g = scenes[name]();
  const out = new Float64Array(W * H);
  for (let i = 0; i < g.length; i++) out[i] = Math.max(0, Math.min(255, g[i]));
  return out;
}
export const names = Object.keys(scenes);
