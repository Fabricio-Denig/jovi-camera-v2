/**
 * O que a Galeria custa com um rolo de verdade — e se ela derruba a aba.
 *
 * **A pergunta.** Num teste físico, salvar uma aula e abrir a Galeria logo
 * depois travou a interface e chegou a fechar o app no celular. Duas
 * explicações concorrem, com correções opostas:
 *
 * - **pressão de memória**: a tela monta TODAS as capturas de uma vez
 *   (`getAllCaptures()`, sem paginação nem virtualização) e não existe
 *   miniatura no app — cada azulejo de ~130px exibe o blob ORIGINAL, que o
 *   navegador decodifica inteiro (~8MB de bitmap por foto a 1920×1080);
 * - **thread principal presa**: a inferência do Whisper roda em WebAssembly
 *   na mesma thread que desenha a tela.
 *
 * Este arquivo mede a primeira, sozinha, sem transcrição nenhuma rodando —
 * é a única forma de saber quanto dela existe por conta própria. Relatório,
 * não teste com veredito.
 *
 * Uso:
 *   node tests/bench-galeria.mjs --capturas=80
 *   node tests/bench-galeria.mjs --capturas=150
 */
import { chromium } from "playwright";
import { APP } from "./caminhos.mjs";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const CAPTURAS = Number(arg("capturas", "80"));
const CHROMIUM = process.env.SLID_CHROMIUM;

const mb = (bytes) => (bytes == null ? "—" : `${(bytes / 1048576).toFixed(1)}MB`);
const dur = (ms) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Semeia capturas com fotos do TAMANHO REAL de uma câmera de celular.
 *
 * O tamanho importa mais que o conteúdo: o custo que se quer medir é o do
 * bitmap decodificado (largura × altura × 4 bytes), que independe do que a
 * foto mostra. 1920×1080 é o que a câmera do app entrega por padrão.
 */
async function semearCapturas(page, quantas) {
  return page.evaluate(async (n) => {
    const fazerFoto = (i) =>
      new Promise((r) => {
        const c = document.createElement("canvas");
        c.width = 1920;
        c.height = 1080;
        const x = c.getContext("2d");
        // Um gradiente com ruído: um JPEG de cor chapada comprime para
        // quase nada e mediria um arquivo que não existe na prática.
        const g = x.createLinearGradient(0, 0, 1920, 1080);
        g.addColorStop(0, `hsl(${(i * 37) % 360} 60% 45%)`);
        g.addColorStop(1, `hsl(${(i * 37 + 120) % 360} 60% 25%)`);
        x.fillStyle = g;
        x.fillRect(0, 0, 1920, 1080);
        const img = x.getImageData(0, 0, 1920, 1080);
        for (let p = 0; p < img.data.length; p += 4) {
          const ruido = (Math.random() - 0.5) * 40;
          img.data[p] = Math.max(0, Math.min(255, img.data[p] + ruido));
          img.data[p + 1] = Math.max(0, Math.min(255, img.data[p + 1] + ruido));
          img.data[p + 2] = Math.max(0, Math.min(255, img.data[p + 2] + ruido));
        }
        x.putImageData(img, 0, 0);
        c.toBlob((b) => r(b), "image/jpeg", 0.85);
      });

    const db = await new Promise((res, rej) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });

    let bytes = 0;
    // Em lotes: uma transação só com 150 blobs de 1920×1080 é mais frágil
    // que várias pequenas, e o que se quer medir é a LEITURA depois.
    for (let i = 0; i < n; i++) {
      const blob = await fazerFoto(i);
      bytes += blob.size;
      const tx = db.transaction("captures", "readwrite");
      tx.objectStore("captures").put({
        id: `bench-foto-${i}`,
        kind: "photo",
        blob,
        width: 1920,
        height: 1080,
        createdAt: Date.now() - i * 60000,
        favorite: false,
      });
      await new Promise((r) => {
        tx.oncomplete = r;
      });
    }
    db.close();
    return bytes;
  }, quantas);
}

console.log(`═══ Galeria com ${CAPTURAS} capturas de 1920×1080 ═══\n`);

const navegador = await chromium.launch(
  CHROMIUM ? { executablePath: CHROMIUM } : {},
);
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await contexto.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));
page.on("crash", () => erros.push("A ABA FECHOU (crash)"));

