/* P0.2: abrir uma aula não pode esperar a galeria inteira carregar.

   Um teste físico real mostrou ~12s em "Abrindo a aula…", tela quase preta —
   `getClassById` varria TODAS as capturas de TODAS as aulas (`getAllCaptures`)
   só para achar uma. Corrigido com um índice do IndexedDB por `session.id`
   (`mediaStore.ts`, `getCapturesBySession`). Este teste prova a correção
   semeando uma galeria grande e medindo o tempo real de abertura — não só
   lendo o código. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

const b = await chromium.launch({
  executablePath: CHROMIUM,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${CENAS}/cor-mesa-de-estudo.y4m`,
  ],
});
const p = await (
  await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
).newPage();
const erros = [];
p.on("pageerror", (e) => erros.push(String(e)));
await p.goto(APP + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);

console.log("== semeando uma galeria grande (40 aulas, ~160 capturas) ==");
const NUM_AULAS = 40;
const MOMENTOS_POR_AULA = 4;
const semeadas = await p.evaluate(
  async ({ numAulas, momentosPorAula }) => {
    const desenhar = (texto, cor) =>
      new Promise((r) => {
        const c = document.createElement("canvas");
        c.width = 480;
        c.height = 360;
        const x = c.getContext("2d");
        x.fillStyle = cor;
        x.fillRect(0, 0, 480, 360);
        x.fillStyle = "#fff";
        x.fillRect(30, 30, 420, 300);
        x.fillStyle = "#1a1a2e";
        x.font = "bold 24px sans-serif";
        x.fillText(texto, 40, 80);
        c.toBlob(r, "image/jpeg", 0.85);
      });

    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });

    const savedAt = Date.now();
    for (let a = 0; a < numAulas; a++) {
      const blobs = [];
      for (let m = 0; m < momentosPorAula; m++) {
        blobs.push(await desenhar(`Aula ${a} · momento ${m}`, "#2b3a55"));
      }
      const tx = db.transaction("captures", "readwrite");
      const store = tx.objectStore("captures");
      for (let m = 0; m < momentosPorAula; m++) {
        store.put({
          id: `aula-carga-${a}-${m}`,
          kind: "photo",
          blob: blobs[m],
          mimeType: "image/jpeg",
          createdAt: savedAt - a * 1000,
          width: 480,
          height: 360,
          session: {
            id: `aula-carga-${a}`,
            subject: a === numAulas - 1 ? "Aula alvo — a que o teste abre" : `Aula de carga ${a}`,
            discipline: "Carga",
            atMs: m * 60000,
            label: `Momento ${m}`,
            detail: null,
            category: "Fórmula",
            lines: [`Linha ${m} da aula ${a}`],
            spanMs: 0,
            durationMs: 300000,
            skippedDuplicates: 0,
            savedAt: savedAt - a * 1000,
            topics: [`Tópico ${a}`],
            kinds: [["formula", 1]],
            overview: `Esta aula de carga teve ${momentosPorAula} momentos.`,
            favorite: false,
          },
        });
      }
      await new Promise((r) => {
        tx.oncomplete = r;
      });
    }
    db.close();
    return numAulas * momentosPorAula;
  },
  { numAulas: NUM_AULAS, momentosPorAula: MOMENTOS_POR_AULA },
);
check(semeadas === NUM_AULAS * MOMENTOS_POR_AULA, "semeou a galeria de carga", `${semeadas} capturas`);

await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);

console.log("\n== abrir UMA aula é rápido, mesmo com a galeria grande ==");
await p.getByRole("button", { name: "Galeria", exact: true }).click();
await p.waitForTimeout(900);
await p
  .getByRole("tablist", { name: "Filtrar a galeria" })
  .getByRole("tab", { name: /^SliD/ })
  .click();
await p.waitForTimeout(700);

const antesDoClique = Date.now();
await p.getByRole("button", { name: /Aula alvo/i }).first().click();
// Espera o cabeçalho de verdade aparecer — não um tempo fixo. O que importa
// é QUANDO o conteúdo real está na tela, não quanto tempo o teste esperou.
await p
  .getByRole("heading", { name: "Aula alvo — a que o teste abre", exact: true })
  .waitFor({ timeout: 5000 });
const tempoAbertura = Date.now() - antesDoClique;

console.log(`        tempo até o cabeçalho real aparecer: ${tempoAbertura}ms`);
check(
  tempoAbertura < 2000,
  "a aula abre em bem menos de 2s, mesmo com 40 aulas na galeria",
  `${tempoAbertura}ms`,
);

const corpo = await p.locator("body").innerText();
check(!/Abrindo a aula…/.test(corpo), "não ficou preso em 'Abrindo a aula…'");

check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");

await b.close();
console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
