/* O microfone não pode ficar preso. Nunca, por caminho nenhum.
 *
 * É o P0 mais grave deste app, e o mais fácil de não perceber: uma track de
 * áudio esquecida em `live` deixa a bolinha laranja do iPhone e o ícone do
 * Android acesos depois de a aula acabar. O estudante vê um app que continua
 * ouvindo a sala — e está certo em ver, porque é o que estaria acontecendo.
 *
 * Esta suíte olha a única coisa que não mente: `track.readyState` de cada
 * track de áudio que a página abriu. Não o estado do React, não o texto da
 * tela — o hardware.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

/**
 * Todo `getUserMedia` da página fica registrado, com as tracks que devolveu.
 *
 * É a única forma honesta de auditar: perguntar ao app quantas tracks ele
 * acha que tem seria confiar exatamente na contabilidade que pode estar
 * errada. Aqui o teste guarda as tracks por fora e pergunta a elas.
 */
const ESPIAO = () => {
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  window.__tracksDeAudio = [];
  window.__pedidosDeAudio = 0;
  navigator.mediaDevices.getUserMedia = async (restricoes) => {
    const pediuAudio = Boolean(restricoes && restricoes.audio);
    if (pediuAudio) window.__pedidosDeAudio += 1;
    const stream = await original(restricoes);
    if (pediuAudio) {
      for (const t of stream.getAudioTracks()) window.__tracksDeAudio.push(t);
    }
    return stream;
  };
};

async function abrir({ atrasoDaPermissao = 0 } = {}) {
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

  if (atrasoDaPermissao > 0) {
    /*
     * A caixa de permissão que demora.
     *
     * No navegador de mesa `--use-fake-ui-for-media-stream` concede na hora, e
     * a janela que interessa — a pessoa responder devagar — simplesmente não
     * existe. Num celular ela dura segundos, às vezes minutos, e é nela que o
     * defeito morava. Atrasar só o pedido de áudio a recria.
     */
    await p.addInitScript((ms) => {
      const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (restricoes) => {
        if (restricoes && restricoes.audio) {
          await new Promise((r) => setTimeout(r, ms));
        }
        return real(restricoes);
      };
    }, atrasoDaPermissao);
  }

  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2000);
  return { b, p, erros };
}

/** Quantas tracks de áudio a página abriu, e quantas continuam vivas. */
const microfones = (p) =>
  p.evaluate(() => ({
    pedidos: window.__pedidosDeAudio ?? 0,
    abertas: (window.__tracksDeAudio ?? []).length,
    vivas: (window.__tracksDeAudio ?? []).filter((t) => t.readyState === "live")
      .length,
  }));

const entrarNoSlid = async (p) => {
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(2500);
};

/**
 * Sair do SliD pela barra de modos, como o estudante sai.
 *
 * Em repouso o SliD esconde os controles — a tela é o quadro, não o app —, e a
 * barra de modos vai junto. O toque no visor é o que a traz de volta. Chamar
 * "Foto" direto esperava trinta segundos por um botão que existe e está
 * coberto: a primeira versão deste arquivo fazia isso e o teste morria sem
 * chegar a medir nada.
 */
async function sairDoSlid(p) {
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) {
    await mostrar.click();
    await p.waitForTimeout(700);
  }
  await sairDoSlid(p);
}

async function encerrar(p) {
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
  await p.waitForTimeout(700);
  const dialogo = p.getByRole("dialog", { name: "Encerrar a aula" });
  await dialogo.getByRole("button", { name: /Salvar aula|^Encerrar$/ }).click();
  await p.waitForTimeout(2500);
}

console.log("== encerrar e salvar: o microfone apaga ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(2000);
  const durante = await microfones(p);
  check(durante.vivas === 1, `durante a aula há microfone vivo (${durante.vivas})`);

  await encerrar(p);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3000);

  const depois = await microfones(p);
  check(
    depois.vivas === 0,
    `depois de salvar, nenhuma track viva (${depois.vivas} de ${depois.abertas})`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== descartar a aula: o microfone apaga igual ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(1800);
  await encerrar(p);
  await p.getByRole("button", { name: /descartar/i }).first().click();
  await p.waitForTimeout(1200);
  const confirmar = p.getByRole("button", { name: /descartar|sim|confirmar/i });
  if ((await confirmar.count()) > 0) {
    await confirmar.last().click();
    await p.waitForTimeout(1500);
  }
  const depois = await microfones(p);
  check(depois.vivas === 0, `nenhuma track viva (${depois.vivas} de ${depois.abertas})`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== desligar pelo ✕: apaga na hora ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(1800);
  await p.getByRole("button", { name: /desligar o áudio desta aula/i }).click();
  await p.waitForTimeout(1000);
  const depois = await microfones(p);
  check(depois.vivas === 0, `o ✕ apaga o microfone (${depois.vivas} de ${depois.abertas})`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sair do SliD sem encerrar: apaga também ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(1800);
  await sairDoSlid(p);
  await p.waitForTimeout(2000);
  const depois = await microfones(p);
  check(depois.vivas === 0, `trocar de modo apaga (${depois.vivas} de ${depois.abertas})`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sair ENQUANTO a permissão está aberta ==");
{
  /*
   * O defeito que esta suíte nasceu para pegar.
   *
   * Entre pedir o microfone e a pessoa responder passam segundos. Se ela sair
   * do SliD nesse meio, o `await` do `getUserMedia` continuava correndo — e
   * quando a permissão enfim chegava, a gravação começava **fora** da sessão,
   * com o microfone aceso e nenhum indicador na tela para desligá-lo.
   *
   * A guarda que faltava não era só "soltar ao sair": era soltar mesmo quando
   * `gravando` ainda é falso, que é o estado durante a caixa inteira.
   */
  const { b, p, erros } = await abrir({ atrasoDaPermissao: 4000 });
  await entrarNoSlid(p);
  // Sai antes de a permissão chegar.
  await p.waitForTimeout(600);
  await sairDoSlid(p);
  // Tempo de sobra para a permissão chegar (atrasada) e o código continuar.
  await p.waitForTimeout(7000);

  const depois = await microfones(p);
  check(
    depois.pedidos > 0,
    `o microfone chegou a ser pedido (${depois.pedidos})`,
  );
  check(
    depois.vivas === 0,
    `e nenhuma track ficou viva depois da saída (${depois.vivas} de ${depois.abertas})`,
  );
  const corpo = await p.locator("body").innerText();
  check(
    !/Ouvindo/i.test(corpo),
    "e a tela não mostra gravação fora da aula",
    corpo.split("\n").slice(0, 3).join(" · "),
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== aula, saída, nova aula: não sobra track da anterior ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(1500);
  await sairDoSlid(p);
  await p.waitForTimeout(1500);
  await entrarNoSlid(p);
  await p.waitForTimeout(1500);

  const durante = await microfones(p);
  check(
    durante.vivas === 1,
    `só a da aula atual está viva (${durante.vivas} de ${durante.abertas})`,
  );

  await sairDoSlid(p);
  await p.waitForTimeout(1800);
  const fim = await microfones(p);
  check(fim.vivas === 0, `e no fim nenhuma (${fim.vivas} de ${fim.abertas})`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
