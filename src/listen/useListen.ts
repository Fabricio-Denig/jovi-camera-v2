import { useCallback, useEffect, useRef, useState } from "react";

/**
 * O estado do Listen, e cada um existe porque acontece.
 *
 * `indisponivel` e `negado` são coisas diferentes e precisam de respostas
 * diferentes: o primeiro é o navegador não saber gravar, e não adianta pedir
 * de novo; o segundo é a pessoa ter dito não, e ela pode mudar de ideia nas
 * permissões do site. Juntar os dois num "erro" faria a tela dar o conselho
 * errado em metade dos casos.
 */
export type ListenStatus =
  | "parado"
  | "pedindo"
  | "ouvindo"
  | "pausado"
  | "negado"
  | "indisponivel"
  | "falhou";

export interface ListenResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

/**
 * Os formatos que este app tenta, na ordem em que prefere.
 *
 * Nenhum navegador grava todos, e nenhum grava o mesmo. Chrome no Android dá
 * webm/opus; Safari no iPhone dá mp4/aac e **não** dá webm. Fixar um codec é
 * escolher metade dos aparelhos — então a lista é percorrida e o primeiro que
 * o navegador aceitar vence. A string vazia no fim é o caminho de último
 * recurso: deixar o navegador escolher sozinho.
 */
const FORMATOS = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "",
];

/** O primeiro formato que este navegador sabe gravar, ou null se nenhum. */
export function melhorFormato(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const formato of FORMATOS) {
    if (formato === "") return "";
    try {
      if (MediaRecorder.isTypeSupported(formato)) return formato;
    } catch {
      // `isTypeSupported` lança em navegador antigo em vez de devolver false.
    }
  }
  return null;
}

