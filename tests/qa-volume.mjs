/* Volume: a Galeria com muitas aulas, e o Resumo com uma aula longa.
 *
 * Prioridade 3 e 4 da lista de fechamento. Nenhum teste existente aperta o
 * app com quantidade — todos os seeders usam uma aula de 3–4 momentos. Aqui
 * o objetivo é só um: não travar, não estourar erro de runtime, e continuar
 * respondendo em tempo razoável quando a galeria e uma aula têm muito mais
 * dentro do que o cenário de demonstração normal.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir() {
  const b = await chromium.launch({ executablePath: CHROMIUM });
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
  return { b, p, erros };
}

/** Escreve N aulas curtas + M fotos soltas direto no banco, sem passar pela câmera. */
async function semearVolume(page, { aulas = 30, fotos = 20 } = {}) {
  return page.evaluate(
    async ({ aulas, fotos }) => {
      const desenhar = (cor) =>
        new Promise((r) => {
          const c = document.createElement("canvas");
          c.width = 320;
          c.height = 240;
          const x = c.getContext("2d");
          x.fillStyle = cor;
          x.fillRect(0, 0, 320, 240);
          c.toBlob(r, "image/jpeg", 0.8);
        });

      const db = await new Promise((r, x) => {
        const q = indexedDB.open("jovi-camera-v2");
        q.onsuccess = () => r(q.result);
        q.onerror = () => x(q.error);
      });

      const disciplinas = ["Cálculo", "Física", "Química", "História", null];
      const savedAt = Date.now();

      // Todos os blobs antes de abrir a transação: um `await` no meio dela a
      // fecha sozinha, e um IndexedDB não espera uma promise no meio do laço.
      const blobsAulas = [];
      for (let a = 0; a < aulas; a++) blobsAulas.push(await desenhar(`hsl(${(a * 37) % 360},50%,30%)`));
      const blobsFotos = [];
      for (let f = 0; f < fotos; f++) blobsFotos.push(await desenhar(`hsl(${(f * 53) % 360},40%,50%)`));

      const tx = db.transaction("captures", "readwrite");
      const store = tx.objectStore("captures");

      for (let a = 0; a < aulas; a++) {
        const blob = blobsAulas[a];
        store.put({
          id: `vol-aula-${a}`,
          kind: "photo",
          blob,
          mimeType: "image/jpeg",
          createdAt: savedAt - a * 60000,
          width: 320,
          height: 240,
          session: {
            id: `vol-aula-${a}`,
            subject: `Aula de volume ${a}`,
            discipline: disciplinas[a % disciplinas.length],
            status: null,
            atMs: 3000,
            label: `Momento ${a}`,
            detail: null,
            category: null,
            lines: [`Momento ${a}`],
            spanMs: 0,
            durationMs: 300000,
            skippedDuplicates: 0,
            savedAt: savedAt - a * 60000,
            topics: [],
            kinds: [],
            overview: `Aula gerada para teste de volume, número ${a}.`,
            favorite: a % 7 === 0,
          },
        });
      }

      for (let f = 0; f < fotos; f++) {
        const blob = blobsFotos[f];
        store.put({
          id: `vol-foto-${f}`,
          kind: "photo",
          blob,
          mimeType: "image/jpeg",
          createdAt: savedAt - f * 30000,
          width: 320,
          height: 240,
        });
      }

      await new Promise((r) => {
        tx.oncomplete = r;
      });
      db.close();
    },
    { aulas, fotos },
  );
}

/** Uma aula só, com muitos momentos — o "aula longa" da prioridade 4. */
async function semearAulaLonga(page, { momentos = 25 } = {}) {
  return page.evaluate(
    async (n) => {
      const desenhar = (i) =>
        new Promise((r) => {
          const c = document.createElement("canvas");
          c.width = 480;
          c.height = 360;
          const x = c.getContext("2d");
          x.fillStyle = `hsl(${(i * 29) % 360},45%,30%)`;
          x.fillRect(0, 0, 480, 360);
          x.fillStyle = "#fff";
          x.font = "bold 28px sans-serif";
          x.fillText(`Momento ${i}`, 40, 90);
          c.toBlob(r, "image/jpeg", 0.85);
        });

      const db = await new Promise((r, x) => {
        const q = indexedDB.open("jovi-camera-v2");
        q.onsuccess = () => r(q.result);
        q.onerror = () => x(q.error);
      });

      const savedAt = Date.now();
      const blobs = [];
      for (let i = 0; i < n; i++) blobs.push(await desenhar(i));

      const tx = db.transaction("captures", "readwrite");
      const store = tx.objectStore("captures");
      const topics = [];
      for (let i = 0; i < n; i++) {
        const blob = blobs[i];
        const label = `Tópico ${i}`;
        topics.push(label);
        store.put({
          id: `longa-${i}`,
          kind: "photo",
          blob,
          mimeType: "image/jpeg",
          createdAt: savedAt,
          width: 480,
          height: 360,
          session: {
            id: "aula-longa",
            subject: "Aula longa de teste",
            discipline: "Biologia",
            status: null,
            atMs: i * 60000,
            label,
            detail: `Linha de conteúdo do momento ${i}`,
            category: i % 3 === 0 ? "Fórmula" : null,
            lines: [label, `Linha de conteúdo do momento ${i}`],
            spanMs: 0,
            durationMs: n * 60000,
            skippedDuplicates: 0,
            savedAt,
            topics,
            kinds: [],
            overview: `Aula longa com ${n} momentos, gerada para teste de volume.`,
            favorite: false,
          },
        });
      }
      await new Promise((r) => {
        tx.oncomplete = r;
      });
      db.close();
    },
    momentos,
  );
}

