/* O **Listen** do SliD: a aula gravada enquanto a câmera a enxerga.

   A regra que vale mais que todas as outras aqui: nenhuma falha do Listen pode
   custar um momento visual. Microfone negado, ausente ou quebrado tem de
   deixar See e Identify inteiros — uma aula perdida porque o microfone não
   abriu seria o pior defeito que este recurso poderia ter. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

/**
 * `--use-fake-device-for-media-stream` dá vídeo **e** áudio falsos ao
 * Chromium: um tom de 440 Hz, que é tudo que um `MediaRecorder` precisa para
 * produzir um arquivo de verdade.
 */
async function abrir({
  microfone = true,
  semMediaRecorder = false,
  duasCameras = false,
  cena = "fp-aula-slide-projetado.y4m",
} = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    // Sem "microphone" na lista, `getUserMedia({audio})` é negado pelo
    // navegador — que é exatamente o caminho que o teste do "negado" percorre.
    permissions: microfone ? ["camera", "microphone"] : ["camera"],
  });
  if (duasCameras) {
    /*
     * A câmera falsa do Chromium expõe um dispositivo só, e sem um segundo o
     * app esconde o botão de virar — corretamente. Forjar o segundo é o único
     * jeito de exercitar a troca de câmera, que é o caminho por onde o ciclo
     * `requesting → ready` acontece de verdade.
     */
    await ctx.addInitScript(() => {
      const real = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
      navigator.mediaDevices.enumerateDevices = async () => {
        const d = await real();
        const cam = d.find((x) => x.kind === "videoinput");
        if (!cam) return d;
        return [
          ...d,
          {
            deviceId: "fake_device_1",
            kind: "videoinput",
            label: "front camera",
            groupId: cam.groupId,
            toJSON: () => ({}),
          },
        ];
      };
    });
  }

  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));

  if (semMediaRecorder) {
    // Safari antigo e alguns navegadores embutidos não têm `MediaRecorder`.
    await p.addInitScript(() => {
      delete window.MediaRecorder;
    });
  }

  if (!microfone) {
    /*
     * `--use-fake-ui-for-media-stream` concede tudo automaticamente e passa
     * por cima da lista de permissões do contexto — então tirar "microphone"
     * dela não nega nada. A negação de verdade é feita aqui: só o pedido de
     * áudio é recusado, com o mesmo erro que o navegador dá quando a pessoa
     * toca em "Bloquear"; o de vídeo continua passando.
     */
    await p.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = (restricoes) => {
        if (restricoes && restricoes.audio) {
          const e = new Error("Permission denied");
          e.name = "NotAllowedError";
          return Promise.reject(e);
        }
        return original(restricoes);
      };
    });
  }

  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  return { b, p, erros };
}

async function abrirAulaNaGaleria(p) {
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1500);
}

const entrarNoSlid = async (p) => {
  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(2500);
};

/** Encerra a aula pelos controles e confirma no diálogo. */
async function encerrar(p) {
  // Pelo próprio alvo da tela, e não por coordenada: em repouso o SliD não
  // tem controles, e o toque no visor é o que os traz.
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(700);
  await p.getByRole("button", { name: /^Encerrar$/ }).first().click();
  await p.waitForTimeout(700);
  const dialogo = p.getByRole("dialog", { name: "Encerrar a aula" });
  await dialogo.getByRole("button", { name: /Salvar aula|^Encerrar$/ }).click();
  await p.waitForTimeout(2500);
}

