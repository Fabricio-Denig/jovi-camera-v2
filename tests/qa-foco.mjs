/* A auditoria de foco: o que a câmera consegue dizer, e o que ela realmente faz.
 *
 * O achado do teste real em 12/set foi: o app passou vários slides na frente
 * da câmera e nenhum virou momento — e visualmente a imagem parecia sem
 * foco, do jeito que uma câmera de celular fica antes de tocar na tela para
 * ela acertar. Esta suíte não mexe no detector (`frameAnalysis.ts`,
 * `useSlidSession.ts` continuam exatamente como estavam); ela verifica a
 * camada de baixo — a aquisição da câmera e o pedido de foco — que é o que
 * precisa estar certo antes de julgar o detector de novo.
 *
 * **O que esta bancada realmente expõe, medido antes de escrever qualquer
 * linha:**
 *
 *     getCapabilities().focusMode        → ["manual", "continuous"]
 *     applyConstraints({focusMode:"continuous"})  → resolve sem erro
 *     getConstraints().focusMode         → "continuous"
 *     getSettings().focusMode            → "manual"   (nunca muda)
 *     "pointsOfInterest" in capabilities  → false
 *
 * A API aceita o pedido de foco contínuo e não faz nada — a mesma forma do
 * achado do `SpeechRecognition` desta sessão. E `pointsOfInterest` (a
 * constraint que tocar-para-focar precisaria) não existe aqui. Por isso boa
 * parte desta suíte usa um dublê que registra as chamadas — para testar a
 * MERGE de constraints e a recomputação por track, que são comportamentos do
 * nosso código, não do navegador — e uma parte roda contra a API real e
 * incompleta desta bancada, como o resto do produto já faz para
 * `SpeechRecognition`.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir({ dublePOI = false, dubleZoom = false, cena } = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      ...(cena ? [`--use-file-for-fake-video-capture=${CENAS}/${cena}`] : []),
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  });

  if (dublePOI || dubleZoom) {
    /*
     * O dublê existe para testar DUAS coisas que são código nosso, não
     * comportamento do navegador: que o merge de `advanced` não apaga um
     * pedido anterior, e que a leitura de `pointsOfInterest` funciona quando
     * a capacidade existe. Ele grava cada chamada em `window.__chamadas` e
     * sempre resolve — não finge que o hardware aceitou de verdade, só
     * captura o que o app pediu.
     */
    await ctx.addInitScript(
      ({ dublePOI, dubleZoom }) => {
        window.__chamadas = [];
        const originalGetCaps = MediaStreamTrack.prototype.getCapabilities;
        MediaStreamTrack.prototype.getCapabilities = function () {
          const real = originalGetCaps ? originalGetCaps.call(this) : {};
          return {
            ...real,
            ...(dubleZoom ? { zoom: { min: 1, max: 4, step: 0.1 } } : {}),
            ...(dublePOI ? { pointsOfInterest: true } : {}),
          };
        };
        MediaStreamTrack.prototype.applyConstraints = function (c) {
          window.__chamadas.push(JSON.parse(JSON.stringify(c ?? {})));
          return Promise.resolve();
        };
      },
      { dublePOI, dubleZoom },
    );
  }

  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  return { b, p, erros };
}

const chamadasComFocus = (p) =>
  p.evaluate(() =>
    (window.__chamadas ?? []).filter((c) =>
      (c.advanced ?? []).some((a) => "focusMode" in a),
    ),
  );