console.log("== Galeria com 30 aulas + 20 fotos soltas ==");
{
  const { b, p, erros } = await abrir();
  await semearVolume(p, { aulas: 30, fotos: 20 });
  await p.reload({ waitUntil: "networkidle" });

  const t0 = Date.now();
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(900);
  const tempoAbrir = Date.now() - t0;
  check(tempoAbrir < 4000, `a galeria abre em tempo razoável (${tempoAbrir}ms)`, `${tempoAbrir}ms`);

  // A galeria abre em "Fotos" por decisão de produto — as aulas moram na
  // aba SliD, com título visível; "Todas" é a grade de miniaturas sem texto.
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(700);

  const corpo = await p.locator("body").innerText();
  check(/Aula de volume/.test(corpo), "as aulas semeadas aparecem, com título");

  // "Todas" força renderizar as 30 aulas + 20 fotos juntas na mesma grade.
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^Todas/ })
    .click();
  await p.waitForTimeout(700);
  const cards = await p.locator("img").count();
  check(cards >= 30, `a lista "Todas" renderiza um volume real de itens (${cards} imagens)`, String(cards));

  // Rolar até o fim não deve travar nem estourar erro.
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.mouse.wheel(0, 4000);
  await p.waitForTimeout(500);

  check(erros.length === 0, "sem erro de runtime com 50 itens na galeria", erros[0] ?? "");
  await b.close();
}

console.log("\n== Resumo com uma aula de 25 momentos ==");
{
  const { b, p, erros } = await abrir();
  await semearAulaLonga(p, { momentos: 25 });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1000);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(700);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(600);

  const t0 = Date.now();
  await p.getByRole("button", { name: /Aula longa/i }).first().click();
  await p.waitForTimeout(900);
  const tempoAbrir = Date.now() - t0;
  check(tempoAbrir < 4000, `a aula longa abre em tempo razoável (${tempoAbrir}ms)`, `${tempoAbrir}ms`);

  const imagens = await p.locator('[role=tabpanel]#painel-imagens li').count();
  check(imagens === 25, `a aba Imagens mostra os 25 momentos`, String(imagens));

  // Aba Texto: 25 momentos com texto renderizados sem travar.
  await p.getByRole("tab", { name: /^Texto/ }).click();
  await p.waitForTimeout(500);
  const textoOk = (await p.locator("body").innerText()).includes("Tópico 24");
  check(textoOk, "a aba Texto chega até o último momento");

  // O PDF: a folha de impressão tem de conter os 25 momentos, não travar montando.
  const t1 = Date.now();
  const folha = await p.evaluate(() => {
    const f = document.querySelector(".folha-de-impressao");
    return f ? { texto: f.textContent ?? "", imgs: f.querySelectorAll("img").length } : null;
  });
  const tempoFolha = Date.now() - t1;
  check(folha !== null, "a folha de impressão existe com a aula longa");
  check(folha?.imgs === 25, `a folha traz as 25 imagens (${folha?.imgs})`, String(folha?.imgs));
  check(tempoFolha < 2000, `ler a folha não trava (${tempoFolha}ms)`, `${tempoFolha}ms`);

  check(erros.length === 0, "sem erro de runtime com 25 momentos", erros[0] ?? "");
  await b.close();
}

console.log("\n== estresse: 150 aulas + 150 fotos (5x o volume acima) ==");
{
  /*
   * Prioridade 4 do ciclo de fechamento seguinte: quanto além do cenário de
   * demonstração normal o app aguenta antes de degradar? 300 itens é bem
   * mais do que qualquer banca ou semestre de testes acumularia — o ponto
   * aqui não é "isso é realista", é "onde está a margem".
   */
  const { b, p, erros } = await abrir();
  const t0 = Date.now();
  await semearVolume(p, { aulas: 150, fotos: 150 });
  const tempoSemear = Date.now() - t0;
  await p.reload({ waitUntil: "networkidle" });

  const t1 = Date.now();
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  const tempoAbrir = Date.now() - t1;
  check(tempoAbrir < 6000, `a galeria abre com 300 itens no banco (${tempoAbrir}ms)`, `${tempoAbrir}ms`);

  const t2 = Date.now();
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^Todas/ })
    .click();
  await p.waitForTimeout(1500);
  const tempoTodas = Date.now() - t2;
  check(tempoTodas < 6000, `trocar para "Todas" com 300 itens (${tempoTodas}ms)`, `${tempoTodas}ms`);

  const cards = await p.locator("img").count();
  check(cards >= 250, `renderiza o volume inteiro, não uma amostra (${cards} imagens)`, String(cards));

  await p.mouse.wheel(0, 5000);
  await p.waitForTimeout(400);
  await p.mouse.wheel(0, 5000);
  await p.waitForTimeout(400);

  const t3 = Date.now();
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(1500);
  const tempoSliD = Date.now() - t3;
  check(tempoSliD < 6000, `trocar para "SliD" com 150 aulas (${tempoSliD}ms)`, `${tempoSliD}ms`);

  check(erros.length === 0, "sem erro de runtime em 300 itens", erros[0] ?? "");
  console.log(`  (semear 300 itens: ${tempoSemear}ms — fora do orçamento de UI, é escrita direta no banco)`);
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