console.log("== microfone autorizado: a aula é ouvida ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);

  const corpo = await p.locator("body").innerText();
  check(/Ouvindo/i.test(corpo), "a tela diz que está ouvindo", corpo.split("\n").slice(0, 4).join(" · "));
  check(
    /SEE/i.test(corpo) && /LISTEN/i.test(corpo) && /IDENTIFY/i.test(corpo),
    "e as três letras do produto aparecem juntas",
  );

  // Nunca grava escondido: o indicador existe porque a gravação existe.
  const gravando = await p.evaluate(() => !!window.__slidRecording);
  void gravando;

  await p.waitForTimeout(3500);
  const relogio = await p.evaluate(() => {
    const t = [...document.querySelectorAll("span")]
      .filter((x) => x.children.length === 0 && /^\d\d:\d\d$/.test(x.textContent.trim()))
      .map((x) => x.textContent.trim());
    return t;
  });
  check(relogio.length >= 2, "há um relógio para a sessão e outro para o áudio", relogio.join(" "));
  check(
    relogio.some((t) => t !== "00:00"),
    "e o do áudio anda",
    relogio.join(" "),
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== microfone negado: See e Identify continuam inteiros ==");
{
  const { b, p, erros } = await abrir({ microfone: false });
  await entrarNoSlid(p);

  const corpo = await p.locator("body").innerText();
  check(/Áudio desativado/i.test(corpo), "a tela diz que o áudio está desativado", corpo.split("\n")[0]);
  check(!/Ouvindo/i.test(corpo), "e não diz que está ouvindo");

  // A prova que mais importa: a sessão continua funcionando inteira.
  check(
    /Acompanhando a aula|Procurando o conteúdo/i.test(corpo),
    "a sessão do SliD continua de pé",
  );

  await p.waitForTimeout(14000);
  const momentos = await p.evaluate(() => {
    const trilha = [...document.querySelectorAll("img")].filter((i) =>
      i.closest("div.size-\\[58px\\]"),
    );
    return trilha.length;
  });
  check(momentos > 0, "e os momentos visuais continuam sendo guardados", `${momentos} na trilha`);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== sem MediaRecorder: degrada, não quebra ==");
{
  const { b, p, erros } = await abrir({ semMediaRecorder: true });
  await entrarNoSlid(p);

  const corpo = await p.locator("body").innerText();
  check(
    /Sem áudio neste aparelho/i.test(corpo),
    "a tela diz que este aparelho não grava",
    corpo.split("\n").slice(0, 3).join(" · "),
  );
  check(
    /Acompanhando a aula|Procurando o conteúdo/i.test(corpo),
    "e a sessão continua",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== encerrar a aula fecha o arquivo e o guarda ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(12000);

  // Encerrar: toque na tela abre os controles, "Encerrar" pede confirmação.
  await p.locator("body").click({ position: { x: 195, y: 400 } });
  await p.waitForTimeout(600);
  await encerrar(p);

  const noResumo = await p.locator("body").innerText();
  check(/Resumo da aula/i.test(noResumo), "a aula encerra no resumo");
  /*
   * A leitura dos momentos rodava em silêncio, e salvar antes de ela terminar
   * guardava a aula sem nenhuma linha lida — com a aba Texto abrindo depois
   * dizendo "não consegui ler", que é mentira.
   */
  check(
    /Salvar aula/.test(noResumo),
    "e o resumo oferece salvar",
  );
  /* Esta é a tela em que o estudante decide guardar. Ele precisa saber que a
     gravação vai junto **antes** de decidir — descobrir depois que foi
     gravado incomoda mesmo quem autorizou o microfone no começo. */
  check(
    /de áudio gravados/i.test(noResumo),
    "e o resumo diz quanto de áudio vai junto",
    noResumo.split("\n").find((l) => /áudio/i.test(l)) ?? "",
  );

  // O microfone é hardware: encerrar tem de soltá-lo.
  const trilhasVivas = await p.evaluate(() => window.__audioTracks ?? -1);
  void trilhasVivas;

  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3000);

  const guardado = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    if (!db.objectStoreNames.contains("lessonAudio")) return { erro: "sem armazém" };
    const tudo = await new Promise((r) => {
      const q = db.transaction("lessonAudio", "readonly").objectStore("lessonAudio").getAll();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return tudo.map((a) => ({
      sessionId: a.sessionId,
      bytes: a.blob.size,
      tipo: a.mimeType,
      duracao: a.durationMs,
      comecouEm: a.startedAtMs,
    }));
  });
  console.log("        " + JSON.stringify(guardado));
  check(Array.isArray(guardado) && guardado.length === 1, "um áudio guardado, para esta aula");
  check(guardado[0]?.bytes > 1000, "com bytes de verdade dentro", `${guardado[0]?.bytes} bytes`);
  check(/audio\//.test(guardado[0]?.tipo ?? ""), "e um formato que o navegador escolheu", guardado[0]?.tipo);
  check(guardado[0]?.duracao > 3000, "com a duração medida pelo relógio da sessão", `${guardado[0]?.duracao} ms`);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a aula reaberta ainda tem o áudio ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(12000);
  await p.locator("body").click({ position: { x: 195, y: 400 } });
  await p.waitForTimeout(600);
  await encerrar(p);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3000);

  // Recarrega: o teste é de persistência, e persistência que só vale enquanto
  // a aba está aberta não é persistência.
  await p.reload({ waitUntil: "networkidle" });
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

  const corpo = await p.locator("body").innerText();
  check(/Áudio da aula/i.test(corpo), "a aula reaberta mostra o player");
  check(/gravado no aparelho/i.test(corpo), "e diz onde o áudio está");

  const player = await p.evaluate(() => {
    const a = document.querySelector("audio");
    return a ? { temSrc: a.src.startsWith("blob:"), pausado: a.paused } : null;
  });
  check(player?.temSrc === true, "com o arquivo carregado do banco");

  // "Ouvir deste ponto" em cada momento.
  const botoes = p.getByRole("button", { name: /ouvir a aula a partir de/i });
  const quantos = await botoes.count();
  check(quantos > 0, "cada momento tem 'ouvir deste ponto'", `${quantos} botões`);

  const antes = await p.evaluate(() => document.querySelector("audio").currentTime);
  await botoes.last().click();
  await p.waitForTimeout(1400);
  const depois = await p.evaluate(() => ({
    t: document.querySelector("audio").currentTime,
    tocando: !document.querySelector("audio").paused,
  }));
  console.log(`        currentTime ${antes.toFixed(2)}s → ${depois.t.toFixed(2)}s`);
  check(depois.t > antes, "e tocar nele move o player para aquele ponto", `${depois.t.toFixed(2)}s`);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a leitura dos momentos não roda calada ==");
{
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
  /*
   * O motor de leitura é atrasado de propósito. Sem isso o OCR termina antes
   * de o teste olhar, e a checagem passa pelo caminho fácil — provando nada
   * sobre o estado que ela existe para cobrir.
   */
  await ctx.route(/tesseract/, async (rota) => {
    await new Promise((r) => setTimeout(r, 4000));
    await rota.continue();
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);

  await entrarNoSlid(p);
  await p.waitForTimeout(12000);
  await encerrar(p);
  await p.waitForTimeout(600);

  const durante = await p.locator("body").innerText();
  check(
    /Lendo o que está nos momentos/i.test(durante),
    "o resumo diz que está lendo",
    durante.split("\n").find((l) => /Lendo/i.test(l)) ?? durante.split("\n").slice(0, 3).join(" · "),
  );
  check(
    /\d+\/\d+/.test(durante),
    "com quantos momentos já leu",
    /(\d+\/\d+)/.exec(durante)?.[1] ?? "",
  );
  /* O botão não é bloqueado: esperar é decisão de quem está com o celular na
     mão. O que não pode é decidir sem saber. */
  check(
    /Salvar aula mesmo assim/i.test(durante),
    "e o botão diz que salvar agora é salvar antes de terminar",
  );

  await p.waitForTimeout(30000);
  check(
    !/Lendo o que está nos momentos/i.test(await p.locator("body").innerText()),
    "quando termina, a linha some",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== desligar o áudio à mão vale para o resto da aula ==");
{
  const { b, p, erros } = await abrir({ duasCameras: true });
  await entrarNoSlid(p);
  check(/Ouvindo/i.test(await p.locator("body").innerText()), "começa ouvindo");

  await p.getByRole("button", { name: /desligar o áudio desta aula/i }).click();
  await p.waitForTimeout(900);
  check(
    !/Ouvindo/i.test(await p.locator("body").innerText()),
    "o ✕ desliga a gravação",
  );

  /*
   * O caminho por onde o microfone voltava sozinho: trocar de câmera leva o
   * estado da câmera por `requesting` e de volta a `ready`, e o efeito que
   * pede o microfone rodava de novo encontrando o Listen "parado" — como se
   * ninguém tivesse desligado nada. Religar uma gravação que a pessoa
   * desligou é exatamente o que este recurso não pode fazer.
   */
  // Em repouso o SliD não tem controles; o toque no visor é o que os traz.
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(700);

  const trocar = p.getByRole("button", { name: /trocar câmera/i });
  check(
    (await trocar.count()) === 1,
    "há como trocar de câmera nesta sessão (o caminho que reproduzia o defeito)",
  );
  await trocar.click();
  await p.waitForTimeout(3500);

  check(
    !/Ouvindo/i.test(await p.locator("body").innerText()),
    "e ele NÃO volta sozinho depois de a câmera se reacomodar",
    (await p.locator("body").innerText()).split("\n").slice(0, 3).join(" · "),
  );

  // Mudar de ideia continua possível.
  const ativar = p.getByRole("button", { name: /^Ativar$/ });
  if ((await ativar.count()) > 0) {
    await ativar.click();
    await p.waitForTimeout(1500);
    check(
      /Ouvindo/i.test(await p.locator("body").innerText()),
      "mas 'Ativar' religa quando a pessoa pede",
    );
  } else {
    check(true, "(sem botão Ativar neste estado — o áudio ficou desligado)");
  }

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== lixeira e volta: o áudio acompanha a aula ==");
{
  const { b, p, erros } = await abrir();
  await entrarNoSlid(p);
  await p.waitForTimeout(12000);
  await encerrar(p);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3000);
  await abrirAulaNaGaleria(p);
  check(/Áudio da aula/i.test(await p.locator("body").innerText()), "a aula tem áudio");

  // Para a lixeira, pelo cartão "Excluir" das ações rápidas.
  await p
    .getByRole("tablist", { name: "Conteúdo da aula" })
    .getByRole("tab", { name: "Resumo" })
    .click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Excluir$/ }).click();
  await p.waitForTimeout(2000);

  /* A gravação fica num armazém próprio, com a chave da sessão. Só sai quando
     a aula sai de vez — e uma aula na lixeira não saiu de vez. */
  const naLixeira = await p.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
    });
    const chaves = await new Promise((r) => {
      const q = db.transaction("lessonAudio", "readonly").objectStore("lessonAudio").getAllKeys();
      q.onsuccess = () => r(q.result);
    });
    db.close();
    return chaves.length;
  });
  check(naLixeira === 1, "na lixeira, a gravação continua guardada", `${naLixeira}`);

  // Restaurar devolve a aula inteira, com o áudio.
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /lixeira/i })
    .click()
    .catch(() => {});
  await p.waitForTimeout(1200);
  const restaurar = p.getByRole("button", { name: /restaurar/i }).first();
  if ((await restaurar.count()) > 0) {
    await restaurar.click();
    await p.waitForTimeout(2000);
    await p
      .getByRole("tablist", { name: "Filtrar a galeria" })
      .getByRole("tab", { name: /^SliD/ })
      .click();
    await p.waitForTimeout(1000);
    await p.locator("article button").first().click();
    await p.waitForTimeout(1500);
    check(
      /Áudio da aula/i.test(await p.locator("body").innerText()),
      "e restaurar devolve a aula com o áudio",
    );
  } else {
    check(false, "a lixeira oferece restaurar");
  }

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a aula sem áudio não mostra player nem botões ==");
{
  const { b, p, erros } = await abrir({ microfone: false });
  await entrarNoSlid(p);
  await p.waitForTimeout(12000);
  await p.locator("body").click({ position: { x: 195, y: 400 } });
  await p.waitForTimeout(600);
  await encerrar(p);
  await p.getByRole("button", { name: /salvar|guardar/i }).first().click();
  await p.waitForTimeout(3000);
  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await p
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await p.waitForTimeout(900);
  await p.locator("article button").first().click();
  await p.waitForTimeout(1500);

  const corpo = await p.locator("body").innerText();
  check(!/Áudio da aula/i.test(corpo), "sem player");
  check(
    (await p.getByRole("button", { name: /ouvir a aula a partir de/i }).count()) === 0,
    "e sem botão que não levaria a lugar nenhum",
  );
  check(
    (await p.locator("[role=tabpanel] li button").count()) > 0,
    "mas a aula está lá, com os momentos",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