await page.goto(`${APP}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

console.log("semeando…");
const bytesTotais = await semearCapturas(page, CAPTURAS);
console.log(
  `  ${CAPTURAS} fotos, ${mb(bytesTotais)} de JPEG no banco` +
    ` (${mb(CAPTURAS * 1920 * 1080 * 4)} se TODAS forem decodificadas de uma vez)\n`,
);

// Recarrega para a Galeria montar do zero, sem nada em memória da semeadura.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Observa travas da thread principal durante a abertura.
await page.evaluate(() => {
  window.__travas__ = { total: 0, somaMs: 0, maiorMs: 0, disponivel: false };
  try {
    const o = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__travas__.total++;
        window.__travas__.somaMs += e.duration;
        window.__travas__.maiorMs = Math.max(window.__travas__.maiorMs, e.duration);
      }
    });
    o.observe({ entryTypes: ["longtask"] });
    window.__travas__.disponivel = true;
  } catch {
    /* longtask não suportado */
  }
});

/*
 * Quanto custa UMA leitura completa do armazém de capturas.
 *
 * Interessa porque a Galeria faz QUATRO delas a cada montagem:
 * `getAllCaptures()`, `getClasses()` (que chama `getAllCaptures()` por
 * dentro), `getTrashedCaptures()` e `getTrashedClasses()` (idem). Cada uma
 * abre uma conexão nova e desserializa TODOS os registros, Blobs inclusos —
 * quatro vezes os mesmos bytes, no mesmo instante, para produzir quatro
 * recortes da mesma lista.
 */
const custoDeUmaLeitura = await page.evaluate(async () => {
  const t = performance.now();
  const db = await new Promise((r, x) => {
    const q = indexedDB.open("jovi-camera-v2");
    q.onsuccess = () => r(q.result);
    q.onerror = () => x(q.error);
  });
  const tx = db.transaction("captures", "readonly");
  const pedido = tx.objectStore("captures").getAll();
  const itens = await new Promise((r) => {
    pedido.onsuccess = () => r(pedido.result);
    pedido.onerror = () => r([]);
  });
  db.close();
  return { ms: performance.now() - t, registros: itens.length };
});
console.log(
  `uma leitura completa do armazém: ${dur(custoDeUmaLeitura.ms)} para ${custoDeUmaLeitura.registros} registros`,
);
console.log(
  `  a Galeria faz 4 dessas por montagem → ~${dur(custoDeUmaLeitura.ms * 4)} só de leitura\n`,
);

const heapAntes = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);

const t0 = Date.now();
await page.getByRole("button", { name: "Galeria", exact: true }).click();
await page.waitForSelector("img", { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(3000);
const abriuEm = Date.now() - t0;

const medida = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll("img")];
  return {
    heap: performance.memory?.usedJSHeapSize ?? null,
    heapLimite: performance.memory?.jsHeapSizeLimit ?? null,
    imgs: imgs.length,
    lazy: imgs.filter((i) => i.loading === "lazy").length,
    decodingAsync: imgs.filter((i) => i.decoding === "async").length,
    carregadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    videos: document.querySelectorAll("video").length,
    videosSemPreload: [...document.querySelectorAll("video")].filter(
      (v) => v.preload === "none",
    ).length,
    travas: window.__travas__,
  };
});

console.log("abertura da Galeria:");
console.log(`  tempo até pintar     ${dur(abriuEm)}`);
console.log(`  <img> renderizados   ${medida.imgs}`);
console.log(`  com loading=lazy     ${medida.lazy}/${medida.imgs}`);
console.log(`  com decoding=async   ${medida.decodingAsync}/${medida.imgs}`);
console.log(`  de fato decodificadas ${medida.carregadas}/${medida.imgs}`);
if (medida.videos > 0) {
  console.log(`  <video> preload=none ${medida.videosSemPreload}/${medida.videos}`);
}
console.log(
  `  heap                 ${mb(heapAntes)} → ${mb(medida.heap)}` +
    (medida.heapLimite ? ` (limite ${mb(medida.heapLimite)})` : ""),
);
console.log(
  medida.travas?.disponivel
    ? `  travas ≥50ms         ${medida.travas.total}, somando ${dur(medida.travas.somaMs)}, pior ${dur(medida.travas.maiorMs)}`
    : "  travas               longtask indisponível",
);

// Rolar é o outro momento de verdade: com `lazy`, é aqui que o resto
// decodifica; sem ele, já decodificou tudo lá em cima.
const t1 = Date.now();
for (let i = 0; i < 6; i++) {
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(400);
}
const depoisDeRolar = await page.evaluate(() => ({
  heap: performance.memory?.usedJSHeapSize ?? null,
  carregadas: [...document.querySelectorAll("img")].filter(
    (i) => i.complete && i.naturalWidth > 0,
  ).length,
  travas: window.__travas__,
}));
console.log("\ndepois de rolar o rolo inteiro:");
console.log(`  tempo                ${dur(Date.now() - t1)}`);
console.log(`  decodificadas        ${depoisDeRolar.carregadas}/${medida.imgs}`);
console.log(`  heap                 ${mb(depoisDeRolar.heap)}`);
console.log(
  depoisDeRolar.travas?.disponivel
    ? `  travas ≥50ms         ${depoisDeRolar.travas.total}, somando ${dur(depoisDeRolar.travas.somaMs)}, pior ${dur(depoisDeRolar.travas.maiorMs)}`
    : "  travas               indisponível",
);

console.log(
  `\naba viva no fim: ${erros.some((e) => e.includes("crash")) ? "NÃO" : "sim"}` +
    (erros.length > 0 ? ` · ${erros.length} erro(s) de runtime` : ""),
);
for (const e of erros.slice(0, 3)) console.log(`  ${e.slice(0, 160)}`);

await navegador.close();
