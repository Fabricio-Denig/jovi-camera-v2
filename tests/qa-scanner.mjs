/* O Scanner de ponta a ponta: Modos → Documento → apontar → capturar →
   recortar → escolher aparência → salvar → achar na galeria.
   É o critério de pronto da fase 1, escrito como teste. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
let fail = 0;
const check = (ok, l, e = "") => { console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`); if (!ok) fail++; };

async function abrir(cena) {
  const b = await chromium.launch({ executablePath: CHROMIUM,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`] });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["camera"] })).newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);
  return { b, p, erros };
}
async function entrarNoScanner(p) {
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(700);
  await p.getByRole("dialog").getByRole("button", { name: /^Scanner/ }).first().click();
  await p.waitForTimeout(2500);
}

console.log("== o modo Documento existe e é real ==");
{
  const { b, p, erros } = await abrir("doc-folha-na-mesa.y4m");
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(700);
  const card = await p.evaluate(() => {
    const c = [...document.querySelectorAll("[role=dialog] li button")].find((x) => /^Scanner/.test(x.innerText));
    return c ? c.innerText : "";
  });
  check(card !== "", "há um card de Scanner");
  check(!/Prévia/.test(card), "e ele não é mais prévia", card.replace(/\n/g, " · "));
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== aponta para a folha e a moldura aparece ==");
{
  const { b, p, erros } = await abrir("doc-folha-na-mesa.y4m");
  await entrarNoScanner(p);
  const texto = await p.evaluate(() => document.body.innerText);
  check(/Documento enquadrado|Documento encontrado/.test(texto),
    "o Scanner diz que achou a folha", (texto.match(/Documento [^\n]+/) ?? ["?"])[0]);
  // A barra de modos precisa dizer em que modo a câmera está.
  const barra = await p.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-current") === "true");
    return b ? b.innerText.trim() : "nenhum";
  });
  check(barra === "Scanner", "a barra de modos mostra o modo em uso", barra);
  // A linguagem do Scanner não pode ser a do SliD.
  check(!/Aula detectada|momentos|sessão/i.test(texto), "e não fala de aula nem de momentos");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sem folha, não inventa recorte ==");
{
  const { b, p } = await abrir("doc-mesa-vazia.y4m");
  await entrarNoScanner(p);
  const texto = await p.evaluate(() => document.body.innerText);
  check(/Aponte para a folha/.test(texto), "pede para apontar para a folha");
  check(!/Aula detectada/.test(texto), "e a pílula do SliD não sobrevive à troca de modo");
  check(!/Documento enquadrado/.test(texto), "e não afirma ter enquadrado nada");
  await b.close();
}

console.log("\n== captura, revisa, salva, e aparece na galeria ==");
{
  const { b, p, erros } = await abrir("doc-folha-na-mesa.y4m");
  await entrarNoScanner(p);
  await p.getByRole("button", { name: /Tirar foto|Capturar|obturador/i }).first().click()
    .catch(async () => { await p.locator("button").filter({ hasText: "" }).nth(0).click(); });
  await p.waitForTimeout(1500);

  const revisao = p.getByRole("dialog", { name: "Revisar documento" });
  check((await revisao.count()) === 1, "abre a revisão do documento");
  const corpo = await revisao.innerText();
  check(/Original/.test(corpo) && /Documento/.test(corpo) && /P&B/.test(corpo),
    "com as três aparências");
  check(/margem do recorte/i.test(corpo), "e o ajuste de margem");

  await revisao.getByRole("radio", { name: /P&B/ }).click();
  await p.waitForTimeout(400);
  await revisao.getByRole("button", { name: /Salvar na galeria/ }).click();
  await p.waitForTimeout(2500);
  check((await p.getByRole("dialog", { name: "Revisar documento" }).count()) === 0,
    "salvar fecha a revisão");

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1800);
  const naGaleria = await p.evaluate(() => document.querySelectorAll("ul li img").length);
  check(naGaleria > 0, "o documento está na galeria", `${naGaleria} item(ns)`);
  // Documento é mídia manual: não pode ter virado aula.
  const temAula = await p.evaluate(() => /aulas? acompanhadas?/.test(document.body.innerText));
  const slidChip = await p.getByRole("tab", { name: /SliD/ }).innerText().catch(() => "SliD");
  check(!/SliD\s+[1-9]/.test(slidChip), "e não entrou como aula do SliD", slidChip.replace(/\n/g, " "));
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  void temAula;
  await b.close();
}

console.log("\n== extrair texto: sob demanda, e sem bloquear salvar ==");
{
  // A cena com texto de verdade: sem glifo, o teste só provaria que a leitura
  // termina, nunca que ela lê.
  const { b, p, erros } = await abrir("doc-folha-com-texto.y4m");
  await entrarNoScanner(p);
  await p.getByRole("button", { name: /Tirar foto|Capturar|obturador/i }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const revisao = p.getByRole("dialog", { name: "Revisar documento" });

  const botao = revisao.getByRole("button", { name: /Extrair texto/i });
  check((await botao.count()) === 1, "a revisão oferece extrair o texto");

  // Nada de WASM antes de alguém pedir: o Scanner de quem só quer a foto da
  // página não pode pagar quatro megabytes.
  const antes = await p.evaluate(() =>
    performance.getEntriesByType("resource").filter((r) => /tesseract/.test(r.name)).length,
  );
  check(antes === 0, "e não carrega o motor antes de alguém pedir", `${antes} recursos`);

  await botao.click();
  await p.waitForTimeout(700);
  check(
    /Lendo a folha|Texto da folha|não consegui ler/i.test(await revisao.innerText()),
    "tocar nele começa a leitura",
  );

  // Salvar continua disponível enquanto a leitura corre: o texto é um extra
  // sobre a captura, nunca uma etapa dela.
  const salvar = revisao.getByRole("button", { name: /Salvar na galeria/i });
  check(
    (await salvar.count()) === 1 && !(await salvar.isDisabled()),
    "e salvar continua liberado durante a leitura",
  );

  // A leitura termina de um jeito ou de outro — e os dois são aceitáveis.
  // O que não é aceitável é ficar girando para sempre.
  await p.waitForTimeout(45000);
  const depois = await revisao.innerText();
  const terminou = /Texto da folha|não consegui ler|não terminou/i.test(depois);
  check(terminou, "a leitura termina, com texto ou com explicação", depois.split("\n").slice(0, 3).join(" · "));
  check(!/Lendo a folha/i.test(depois), "e não fica girando para sempre");

  check(/Texto da folha/i.test(depois), "e leu a folha", depois.split("\n").slice(1, 5).join(" · "));
  check(
    /Grau|Funcao|Discriminante|Exercicios|raizes/i.test(depois),
    "com palavras que estavam mesmo na folha",
  );
  check(
    (await revisao.getByRole("button", { name: /Copiar texto/i }).count()) === 1,
    "e há como copiar o que leu",
  );

  /* Extrair e perder seria meia funcionalidade: quem leu a folha na revisão
     espera encontrar aquilo de novo depois de salvar. */
  await revisao.getByRole("button", { name: /Salvar na galeria/i }).click();
  await p.waitForTimeout(2500);

  const guardado = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    const doc = all.find((c) => c.source === "scanner");
    return doc ? { linhas: doc.text?.length ?? 0, primeira: doc.text?.[0] ?? "" } : null;
  });
  console.log("        " + JSON.stringify(guardado));
  check(guardado?.linhas > 0, "o texto foi guardado com o documento", `${guardado?.linhas} linhas`);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1800);
  await p.locator("ul li img").first().click();
  await p.waitForTimeout(1200);
  const visor = await p.locator("body").innerText();
  check(/Texto desta folha/i.test(visor), "e a captura aberta mostra que ele existe");
  await p.getByRole("button", { name: /Texto desta folha/i }).click();
  await p.waitForTimeout(500);
  check(
    /funcao|quadratica|Grau|equacoes/i.test(await p.locator("body").innerText()),
    "com o texto lido dentro",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== refazer volta para a câmera ==");
{
  const { b, p } = await abrir("doc-folha-na-mesa.y4m");
  await entrarNoScanner(p);
  await p.getByRole("button", { name: /Tirar foto|Capturar|obturador/i }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const revisao = p.getByRole("dialog", { name: "Revisar documento" });
  if (await revisao.count()) {
    await revisao.getByRole("button", { name: "Refazer" }).click();
    await p.waitForTimeout(900);
    check((await p.getByRole("dialog", { name: "Revisar documento" }).count()) === 0, "refazer fecha a revisão");
    check((await p.locator("video").count()) === 1, "e a câmera continua viva");
  } else check(false, "a revisão abriu para poder refazer");
  await b.close();
}

console.log(fail ? `\n${fail} FALHA(S)` : "\nTUDO PASSOU");
process.exit(fail ? 1 : 0);
