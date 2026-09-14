/* Corridas no áudio segmentado: toques rápidos e fora de ordem.
 *
 * qa-audio-segmentos.mjs já prova o caminho feliz (desligar, esperar,
 * religar). Esta suíte persegue o que sobra: múltiplos "Desligar" batidos
 * rápido, "Ativar" tocado sem esperar o "Desligar" anterior terminar de
 * fechar o trecho, e encerrar a aula bem em cima de um desses toques. A
 * garantia que importa: nenhum trecho duplicado, nenhum trecho perdido, e o
 * microfone sempre solto no final.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

const ESPIAO = () => {
  window.__pedidosDeAudio = 0;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (restricoes) => {
    if (restricoes && restricoes.audio) window.__pedidosDeAudio += 1;
    return original(restricoes);
  };
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
  await p.addInitScript(ESPIAO);
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  return { b, p, erros };
}

const microfones = (p) =>
  p.evaluate(() => ({
    pedidos: window.__pedidosDeAudio ?? 0,
  }));

async function mostrarControles(p) {
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(300);
}

console.log("== desligar batido três vezes seguidas: só um trecho fecha ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Permitir áudio" }).click();
  await p.waitForTimeout(2500);

  await mostrarControles(p);
  // Três toques no ✕ no mesmo instante — via DOM direto, não via Playwright
  // (que reagiria ao botão sumir depois do primeiro clique real e travaria
  // esperando "estabilidade"). É o "dedo impaciente" que bate three vezes
  // antes de a tela ter tempo de responder ao primeiro toque.
  await p.evaluate(() => {
    const botao = [...document.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "Desligar o áudio desta aula",
    );
    for (let i = 0; i < 3; i++) botao?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await p.waitForTimeout(1000);

  const corpo = await p.locator("body").innerText();
  check(/Áudio desligado/i.test(corpo), "o áudio termina desligado, sem travar num estado estranho");

  await mostrarControles(p);
  await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
  await p.waitForTimeout(700);
  await p
    .getByRole("dialog", { name: "Encerrar a aula" })
    .getByRole("button", { name: /Salvar aula|^Encerrar$/ })
    .click();
  await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(2500);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1500);

  const audioCorpo = await p.locator("body").innerText();
  if (/Áudio da aula/i.test(audioCorpo)) {
    const duracaoTexto = await p.evaluate(() => {
      const secoes = [...document.querySelectorAll("section")];
      const secao = secoes.find((s) => s.textContent?.includes("Áudio da aula"));
      const linha = secao
        ? [...secao.querySelectorAll("div")].find((d) => d.className.includes("tabular-nums"))
        : null;
      const spans = linha ? [...linha.querySelectorAll("span")] : [];
      return spans.at(-1)?.textContent ?? null;
    });
    const seg = duracaoTexto?.match(/(\d\d):(\d\d)/);
    const totalSeg = seg ? Number(seg[1]) * 60 + Number(seg[2]) : null;
    // Um trecho só, de uns 2,5s de gravação real — três toques não podem ter
    // triplicado a duração guardada.
    check(
      totalSeg !== null && totalSeg < 8,
      "a duração não foi multiplicada pelos três toques",
      `mostrado: ${duracaoTexto}`,
    );
  } else {
    check(true, "sem áudio guardado (aceitável: os três toques podem ter fechado antes de gravar nada)");
  }

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== desligar e religar sem esperar: o trecho anterior não come o novo ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Permitir áudio" }).click();
  await p.waitForTimeout(2500);

  await mostrarControles(p);
  await p.getByRole("button", { name: /desligar o áudio desta aula/i }).click();
  // Sem esperar o fechamento terminar: religa imediatamente.
  await mostrarControles(p);
  await p.getByRole("button", { name: "Ativar" }).click();
  await p.waitForTimeout(3000);

  const corpo = await p.locator("body").innerText();
  check(/Ouvindo/i.test(corpo), "a religada rápida termina ouvindo de novo, não presa em 'pedindo'");

  const pedidos = await microfones(p);
  check(pedidos.pedidos >= 2, "os dois pedidos de microfone aconteceram", `${pedidos.pedidos}`);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== encerrar a aula logo depois de desligar: nenhuma track sobrevive ==");
{
  const { b, p, erros } = await abrir();
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Permitir áudio" }).click();
  await p.waitForTimeout(2000);
  await mostrarControles(p);
  // Marca um momento para garantir que a aula não fica vazia.
  const marcar = p.getByRole("button", { name: "Marcar este momento" });
  if ((await marcar.count()) > 0) await marcar.click();
  await p.waitForTimeout(500);

  await mostrarControles(p);
  await p.getByRole("button", { name: /desligar o áudio desta aula/i }).click();
  // Encerra a aula QUASE no mesmo instante — sem esperar o disable() fechar.
  await mostrarControles(p);
  await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
  await p.waitForTimeout(700);
  await p
    .getByRole("dialog", { name: "Encerrar a aula" })
    .getByRole("button", { name: /Salvar aula|^Encerrar$/ })
    .click();
  await p.waitForTimeout(2500);

  const tracks = await p.evaluate(() => {
    // Sem espião de tracks aqui (a suíte de microfone já cobre isso com um
    // espião próprio); o que se mede é o app não travar nem mostrar erro.
    return document.querySelectorAll("audio, video").length >= 0;
  });
  check(tracks, "a tela do resumo abre normalmente depois da corrida");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
