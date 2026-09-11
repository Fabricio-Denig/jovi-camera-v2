/* O modo Intervalo (time-lapse), que deixou de ser prévia.

   Ele é o modo criativo mais honesto que dá para fazer no navegador: um
   time-lapse **é** um quadro a cada N segundos tocados em sequência. Não há
   aproximação nem efeito aplicado depois — e é isso que este arquivo prova. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir({ quebrar } = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/din-troca-de-slide.y4m`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  if (quebrar) await p.addInitScript(quebrar);
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(900);
  await p.getByRole("dialog").getByRole("button", { name: /^Intervalo/ }).first().click();
  await p.waitForTimeout(2000);
  return { b, p, erros };
}

const videosGuardados = (p) =>
  p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return all
      .filter((c) => c.kind === "video")
      .map((c) => ({ bytes: c.blob.size, tipo: c.mimeType, w: c.width, h: c.height }));
  });

console.log("== o modo deixou de ser prévia ==");
{
  const { b, p, erros } = await abrir();
  const corpo = await p.locator("body").innerText();
  check(
    !/Prévia/i.test(corpo),
    "nenhum selo de prévia na tela",
    corpo.split("\n").slice(0, 3).join(" · "),
  );
  check(/Um quadro a cada/i.test(corpo), "e o controle de intervalo aparece");

  const opcoes = await p.getByRole("radio").allInnerTexts();
  check(opcoes.length === 5, "cinco intervalos", opcoes.join(" "));

  const obturador = p.getByRole("button", { name: /Iniciar gravação/i });
  check((await obturador.count()) === 1, "e o obturador está vivo — não desativado");

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== grava um quadro por intervalo e monta um vídeo ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("radio", { name: /500ms/ }).click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: /Iniciar gravação/i }).click();
  await p.waitForTimeout(9000);

  const durante = await p.locator("body").innerText();
  const quadros = Number(/(\d+) quadros/.exec(durante)?.[1] ?? 0);
  console.log(`        ${durante.split("\n").filter((l) => /quadro|vídeo/.test(l)).join(" · ")}`);

  // Nove segundos a meio segundo por quadro: perto de dezoito. A folga é para
  // o tempo que o Chromium leva para começar, não para esconder erro.
  check(
    quadros >= 14 && quadros <= 22,
    "o número de quadros bate com o intervalo escolhido",
    `${quadros} em ~9 s a 500 ms`,
  );
  check(
    /de tempo real →/.test(durante),
    "a tela diz quanto tempo real virou quanto de vídeo",
  );
  check(/mais rápido/.test(durante), "e quantas vezes mais rápido fica");

  await p.getByRole("button", { name: /Parar gravação/i }).click();
  await p.waitForTimeout(4500);

  const videos = await videosGuardados(p);
  console.log("        " + JSON.stringify(videos));
  check(videos.length === 1, "um vídeo guardado");
  check(videos[0]?.bytes > 5000, "com bytes de verdade", `${videos[0]?.bytes} bytes`);
  check(/^video\//.test(videos[0]?.tipo ?? ""), "e formato de vídeo", videos[0]?.tipo);
  check(videos[0]?.w > 0 && videos[0]?.h > 0, "com dimensões", `${videos[0]?.w}×${videos[0]?.h}`);

  // E ele toca: um arquivo que o navegador não abre não é um vídeo.
  const tocavel = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const all = await new Promise((r) => {
      const q = db.transaction("captures", "readonly").objectStore("captures").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    const v = all.find((c) => c.kind === "video");
    const el = document.createElement("video");
    el.src = URL.createObjectURL(v.blob);
    return new Promise((r) => {
      el.onloadeddata = () => r({ w: el.videoWidth, h: el.videoHeight });
      el.onerror = () => r(null);
      setTimeout(() => r(null), 6000);
    });
  });
  check(tocavel !== null, "e o navegador consegue abri-lo", JSON.stringify(tocavel));

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== trocar de modo gravando não joga a captura fora ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("radio", { name: /500ms/ }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Iniciar gravação/i }).click();
  await p.waitForTimeout(6000);

  // Um toque na barra de modos não pode custar minutos de captura.
  await p.getByRole("button", { name: "Foto", exact: true }).click();
  await p.waitForTimeout(4500);

  const videos = await videosGuardados(p);
  check(videos.length === 1, "o que já foi capturado foi guardado", `${videos.length}`);
  check(videos[0]?.bytes > 3000, "com bytes de verdade", `${videos[0]?.bytes} bytes`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== poucos quadros não viram arquivo quebrado ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("radio", { name: /^10s/ }).click();
  await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Iniciar gravação/i }).click();
  await p.waitForTimeout(2000);
  await p.getByRole("button", { name: /Parar gravação/i }).click();
  await p.waitForTimeout(3000);

  const videos = await videosGuardados(p);
  check(videos.length === 0, "nenhum vídeo de um quadro só foi salvo");
  check(
    /Poucos quadros/i.test(await p.locator("body").innerText()),
    "e a tela diz por quê, em vez de salvar um arquivo que não toca",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sem captureStream: o modo diz que não dá ==");
{
  const { b, p, erros } = await abrir({
    quebrar: () => {
      HTMLCanvasElement.prototype.captureStream = undefined;
    },
  });
  await p.getByRole("button", { name: /Iniciar gravação/i }).click();
  await p.waitForTimeout(1200);
  check(
    /não consegue montar vídeo/i.test(await p.locator("body").innerText()),
    "a tela explica, em vez de não fazer nada",
  );
  check((await videosGuardados(p)).length === 0, "e nada é salvo");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
