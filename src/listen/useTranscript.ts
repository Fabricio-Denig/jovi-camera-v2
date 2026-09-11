import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A transcrição da fala, ao lado da gravação — nunca no lugar dela.
 *
 * `MediaRecorder` produz o arquivo de áudio da aula; isto produz a versão
 * textual do que foi dito. Um não substitui o outro: o arquivo é a prova e o
 * que sobrevive a qualquer navegador; o texto é o que deixa a aula ser
 * pesquisada, resumida e ligada aos momentos.
 *
 * **A lição do spike, e a decisão que ela impõe.** Medido no Chromium desta
 * bancada: `typeof SpeechRecognition === "function"` é verdade, o objeto
 * constrói, `start()` funciona — e um instante depois vem
 * `error: audio-capture` e `end`. Ou seja, **detecção de recurso não prova
 * nada aqui**. Por isso este gancho não diz "transcrevendo" porque a API
 * existe; ele diz porque um resultado chegou. Capacidade é evidência, não
 * declaração.
 *
 * **Sobre privacidade, com precisão.** A `SpeechRecognition` do navegador
 * **pode** enviar áudio para um serviço do próprio navegador — no Chrome ela
 * envia. Este app não escolhe isso e não tem como impedir; o que ele pode
 * fazer é não mentir sobre. O arquivo de áudio, esse sim, fica no aparelho:
 * é `MediaRecorder` gravando para IndexedDB, sem rede nenhuma.
 */

/*
 * O trecho de fala vem de `mediaStore` e não é redefinido aqui.
 *
 * Duas cópias da mesma interface — uma no gancho, outra no armazém — são duas
 * cópias que combinam hoje e divergem no dia em que uma ganhar um campo. Como
 * o que vale é o que sobrevive ao fechar do app, a forma pertence a quem
 * guarda.
 *
 * O `startMs` é o relógio **da sessão**, não o do arquivo de áudio: é o mesmo
 * eixo de `capture.atMs`, e é o que deixa fala e momento se encontrarem.
 */
export type { TranscriptSegment } from "../shared/lib/mediaStore";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

export type TranscriptStatus =
  /** Nem tentou ainda. */
  | "parado"
  /** Ligado, mas nenhum resultado chegou — ainda não se sabe se funciona. */
  | "aguardando"
  /** Chegou resultado: funciona mesmo. */
  | "transcrevendo"
  /** A API não existe neste navegador. */
  | "indisponivel"
  /** Existe e falhou de um jeito que não adianta repetir. */
  | "falhou";

type Construtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >;
}

