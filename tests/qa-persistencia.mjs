/* O que sobra no banco depois de apagar — o lixo que ninguém vê.
 *
 * O áudio de uma aula mora num armazém próprio (`lessonAudio`), com a chave da
 * sessão. Nenhuma tela o lista sozinho: ele aparece dentro da aula ou não
 * aparece. Isso quer dizer que uma gravação órfã é invisível por construção —
 * dezenas de megabytes de uma aula que não existe mais, comendo a cota do
 * navegador e voltando depois como "não coube o áudio" numa aula nova.
 *
 * Esta suíte olha o banco por fora, que é o único jeito de ver esse lixo.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { semearAula } from "./semear-aula.mjs";
import { AULA_REACT, semearAudio } from "./semear-fala.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir() {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/fp-aula-slide-projetado.y4m`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  return { b, p, erros };
}

/** O banco por fora: o que está guardado em cada armazém. */
const banco = (p) =>
  p.evaluate(async () => {
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });
    const ler = (store) =>
      new Promise((r) => {
        const q = db.transaction(store).objectStore(store).getAll();
        q.onsuccess = () => r(q.result);
      });
    const capturas = await ler("captures");
    const audios = await ler("lessonAudio");
    db.close();
    const sessoes = new Set(
      capturas.map((c) => c.session?.id).filter(Boolean),
    );
    return {
      capturas: capturas.length,
      naLixeira: capturas.filter((c) => c.deletedAt).length,
      sessoes: [...sessoes],
      audios: audios.map((a) => a.sessionId),
      orfaos: audios.filter((a) => !sessoes.has(a.sessionId)).map((a) => a.sessionId),
    };
  });

const irParaGaleria = async (p) => {
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
};

const abaSliD = async (p) => {
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
};

console.log("== a aula na lixeira MANTÉM o áudio ==");
{
  /* Porque ela volta inteira. Apagar o áudio aqui transformaria uma ação
     reversível numa perda permanente — e a lixeira existe justamente para
     que apagar não seja definitivo. */
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);

  await irParaGaleria(p);
  await abaSliD(p);
  await p.getByRole("button", { name: /React/i }).first().click();
  await p.waitForTimeout(1500);
  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /excluir/i }).first().click();
  await p.waitForTimeout(2000);

  const depois = await banco(p);
  check(depois.naLixeira > 0, `a aula foi para a lixeira (${depois.naLixeira})`);
  check(
    depois.audios.includes(AULA_REACT.id),
    "e a gravação continua guardada, para voltar com ela",
  );
  check(
    depois.orfaos.length === 0,
    `nada órfão (${depois.orfaos.join(", ") || "—"})`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== apagar a aula de vez leva o áudio junto ==");
{
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);

  // Mandar para a lixeira primeiro, que é por onde o apagar definitivo passa.
  await irParaGaleria(p);
  await abaSliD(p);
  await p.getByRole("button", { name: /React/i }).first().click();
  await p.waitForTimeout(1500);
  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /excluir/i }).first().click();
  await p.waitForTimeout(2000);

  // Agora, na lixeira, apagar de vez.
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /Lixeira/i })
    .click();
  await p.waitForTimeout(1200);
  const apagar = p.getByRole("button", { name: /apagar|excluir/i });
  check((await apagar.count()) > 0, "a lixeira oferece apagar de vez");
  await apagar.first().click();
  await p.waitForTimeout(900);
  const confirmar = p.getByRole("button", { name: /apagar|excluir|confirmar/i });
  await confirmar.last().click();
  await p.waitForTimeout(2500);

  const depois = await banco(p);
  check(
    !depois.audios.includes(AULA_REACT.id),
    `a gravação saiu junto (restam: ${depois.audios.join(", ") || "nenhuma"})`,
  );
  check(depois.orfaos.length === 0, "e nada ficou órfão");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== gravação sem aula nenhuma é varrida ==");
{
  /*
   * O caminho que produz o lixo invisível: uma gravação cuja aula sumiu sem
   * passar pelo apagar-de-vez da aula. Acontece de verdade ao apagar o último
   * momento pela grade de mídia — a aula deixa de existir, porque ela É as
   * capturas que a referenciam, e o áudio nunca é avisado.
   */
  const { b, p, erros } = await abrir();
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  // Uma gravação de uma aula que nunca existiu — o órfão puro.
  await semearAudio(p, { sessionId: "aula-que-sumiu" });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);

  const antes = await banco(p);
  check(
    antes.orfaos.includes("aula-que-sumiu"),
    `o órfão existe antes da varredura (${antes.orfaos.join(", ")})`,
  );

  const removidos = await p.evaluate(async () => {
    // A varredura pela mesma porta que o app usa, no bundle publicado.
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });
    const ler = (store) =>
      new Promise((r) => {
        const q = db.transaction(store).objectStore(store).getAll();
        q.onsuccess = () => r(q.result);
      });
    const capturas = await ler("captures");
    db.close();
    return capturas.length;
  });
  check(removidos > 0, "e a aula de verdade continua no banco");

  /*
   * A varredura roda quando alguém apaga algo de vez. Aqui o teste chega nela
   * pelo caminho do produto: apagar uma mídia qualquer dispara a limpeza, e o
   * órfão tem de sumir junto — mesmo não tendo relação com o que foi apagado.
   */
  await irParaGaleria(p);
  await abaSliD(p);
  await p.getByRole("button", { name: /React/i }).first().click();
  await p.waitForTimeout(1500);
  await p.getByRole("tab", { name: "Resumo", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /excluir/i }).first().click();
  await p.waitForTimeout(2000);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /Lixeira/i })
    .click();
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /apagar|excluir/i }).first().click();
  await p.waitForTimeout(900);
  await p.getByRole("button", { name: /apagar|excluir|confirmar/i }).last().click();
  await p.waitForTimeout(2500);

  const depois = await banco(p);
  check(
    !depois.audios.includes("aula-que-sumiu"),
    `o órfão foi varrido (restam: ${depois.audios.join(", ") || "nenhuma"})`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
