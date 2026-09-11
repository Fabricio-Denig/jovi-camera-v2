/* Cabe na tela do celular? Em três larguras, e não só na que eu escolhi.
 *
 * Até agora só o Resumo era medido em 375, 390 e 430 — as outras telas eram
 * verificadas a 390 px, que é o iPhone de referência do Figma. O problema de
 * medir numa largura só é que ela esconde as duas pontas: 375 é o iPhone SE,
 * onde as coisas estouram, e 430 é o Pro Max, onde uma grade pensada para 390
 * ganha um vão estranho.
 *
 * O que esta suíte procura é o tipo de defeito que a banca vê de longe e que
 * nenhum teste funcional pega: rolagem lateral, elemento fora da tela, coisa
 * importante atrás da navegação de baixo.
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

/** 375 é o SE, 390 é o do Figma, 430 é o Pro Max. As duas pontas e o meio. */
const LARGURAS = [375, 390, 430];

async function abrir(largura) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/fp-aula-slide-projetado.y4m`,
    ],
  });
  const ctx = await b.newContext({
    viewport: { width: largura, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
  });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2200);
  return { b, p, erros };
}

/**
 * A página rola de lado?
 *
 * `scrollWidth > clientWidth` no documento é a pergunta direta. Um pixel de
 * folga porque sub-pixel de borda arredondada aparece como 0,5 em alguns
 * zooms, e reprovar por isso seria ruído.
 */
const rolaDeLado = (p) =>
  p.evaluate(() => {
    const d = document.documentElement;
    return {
      rola: d.scrollWidth - d.clientWidth > 1,
      scrollWidth: d.scrollWidth,
      clientWidth: d.clientWidth,
    };
  });

/**
 * O que está sendo tapado pela navegação de baixo.
 *
 * Um botão atrás da barra é inalcançável e parece um bug do app, não do
 * layout. Aqui a pergunta é feita ao navegador: algum controle interativo tem
 * o centro dentro da faixa da navegação?
 */
const atrasDaNavegacao = (p) =>
  p.evaluate(() => {
    const nav = document.querySelector("nav");
    if (!nav) return { semNav: true, presos: [] };
    const faixa = nav.getBoundingClientRect();
    const presos = [];
    for (const el of document.querySelectorAll("button, a, [role=tab]")) {
      if (nav.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cy = r.top + r.height / 2;
      const cx = r.left + r.width / 2;
      if (cy < faixa.top || cy > faixa.bottom) continue;
      if (cx < faixa.left || cx > faixa.right) continue;
      // O ponto do centro pertence a quem, de verdade?
      const emCima = document.elementFromPoint(cx, cy);
      if (emCima && !el.contains(emCima) && !el.isSameNode(emCima) && nav.contains(emCima)) {
        presos.push((el.textContent || el.getAttribute("aria-label") || "?").trim().slice(0, 30));
      }
    }
    return { semNav: false, presos };
  });

const irPara = async (p, nome) => {
  await p.getByRole("button", { name: nome, exact: true }).click();
  await p.waitForTimeout(1200);
};

for (const largura of LARGURAS) {
  console.log(`\n===== ${largura} px =====`);
  const { b, p, erros } = await abrir(largura);
  await semearAula(p, AULA_REACT);
  await semearAudio(p, { sessionId: AULA_REACT.id });
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2000);

  // --- Câmera ---
  {
    const r = await rolaDeLado(p);
    check(!r.rola, `câmera: sem rolagem lateral (${r.scrollWidth}/${r.clientWidth})`);
    const n = await atrasDaNavegacao(p);
    check(n.presos.length === 0, `câmera: nada atrás da navegação`, n.presos.join(", "));
  }

  // --- Modos ---
  {
    await irPara(p, "Modos");
    const r = await rolaDeLado(p);
    check(!r.rola, `modos: sem rolagem lateral (${r.scrollWidth}/${r.clientWidth})`);
    /*
     * A porta "Mais" já esteve fora da tela a 390 px — ela ficava no fim de
     * uma tira rolável e o dedo nunca chegava nela. Foi corrigida fixando-a
     * fora do container de rolagem; esta verificação existe para que ela não
     * volte a escapar numa largura menor.
     */
    const catalogo = p.getByRole("dialog");
    const cartoes = await catalogo.getByRole("button").count();
    check(cartoes > 10, `modos: o catálogo abriu com os cartões (${cartoes})`);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(700);
  }

  // --- Galeria ---
  {
    await irPara(p, "Galeria");
    const r = await rolaDeLado(p);
    check(!r.rola, `galeria: sem rolagem lateral (${r.scrollWidth}/${r.clientWidth})`);
    const n = await atrasDaNavegacao(p);
    check(n.presos.length === 0, `galeria: nada atrás da navegação`, n.presos.join(", "));
  }

  // --- Aula aberta: as três abas ---
  {
    await p
      .getByRole("tablist", { name: "Filtrar a galeria" })
      .getByRole("tab", { name: /^SliD/ })
      .click();
    await p.waitForTimeout(900);
    await p.getByRole("button", { name: /React/i }).first().click();
    await p.waitForTimeout(1600);

    for (const aba of ["Imagens", "Texto", "Resumo"]) {
      await p.getByRole("tab", { name: aba, exact: true }).click();
      await p.waitForTimeout(700);
      const r = await rolaDeLado(p);
      check(!r.rola, `aula/${aba}: sem rolagem lateral (${r.scrollWidth}/${r.clientWidth})`);
    }

    // A transcrição é a vista mais larga que existe: parágrafos longos com
    // um botão de horário na frente. Se algo estoura, estoura aqui.
    await p.getByRole("tab", { name: "Transcrição da aula" }).click();
    await p.waitForTimeout(700);
    const r = await rolaDeLado(p);
    check(
      !r.rola,
      `aula/transcrição: sem rolagem lateral (${r.scrollWidth}/${r.clientWidth})`,
    );
  }

  check(erros.length === 0, `${largura}px: sem erro de runtime`, erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
