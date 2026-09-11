/**
 * Semeia a gravação de uma aula, com transcrição, no banco do app.
 *
 * Existe por um motivo medido, não por conveniência. O spike de reconhecimento
 * de fala nesta bancada devolveu isto:
 *
 *   { SpeechRecognition: 'function' }        → a API é declarada
 *   { eventos: ['start', 'error:audio-capture', 'end'] }  → e não funciona
 *
 * Ou seja: **a transcrição real não pode ser exercitada em CI**. Não há
 * microfone, e o serviço do navegador recusa antes de qualquer resultado.
 * Testar o que o app faz *com* a fala transcrita exige, então, uma
 * transcrição determinística — a mesma em toda execução, com os mesmos
 * horários, produzindo os mesmos destaques e o mesmo resumo.
 *
 * O que isto NÃO testa: o reconhecimento. Isso continua sendo verificação de
 * aparelho, e está no checklist. O que isto testa é tudo o que vem depois —
 * persistência, abas, horários clicáveis, destaques, resumo — que é onde o
 * produto vive.
 */

/**
 * Uma aula de React, falada.
 *
 * Os horários batem com os momentos de `AULA_REACT` de propósito: é assim que
 * a janela temporal fala↔momento pode ser verificada de verdade.
 */
export const FALA_REACT = [
  [2000, 9000, "bom dia pessoal hoje a gente vai falar sobre estado no React"],
  [
    9500,
    17000,
    "o useState é o jeito de um componente guardar um valor que muda",
  ],
  [
    18000,
    26000,
    "quando você chama o setState o React renderiza o componente de novo",
  ],
  [
    27000,
    35000,
    "prestem atenção nessa parte porque o useState devolve sempre um par",
  ],
  [
    36000,
    44000,
    "o primeiro item do par é o valor atual e o segundo é a função que atualiza",
  ],
  [
    50000,
    58000,
    "um erro muito comum é modificar o estado direto sem usar a função",
  ],
  [
    59000,
    68000,
    "isso cai na prova o estado no React é imutável e você nunca altera ele direto",
  ],
  [
    70000,
    78000,
    "então sempre crie um objeto novo em vez de mudar o objeto antigo",
  ],
  [
    95000,
    104000,
    "agora vamos ver o useEffect que roda depois que o componente renderiza",
  ],
  [105000, 113000, "o useEffect recebe uma função e um array de dependências"],
  [
    114000,
    122000,
    "se o array estiver vazio o efeito roda uma vez só quando o componente monta",
  ],
  [
    130000,
    139000,
    "resumindo o useState guarda estado e o useEffect reage a mudanças de estado",
  ],
];

/** A aula visual correspondente — quadro legível, para o caso com duas fontes. */
export const AULA_REACT = {
  id: "aula-react",
  subject: "React — estado e efeitos",
  discipline: "Front-end",
  status: "entendi",
  durationMs: 145000,
  momentos: [
    {
      t: 12000,
      label: "useState",
      cat: "Código",
      cor: "#1e2a3a",
      lines: ["useState", "const [valor, setValor] = useState(0)"],
    },
    {
      t: 62000,
      label: "Estado imutável",
      cat: "Conceito",
      cor: "#2a1e3a",
      lines: ["Estado imutável", "Nunca altere o objeto antigo"],
    },
    {
      t: 108000,
      label: "useEffect",
      cat: "Código",
      cor: "#3a2a1e",
      lines: ["useEffect", "useEffect(() => {...}, [deps])"],
    },
  ],
};

/** A mesma aula, com o quadro ilegível: o caso do teste no celular. */
export const AULA_SO_FALA = {
  ...AULA_REACT,
  id: "aula-so-fala",
  subject: "React — aula sem quadro legível",
  momentos: AULA_REACT.momentos.map((m) => ({ ...m, lines: [], cat: null })),
};

/** Os trechos no formato que o app guarda. */
export function comoSegmentos(fala = FALA_REACT) {
  return fala.map(([startMs, endMs, text]) => ({
    startMs,
    endMs,
    text,
    final: true,
  }));
}

/**
 * Escreve o áudio da aula — com a transcrição — no armazém `lessonAudio`.
 *
 * O blob é um WAV de silêncio gerado na hora: pequeno, válido, e real o
 * bastante para o tocador carregar e o `duration` existir. Um blob falso faria
 * o player falhar por um motivo que não é o que o teste investiga.
 */
export async function semearAudio(
  page,
  {
    sessionId,
    segments = comoSegmentos(),
    durationMs = 145000,
    startedAtMs = 0,
    transcriptStatus = "ok",
  },
) {
  return page.evaluate(
    async ({
      sessionId,
      segments,
      durationMs,
      startedAtMs,
      transcriptStatus,
    }) => {
      // WAV PCM 8 kHz mono de silêncio, montado à mão.
      const amostras = Math.round((durationMs / 1000) * 8000);
      const buf = new ArrayBuffer(44 + amostras * 2);
      const v = new DataView(buf);
      const escrever = (off, s) => {
        for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
      };
      escrever(0, "RIFF");
      v.setUint32(4, 36 + amostras * 2, true);
      escrever(8, "WAVEfmt ");
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true);
      v.setUint32(28, 16000, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      escrever(36, "data");
      v.setUint32(40, amostras * 2, true);

      const db = await new Promise((r, x) => {
        const q = indexedDB.open("jovi-camera-v2");
        q.onsuccess = () => r(q.result);
        q.onerror = () => x(q.error);
      });
      const tx = db.transaction("lessonAudio", "readwrite");
      tx.objectStore("lessonAudio").put({
        sessionId,
        blob: new Blob([buf], { type: "audio/wav" }),
        mimeType: "audio/wav",
        durationMs,
        startedAtMs,
        createdAt: Date.now(),
        transcript: segments,
        transcriptStatus,
      });
      await new Promise((r) => {
        tx.oncomplete = r;
      });
      db.close();
      return segments.length;
    },
    { sessionId, segments, durationMs, startedAtMs, transcriptStatus },
  );
}
