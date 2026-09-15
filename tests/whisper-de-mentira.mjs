/**
 * O dublê do motor de transcrição local (Whisper), no mesmo espírito de
 * `fala-de-mentira.mjs` para o `SpeechRecognition` do navegador.
 *
 * Não há como uma suíte de bancada baixar dezenas de megabytes de pesos de
 * modelo a cada execução, nem rodar inferência de verdade num Chromium
 * headless em segundos. O que este dublê prova não é "o modelo acerta" — é
 * "o resto do cano funciona": o deslocamento de horário por trecho de áudio,
 * os estados processando/pronto/falhou, a persistência, o retry, e o que as
 * abas Texto e Resumo mostram com uma transcrição de verdade dentro.
 *
 * `window.__transcreverMock__` é o único ponto de entrada — `whisperEngine.ts`
 * usa ele no lugar do `pipeline(...)` real quando presente, e nunca existe em
 * produção.
 */

/** Um atraso de propósito: sem ele, a tela nunca fica tempo suficiente em
    "processando" para o teste conseguir observar — entre encerrar a aula e
    abri-la de novo na galeria já passam uns oito segundos de navegação. */
export const ATRASO_MS = 13000;

/**
 * Instala o dublê para devolver sempre os mesmos blocos, na ordem.
 *
 * Chamar como
 * `page.addInitScript(instalarWhisperDeMentira(), { blocos: AULA_POO, atrasoMs: ATRASO_MS })`
 * — o segundo argumento de `addInitScript` é o único jeito de levar dados
 * para dentro do script instalado; uma função de fábrica que já capturasse
 * `blocos` por clausura pareceria funcionar e não funcionaria, porque o
 * script roda numa página nova, sem a clausura do Node por trás.
 */
export function instalarWhisperDeMentira() {
  return ({ blocos, atrasoMs }) => {
    window.__transcreverMock__ = (_blob) =>
      new Promise((resolve) => {
        setTimeout(() => resolve(blocos), atrasoMs);
      });
  };
}

/** O dublê falhando sempre — para testar o estado "falhou" e o retry. */
export function instalarWhisperFalho() {
  return () => {
    window.__transcreverMock__ = () =>
      new Promise((_resolve, reject) => {
        setTimeout(() => reject(new Error("rede indisponível (dublê)")), 300);
      });
  };
}

/**
 * A aula falada exata que o pedido de produto usou como exemplo: conteúdo
 * conhecido de POO, com "prestem atenção" como marca de ênfase.
 */
export const AULA_POO = [
  {
    text: "Hoje vamos falar sobre programação orientada a objetos.",
    startMs: 0,
    endMs: 4000,
  },
  {
    text: "Uma classe funciona como modelo para criar objetos.",
    startMs: 4000,
    endMs: 9000,
  },
  {
    text: "Encapsulamento ajuda a proteger o estado interno.",
    startMs: 9000,
    endMs: 14000,
  },
  {
    text: "Prestem atenção porque herança permite reutilizar comportamentos.",
    startMs: 14000,
    endMs: 20000,
  },
  {
    text: "Resumindo, vimos classes, encapsulamento e herança.",
    startMs: 20000,
    endMs: 25000,
  },
];