function construtorDeFala(): Construtor | null {
  const w = window as unknown as {
    SpeechRecognition?: Construtor;
    webkitSpeechRecognition?: Construtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Se o navegador **declara** a API. Não é o mesmo que ela funcionar — ver a
 * nota do spike acima.
 */
export function reconhecimentoDeclarado(): boolean {
  return construtorDeFala() !== null;
}

/**
 * Erros dos quais não adianta tentar de novo.
 *
 * `audio-capture` é o microfone não chegar ao reconhecedor — foi exatamente o
 * que a bancada devolveu. `not-allowed` e `service-not-allowed` são permissão
 * e política. Reiniciar em cima de qualquer um dos três seria um laço que
 * queima bateria sem nunca transcrever nada.
 *
 * `no-speech` e `aborted`, ao contrário, são rotina: silêncio na sala e o
 * próprio navegador encerrando o turno. Esses pedem reinício.
 */
const ERROS_FATAIS = new Set([
  "audio-capture",
  "not-allowed",
  "service-not-allowed",
  "language-not-supported",
  "bad-grammar",
]);

/** Quanto esperar antes de religar depois de um fim benigno. */
const RELIGAR_MS = 400;
/** Quantos religamentos seguidos sem nenhum resultado antes de desistir. */
const TENTATIVAS_SEM_RESULTADO = 6;

export function useTranscript({
  /** O relógio da sessão, em ms. Cada trecho é ancorado nele. */
  agoraMs,
  idioma = "pt-BR",
}: {
  agoraMs: () => number;
  idioma?: string;
}) {
  const [status, setStatus] = useState<TranscriptStatus>("parado");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  /** O que está sendo dito agora, ainda podendo mudar. */
  const [parcial, setParcial] = useState<string>("");

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  /** O usuário quer transcrição. Desligar à mão zera isto e nada religa. */
  const queridoRef = useRef(false);
  const religarRef = useRef<number | null>(null);
  const tentativasRef = useRef(0);
  const jaDeuResultadoRef = useRef(false);
  /** Onde o trecho em andamento começou, no relógio da sessão. */
  const inicioDoTrechoRef = useRef(0);
  const agoraRef = useRef(agoraMs);
  agoraRef.current = agoraMs;

  const soltar = useCallback(() => {
    if (religarRef.current !== null) {
      clearTimeout(religarRef.current);
      religarRef.current = null;
    }
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        /* já parado */
      }
    }
    setParcial("");
  }, []);

  useEffect(() => soltar, [soltar]);

  const ligar = useCallback(() => {
    const Construtor = construtorDeFala();
    if (!Construtor) {
      setStatus("indisponivel");
      return;
    }

    let rec: SpeechRecognitionLike;
    try {
      rec = new Construtor();
    } catch {
      setStatus("indisponivel");
      return;
    }

    rec.lang = idioma;
    // Contínuo porque uma aula é contínua. Parciais porque a tela mostra a
    // frase em andamento — e porque são eles que provam, antes do primeiro
    // resultado final, que o reconhecimento está vivo.
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      inicioDoTrechoRef.current = agoraRef.current();
      setStatus((s) => (s === "transcrevendo" ? s : "aguardando"));
    };

    rec.onresult = (e) => {
      jaDeuResultadoRef.current = true;
      tentativasRef.current = 0;
      setStatus("transcrevendo");

      const fim = agoraRef.current();
      let emAndamento = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        const alternativa = resultado[0];
        if (!alternativa) continue;
        const texto = alternativa.transcript.trim();
        if (!texto) continue;

        if (resultado.isFinal) {
          const inicio = inicioDoTrechoRef.current;
          setSegments((atuais) => [
            ...atuais,
            {
              startMs: inicio,
              endMs: fim,
              text: texto,
              final: true,
              // A confiança da Web Speech vem zerada em vários navegadores.
              // Zero não é "não confio" — é "não sei dizer", e guardar isso
              // como zero faria qualquer peneira jogar tudo fora.
              ...(typeof alternativa.confidence === "number" &&
              alternativa.confidence > 0
                ? { confidence: alternativa.confidence }
                : {}),
            },
          ]);
          // O próximo trecho começa onde este acabou.
          inicioDoTrechoRef.current = fim;
        } else {
          emAndamento = texto;
        }
      }

      setParcial(emAndamento);
    };

    rec.onerror = (e) => {
      if (ERROS_FATAIS.has(e.error)) {
        queridoRef.current = false;
        soltar();
        setStatus(jaDeuResultadoRef.current ? "falhou" : "indisponivel");
      }
      // `no-speech` e `aborted` não fazem nada aqui: o `onend` que vem a
      // seguir é quem decide religar.
    };

    rec.onend = () => {
      recRef.current = null;
      setParcial("");
      if (!queridoRef.current) return;

      /*
       * O navegador encerra o turno sozinho — por silêncio, por limite de
       * tempo, por decisão própria. Religar é o que mantém a transcrição viva
       * numa aula de quarenta minutos.
       *
       * Com duas travas. A primeira: só religa enquanto o usuário quiser, e
       * `queridoRef` só é ligado por um gesto explícito. Foi assim que o
       * defeito anterior aconteceu — algo desligado pela pessoa voltava
       * sozinho —, e ele não se repete aqui.
       *
       * A segunda: se religar seis vezes sem nunca produzir um resultado, o
       * reconhecimento não está funcionando neste aparelho. Insistir seria um
       * laço queimando bateria para nada.
       */
      if (!jaDeuResultadoRef.current) {
        tentativasRef.current += 1;
        if (tentativasRef.current >= TENTATIVAS_SEM_RESULTADO) {
          queridoRef.current = false;
          setStatus("indisponivel");
          return;
        }
      }
      religarRef.current = window.setTimeout(
        () => ligarRef.current?.(),
        RELIGAR_MS,
      );
    };

    try {
      rec.start();
      recRef.current = rec;
    } catch {
      // `start()` lança quando já há um reconhecimento ativo. Não é falha do
      // aparelho; é corrida entre o religamento e o anterior terminando.
      recRef.current = null;
    }
  }, [idioma, soltar]);

  /*
   * O religamento chama pelo ref, não pela variável.
   *
   * `ligar` precisa se agendar de novo, e uma função que captura a si mesma
   * captura a versão daquele render — a que ainda tem o idioma antigo depois
   * de uma troca. Pelo ref, cada religamento pega a versão atual, e a
   * recursão deixa de ser uma referência a algo ainda em construção.
   */
  const ligarRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    ligarRef.current = ligar;
  }, [ligar]);

  /**
   * Começa a transcrever. Só por gesto explícito de quem é dono da sessão.
   *
   * **Não apaga o que já foi transcrito**, e isso é deliberado. Desligar o
   * áudio no meio da aula e religar dez minutos depois é um caminho normal —
   * e limpar aqui faria a primeira metade da aula desaparecer no gesto de
   * voltar a gravar, que é o oposto do que a pessoa pediu. Quem zera é
   * `reset`, chamado quando uma aula nova começa.
   */
  const start = useCallback(() => {
    if (!reconhecimentoDeclarado()) {
      setStatus("indisponivel");
      return;
    }
    queridoRef.current = true;
    tentativasRef.current = 0;
    jaDeuResultadoRef.current = false;
    setParcial("");
    setStatus("aguardando");
    ligar();
  }, [ligar]);

  /** Aula nova, transcrição nova. O único lugar que joga fora o que foi dito. */
  const reset = useCallback(() => {
    queridoRef.current = false;
    soltar();
    setSegments([]);
    setStatus("parado");
  }, [soltar]);

  /** Para e devolve o que foi transcrito. */
  const stop = useCallback((): TranscriptSegment[] => {
    queridoRef.current = false;
    soltar();
    setStatus((s) => (s === "indisponivel" || s === "falhou" ? s : "parado"));
    return segments;
  }, [segments, soltar]);

  /** Desligar à mão. A intenção do usuário vence e nada religa. */
  const disable = useCallback(() => {
    queridoRef.current = false;
    soltar();
    setStatus("parado");
  }, [soltar]);

  return {
    status,
    segments,
    parcial,
    /** Há prova de que o reconhecimento funciona neste aparelho. */
    transcrevendo: status === "transcrevendo",
    start,
    stop,
    disable,
    reset,
  };
}
