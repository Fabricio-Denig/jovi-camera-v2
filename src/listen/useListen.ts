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

/**
 * Um trecho gravado: o que um `MediaRecorder` produziu entre um `start` e o
 * fim dele — por `stop` (aula encerrada) ou por `disable` (a pessoa desligou).
 *
 * `startMs` é o relógio da SESSÃO, não do arquivo: o mesmo eixo de
 * `capture.atMs`, o que deixa comparar um momento e um trecho de áudio direto,
 * sem ninguém lembrar de somar atrasos. Existem vários porque desligar o áudio
 * e religar depois é exatamente o mesmo MediaRecorder come TODO o já gravado
 * — a `disable` de antes descartava esses bytes ao chamar `recorder.stop()`
 * sem nunca montar o blob. Um trecho por ciclo liga/desliga é o jeito de não
 * perder nada, sem colar containers de gravações diferentes num arquivo só
 * (o que webm/ogg não garantem tocar depois).
 */
export interface ListenSegment {
  /** Onde este trecho começa na aula, em ms desde o início da sessão. */
  startMs: number;
  /** Quanto dura, em ms — medido pelo relógio da sessão, não do arquivo. */
  durationMs: number;
  blob: Blob;
  mimeType: string;
}

export interface ListenResult {
  segments: ListenSegment[];
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
 * Regras que moldam tudo aqui.
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
 * **Desligar libera o hardware de verdade.** `disable` para as tracks — não
 * existe meio-termo em que o microfone continua "vivo" escondido só para
 * facilitar religar depois. Religar pede um stream novo, do zero.
 *
 * **Nada que já foi gravado desaparece.** Desligar fecha o trecho atual num
 * `ListenSegment` e o guarda; religar abre um trecho novo. A aula inteira é a
 * lista de trechos, na ordem em que aconteceram — nunca um único arquivo que
 * a última religada sobrescreve.
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
  /** Quanto já foi gravado antes da pausa atual, dentro do trecho em curso. */
  const acumuladoRef = useRef<number>(0);
  const analiseRef = useRef<{ ctx: AudioContext; raf: number } | null>(null);
  /** Onde, no relógio da sessão, o trecho em curso começou. */
  const inicioDoTrechoRef = useRef<number>(0);
  /** Os trechos já fechados desta sessão — ver `ListenSegment`. */
  const trechosRef = useRef<ListenSegment[]>([]);
  /*
   * A geração da tentativa em curso.
   *
   * Existe por causa de uma janela que só aparece no aparelho: entre pedir o
   * microfone e a pessoa responder passam segundos — às vezes minutos. Nesse
   * intervalo ela pode sair do SliD, ou desligar o áudio, e sem esta marca o
   * `await` continuava correndo: quando a permissão enfim chegava, `streamRef`
   * era preenchido e o `MediaRecorder` começava a gravar **fora** da sessão,
   * sem nenhum indicador na tela.
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
   * Fecha o trecho em curso num `ListenSegment`, se houver um gravando.
   *
   * É o coração do conserto: antes, desligar (`disable`) chamava
   * `recorder.stop()` sem nunca ouvir o `onstop` — os bytes já gravados eram
   * jogados fora ali mesmo. Agora tanto `disable` quanto `stop` passam por
   * aqui, e o trecho vira parte da lista antes do microfone soltar.
   */
  const fecharTrechoAtual = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const duracao =
      acumuladoRef.current +
      (recorder.state === "recording" ? Date.now() - inicioRef.current : 0);
    const tipo = recorder.mimeType || mimeType || "audio/webm";
    const inicioDoTrecho = inicioDoTrechoRef.current;

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

    pedacosRef.current = [];
    // Um trecho de tamanho zero (religou e desligou na mesma fração de
    // segundo, sem nenhum pedaço chegar) não vira um segmento vazio na lista.
    if (blob.size > 0) {
      trechosRef.current = [
        ...trechosRef.current,
        { startMs: inicioDoTrecho, durationMs: duracao, blob, mimeType: tipo },
      ];
    }
  }, [mimeType]);

  /**
   * Começa a ouvir um trecho novo. Devolve se conseguiu.
   *
   * `inicioMs` é o relógio da SESSÃO no instante em que este trecho começa —
   * quem chama (a câmera) é quem sabe converter isso, porque é ela que sabe o
   * relógio do SliD. Sem isso, um trecho religado no meio da aula não saberia
   * dizer onde entra na timeline.
   *
   * Quem chama não precisa tratar erro: o estado já conta o que aconteceu, e
   * a sessão continua de pé em qualquer um dos caminhos ruins.
   */
  const start = useCallback(async (inicioMs: number): Promise<boolean> => {
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
        // A gravação morreu. Os pedaços já recebidos ficam pendentes de
        // fechar; a sessão segue sem áudio novo até religar.
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
      inicioDoTrechoRef.current = inicioMs;
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

  /**
   * Encerra a sessão inteira e devolve todos os trechos gravados — os que já
   * tinham sido fechados por `disable` mais o que estiver gravando agora.
   *
   * Sempre seguro de chamar, mesmo sem nada gravando no momento: uma aula em
   * que a pessoa desligou o áudio e nunca religou antes de encerrar ainda tem
   * os trechos de antes, e eles não podem ficar presos aqui dentro.
   */
  const stop = useCallback(async (): Promise<ListenResult | null> => {
    await fecharTrechoAtual();
    soltarTudo();
    setStatus((s) => (s === "ouvindo" || s === "pausado" ? "parado" : s));
    setElapsedMs(0);

    const trechos = trechosRef.current;
    trechosRef.current = [];
    if (trechos.length === 0) return null;
    return { segments: trechos };
  }, [fecharTrechoAtual, soltarTudo]);

  /**
   * Silenciar sem encerrar: o áudio para, a aula continua — mesmo trecho.
   *
   * Diferente de `disable`: aqui o `MediaRecorder` só pausa, o microfone
   * continua com a track aberta, e é o mesmo trecho que retoma ao religar.
   * Serve para uma pausa curta; não é o botão que a pessoa toca no selo — esse
   * é `disable`, que solta o hardware de verdade.
   */
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
   * Desligar de verdade: fecha o trecho em curso — sem jogá-lo fora, ao
   * contrário do que este método fazia antes — e solta o microfone.
   *
   * Chamável a qualquer momento, inclusive durante o "pedindo": é justamente
   * aí que ele mais importa, porque é a janela em que o microfone podia ficar
   * preso. `soltarTudo` incrementa a geração e a tentativa pendente morre
   * sozinha quando voltar.
   *
   * Assíncrono de propósito: fechar o trecho espera o `MediaRecorder` entregar
   * o que já gravou antes de soltar o stream. Quem chama não precisa esperar
   * — o hardware para de qualquer jeito, mesmo que o blob acabe de montar um
   * instante depois.
   */
  const disable = useCallback(async () => {
    await fecharTrechoAtual();
    pedacosRef.current = [];
    soltarTudo();
    setStatus("parado");
    setElapsedMs(0);
  }, [fecharTrechoAtual, soltarTudo]);

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
    /** Quantos trechos já fechados existem nesta sessão, sem contar o atual. */
    trechosFechados: () => trechosRef.current.length,
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
