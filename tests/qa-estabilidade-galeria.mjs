/**
 * O fluxo que travou no celular: salvar a aula e usar o app enquanto ela é
 * transcrita.
 *
 * **O relato.** Uma gravação de ~68 segundos foi salva, a Galeria foi aberta
 * logo em seguida, e o site travou — foi preciso fechar e abrir de novo. A
 * transcrição terminou minutos depois. Dois sintomas, duas causas possíveis
 * (memória, ou a thread principal presa pela inferência), e nenhuma prova de
 * qual.
 *
 * **O que este teste responde.** Não "quanto demora" — isso é
 * `bench-transcricao.mjs`. Aqui a pergunta é binária e é a que decide se uma
 * versão pode substituir a produção: **com a transcrição rodando, o app
 * continua usável e os dados continuam lá?** Navegar, rolar, abrir a aula,
 * voltar, abrir de novo. Nenhuma dessas ações pode fechar a aba, perder o
 * áudio, perder os momentos, ou deixar a tela morta.
 *
 * O áudio é fala de verdade (um WAV de 60-70s), porque áudio silencioso faz
 * o motor pular a inferência (`capturaParecaSilenciosa`) e o teste passaria
 * sem nunca exercitar o caso que importa.
 *
 * Uso:
 *   node tests/qa-estabilidade-galeria.mjs --audio=aula68.wav
 *   node tests/qa-estabilidade-galeria.mjs --audio=... --modelo=tiny --grafo=basic
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { APP } from "./caminhos.mjs";
import { semearAula, AULA } from "./semear-aula.mjs";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const AUDIO = arg("audio", null);
const MODELO = arg("modelo", "base");
const GRAFO = arg("grafo", null);
const CHROMIUM = process.env.SLID_CHROMIUM;

if (!AUDIO) {
  console.error("Falta --audio=<arquivo.wav> com fala de verdade (60-70s).");
  process.exit(2);
}

let falhas = 0;
let passo = 0;
const check = (ok, rotulo, extra = "") => {
  console.log(
    `${ok ? "[ok]  " : "[FAIL]"} ${String(++passo).padStart(2)}. ${rotulo}${
      extra ? " — " + extra : ""
    }`,
  );
  if (!ok) falhas++;
};

const wavBase64 = readFileSync(AUDIO).toString("base64");

const navegador = await chromium.launch(
  CHROMIUM ? { executablePath: CHROMIUM } : {},
);
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await contexto.newPage();

const erros = [];
let abaMorreu = false;
page.on("pageerror", (e) => erros.push(String(e)));
page.on("crash", () => {
  abaMorreu = true;
});

const params = `listen-model=${MODELO}` + (GRAFO ? `&listen-graph=${GRAFO}` : "");
console.log(
  `═══ estabilidade durante a transcrição · modelo=${MODELO} · grafo=${GRAFO ?? "padrão"} ═══\n`,
);

await page.goto(`${APP}/?${params}`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// A aula, com a gravação real, entrando pelo mesmo caminho que a sessão usa.
await semearAula(page, { ...AULA, id: "estab", subject: "Aula em transcrição" });
await page.evaluate(
  async ({ base64 }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/wav" });
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });
    const tx = db.transaction("lessonAudio", "readwrite");
    tx.objectStore("lessonAudio").put({
      sessionId: "estab",
      segments: [
        {
          startMs: 0,
          durationMs: Math.round(((bytes.length - 44) / 32000) * 1000),
          blob,
          mimeType: "audio/wav",
        },
      ],
      createdAt: Date.now(),
      transcriptStatus: "indisponivel",
    });
    await new Promise((r) => {
      tx.oncomplete = r;
    });
    db.close();
  },
  { base64: wavBase64 },
);
await page.goto(`${APP}/?${params}`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

/** Abrir a aula é o que dispara o reprocessamento — o mesmo gatilho do app. */
async function abrirAula() {
  await page.getByRole("button", { name: "Galeria", exact: true }).click();
  await page.waitForTimeout(700);
  await page
    .getByRole("tablist", { name: "Filtrar a galeria" })
    .getByRole("tab", { name: /^SliD/ })
    .click();
  await page.waitForTimeout(600);
  await page
    .locator("article")
    .filter({ hasText: "Aula em transcrição" })
    .getByRole("button")
    .first()
    .click();
  await page.waitForTimeout(700);
}

await abrirAula();
check(
  /Organizando o que foi dito/i.test(await page.locator("body").innerText()),
  "a aula abre e diz que está organizando — o trabalho começou",
);

/*
 * A partir daqui a transcrição está correndo. Cada ação abaixo é uma que a
 * pessoa de fato fez no teste físico, na mesma ordem.
 *
 * `timeout` curto de propósito: se a thread principal estiver presa, o
 * Playwright não consegue nem clicar, e é ISSO que se quer detectar — não
 * esperar pacientemente até a inferência acabar e declarar sucesso.
 */