console.log("== capacidade ausente: nenhuma exceção, nenhuma UI falsa ==");
{
  /*
   * Esta bancada, sem dublê nenhum, já É o caso "pointsOfInterest ausente" —
   * medido, não suposto. O que se cobra: a câmera funciona igual, e não
   * existe em lugar nenhum uma interação de "tocar para focar" prometendo um
   * controle que o navegador não tem.
   */
  const { b, p, erros } = await abrir();
  const corpo = await p.locator("body").innerText();
  check(
    corpo.trim().length > 20,
    "a câmera abre normalmente sem pointsOfInterest",
  );
  check(
    !/tocar para focar|toque para focar/i.test(corpo),
    "e não existe promessa de toque-para-focar na tela",
  );
  const anelDeFoco = await p.locator("[aria-label*='foco' i]").count();
  check(anelDeFoco === 0, "nenhum indicador visual de foco fingindo existir");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== contínuo declarado: é pedido, e getSettings() é a prova — não a promise ==");
{
  /*
   * Roda contra a API real desta bancada, sem dublê. `focusMode` inclui
   * "continuous" aqui de verdade — é o achado que abriu esta suíte.
   */
  const { b, p, erros } = await abrir();

  const estado = await p.evaluate(async () => {
    // Espera o preview já estar de pé (a suíte inteira já deu 2.6s de sobra).
    const video = document.querySelector("video");
    return new Promise((resolve) => {
      const tenta = () => {
        const track = video?.srcObject?.getVideoTracks?.()[0];
        if (!track) return setTimeout(tenta, 150);
        resolve({
          constraints: track.getConstraints ? track.getConstraints() : null,
          settings: track.getSettings ? track.getSettings() : null,
          capacidades: track.getCapabilities ? track.getCapabilities() : null,
        });
      };
      tenta();
    });
  });

  check(
    Boolean(estado.capacidades?.focusMode?.includes?.("continuous")),
    "a capacidade declara continuous nesta bancada",
    JSON.stringify(estado.capacidades?.focusMode),
  );
  check(
    estado.constraints?.advanced?.some?.((a) => a.focusMode === "continuous"),
    "o app pediu focusMode:continuous (getConstraints ecoa o pedido)",
    JSON.stringify(estado.constraints),
  );
  check(
    estado.settings?.focusMode === "manual",
    "mas getSettings() prova que o modo não mudou — a promise não é prova",
    JSON.stringify(estado.settings?.focusMode),
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== ?debug=device mostra a mesma verdade: pedido, não confirmado ==");
{
  /*
   * Sem `cena`: passar `--use-file-for-fake-video-capture` troca o dispositivo
   * fake do Chromium para um perfil de capacidades pobre (sem focusMode, sem
   * focusDistance, sem exposureMode/exposureTime) — medido diretamente,
   * comparando `getCapabilities()` com e sem esse argumento. Este bloco só
   * precisa de uma track de câmera viva para ler o relatório, não de uma cena
   * realista; usar `cena` aqui testaria o perfil errado do dispositivo fake,
   * não o código do produto.
   */
  const { b, p, erros } = await abrir();
  await p.goto(APP + "/?debug=device", { waitUntil: "networkidle" });
  await p.waitForTimeout(2800);
  const corpo = await p.locator("body").innerText();
  check(/focusMode declarado[^]*continuous/i.test(corpo), "declara continuous");
  check(
    /Contínuo confirmado \(getSettings\)[^]*não/i.test(corpo),
    "e diz que NÃO está confirmado",
  );
  check(
    /Estado do foco[^]*pedido/i.test(corpo),
    "o estado fica em 'pedido', nunca 'confirmado' sem prova",
  );
  check(
    /pointsOfInterest declarado[^]*não/i.test(corpo),
    "e diz que toque-para-focar não é suportado aqui",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== o merge de constraints: pedir zoom não apaga o pedido de foco ==");
{
  /*
   * O bug que este ciclo existe para não ter: `applyConstraints({advanced:
   * [{zoom}]})` chamado direto substituiria o `advanced` inteiro, apagando o
   * `focusMode` pedido antes. Com `aplicarAvancadas` centralizando os dois,
   * a segunda chamada tem de levar os dois campos juntos.
   */
  const { b, p, erros } = await abrir({ dubleZoom: true });
  // O zoom é pedido ao trocar de nível — o app já pede 1x na entrada.
  // O nome acessível vem do aria-label ("Aproximar 2 vezes"), não do texto "2x".
  await p.getByRole("button", { name: "Aproximar 2 vezes", exact: true }).click();
  await p.waitForTimeout(600);

  const chamadas = await chamadasComFocus(p);
  check(
    chamadas.length > 0,
    `pelo menos uma chamada carregou focusMode (${chamadas.length} do total)`,
  );
  const ultima = chamadas.at(-1);
  const advDaUltima = ultima?.advanced?.[0] ?? {};
  check(
    "focusMode" in advDaUltima && "zoom" in advDaUltima,
    "a chamada de zoom carrega focusMode E zoom no mesmo advanced",
    JSON.stringify(advDaUltima),
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== pointsOfInterest presente: o diagnóstico reconhece, sem prometer mais que isso ==");
{
  /*
   * Esta bancada não tem `pointsOfInterest` de verdade. O dublê a acrescenta
   * só para provar que, no dia em que um aparelho a tiver, o app já sabe
   * ler — sem isso, este caminho nunca seria exercitado por teste nenhum.
   * A matemática de "onde o toque cai no quadro" já está coberta, à parte,
   * em `qa-foco-matematica.mjs` — não duplicada aqui.
   */
  const { b, p, erros } = await abrir({ dublePOI: true });
  await p.goto(APP + "/?debug=device", { waitUntil: "networkidle" });
  await p.waitForTimeout(2800);
  const corpo = await p.locator("body").innerText();
  check(
    /pointsOfInterest declarado[^]*sim/i.test(corpo),
    "com a capacidade presente, o relatório diz que sim",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== trocar de câmera: as capacidades são recalculadas para o track novo ==");
{
  const { b, p, erros } = await abrir({ dubleZoom: true });
  await p.addInitScript(() => {
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
  // O script foi anexado depois do primeiro load; recarrega para valer.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2600);

  const antes = (await chamadasComFocus(p)).length;
  check(antes > 0, `o pedido de foco já aconteceu para a primeira câmera (${antes})`);

  const virar = p.getByRole("button", { name: "Trocar câmera" });
  check((await virar.count()) === 1, "há como trocar de câmera para testar isto");
  await virar.click();
  await p.waitForTimeout(2200);

  const depois = (await chamadasComFocus(p)).length;
  check(
    depois > antes,
    `o pedido de foco foi refeito para o track novo (${antes} → ${depois})`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== a câmera morre e volta: o foco é reaplicado no track de recuperação ==");
{
  /*
   * O mesmo caminho do P0 de "tela preta" do ciclo anterior — a track
   * encerrada pelo sistema, e a volta à aba retomando sozinha. Aqui a
   * pergunta é se o pedido de foco acompanha o track novo, e não fica preso
   * pedindo só para o primeiro que já não existe mais.
   */
  const { b, p, erros } = await abrir({ dubleZoom: true });
  const antes = (await chamadasComFocus(p)).length;
  check(antes > 0, `pedido de foco na primeira track (${antes})`);

  await p.evaluate(() => {
    const video = document.querySelector("video");
    const track = video?.srcObject?.getVideoTracks?.()[0];
    /*
     * `dispatchEvent(new Event("ended"))` sozinho só chama o listener — o
     * `readyState` nativo da track continua "live", porque só `stop()` o
     * muda de verdade. E `stop()` sozinho não dispara o evento "ended" (esse
     * evento é para quando a track morre por fora, não por chamada do app).
     * A recuperação em `useCamera.ts` decide olhando `readyState`, não o
     * evento — por isso os dois são necessários aqui para simular de verdade
     * "a câmera morreu enquanto a aba estava escondida".
     */
    track?.stop();
    track?.dispatchEvent(new Event("ended"));
  });
  await p.waitForTimeout(500);

  // Volta para a aba: dispara o mesmo listener que já existe para retomar a
  // câmera morta.
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(2200);

  const depois = (await chamadasComFocus(p)).length;
  check(
    depois > antes,
    `o pedido de foco foi refeito para o track de recuperação (${antes} → ${depois})`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
