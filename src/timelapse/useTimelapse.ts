import { useCallback, useEffect, useRef, useState } from "react";

/**
 * O modo Intervalo, de verdade.
 *
 * Ele é honesto de um jeito que quase nenhum outro modo "criativo" consegue
 * ser no navegador: um time-lapse **é** exatamente isto — um quadro a cada N
 * segundos, tocados em sequência. Não há aproximação nem simulação. O que sai
 * daqui é o mesmo tipo de arquivo que um aplicativo nativo produziria.
 *
 * A montagem usa `canvas.captureStream()` com `MediaRecorder`, e esta é a
 * parte que decide o resultado: desenhar um quadro no canvas e chamar
 * `requestFrame()` empurra **um** quadro para a gravação. Então o vídeo final
 * tem exatamente tantos quadros quantas capturas houve, na taxa de
 * reprodução escolhida — e a aceleração é o quociente entre os dois números,
 * não um efeito aplicado depois.
 *
 * Nada aqui toca a análise do SliD: o canvas lê o <video> como todo o resto
 * do app, e o quadro que ele lê é o quadro cru.
 */

/** Intervalos oferecidos, em segundos. */
export const INTERVALOS = [0.5, 1, 2, 5, 10] as const;
export type Intervalo = (typeof INTERVALOS)[number];

/** A que taxa o vídeo final é reproduzido. */
const FPS_SAIDA = 12;
/** O maior lado do quadro gravado. Acima disto o arquivo cresce sem ganho. */
const LADO_MAX = 1280;

export type TimelapseStatus = "parado" | "gravando" | "montando" | "indisponivel";

export interface TimelapseResult {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  /** Quantos quadros entraram — o vídeo tem exatamente este tamanho. */
  quadros: number;
  /** Quanto tempo real foi coberto. */
  duracaoRealMs: number;
}

export function timelapseSuportado(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return typeof c.captureStream === "function";
  } catch {
    return false;
  }
}

/** O primeiro formato de vídeo que este navegador grava. */
function melhorFormatoDeVideo(): string | null {
  const tentativas = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
    "",
  ];
  for (const f of tentativas) {
    if (f === "") return "";
    try {
      if (MediaRecorder.isTypeSupported(f)) return f;
    } catch {
      /* navegador antigo lança em vez de devolver false */
    }
  }
  return null;
}

export function useTimelapse(
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const [status, setStatus] = useState<TimelapseStatus>("parado");
  const [intervalo, setIntervalo] = useState<Intervalo>(1);
  const [quadros, setQuadros] = useState(0);
  const [decorridoMs, setDecorridoMs] = useState(0);
  /** A última miniatura capturada, para a tela mostrar que algo aconteceu. */
  const [ultima, setUltima] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pedacosRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const inicioRef = useRef(0);
  const quadrosRef = useRef(0);

  const limpar = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => limpar, [limpar]);

  /** O relógio do tempo real coberto. */
  useEffect(() => {
    if (status !== "gravando") return;
    const id = setInterval(() => setDecorridoMs(Date.now() - inicioRef.current), 250);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback((): boolean => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !timelapseSuportado()) {
      setStatus("indisponivel");
      return false;
    }
    const formato = melhorFormatoDeVideo();
    if (formato === null) {
      setStatus("indisponivel");
      return false;
    }

    // O canvas nasce com a proporção do sensor, limitado no lado maior: um
    // time-lapse de trinta minutos em 4K seria um arquivo que não cabe no
    // aparelho e que o navegador não consegue montar.
    const escala = Math.min(1, LADO_MAX / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    canvasRef.current = canvas;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("indisponivel");
      return false;
    }

    // Zero: o canvas não produz quadro sozinho. Cada `requestFrame()` empurra
    // exatamente um — que é o que faz o vídeo ter tantos quadros quantas
    // capturas, em vez de gravar o canvas parado em tempo real.
    const stream = canvas.captureStream(0);
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, formato ? { mimeType: formato } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setStatus("indisponivel");
      return false;
    }

    pedacosRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) pedacosRef.current.push(e.data);
    };
    recorder.start();

    recorderRef.current = recorder;
    streamRef.current = stream;
    inicioRef.current = Date.now();
    quadrosRef.current = 0;
    setQuadros(0);
    setDecorridoMs(0);
    setUltima(null);
    setStatus("gravando");

    const capturar = () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const trilha = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      trilha.requestFrame?.();
      quadrosRef.current += 1;
      setQuadros(quadrosRef.current);
      // Uma miniatura a cada oito quadros: gerar uma por quadro num intervalo
      // de meio segundo custaria mais que a captura em si.
      if (quadrosRef.current % 8 === 1) {
        try {
          setUltima(canvas.toDataURL("image/jpeg", 0.5));
        } catch {
          /* a miniatura é enfeite; a gravação não depende dela */
        }
      }
    };

    capturar();
    timerRef.current = window.setInterval(capturar, intervalo * 1000);
    return true;
  }, [videoRef, intervalo]);

  const stop = useCallback(async (): Promise<TimelapseResult | null> => {
    const recorder = recorderRef.current;
    const canvas = canvasRef.current;
    if (!recorder || !canvas) {
      limpar();
      setStatus("parado");
      return null;
    }

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStatus("montando");

    const total = quadrosRef.current;
    const duracaoRealMs = Date.now() - inicioRef.current;
    const tipo = recorder.mimeType || "video/webm";

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(pedacosRef.current, { type: tipo }));
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(pedacosRef.current, { type: tipo }));
      }
    });

    limpar();
    setStatus("parado");
    // Menos de dois quadros não é vídeo — é uma foto com metadados de vídeo, e
    // guardá-la como vídeo daria um arquivo que não toca.
    if (blob.size === 0 || total < 2) return null;
    return {
      blob,
      mimeType: tipo,
      width: canvas.width,
      height: canvas.height,
      quadros: total,
      duracaoRealMs,
    };
  }, [limpar]);

  /** Quanto o resultado acelera o tempo real, para a tela poder dizer. */
  const aceleracao =
    quadros > 1 ? Math.round((decorridoMs / 1000 / (quadros / FPS_SAIDA)) || 0) : 0;

  return {
    status,
    intervalo,
    setIntervalo,
    quadros,
    decorridoMs,
    /** A duração que o vídeo final terá, em ms. */
    duracaoFinalMs: (quadros / FPS_SAIDA) * 1000,
    aceleracao,
    ultima,
    gravando: status === "gravando",
    start,
    stop,
  };
}