export function listenSuportado(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * O **Listen** do SliD: a aula gravada enquanto a câmera a enxerga.
 *
 * Três regras moldam tudo aqui.
 *
 * **Nunca grava escondido.** A gravação só começa depois de o microfone ser
 * concedido, e enquanto ela corre a tela diz que está correndo. Não há caminho
 * no código que ligue o `MediaRecorder` sem o indicador aparecer.
 *
 * **Nunca derruba o See/Identify.** Microfone negado, ausente ou quebrado
 * deixa a sessão inteira de pé — o SliD continua vendo e identificando, e a
 * tela diz "Áudio desativado" em vez de falhar. Uma aula perdida porque o
 * microfone não abriu seria o pior defeito que este recurso poderia ter.
 *
 * **O áudio é um arquivo só, com marcadores.** Cortar em trinta pedaços
 * exigiria trinta gravadores ou uma remontagem que o navegador não faz. Um
 * arquivo e uma lista de tempos dá a mesma experiência sendo muito mais
 * robusto: se a gravação morrer no meio, o que já foi gravado continua bom.
 *
 * O áudio fica no aparelho. Este gancho usa só `getUserMedia` e
 * `MediaRecorder`: nada sai do navegador, e nenhum serviço externo é chamado.
 */
export function useListen() {
  const [status, setStatus] = useState<ListenStatus>("parado");
  const [elapsedMs, setElapsedMs] = useState(0);
  /** Sobe e desce com a voz, só para o indicador ter pulso. */
  const [level, setLevel] = useState(0);
  const [mimeType, setMimeType] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const inicioRef = useRef<number>(0);
  /** Quanto já foi gravado antes da pausa atual. */
  const acumuladoRef = useRef<number>(0);
  const analiseRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  /*
   * A geração da tentativa em curso.
   *
   * Existe por causa de uma janela que só aparece no aparelho: entre pedir o
   * microfone e a pessoa responder à caixa de permissão passam segundos — às
   * vezes minutos. Nesse intervalo ela pode sair do SliD, ou desligar o áudio,
   * e sem esta marca o `await` continuava correndo: quando a permissão enfim
   * chegava, `streamRef` era preenchido e o `MediaRecorder` começava a gravar
   * **fora** da sessão, sem nenhum indicador na tela.
   *
   * Eram dois defeitos num só — microfone preso aceso, e gravação sem aviso,
   * que é exatamente o que este recurso não pode fazer. Qualquer coisa que
   * solte o microfone incrementa isto, e a tentativa antiga descobre, ao
   * voltar, que já não é a atual.
   */
  const geracaoRef = useRef(0);

  const soltarTudo = useCallback(() => {
    geracaoRef.current += 1;
    if (analiseRef.current) {
      cancelAnimationFrame(analiseRef.current.raf);
      void analiseRef.current.ctx.close().catch(() => {});
      analiseRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setLevel(0);
  }, []);

  // O microfone é hardware: uma aba que sai sem soltá-lo deixa o indicador
  // vermelho do sistema aceso, o que é exatamente a impressão que este
  // recurso não pode dar.
  useEffect(() => soltarTudo, [soltarTudo]);

  /** O relógio do indicador. Conta pelo tempo de parede, não por evento. */
  useEffect(() => {
    if (status !== "ouvindo") return;
    const id = setInterval(() => {
      setElapsedMs(acumuladoRef.current + (Date.now() - inicioRef.current));
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  /**
   * Começa a ouvir. Devolve se conseguiu.
   *
   * Quem chama não precisa tratar erro: o estado já conta o que aconteceu, e
   * a sessão continua de pé em qualquer um dos caminhos ruins.
   */
  const start = useCallback(async (): Promise<boolean> => {
    if (!listenSuportado()) {
      setStatus("indisponivel");
      return false;
    }
    const formato = melhorFormato();
    if (formato === null) {
      setStatus("indisponivel");
      return false;
    }

    setStatus("pedindo");
    // A geração desta tentativa, lida antes de qualquer espera.
    const minhaGeracao = ++geracaoRef.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Uma sala de aula tem eco, ar-condicionado e cadeira arrastando. O
          // navegador já sabe tratar os três; pedir é de graça e o que ele não
          // suportar ele ignora.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (erro) {
      // `NotAllowedError` é a pessoa dizendo não; o resto é o aparelho não
      // tendo microfone, ou ele estar ocupado por outro app.
      const nome = erro instanceof Error ? erro.name : "";
      // Uma recusa que chega depois de a pessoa já ter saído não deve
      // reescrever o estado: ela veria "Áudio desativado" numa tela que não
      // tem áudio nenhum.
      if (geracaoRef.current !== minhaGeracao) return false;
      setStatus(nome === "NotAllowedError" || nome === "SecurityError" ? "negado" : "indisponivel");
      return false;
    }

    /*
     * A permissão chegou — mas para quem?
     *
     * Se alguém desligou o áudio ou saiu do SliD enquanto a caixa estava
     * aberta, este stream não tem mais dono. Soltar aqui é a diferença entre
     * o microfone apagar e ficar aceso pelo resto da sessão.
     */
    if (geracaoRef.current !== minhaGeracao) {
      stream.getTracks().forEach((t) => t.stop());
      return false;
    }

    try {
      const recorder = new MediaRecorder(
        stream,
        formato ? { mimeType: formato } : undefined,
      );
      pedacosRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) pedacosRef.current.push(e.data);
      };
      recorder.onerror = () => {
        // A gravação morreu. Os pedaços já recebidos continuam válidos, então
        // o que existe é guardado e a sessão segue sem áudio novo.
        setStatus("falhou");
        soltarTudo();
      };
      // Um pedaço por segundo, e não um só no fim: assim uma aba fechada no
      // meio da aula perde um segundo de áudio em vez de perder tudo.
      recorder.start(1000);

      recorderRef.current = recorder;
      streamRef.current = stream;
      inicioRef.current = Date.now();
      acumuladoRef.current = 0;
      setElapsedMs(0);
      setMimeType(recorder.mimeType || formato || "audio/webm");
      setStatus("ouvindo");
      ligarMedidor(stream, analiseRef, setLevel);
      return true;
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("falhou");
      return false;
    }
  }, [soltarTudo]);

  /** Encerra e devolve o que foi gravado. Null quando não há áudio. */
  const stop = useCallback(async (): Promise<ListenResult | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      soltarTudo();
      setStatus((s) => (s === "ouvindo" || s === "pausado" ? "parado" : s));
      return null;
    }

    const duracao =
      acumuladoRef.current +
      (recorder.state === "recording" ? Date.now() - inicioRef.current : 0);
    const tipo = recorder.mimeType || mimeType || "audio/webm";

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(pedacosRef.current, { type: tipo }));
      };
      try {
        recorder.stop();
      } catch {
        // Já parado por conta própria: o que foi recebido ainda serve.
        resolve(new Blob(pedacosRef.current, { type: tipo }));
      }
    });

    soltarTudo();
    setStatus("parado");
    setElapsedMs(duracao);
    if (blob.size === 0) return null;
    return { blob, mimeType: tipo, durationMs: duracao };
  }, [mimeType, soltarTudo]);

  /** Silenciar sem encerrar: o áudio para, a aula continua. */
  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    acumuladoRef.current += Date.now() - inicioRef.current;
    try {
      recorder.pause();
      setStatus("pausado");
      setLevel(0);
    } catch {
      // Safari mais antigo não pausa. Continuar gravando é melhor que quebrar,
      // e o estado não mente: segue dizendo "ouvindo".
    }
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    try {
      recorder.resume();
      inicioRef.current = Date.now();
      setStatus("ouvindo");
    } catch {
      /* mesmo caso do pause */
    }
  }, []);

  /**
   * Desistir do áudio, com ou sem gravação em curso.
   *
   * Chamável a qualquer momento, inclusive durante o "pedindo": é justamente
   * aí que ele mais importa, porque é a janela em que o microfone podia ficar
   * preso. `soltarTudo` incrementa a geração e a tentativa pendente morre
   * sozinha quando voltar.
   */
  const disable = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* já parado */
      }
    }
    pedacosRef.current = [];
    soltarTudo();
    setStatus("parado");
    setElapsedMs(0);
  }, [soltarTudo]);

  /**
   * O estado real das tracks de microfone, perguntado ao hardware.
   *
   * Função e não estado: o `readyState` de uma track muda sem avisar o React
   * — o sistema pode encerrá-la quando outro app toma o microfone —, e um
   * valor guardado em `useState` estaria desatualizado exatamente na hora em
   * que alguém o consulta para investigar. Quem chama pergunta na hora.
   */
  const estadoDoMicrofone = useCallback((): {
    tracks: number;
    vivas: number;
    detalhe: string;
  } => {
    const tracks = streamRef.current?.getAudioTracks() ?? [];
    return {
      tracks: tracks.length,
      vivas: tracks.filter((t) => t.readyState === "live").length,
      detalhe:
        tracks.length === 0
          ? "sem track"
          : tracks.map((t) => `${t.label || "microfone"}:${t.readyState}`).join(", "),
    };
  }, []);

  return {
    status,
    elapsedMs,
    level,
    mimeType,
    estadoDoMicrofone,
    /** Se há gravação correndo agora — o que o indicador da tela reflete. */
    gravando: status === "ouvindo" || status === "pausado",
    start,
    stop,
    pause,
    resume,
    disable,
  };
}

