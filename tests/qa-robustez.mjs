/* Os caminhos ruins.

   A regra desta reta final é que nenhum elemento visível seja cenográfico. A
   consequência menos óbvia dessa regra é esta: quando uma capacidade falta, a
   tela tem de **dizer** — nunca ficar preta, nunca girar para sempre, nunca
   deixar um botão que não faz nada.

   Cada bloco aqui derruba uma capacidade de propósito e pergunta o que a tela
   faz com isso. */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { APP, CENAS, CHROMIUM } from "./caminhos.mjs";
import { abrirAula, semearAula } from "./semear-aula.mjs";

let fail = 0;
const check = (ok, l, e = "") => {
  console.log(`${ok ? "[ok]  " : "[FAIL]"} ${l}${e ? " — " + e : ""}`);
  if (!ok) fail++;
};

async function abrir({
  quebrar,
  camera = true,
  cena = "cor-mesa-de-estudo.y4m",
  largura = 390,
  altura = 844,
} = {}) {
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      camera ? "--use-fake-ui-for-media-stream" : "--deny-permission-prompts",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/${cena}`,
    ],
  });
  const p = await (
    await b.newContext({
      viewport: { width: largura, height: altura },
      isMobile: true,
      hasTouch: true,
      permissions: camera ? ["camera", "microphone"] : [],
    })
  ).newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  if (quebrar) await p.addInitScript(quebrar);
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2600);
  return { b, p, erros };
}

console.log("== câmera negada ==");
{
  const { b, p, erros } = await abrir({
    camera: false,
    quebrar: () => {
      navigator.mediaDevices.getUserMedia = () => {
        const e = new Error("Permission denied");
        e.name = "NotAllowedError";
        return Promise.reject(e);
      };
    },
  });
  const corpo = await p.locator("body").innerText();
  check(corpo.trim().length > 20, "a tela não fica vazia", corpo.split("\n")[0]);
  check(
    /permiss|câmera|camera|acesso/i.test(corpo),
    "e explica que a câmera não foi liberada",
    corpo.split("\n").slice(0, 2).join(" · "),
  );
  check(
    (await p.getByRole("button").count()) > 0,
    "com pelo menos um caminho para a frente",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== IndexedDB recusado ==");
{
  const { b, p, erros } = await abrir({
    quebrar: () => {
      // Janela anônima em alguns navegadores, e dados de site bloqueados: o
      // `open` devolve uma requisição que dispara `error`.
      indexedDB.open = () => {
        const req = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          error: new DOMException("bloqueado", "SecurityError"),
        };
        setTimeout(() => req.onerror && req.onerror({ target: req }), 0);
        return req;
      };
    },
  });

  check(
    (await p.locator("video").count()) === 1,
    "a câmera continua inteira — o que falhou foi guardar",
  );

  await p.getByRole("button", { name: "Galeria", exact: true }).click();
  await p.waitForTimeout(2000);
  const corpo = await p.locator("body").innerText();
  check(
    !/Carregando…/.test(corpo),
    "a galeria não fica em 'Carregando…' para sempre",
    corpo.split("\n").slice(0, 3).join(" · "),
  );
  check(
    /não deixou abrir o armazenamento|não consegui abrir o armazenamento/i.test(corpo),
    "ela diz o que aconteceu",
  );
  check(
    /anônima|bloqueados|configurações/i.test(corpo),
    "e o motivo mais provável",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== espaço acabou ==");
{
  const { b, p, erros } = await abrir({
    quebrar: () => {
      /* O navegador recusando por cota. É o caso real de uma aula de uma hora
         com áudio, ou de um time-lapse longo — e a resposta a ele é diferente
         de todos os outros erros: há o que fazer. */
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const req = original.apply(this, args);
        setTimeout(() => {
          const e = new DOMException("cheio", "QuotaExceededError");
          Object.defineProperty(this.transaction, "error", { value: e, configurable: true });
          this.transaction.onerror?.({ target: this.transaction });
        }, 0);
        return req;
      };
    },
  });

  await p.getByRole("button", { name: /Tirar foto/i }).first().click();
  await p.waitForTimeout(2500);
  const corpo = await p.locator("body").innerText();
  check(
    /espaço.*acabou|sem espaço/i.test(corpo),
    "a tela diz que o espaço acabou",
    corpo.split("\n").find((l) => /espaço/i.test(l)) ?? corpo.split("\n").slice(-3).join(" · "),
  );
  check(
    /Apague|Galeria/i.test(corpo),
    "e diz o que fazer — é a diferença entre um beco e uma instrução",
  );
  check((await p.locator("video").count()) === 1, "e a câmera continua viva");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== área de transferência negada ==");
{
  const b = await chromium.launch({
    executablePath: CHROMIUM,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CENAS}/cor-mesa-de-estudo.y4m`,
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
  await p.addInitScript(() => {
    // As duas portas fechadas: a moderna e a de trás.
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.execCommand = () => false;
  });
  await p.goto(APP + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2400);
  await semearAula(p);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await abrirAula(p);
  await p
    .getByRole("tablist", { name: "Conteúdo da aula" })
    .getByRole("tab", { name: "Texto" })
    .click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: /^Copiar texto/ }).click();
  await p.waitForTimeout(800);

  const painel = await p.locator("[role=tabpanel]").innerText();
  check(!/copiado/i.test(painel), "o botão NÃO diz que copiou");
  check(
    /não deu para copiar/i.test(painel),
    "ele diz que não deu",
    painel.split("\n").filter((l) => /copiar/i.test(l)).join(" · "),
  );
  check(
    /selecionar à mão/i.test(painel),
    "e diz o que dá para fazer no lugar",
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== uma câmera só: o botão de virar não aparece ==");
{
  const { b, p, erros } = await abrir();
  // A câmera falsa do Chromium expõe um dispositivo só, que é o caso real de
  // muito notebook — e o app, corretamente, esconde o botão.
  const virar = await p.getByRole("button", { name: /trocar câmera|virar/i }).count();
  check(virar === 0, "sem botão de virar onde não há para onde virar", `${virar}`);
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== deitado ==");
{
  const { b, p, erros } = await abrir({ largura: 844, altura: 390 });
  const g = await p.evaluate(() => {
    const l = document.documentElement.clientWidth;
    const h = document.documentElement.clientHeight;
    const nav = [...document.querySelectorAll("nav a, nav button")];
    return {
      rolagemLateral: document.documentElement.scrollWidth > l + 0.5,
      rolagemVertical: document.documentElement.scrollHeight > h + 1,
      temVideo: !!document.querySelector("video"),
      navVisivel: nav.every((n) => n.getBoundingClientRect().bottom <= h + 0.5),
    };
  });
  check(g.temVideo, "a câmera abre deitada");
  check(!g.rolagemLateral, "sem rolagem lateral");
  check(!g.rolagemVertical, "sem rolagem vertical — a tela é a tela");
  check(g.navVisivel, "e a navegação continua na tela");
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log("\n== tela pequena (320 px) ==");
{
  const { b, p, erros } = await abrir({ largura: 320, altura: 568 });
  const g = await p.evaluate(() => {
    const l = document.documentElement.clientWidth;
    const alvos = [...document.querySelectorAll("button")].filter(
      (x) => x.getBoundingClientRect().width > 0,
    );

    /*
     * Estar fora da tela dentro de uma lista que rola não é vazar — é o
     * comportamento da lista. A tira de filtros tem sete miniaturas e nunca
     * coube inteira em 320 px; o que importa é que dá para chegar nelas.
     *
     * A primeira versão deste teste não separava as duas coisas e reprovava a
     * tira funcionando corretamente.
     */
    const dentroDeRolagem = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        if (n.scrollWidth > n.clientWidth + 1) return true;
      }
      return false;
    };

    const presos = alvos.filter(
      (x) => x.getBoundingClientRect().right > l + 1 && !dentroDeRolagem(x),
    );
    const pequenos = alvos.filter((x) => {
      const r = x.getBoundingClientRect();
      return r.height < 32 && r.width < 32;
    });
    return {
      rolagemLateral: document.documentElement.scrollWidth > l + 0.5,
      vazando: presos.length,
      nomes: presos.map((x) => (x.getAttribute("aria-label") || x.innerText).slice(0, 22)),
      pequenos: pequenos.length,
      total: alvos.length,
    };
  });
  check(!g.rolagemLateral, "sem rolagem lateral a 320 px");
  check(
    g.vazando === 0,
    "nenhum botão fica inalcançável fora da tela",
    g.nomes.join(", ") || `0 de ${g.total}`,
  );
  check(
    g.pequenos === 0,
    "e nenhum alvo de toque abaixo de 32 px",
    `${g.pequenos} de ${g.total}`,
  );
  check(erros.length === 0, "sem erro de runtime", erros[0] ?? "");
  await b.close();
}

console.log(fail === 0 ? "\nTUDO CERTO" : `\n${fail} FALHA(S)`);
process.exit(fail === 0 ? 0 : 1);
