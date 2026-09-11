/* Acessibilidade, nas coisas que dá para verificar mecanicamente.

   Não é uma auditoria completa — contraste percebido e ordem de leitura pedem
   olho humano. O que dá para automatizar é o que mais quebra na prática: botão
   sem nome, alvo pequeno demais para um dedo, e imagem decorativa que o leitor
   de tela anuncia como se fosse conteúdo. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { abrirAula, semearAula } from "./semear-aula.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir(cena = "fp-aula-slide-projetado.y4m") {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      permissions: ["camera", "microphone"],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  return { b, p, erros };
}

/**
 * O que um leitor de tela anunciaria para cada controle visível.
 *
 * A conta segue a mesma ordem que o navegador segue: `aria-label`, depois
 * `aria-labelledby`, depois o texto de dentro, depois `title`. Um controle que
 * não produz nada em nenhum desses é um botão que o leitor de tela anuncia
 * como "botão" e mais nada.
 */
const auditar = (p) =>
  p.evaluate(() => {
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
    };
    const nome = (el) => {
      const aria = el.getAttribute("aria-label");
      if (aria?.trim()) return aria.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const alvo = document.getElementById(by);
        if (alvo?.innerText.trim()) return alvo.innerText.trim();
      }
      if (el.innerText?.trim()) return el.innerText.trim();
      if (el.getAttribute("title")?.trim()) return el.getAttribute("title").trim();
      return "";
    };

    const controles = [
      ...document.querySelectorAll(
        "button, a[href], input, select, textarea, [role=button], [role=tab], [role=radio], [role=slider]",
      ),
    ].filter(visivel);

    const semNome = controles
      .filter((el) => !nome(el))
      .map((el) => el.outerHTML.slice(0, 70));

    const pequenos = controles
      .filter((el) => {
        const r = el.getBoundingClientRect();
        // 32 px é o mínimo que este projeto aceita; 44 é a recomendação, e
        // vários controles de canto ficam entre os dois de propósito.
        return r.height < 32 && r.width < 32;
      })
      .map((el) => `${nome(el) || "?"} (${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)})`);

    // Imagem decorativa precisa de alt vazio; imagem de conteúdo precisa de alt.
    const imagensSemAlt = [...document.querySelectorAll("img")]
      .filter(visivel)
      .filter((i) => i.getAttribute("alt") === null)
      .map((i) => i.src.slice(0, 40));

    // Um `<h1>` por tela, e nenhum salto de nível para trás.
    const niveis = [...document.querySelectorAll("h1,h2,h3,h4")]
      .filter(visivel)
      .map((h) => Number(h.tagName[1]));
    let salto = null;
    for (let i = 1; i < niveis.length; i++) {
      if (niveis[i] - niveis[i - 1] > 1) salto = `h${niveis[i - 1]} → h${niveis[i]}`;
    }

    return {
      total: controles.length,
      semNome,
      pequenos,
      imagensSemAlt,
      niveis,
      salto,
    };
  });

async function tela(nome, p) {
  const a = await auditar(p);
  console.log(`\n── ${nome} (${a.total} controles) ──`);
  check(a.semNome.length === 0, "todo controle tem nome acessível", a.semNome.join(" | "));
  check(a.pequenos.length === 0, "nenhum alvo abaixo de 32 px", a.pequenos.join(" | "));
  check(
    a.imagensSemAlt.length === 0,
    "toda imagem declara alt (vazio quando é decorativa)",
    a.imagensSemAlt.join(" | "),
  );
  check(a.salto === null, "sem salto de nível entre cabeçalhos", a.salto ?? "");
  return a;
}

{
  const { b, p, erros } = await abrir();
  await tela("Câmera", p);

  await p.getByRole("button", { name: /abrir todos os filtros/i }).click();
  await p.waitForTimeout(900);
  await tela("Filtros", p);
  await p.getByRole("button", { name: "Fechar painel" }).click();
  await p.waitForTimeout(500);

  await p.getByRole("button", { name: "Modos", exact: true }).click();
  await p.waitForTimeout(900);
  await tela("Modos", p);
  await p.getByRole("button", { name: "Fechar painel" }).click();
  await p.waitForTimeout(500);

  await p.getByRole("button", { name: "SliD", exact: true }).click();
  await p.waitForTimeout(4000);
  await tela("SliD ativo", p);

  /*
   * O estado da sessão e o do áudio são o que alguém que apoiou o celular
   * precisa saber sem olhar — e eram exatamente os dois que mudavam em
   * silêncio para um leitor de tela.
   */
  const anunciados = await p.evaluate(() =>
    [...document.querySelectorAll("[aria-live]")].map((x) =>
      x.innerText.replace(/\n/g, " ").slice(0, 44),
    ),
  );
  check(
    anunciados.some((t) => /Acompanhando|Procurando|Pausado/i.test(t)),
    "o estado da sessão é anunciado quando muda",
    anunciados.join(" | "),
  );
  check(
    anunciados.some((t) => /Ouvindo|Áudio/i.test(t)),
    "e o do áudio também",
  );

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

{
  const { b, p, erros } = await abrir("cor-mesa-de-estudo.y4m");
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(1200);
  await tela("Galeria", p);

  await abrirAula(p);
  await tela("Aula — Imagens", p);

  await p
    .getByRole("tablist", { name: "Conteúdo da aula" })
    .getByRole("tab", { name: "Resumo" })
    .click();
  await p.waitForTimeout(600);
  await tela("Aula — Resumo", p);

  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
