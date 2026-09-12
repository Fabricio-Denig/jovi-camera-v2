/* Os dezesseis modos, um por um. Nenhum pode ser botão morto.
 *
 * O `qa-modos` já verifica a estrutura do catálogo e testa **um** simulado —
 * a Panorâmica — como amostra. Amostra prova sobre a amostra. A regra do
 * produto é sobre todos:
 *
 *   Todo elemento visível deve fazer alguma coisa real.
 *
 * Para um modo, "alguma coisa real" tem duas formas aceitáveis e uma
 * inaceitável. Aceitável: a câmera entra no modo e ele funciona; ou o modo diz
 * o que é, para que serve, quais controles teria no aparelho, e oferece volta.
 * Inaceitável: o toque leva a uma tela que não fala do modo, ou a lugar nenhum.
 *
 * Esta suíte percorre os dezesseis e cobra isso de cada um.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

/**
 * Os dezesseis, com a palavra que a tela precisa dizer sobre cada um.
 *
 * A palavra não é o rótulo inteiro de propósito: "Visualização dupla" pode
 * aparecer quebrado em duas linhas, e "Alta Resolução" com maiúscula diferente.
 * O que se cobra é que a tela fale **daquele** modo, não de outro.
 */
const MODOS = [
  ["Foto", /foto/i, "real"],
  ["Vídeo", /v[íi]deo/i, "real"],
  ["SliD", /slid|aula/i, "real"],
  ["Retrato", /retrato/i, "simulado"],
  ["Noite", /noite|noturno/i, "real"],
  ["Comida", /comida|prato/i, "real"],
  ["Microfilme", /microfilme/i, "simulado"],
  ["Câmera lenta", /lenta/i, "simulado"],
  ["Intervalo", /intervalo|lapse/i, "real"],
  ["Panorâmica", /panor/i, "simulado"],
  ["Profissional", /profissional|pro\b/i, "simulado"],
  ["Alta Resolução", /alta resolu/i, "simulado"],
  ["Superlua", /superlua|lua/i, "simulado"],
  ["Visualização dupla", /dupla/i, "simulado"],
  ["Instantâneo", /instant/i, "real"],
  ["Scanner", /scanner|documento|folha/i, "real"],
];

async function abrir() {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/doc-folha-na-mesa.y4m`,
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
  await p.waitForTimeout(2200);
  return { b, p, erros };
}

console.log("== os dezesseis modos, um por um ==");
{
  const { b, p, erros } = await abrir();
  const linhas = [];

  for (const [nome, fala, tipo] of MODOS) {
    await p.getByRole("button", { name: "Modos", exact: true }).click();
    await p.waitForTimeout(800);

    const card = p
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp("^" + nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })
      .first();
    const existe = (await card.count()) > 0;
    if (!existe) {
      check(false, `${nome}: existe no catálogo`);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(500);
      continue;
    }

    await card.click();
    await p.waitForTimeout(2200);

    const corpo = await p.evaluate(() => document.body.innerText);
    const temPrevia = /pr[ée]via/i.test(corpo);
    const falaDele = fala.test(corpo);
    /* O modo em uso tem de se anunciar na barra — é como a pessoa sabe onde
       está depois de o catálogo fechar. */
    const emUso = await p.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.getAttribute("aria-current") === "true",
      );
      return b ? b.innerText.trim().split("\n")[0] : "";
    });

    linhas.push({ nome, tipo, temPrevia, falaDele, emUso });

    /*
     * Para Foto, Vídeo e SliD a barra de modos mostra os três nomes ao mesmo
     * tempo — então "a tela fala deste modo" passaria por acaso, sem provar
     * nada. A verificação que não é vácua é outra: o modo em uso se anuncia
     * com `aria-current`, e é assim que a pessoa sabe onde está depois de o
     * catálogo fechar.
     */
    if (tipo === "real") {
      check(
        emUso.toLowerCase().startsWith(nome.toLowerCase().slice(0, 5)),
        `${nome}: a barra anuncia o modo em uso`,
        `aria-current = "${emUso}"`,
      );
    } else {
      check(falaDele, `${nome}: a tela fala deste modo`, corpo.slice(0, 70).replace(/\n/g, " · "));
    }
    check(
      !/undefined|NaN|\[object/.test(corpo),
      `${nome}: sem texto quebrado`,
    );
    if (tipo === "simulado") {
      check(temPrevia, `${nome}: assume que é prévia em vez de fingir`);
      /*
       * A saída do cartão de prévia é obrigatória. Um modo explicativo sem
       * volta é exatamente o "modal impossível de fechar" da lista de P0 —
       * e num modo que não captura, ficar preso nele é ficar preso no app.
       */
      const volta = p.getByRole("button", { name: /voltar|foto|entendi|fechar/i });
      check((await volta.count()) > 0, `${nome}: oferece caminho de volta`);
    } else {
      check(!temPrevia, `${nome}: não se anuncia como prévia`);
    }

    // Volta para Foto para o próximo começar do mesmo lugar.
    await p.getByRole("button", { name: "Modos", exact: true }).click();
    await p.waitForTimeout(700);
    await p.getByRole("dialog").getByRole("button", { name: /^Foto/ }).first().click();
    await p.waitForTimeout(1200);
    // Sair do SliD com momentos abre o resumo; descartar para seguir limpo.
    const descartar = p.getByRole("button", { name: /descartar/i });
    if ((await descartar.count()) > 0) {
      await descartar.first().click();
      await p.waitForTimeout(800);
      const confirmar = p.getByRole("button", { name: /descartar|sim|confirmar/i });
      if ((await confirmar.count()) > 0) {
        await confirmar.last().click();
        await p.waitForTimeout(1000);
      }
    }
  }

  console.log("\n  quadro final:");
  console.log("  modo                   tipo       prévia?  fala dele?  em uso");
  for (const l of linhas) {
    console.log(
      `  ${l.nome.padEnd(22)} ${l.tipo.padEnd(10)} ${(l.temPrevia ? "sim" : "não").padEnd(8)} ${(l.falaDele ? "sim" : "NÃO").padEnd(11)} ${l.emUso}`,
    );
  }

  check(linhas.length === 16, `os dezesseis foram percorridos (${linhas.length})`);
  check(erros.length === 0, "sem erro de runtime em nenhum deles", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
