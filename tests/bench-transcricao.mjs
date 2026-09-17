/**
 * Quanto custa, de verdade, transcrever uma aula curta — etapa por etapa.
 *
 * **A pergunta.** Um teste físico mediu ~68 segundos de gravação levando
 * cerca de dez minutos no celular. Nem a memória explica (68s de PCM são
 * ~4MB), nem havia como saber em QUAL etapa o tempo foi: a instrumentação
 * media downloads e uma duração agregada de inferência. Este arquivo roda o
 * motor DE VERDADE — os mesmos pesos, o mesmo backend wasm, o mesmo caminho
 * de produção — e devolve a conta separada.
 *
 * **Não é um teste com veredito, é um relatório** — no mesmo espírito de
 * `perf-app.mjs`. Não existe número "certo" para comparar; o que existe é a
 * comparação entre duas configurações do mesmo áudio.
 *
 * **O que ele mede, e o que NÃO mede.** Mede numa máquina de bancada, que é
 * muito mais rápida que o celular da apresentação: os números absolutos são
 * um PISO, não uma previsão. O que viaja de uma máquina para outra é a
 * PROPORÇÃO — quanto do tempo é carregar o modelo contra inferir, e quantas
 * vezes `tiny` é mais rápido que `base`. É isso que decide o que otimizar.
 *
 * Uso:
 *   node tests/bench-transcricao.mjs                # base, frio e quente
 *   node tests/bench-transcricao.mjs --modelo=tiny
 *   node tests/bench-transcricao.mjs --audio=caminho.wav
 *
 * Precisa de `public/models/` povoado (`node scripts/fetch-whisper-model.mjs`)
 * e do app servido (`npm run build && npm run preview`).
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { APP } from "./caminhos.mjs";
import { semearAula, AULA } from "./semear-aula.mjs";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const MODELO = arg("modelo", "base");
const GRAFO = arg("grafo", null);
const AUDIO = arg("audio", null);
const CHROMIUM = process.env.SLID_CHROMIUM;

if (!AUDIO) {
  console.error(
    "Falta --audio=<arquivo.wav>. Um WAV de fala de 60-70s, mono, 16 kHz.\n" +
      "Sem fala de verdade o motor pula a inferência (ver `capturaParecaSilenciosa`)\n" +
      "e o benchmark mede zero.",
  );
  process.exit(2);
}

const wavBase64 = readFileSync(AUDIO).toString("base64");

/** Milissegundos como alguém lê. */
const dur = (ms) =>
  ms == null
    ? "—"
    : ms < 1000
      ? `${Math.round(ms)}ms`
      : ms < 60_000
        ? `${(ms / 1000).toFixed(1)}s`
        : `${Math.floor(ms / 60_000)}min${String(Math.round((ms % 60_000) / 1000)).padStart(2, "0")}s`;

/**
 * Escreve a gravação real no armazém de áudio, do mesmo jeito que a sessão
 * escreveria — sem `transcriptJobStatus`, que é o que faz a `ClassPage`
 * disparar o reprocessamento ao abrir a aula. É o caminho de produção, não
 * um atalho para dentro do motor.
 */
async function semearGravacaoReal(page, sessionId, base64) {
  return page.evaluate(
    async ({ sessionId, base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/wav" });
      const db = await new Promise((r, x) => {
        const q = indexedDB.open("jovi-camera-v2");
        q.onsuccess = () => r(q.result);
        q.onerror = () => x(q.error);
      });
      const tx = db.transaction("lessonAudio", "readwrite");
      tx.objectStore("lessonAudio").put({
        sessionId,
        segments: [
          {
            startMs: 0,
            durationMs: Math.round(((bytes.length - 44) / 32000) * 1000),
            blob,
            mimeType: "audio/wav",
          },
        ],
        createdAt: Date.now(),
        transcriptStatus: "indisponivel",
      });
      await new Promise((r) => {
        tx.oncomplete = r;
      });
      db.close();
      return blob.size;
    },
    { sessionId, base64 },
  );
}

/** O diagnóstico como o app o deixou — a mesma fonte que `?debug=listen` lê. */
async function lerDiag(page) {
  return page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("slid:listen-diag:v1") ?? "null");
    } catch {
      return null;
    }
  });
}