const acao = async (rotulo, fn) => {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t };
  } catch (erro) {
    return { ok: false, ms: Date.now() - t, erro: String(erro).slice(0, 120) };
  }
};

const voltar = await acao("voltar", async () => {
  await page.getByRole("button", { name: /voltar|fechar/i }).first().click({ timeout: 20000 });
  await page.waitForTimeout(400);
});
check(voltar.ok, "dá para VOLTAR da aula durante a transcrição", `${voltar.ms}ms`);

const rolar = await acao("rolar", async () => {
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(200);
  }
});
check(rolar.ok, "dá para ROLAR a Galeria durante a transcrição", `${rolar.ms}ms`);

const reabrir = await acao("reabrir", async () => {
  await abrirAula();
});
check(reabrir.ok, "dá para ABRIR a aula de novo durante a transcrição", `${reabrir.ms}ms`);

// A aba sobreviveu a tudo isso?
check(!abaMorreu, "a aba NÃO fechou sozinha");

// E os dados continuam onde estavam — a pergunta que nenhuma otimização
// pode responder "não".
const dados = await page.evaluate(async () => {
  const db = await new Promise((r, x) => {
    const q = indexedDB.open("jovi-camera-v2");
    q.onsuccess = () => r(q.result);
    q.onerror = () => x(q.error);
  });
  const audio = await new Promise((r) => {
    const p = db.transaction("lessonAudio", "readonly").objectStore("lessonAudio").get("estab");
    p.onsuccess = () => r(p.result);
    p.onerror = () => r(null);
  });
  const capturas = await new Promise((r) => {
    const p = db.transaction("captures", "readonly").objectStore("captures").getAll();
    p.onsuccess = () => r(p.result);
    p.onerror = () => r([]);
  });
  db.close();
  return {
    temAudio: Boolean(audio?.segments?.[0]?.blob?.size),
    bytesAudio: audio?.segments?.[0]?.blob?.size ?? 0,
    momentos: capturas.filter((c) => c.session?.id === "estab").length,
    status: audio?.transcriptJobStatus,
  };
});
check(dados.temAudio, "o ÁUDIO continua salvo", `${(dados.bytesAudio / 1024).toFixed(0)} KB`);
check(dados.momentos > 0, "os MOMENTOS continuam salvos", `${dados.momentos}`);

// E o trabalho termina — com teto, porque não terminar também é resposta.
console.log("\nesperando a transcrição terminar…");
const t0 = Date.now();
let fim = null;
for (;;) {
  fim = await page.evaluate(async () => {
    const db = await new Promise((r, x) => {
      const q = indexedDB.open("jovi-camera-v2");
      q.onsuccess = () => r(q.result);
      q.onerror = () => x(q.error);
    });
    const a = await new Promise((r) => {
      const p = db.transaction("lessonAudio", "readonly").objectStore("lessonAudio").get("estab");
      p.onsuccess = () => r(p.result);
      p.onerror = () => r(null);
    });
    db.close();
    return {
      status: a?.transcriptJobStatus,
      outcome: a?.transcriptOutcome,
      blocos: a?.transcript?.length ?? 0,
      texto: (a?.transcript ?? []).map((t) => t.text).join(" "),
    };
  });
  if (fim.status === "pronto" || fim.status === "falhou") break;
  if (Date.now() - t0 > 12 * 60_000) break;
  await page.waitForTimeout(1500);
}
const levou = Date.now() - t0;

check(fim.status === "pronto", "a transcrição TERMINA", `${(levou / 1000).toFixed(0)}s, status ${fim.status ?? "?"}`);
check(fim.blocos > 0 && fim.outcome === "texto", "e produz texto de verdade", `${fim.blocos} blocos`);

// A tela não pode ficar com o spinner depois de terminar, nem anunciar falha
// de um trabalho que deu certo.
await page.waitForTimeout(3000);
const corpo = await page.locator("body").innerText();
check(
  !/Organizando o que foi dito/i.test(corpo),
  "o aviso 'Organizando…' some quando o trabalho acaba",
);
check(
  !/Não foi possível organizar/i.test(corpo),
  "e a tela NÃO anuncia falha de um trabalho que terminou bem",
);

check(erros.length === 0, "sem erro de runtime na jornada inteira", erros[0]?.slice(0, 100) ?? "");

if (fim.texto) console.log(`\ntexto: ${fim.texto.slice(0, 200).replace(/\s+/g, " ")}`);
console.log(
  `\n${falhas === 0 ? "TUDO CERTO" : `${falhas} FALHA(S)`} — ${passo} verificações`,
);

await navegador.close();
process.exit(falhas === 0 ? 0 : 1);
