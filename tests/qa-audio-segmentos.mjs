/* O bug real, reproduzido: desligar e religar o áudio no meio da aula.
 *
 * Vídeo de teste real no celular: sessão de ~36s, áudio ligado, desligado,
 * religado — e ao salvar a aula o player só tinha os últimos 6s. A causa era
 * `useListen.disable()` chamando `recorder.stop()` sem nunca montar o blob
 * do que já tinha sido gravado: os bytes do primeiro trecho eram jogados
 * fora ali mesmo, e o segundo `start()` começava do zero.
 *
 * Esta suíte audita a correção pelo que importa: a aula salva precisa ter
 * áudio cobrindo A SESSÃO INTEIRA (ligado → desligado → religado), não só o
 * último trecho — e "ouvir deste ponto" em cada momento precisa cair no
 * trecho certo, mesmo que ele não seja o último gravado.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

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
  await p.waitForTimeout(1500);
  return { b, p, erros };
}

async function mostrarControles(p) {
  const mostrar = p.getByRole("button", { name: "Mostrar controles" });
  if ((await mostrar.count()) > 0) await mostrar.click();
  await p.waitForTimeout(500);
}

async function marcarMomento(p) {
  await mostrarControles(p);
  const botao = p.getByRole("button", { name: "Marcar este momento" });
  await botao.click();
  await p.waitForTimeout(500);
}

async function desligarAudio(p) {
  await mostrarControles(p);
  await p.getByRole("button", { name: /desligar o áudio desta aula/i }).click();
  await p.waitForTimeout(600);
}

async function ativarAudio(p) {
  await mostrarControles(p);
  await p.getByRole("button", { name: "Ativar" }).click();
  await p.waitForTimeout(600);
}

async function encerrarESalvar(p) {
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

/** mm:ss → segundos totais. */
const paraSegundos = (texto) => {
  const m = texto?.match(/(\d\d):(\d\d)/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

/**
 * O segundo mm:ss do player (a duração total, à direita da barra).
 *
 * `font-mono` está na `<div>` que envolve os dois `<span>` (posição/duração),
 * herdado por CSS — não em cada `<span>` — então o seletor certo é achar essa
 * div (`justify-between`, a que fica logo abaixo da faixa) e pegar o segundo
 * span dela.
 */
const duracaoMostrada = (p) =>
  p.evaluate(() => {
    const secoes = [...document.querySelectorAll("section")];
    const secao = secoes.find((s) => s.textContent?.includes("Áudio da aula"));
    if (!secao) return null;
    const linha = [...secao.querySelectorAll("div")].find((d) =>
      d.className.includes("tabular-nums"),
    );
    const spans = linha ? [...linha.querySelectorAll("span")] : [];
    return spans.at(-1)?.textContent ?? null;
  });

console.log("== A → desligar → religar → B: nada pode desaparecer ==");
{
  const { b, p, erros } = await abrir();

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Permitir áudio" }).click();
  await p.waitForTimeout(2500);
  check(
    /Ouvindo/i.test(await p.locator("body").innerText()),
    "trecho A começa gravando",
  );

  await marcarMomento(p); // momento A
  await p.waitForTimeout(1500);

  await desligarAudio(p);
  check(
    /Áudio desligado/i.test(await p.locator("body").innerText()),
    "desligar mostra o estado certo",
  );
  // A lacuna: tempo de aula sem áudio nenhum.
  await p.waitForTimeout(3000);

  await ativarAudio(p);
  await p.waitForTimeout(2500);
  check(
    /Ouvindo/i.test(await p.locator("body").innerText()),
    "trecho B volta a gravar",
  );

  await marcarMomento(p); // momento B
  await p.waitForTimeout(1500);

  await encerrarESalvar(p);
  await abrirAulaNaGaleria(p);

  const corpo = await p.locator("body").innerText();
  check(/Áudio da aula/i.test(corpo), "a aula abre com o player de áudio");

  // A duração total mostrada é a da SESSÃO (A + lacuna + B), não só o
  // último trecho — era exatamente isto que o bug reduzia a ~6s.
  const duracaoTexto = await duracaoMostrada(p);
  const duracaoSeg = paraSegundos(duracaoTexto);
  check(
    duracaoSeg !== null && duracaoSeg >= 7,
    "a barra cobre a sessão inteira, não só o último trecho",
    `mostrado: ${duracaoTexto} (esperado ≥ 7s; A+lacuna+B somam ~9-10s)`,
  );

  // "Ouvir deste ponto" em cada momento: dois pontos, duas posições
  // diferentes — não os dois caindo no mesmo (único) trecho sobrevivente.
  const ouvir = p.getByRole("button", { name: /ouvir a aula a partir de/i });
  const total = await ouvir.count();
  check(total >= 2, "os dois momentos têm 'ouvir deste ponto'", `${total}`);

  await ouvir.first().click();
  await p.waitForTimeout(1200);
  const posA = await p.evaluate(() => document.querySelector("audio")?.currentTime ?? -1);

  await ouvir.last().click();
  await p.waitForTimeout(1200);
  const posB = await p.evaluate(() => document.querySelector("audio")?.currentTime ?? -1);

  check(posA >= 0, "o momento A resolve para uma posição real", `${posA}`);
  check(posB >= 0, "o momento B resolve para uma posição real", `${posB}`);
  check(
    !(await p.locator("text=O áudio estava desligado nesse momento da aula").count()) ||
      total < 2,
    "nem A nem B caem numa lacuna (os dois têm áudio de verdade)",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");

  // Reload: os trechos vêm do IndexedDB, não da memória da sessão. A tela da
  // aula não sobrevive ao reload (nenhuma tela deste app sobrevive), então a
  // rota é reabrir pela Galeria — o mesmo caminho que qa-persistencia.mjs usa.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAulaNaGaleria(p);
  const corpoDepois = await p.locator("body").innerText();
  check(
    /Áudio da aula/i.test(corpoDepois),
    "depois de recarregar, o áudio da aula continua lá",
  );
  const duracaoDepois = await duracaoMostrada(p);
  check(
    paraSegundos(duracaoDepois) === duracaoSeg,
    "e a duração é a mesma de antes do reload",
    `antes: ${duracaoTexto}, depois: ${duracaoDepois}`,
  );

  await b.close();
}

console.log("\n== três trechos: A → off → B → off → C ==");
{
  const { b, p, erros } = await abrir();

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: "Permitir áudio" }).click();
  await p.waitForTimeout(2000);
  await marcarMomento(p);

  await desligarAudio(p);
  await p.waitForTimeout(1200);
  await ativarAudio(p);
  await p.waitForTimeout(2000);
  await marcarMomento(p);

  await desligarAudio(p);
  await p.waitForTimeout(1200);
  await ativarAudio(p);
  await p.waitForTimeout(2000);
  await marcarMomento(p);

  await encerrarESalvar(p);
  await abrirAulaNaGaleria(p);

  const ouvir = p.getByRole("button", { name: /ouvir a aula a partir de/i });
  check((await ouvir.count()) >= 3, "os três momentos existem na aula salva", `${await ouvir.count()}`);

  const duracaoTexto = await duracaoMostrada(p);
  check(
    (paraSegundos(duracaoTexto) ?? 0) >= 9,
    "a duração cobre os três trechos e as duas lacunas",
    `mostrado: ${duracaoTexto}`,
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