async function estadoDoJob(page, sessionId) {
  return page.evaluate(async (id) => {
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });
    const tx = db.transaction("lessonAudio", "readonly");
    const pedido = tx.objectStore("lessonAudio").get(id);
    const registro = await new Promise((r) => {
      pedido.onsuccess = () => r(pedido.result);
      pedido.onerror = () => r(null);
    });
    db.close();
    return registro
      ? {
          status: registro.transcriptJobStatus,
          outcome: registro.transcriptOutcome,
          falha: registro.transcriptFailure,
          blocos: registro.transcript?.length ?? 0,
          texto: (registro.transcript ?? []).map((t) => t.text).join(" "),
        }
      : null;
  }, sessionId);
}

/*
 * Abre a aula PELO NOME, nunca por índice.
 *
 * A primeira versão clicava em `article button` pelo número, e a Galeria
 * ordena as aulas por `savedAt` — duas aulas semeadas no mesmo milissegundo
 * saem em ordem arbitrária. O resultado foi um benchmark que transcrevia uma
 * aula e ficava quinze minutos esperando a OUTRA terminar, relatando
 * `status: ?` para um trabalho que tinha corrido bem. As medidas de etapa
 * continuaram válidas (o diagnóstico é global), mas o tempo "até aparecer"
 * era puro artefato do harness.
 */
async function abrirAula(page, nome) {
  await page.getByRole("button", { name: "Galeria", exact: true }).click();
  await page.waitForTimeout(800);
  await page
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await page.waitForTimeout(700);
  await page
    .locator("article")
    .filter({ hasText: nome })
    .getByRole("button")
    .first()
    .click();
  await page.waitForTimeout(800);
}

/**
 * Abre a aba Resumo, que é onde `gerarResumoGlobal` roda.
 *
 * Sem isto a etapa `summary` nunca aparece no relatório — e "não medido"
 * seria lido como "não custa nada", que é uma conclusão diferente. A aba é
 * aberta DEPOIS do job terminar, que é quando o resumo de fato é montado
 * sobre a transcrição inteira.
 */
