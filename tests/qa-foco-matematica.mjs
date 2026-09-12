/* A matemática de "onde o toque cai no quadro real" — sem navegador nenhum.
 *
 * Roda com:
 *
 *     node --experimental-strip-types tests/qa-foco-matematica.mjs
 *
 * A flag existe porque este teste importa `src/camera/focusPoint.ts`
 * **diretamente** — a mesma função que o app usa, não uma cópia. Uma cópia
 * aqui provaria a matemática de um arquivo que ninguém roda; o produto podia
 * divergir e o teste continuar verde. Node 22 sabe descartar os tipos de um
 * TypeScript simples sem precisar do `tsc` nem do Vite no meio, e é só isso
 * que `focusPoint.ts` usa — interfaces e funções tipadas, nada que dependa
 * do DOM.
 *
 * O que se cobra, com as palavras do pedido original: "um toque no centro
 * precisa continuar sendo centro" e "um toque no canto visível precisa
 * mapear para o ponto correto do frame que está sendo mostrado" — não o
 * canto do quadro inteiro, o canto do que a pessoa está vendo depois do
 * corte do `object-cover`.
 */
import { mapearToqueParaFrame } from "../src/camera/focusPoint.ts";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

const perto = (a, b, tol = 0.001) => Math.abs(a - b) <= tol;

// Uma caixa de retrato comum (390×844, como o resto da suíte) e um quadro de
// câmera 4:3 na horizontal (640×480) — o caso do object-cover cortando os
// lados, porque o quadro é "mais largo" (em proporção) do que a caixa alta.
const RETRATO = { left: 0, top: 0, width: 390, height: 844 };
const QUADRO_4_3 = { videoWidth: 640, videoHeight: 480 };

console.log("== o centro da caixa é sempre o centro do quadro ==");
{
  for (const [nome, rect, video] of [
    ["retrato, sem corte especial", RETRATO, QUADRO_4_3],
    ["caixa quadrada, quadro 16:9", { left: 20, top: 40, width: 300, height: 300 }, { videoWidth: 1280, videoHeight: 720 }],
    ["caixa bem larga, quadro alto (retrato nativo)", { left: 0, top: 0, width: 800, height: 200 }, { videoWidth: 480, videoHeight: 640 }],
  ]) {
    const p = mapearToqueParaFrame({
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      rect,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      espelhado: false,
    });
    check(
      p !== null && perto(p.x, 0.5) && perto(p.y, 0.5),
      `${nome}: centro → (0.5, 0.5)`,
      p ? `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})` : "null",
    );
  }
}

console.log("\n== o canto visível cai no canto do que está sendo mostrado, não do quadro inteiro ==");
{
  // Caixa alta (390×844, aspect ≈ 0.462) com quadro 4:3 deitado (640×480,
  // aspect ≈ 1.333): o quadro é mais largo em proporção, então a ALTURA bate
  // cheia e os LADOS são cortados. O canto esquerdo visível não é x=0 do
  // quadro inteiro — é o início da fatia central visível.
  const larguraVisivelFrac = (RETRATO.width / RETRATO.height) / (QUADRO_4_3.videoWidth / QUADRO_4_3.videoHeight);
  const esperado = (1 - larguraVisivelFrac) / 2;

  const canto = mapearToqueParaFrame({
    clientX: RETRATO.left, // extremo esquerdo da caixa
    clientY: RETRATO.top, // extremo superior
    rect: RETRATO,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: false,
  });

  check(
    canto !== null && perto(canto.x, esperado),
    `canto esquerdo visível → x=${esperado.toFixed(3)} do quadro (não 0)`,
    canto ? canto.x.toFixed(3) : "null",
  );
  check(
    canto !== null && perto(canto.y, 0),
    "e o topo, esse sim, bate com y=0 (a altura não é cortada nesta combinação)",
    canto ? canto.y.toFixed(3) : "null",
  );
}