/**
 * O pulso do indicador, tirado do próprio microfone.
 *
 * Sem ele o "Ouvindo" é um ponto parado, que não distingue um microfone vivo
 * de um congelado. Com ele, falar perto do celular mexe a barra — que é a
 * prova mais barata de que a gravação está acontecendo de verdade.
 *
 * Se o `AudioContext` não abrir, o indicador fica parado e a gravação segue:
 * o medidor é enfeite, a gravação não.
 */
function ligarMedidor(
  stream: MediaStream,
  ref: React.MutableRefObject<{ ctx: AudioContext; raf: number } | null>,
  setLevel: (n: number) => void,
) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const fonte = ctx.createMediaStreamSource(stream);
    const analisador = ctx.createAnalyser();
    analisador.fftSize = 256;
    fonte.connect(analisador);
    const dados = new Uint8Array(analisador.frequencyBinCount);

    const passo = () => {
      analisador.getByteTimeDomainData(dados);
      let pico = 0;
      for (const v of dados) pico = Math.max(pico, Math.abs(v - 128));
      // 0–1 com um pouco de compressão: fala normal já mexe a barra, e um
      // estalo não a satura de vez.
      setLevel(Math.min(1, (pico / 90) ** 0.7));
      if (ref.current) ref.current.raf = requestAnimationFrame(passo);
    };
    ref.current = { ctx, raf: requestAnimationFrame(passo) };
  } catch {
    /* sem medidor; a gravação não depende dele */
  }
}