async function abrirResumo(page) {
  await page
    .getByRole("tab", { name: "Resumo", exact: true })
    .click({ timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

/** Espera o job terminar, com teto — um travamento também é um resultado. */
async function esperarFim(page, sessionId, tetoMs = 15 * 60_000) {
  const comeco = Date.now();
  for (;;) {
    const estado = await estadoDoJob(page, sessionId);
    if (estado?.status === "pronto" || estado?.status === "falhou") {
      return { ...estado, esperouMs: Date.now() - comeco };
    }
    if (Date.now() - comeco > tetoMs) {
      return { ...(estado ?? {}), estourou: true, esperouMs: Date.now() - comeco };
    }
    await page.waitForTimeout(1000);
  }
}

function relatar(titulo, diag, fim) {
  console.log(`\n── ${titulo} ──`);
  if (!diag) {
    console.log("  sem diagnóstico (o job não chegou a começar)");
    return;
  }
  const porFase = new Map();
  for (const f of diag.fases ?? []) {
    const a = porFase.get(f.fase) ?? { ms: 0, n: 0 };
    porFase.set(f.fase, { ms: a.ms + f.duracaoMs, n: a.n + 1 });
  }
  const ordem = [
    "model_load",
    "decode",
    "inference",
    "sanitizer",
    "summary",
    "persistence",
  ];
  let somaConhecida = 0;
  for (const fase of ordem) {
    const v = porFase.get(fase);
    if (!v) continue;
    somaConhecida += v.ms;
    console.log(`  ${fase.padEnd(12)} ${dur(v.ms).padStart(8)}  (${v.n}×)`);
  }
  console.log(`  ${"TOTAL medido".padEnd(12)} ${dur(somaConhecida).padStart(8)}`);
  console.log(`  ${"até aparecer".padEnd(12)} ${dur(fim.esperouMs).padStart(8)}`);
  console.log(
    `  modelo: ${diag.engine?.modelId ?? "—"} · cache ${diag.engine?.cache ?? "—"}` +
      ` · grafo ${diag.engine?.graphOptimizationLevel ?? "—"}` +
      ` · threads ${diag.engine?.numThreads ?? "—"}`,
  );
  const lt = diag.longTasks;
  console.log(
    lt?.disponivel
      ? `  travas ≥50ms: ${lt.total}, somando ${dur(lt.somaMs)}, pior ${dur(lt.maiorMs)}`
      : "  travas: longtask indisponível neste navegador",
  );
  const heaps = (diag.fases ?? []).filter((f) => f.heapMb != null);
  if (heaps.length > 0) {
    console.log(
      `  heap: ${Math.min(...heaps.map((h) => h.heapMb))}MB → ${Math.max(...heaps.map((h) => h.heapMb))}MB (pico entre etapas)`,
    );
  }
  for (const f of diag.fases ?? []) {
    if (f.detalhe) console.log(`    · ${f.fase}: ${f.detalhe}`);
  }
  console.log(`  status: ${fim.status ?? "?"} · outcome: ${fim.outcome ?? "?"} · ${fim.blocos ?? 0} blocos`);
  if (fim.falha) console.log(`  FALHA [${fim.falha.stage}]: ${fim.falha.message}`);
  if (fim.texto) console.log(`  texto: ${fim.texto.slice(0, 220).replace(/\s+/g, " ")}`);
}

console.log(
  `═══ benchmark de transcrição · modelo=${MODELO} · áudio=${AUDIO.split(/[\\/]/).pop()} ═══`,
);

const navegador = await chromium.launch(
  CHROMIUM ? { executablePath: CHROMIUM } : {},
);
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await contexto.newPage();
const errosDePagina = [];
page.on("pageerror", (e) => errosDePagina.push(String(e)));

// Primeira aula: cache de rede frio E motor frio — o pior caso real, que é
// o da primeira aula de quem acabou de abrir o app.
const params = `listen-model=${MODELO}` + (GRAFO ? `&listen-graph=${GRAFO}` : "");
await page.goto(`${APP}/?${params}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const aulaA = { ...AULA, id: "bench-a", subject: "Benchmark A" };
const aulaB = { ...AULA, id: "bench-b", subject: "Benchmark B" };
await semearAula(page, aulaA);
await semearAula(page, aulaB);
const bytes = await semearGravacaoReal(page, "bench-a", wavBase64);
await semearGravacaoReal(page, "bench-b", wavBase64);
console.log(`gravação semeada: ${(bytes / 1024).toFixed(0)} KB de WAV\n`);

await page.goto(`${APP}/?${params}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const t0 = Date.now();
await abrirAula(page, "Benchmark A");
const fimFrio = await esperarFim(page, "bench-a");
fimFrio.esperouMs = Date.now() - t0;
await abrirResumo(page);
relatar("PRIMEIRA execução (cache frio, motor frio)", await lerDiag(page), fimFrio);

// Segunda aula, MESMA aba: o motor já está carregado (`motorCompartilhado`
// memoiza a promessa) e os pesos já estão no cache do navegador. É o que
// acontece da segunda aula em diante.
await page.getByRole("button", { name: /voltar|fechar/i }).first().click().catch(() => {});
await page.waitForTimeout(600);
const t1 = Date.now();
await abrirAula(page, "Benchmark B");
const fimQuente = await esperarFim(page, "bench-b");
fimQuente.esperouMs = Date.now() - t1;
await abrirResumo(page);
relatar("SEGUNDA execução (motor quente)", await lerDiag(page), fimQuente);

if (errosDePagina.length > 0) {
  console.log(`\nerros de runtime: ${errosDePagina.length}`);
  for (const e of errosDePagina.slice(0, 3)) console.log(`  ${e.slice(0, 200)}`);
}

await navegador.close();