console.log("\n== o espelho da câmera frontal inverte X, e só X ==");
{
  const semEspelho = mapearToqueParaFrame({
    clientX: RETRATO.left + RETRATO.width * 0.2,
    clientY: RETRATO.top + RETRATO.height * 0.7,
    rect: RETRATO,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: false,
  });
  const comEspelho = mapearToqueParaFrame({
    clientX: RETRATO.left + RETRATO.width * 0.2,
    clientY: RETRATO.top + RETRATO.height * 0.7,
    rect: RETRATO,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: true,
  });

  check(
    semEspelho !== null && comEspelho !== null && perto(semEspelho.y, comEspelho.y),
    "Y não muda com o espelho",
  );
  check(
    semEspelho !== null &&
      comEspelho !== null &&
      !perto(semEspelho.x, comEspelho.x) &&
      perto(semEspelho.x + comEspelho.x, 1, 0.05),
    "e X do espelhado é aproximadamente o complemento do normal",
    semEspelho && comEspelho ? `${semEspelho.x.toFixed(3)} vs ${comEspelho.x.toFixed(3)}` : "null",
  );
}

console.log("\n== o zoom digital (escala uniforme na caixa) não muda a fração calculada ==");
{
  /*
   * `Viewfinder` aplica `transform: scale(zoom.digital)` no próprio <video>,
   * e `getBoundingClientRect()` devolve a caixa JÁ escalada — maior, mas
   * ainda centrada no mesmo ponto. Simulamos isso aumentando a caixa 2× ao
   * redor do mesmo centro e conferindo que o toque no "mesmo lugar visual"
   * (proporcionalmente) dá o mesmo ponto do quadro.
   */
  const centroX = RETRATO.left + RETRATO.width / 2;
  const centroY = RETRATO.top + RETRATO.height / 2;
  const fracaoX = 0.3;
  const fracaoY = 0.65;

  const semZoom = mapearToqueParaFrame({
    clientX: RETRATO.left + RETRATO.width * fracaoX,
    clientY: RETRATO.top + RETRATO.height * fracaoY,
    rect: RETRATO,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: false,
  });

  const escala = 2;
  const rectAmpliado = {
    left: centroX - (RETRATO.width * escala) / 2,
    top: centroY - (RETRATO.height * escala) / 2,
    width: RETRATO.width * escala,
    height: RETRATO.height * escala,
  };
  const comZoom = mapearToqueParaFrame({
    clientX: rectAmpliado.left + rectAmpliado.width * fracaoX,
    clientY: rectAmpliado.top + rectAmpliado.height * fracaoY,
    rect: rectAmpliado,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: false,
  });

  check(
    semZoom !== null && comZoom !== null && perto(semZoom.x, comZoom.x) && perto(semZoom.y, comZoom.y),
    "o mesmo ponto proporcional mapeia igual, com ou sem a caixa ampliada",
    semZoom && comZoom
      ? `(${semZoom.x.toFixed(3)},${semZoom.y.toFixed(3)}) vs (${comZoom.x.toFixed(3)},${comZoom.y.toFixed(3)})`
      : "null",
  );
}

console.log("\n== quadro ou caixa sem tamanho: null, nunca uma divisão quebrada ==");
{
  check(
    mapearToqueParaFrame({
      clientX: 10,
      clientY: 10,
      rect: { left: 0, top: 0, width: 0, height: 844 },
      videoWidth: 640,
      videoHeight: 480,
      espelhado: false,
    }) === null,
    "caixa com largura zero → null",
  );
  check(
    mapearToqueParaFrame({
      clientX: 10,
      clientY: 10,
      rect: RETRATO,
      videoWidth: 0,
      videoHeight: 0,
      espelhado: false,
    }) === null,
    "quadro ainda sem metadados (0×0) → null",
  );
}

console.log("\n== toque fora da caixa é grudado na borda, não extrapolado ==");
{
  const foraDireita = mapearToqueParaFrame({
    clientX: RETRATO.left + RETRATO.width + 500,
    clientY: RETRATO.top + RETRATO.height / 2,
    rect: RETRATO,
    videoWidth: QUADRO_4_3.videoWidth,
    videoHeight: QUADRO_4_3.videoHeight,
    espelhado: false,
  });
  check(
    foraDireita !== null && foraDireita.x <= 1 && foraDireita.x >= 0,
    "um toque bem à direita da caixa ainda cai dentro de [0,1]",
    foraDireita ? foraDireita.x.toFixed(3) : "null",
  );
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
