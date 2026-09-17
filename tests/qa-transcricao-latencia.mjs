/**
 * A aritmética do caso REAL medido em aparelho — e a premissa que ela
 * corrige.
 *
 * **O teste físico.** Uma gravação que a tela mostrava como `01:08` — **68
 * SEGUNDOS** — levou cerca de **dez minutos** para ser transcrita no
 * celular. A interface travou ao navegar para a Galeria no meio, o app
 * chegou a fechar sozinho, e a tela anunciou que a transcrição tinha
 * falhado antes de ela terminar bem.
 *
 * **O engano que este arquivo existe para impedir que volte.** A primeira
 * investigação leu aquele `01:08` como uma hora e oito minutos, e construiu
 * em cima disso uma explicação de memória (centenas de megabytes de PCM)
 * que simplesmente não descreve o caso. As contas abaixo fixam os números
 * verdadeiros: 68 segundos de áudio são ~4,3 MB de PCM, ou seja **memória
 * não é a explicação** — e qualquer futura hipótese de memória para este
 * caso tem que passar por aqui primeiro.
 *
 * O que sobra, e que só a medição em aparelho responde, é a desproporção:
 * ~9× a duração do áudio em tempo de processamento. Este arquivo não mede
 * isso (não há modelo nem navegador aqui); ele garante as duas coisas que
 * dão para garantir sem aparelho: a aritmética do áudio, e a regra de ciclo
 * de vida que fez a tela mentir.
 *
 * Roda sem navegador e sem modelo: `node tests/qa-transcricao-longa.mjs`.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { megabytesDePcm, TAXA_WHISPER } = await jiti.import(
  "../src/listen/audioPcm.ts",
);
const { jobParecaTravado, SEM_SINAL_DE_VIDA_MS, JOB_ABANDONADO_MS } =
  await jiti.import("../src/listen/transcribeSession.ts");

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

const MIN = 60_000;
/** A gravação do teste físico: `01:08` na tela, 68 segundos de verdade. */
const AULA_MEDIDA_S = 68;
/** E quanto ela levou para ser transcrita, no aparelho. */
const LEVOU_MS = 10 * MIN;

console.log("═══ a aula de 68 SEGUNDOS que levou ~10 minutos ═══\n");

/* ── 1. Memória: a hipótese que a conta derruba ──────────────────────── */

const pesoDaAula = megabytesDePcm(AULA_MEDIDA_S);
check(
  pesoDaAula < 10,
  "68 segundos de áudio cabem em poucos MB de PCM — memória não explica nada aqui",
  `${pesoDaAula}MB`,
);
check(
  megabytesDePcm(AULA_MEDIDA_S, 48000) < 20,
  "e mesmo decodificado a 48 kHz, antes de reamostrar, continua pequeno",
  `${megabytesDePcm(AULA_MEDIDA_S, 48000)}MB`,
);
/*
 * A trava contra a repetição do engano: se alguém ler `01:08` como horas de
 * novo, a conta dá 249MB e esta verificação quebra, com o nome dizendo por
 * quê.
 */
check(
  megabytesDePcm(68 * 60) > 200 && pesoDaAula < 10,
  "`01:08` são 68s (≈4MB), não 68min (≈249MB) — a diferença que invalidou a primeira análise",
  `${pesoDaAula}MB contra ${megabytesDePcm(68 * 60)}MB`,
);

/* ── 2. A desproporção que sobra como P0 ─────────────────────────────── */

const razao = LEVOU_MS / (AULA_MEDIDA_S * 1000);
check(
  razao > 5,
  "o processamento levou muitas vezes a duração do próprio áudio",
  `~${razao.toFixed(0)}× (${AULA_MEDIDA_S}s de áudio, ~${LEVOU_MS / MIN}min de trabalho)`,
);
/*
 * Uma aula desse tamanho cabe em poucos blocos de 30s do próprio Whisper
 * (`chunk_length_s: 30`), então nem fatiar o áudio nem paralelizar janelas
 * teria como explicar dez minutos: o custo está DENTRO de um punhado de
 * chamadas ao modelo, ou antes delas, no carregamento. Só a medição em
 * aparelho (`?debug=listen`, etapas `model_load`/`decode`/`inference`)
 * separa as duas.
 */
const blocosDe30s = Math.ceil(AULA_MEDIDA_S / 30);
check(
  blocosDe30s <= 3,
  "e o áudio inteiro cabe em pouquíssimos blocos de 30s do modelo",
  `${blocosDe30s} blocos`,
);

/* ── 3. Ciclo de vida: a tela que anunciou falha de um trabalho vivo ── */

const agora = Date.now();

/*
 * O caso exato: dez minutos de trabalho legítimo contra um teto de dez
 * minutos contado desde o começo. Sem batimento, a regra antiga condena um
 * trabalho que está rodando — foi o que a pessoa viu na tela.
 */
check(
  jobParecaTravado({
    transcriptJobStatus: "processando",
    transcriptJobStartedAt: agora - (LEVOU_MS + MIN),
  }) === true,
  "a regra ANTIGA condena um trabalho de dez minutos, mesmo vivo",
  "o defeito que a pessoa viu",
);

check(
  SEM_SINAL_DE_VIDA_MS < JOB_ABANDONADO_MS,
  "a regra nova percebe uma aba morta mais rápido que a antiga",
  `${SEM_SINAL_DE_VIDA_MS / MIN}min contra ${JOB_ABANDONADO_MS / MIN}min`,
);

check(
  jobParecaTravado({
    transcriptJobStatus: "processando",
    transcriptJobStartedAt: agora - 2 * MIN,
  }) === false,
  "e um trabalho recém-começado, sem batimento, não é dado por morto",
);

check(
  jobParecaTravado({
    transcriptJobStatus: "pronto",
    transcriptJobStartedAt: agora - 60 * MIN,
  }) === false &&
    jobParecaTravado({
      transcriptJobStatus: "falhou",
      transcriptJobStartedAt: agora - 60 * MIN,
    }) === false,
  "um trabalho que já terminou nunca é 'travado', por mais antigo que seja",
);

/*
 * O batimento em si é exercitado no navegador (`qa-listen-whisper`), porque
 * depende de `localStorage` e do temporizador do job. O que dá para fixar
 * aqui é a decisão de projeto que ele encarna: a pergunta deixou de ser
 * "faz quanto tempo que começou" e passou a ser "faz quanto tempo que dá
 * notícia" — e um trabalho rodando NESTA aba nem chega a ser julgado por
 * heurística de tempo nenhuma.
 */
check(
  typeof SEM_SINAL_DE_VIDA_MS === "number" && SEM_SINAL_DE_VIDA_MS >= 2 * MIN,
  "o teto de silêncio é folgado para um batimento de 15s — sem falso positivo",
  `${SEM_SINAL_DE_VIDA_MS / MIN}min`,
);

/* ── 4. A taxa que o modelo espera ───────────────────────────────────── */

check(
  TAXA_WHISPER === 16000,
  "o PCM entregue ao modelo é 16 kHz — a taxa que o extrator de features exige",
);

console.log(
  `\n${falhas === 0 ? "tudo passou" : `${falhas} falha(s)`} — ${passo} verificações`,
);
process.exit(falhas === 0 ? 0 : 1);
