import { useCallback, useEffect, useRef, useState } from "react";
import { decideMoment, REFRAME_TICKS, REFRAMED } from "./momentPolicy";
import {
  ANALYSIS_SCALES,
  type ContentBounds,
  type ScaledScene,
  boundsAtScale,
  contentDelta,
  frameDifference,
  markArea,
  markMask,
  readBestScene,
  readScene,
  unionBounds,
  sampleFrame,
} from "./frameAnalysis";
import { capturePhotoFromVideo } from "../camera/capturePhoto";

export type SlidStatus = "idle" | "running" | "paused" | "finished";

/**
 * Why this moment was worth keeping. The reason is the product: a student
 * trusts the session when the camera can say what it noticed, not merely that
 * something changed.
 */
export type MomentReason =
  | "novo-topico"
  | "novo-slide"
  | "novo-conteudo"
  | "manual";

export const REASON_LABELS: Record<MomentReason, string> = {
  "novo-topico": "Novo tópico no quadro",
  "novo-slide": "Novo slide",
  "novo-conteudo": "Conteúdo acrescentado",
  manual: "Você marcou este momento",
};

export interface SlidCapture {
  id: string;
  blob: Blob;
  /** Milliseconds into the session, which is how a student locates a moment later. */
  atMs: number;
  auto: boolean;
  reason: MomentReason;
  /** Share of the frame covered in marks, kept so a moment can say whether
   *  there was content even when nothing could be read from it. */
  marks: number;
  /** How many times the surface grew while this stayed the same topic. */
  refinements: number;
  /** When the topic stopped growing — the moment holds its fullest state. */
  completedAtMs: number;
}

/** What the session watched but chose not to keep — the curation made visible. */
export interface SlidStats {
  /** Frames inspected while the session ran. */
  analysed: number;
  /** Near-identical frames skipped so the session stays reviewable. */
  skippedDuplicates: number;
}

/** How often frames are inspected. Slow on purpose: a board changes over minutes. */
const TICK_MS = 1200;

/*
 * A moment is kept only when both questions answer yes:
 *
 *   1. Is there study material in front of the camera?   readScene
 *   2. Did the content itself change?                    contentDelta
 *
 * Neither alone is enough. Question 2 on its own is a motion detector — that
 * is what shipped first, and pointed at a person for a minute it produced
 * moments. Question 1 on its own would photograph a static page forever.
 */

/** Ticks of study material before capture arms — one lucky frame is not a class. */
const SCENE_ARM_TICKS = 2;
/** Ticks without it before capture disarms; a hand over the page is not a room change. */
const SCENE_LOST_TICKS = 3;

/** Frame-to-frame change that means something is moving — a hand, a person. */
const MOTION_THRESHOLD = 0.03;
/** Frames must settle before capturing, so a passing hand isn't photographed. */
const STABLE_TICKS = 2;

/** Consecutive positive readings before the class suggestion appears. */
const DETECTION_TICKS = 3;

/**
 * Tiques seguidos de "vi alguma coisa, mas pequena demais" antes de dizer isso
 * em voz alta. Dois: uma dica que pisca é pior do que nenhuma.
 */
const HINT_TICKS = 2;

/**
 * Quantos tiques de leitura a moldura carrega consigo. Três: o bastante para
 * uma leitura magra não apagar a anterior, pouco o bastante para a caixa
 * acompanhar uma troca de slide sem parecer presa ao slide de antes.
 */
const ENVELOPE_TICKS = 3;

interface UseSlidSessionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Contextual detection only runs while the camera is live and SliD is not already active. */
  detectionEnabled: boolean;
  /**
   * The crop the preview is applying on its own. The session reads the window
   * the student framed — zooming in on a slide across a lecture hall is the
   * whole point of the control, and it would do nothing if the analysis kept
   * looking at the wide shot.
   */
  zoom?: number;
  /** Liga a coleta do diagnóstico. Desligado, nada é guardado nem renderizado. */
  diagnosing?: boolean;
}

/** O que o painel de diagnóstico mostra. Só existe com ?debug=slid. */
export interface SlidDiagnostics {
  /** A leitura escolhida no último tique, com todas as janelas lidas. */
  scene: ScaledScene | null;
  /** Quantos tiques seguidos de aula até aqui, e quantos faltam para sugerir. */
  streak: number;
  needed: number;
  /** A janela travada da sessão, quando ela já armou. 0 quando ainda não armou. */
  lockedScale: number;
}

/**
 * O que a câmera diria se pudesse falar sobre o enquadramento.
 *
 * Só existe um caso, e ele é o que o teste de campo mostra: o conteúdo está
 * lá, a janela ampliada até reconhece escrita nele, mas não o bastante para
 * afirmar que é aula. Isso não é um erro de leitura — é um slide longe demais,
 * e o estudante tem o botão que resolve isso a um toque de distância.
 *
 * Nenhuma outra dica entra aqui sem um sinal que a sustente. Dizer "enquadre
 * melhor" quando a câmera não sabe se há o que enquadrar é inventar conteúdo
 * com outro nome.
 */
export type FramingHint = "distante";

export interface SlidSession {
  status: SlidStatus;
  captures: SlidCapture[];
  stats: SlidStats;
  /** Set briefly right after a capture, so the session can say what it just noticed. */
  lastMoment: SlidCapture | null;
  elapsedMs: number;
  /** True once the frame has looked like a board for long enough to suggest SliD. */
  boardDetected: boolean;
  /** Where the recognised content sits in the frame, so it can be shown. */
  contentBounds: ContentBounds | null;
  /**
   * The camera has seen study material but not yet enough of it to offer
   * anything. Shown, because three and a half seconds of a plain viewfinder
   * before the suggestion arrives reads as a camera that did not notice.
   */
  weighing: boolean;
  /**
   * Whether the running session is actually looking at study material. The
   * session says so out loud rather than implying it is guarding a class while
   * the camera faces a wall.
   */
  sceneReady: boolean;
  /**
   * A dica de enquadramento, quando há sinal que a justifique. `null` na
   * imensa maioria dos tiques, que é o certo: uma câmera que comenta o tempo
   * todo é uma câmera que ninguém lê.
   */
  framingHint: FramingHint | null;
  /** Preenchido só quando `diagnosing` está ligado. */
  diagnostics: SlidDiagnostics | null;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  captureManually: () => Promise<void>;
  dismissSuggestion: () => void;
}

/**
 * SliD as a continuous session rather than a single photo of a board.
 *
 * The session owns its own loop and never touches the camera stream: it only
 * reads frames from the existing <video>. That keeps the validated capture
 * engine untouched no matter what happens here.
 */
export function useSlidSession({
  videoRef,
  detectionEnabled,
  zoom = 1,
  diagnosing = false,
}: UseSlidSessionOptions): SlidSession {
  const [status, setStatus] = useState<SlidStatus>("idle");
  const [captures, setCaptures] = useState<SlidCapture[]>([]);
  const [stats, setStats] = useState<SlidStats>({
    analysed: 0,
    skippedDuplicates: 0,
  });
  const [lastMoment, setLastMoment] = useState<SlidCapture | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [boardDetected, setBoardDetected] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [contentBounds, setContentBounds] = useState<ContentBounds | null>(null);
  const [weighing, setWeighing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SlidDiagnostics | null>(null);
  const [framingHint, setFramingHint] = useState<FramingHint | null>(null);
  const diagnosingRef = useRef(diagnosing);
  diagnosingRef.current = diagnosing;

  const startedAtRef = useRef(0);
  const pausedTotalRef = useRef(0);
  const pausedAtRef = useRef(0);
  const lastCapturedMarksRef = useRef<Uint8Array | null>(null);
  const lastSampleRef = useRef<Uint8Array | null>(null);
  const stableCountRef = useRef(0);
  const sceneArmedRef = useRef(false);
  const boundsRef = useRef<ContentBounds | null>(null);
  const referenceBoundsRef = useRef<ContentBounds | null>(null);
  const outsideMovedRef = useRef(0);
  const sceneOkRef = useRef(0);
  const sceneMissRef = useRef(0);
  const detectionCountRef = useRef(0);
  const suggestionDismissedRef = useRef(false);
  const hintCountRef = useRef(0);
  const capturingRef = useRef(false);
  // Read inside the loops rather than closed over: changing the zoom must not
  // tear down and restart a session that is running.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /**
   * The window the running session reads through, held still once the scene is
   * armed.
   *
   * Picking afresh every tick is what would break the comparison the whole
   * session rests on: the masks of two ticks are only subtractable if they show
   * the same region, and a scene that flickered between the wide shot and a
   * crop would read as the board being wiped and rewritten every second. So the
   * choice is made while the scene is being found, and then it stops moving
   * until the scene is lost.
   */
  const scaleRef = useRef(1);
  /**
   * A janela que a detecção usou por último. Diferente da travada da sessão:
   * esta serve só para a moldura parar quieta antes de a aula começar.
   */
  const detectScaleRef = useRef<number | undefined>(undefined);
  /**
   * A caixa que está desenhada, suavizada.
   *
   * Uma cena de pouco contraste lida duas vezes seguidas devolve extensões
   * diferentes para a mesma escrita — medido sobre um slide parado numa sala
   * clara, a altura alternava entre 29 % e 80 % do quadro a cada tique, e o
   * contorno pulava 159 px. Média não resolve isso: ela fica no meio, que é
   * onde a escrita não está.
   *
   * O que resolve é notar que as duas leituras não têm o mesmo valor. A menor
   * perdeu faixas que a maior enxergou — a geometria confirma: um slide
   * centrado ocupa quase toda a janela de 2,6x, e era a leitura de 80 % que
   * dizia isso. Perder faixa é o erro que o pouco contraste comete; inventar
   * faixa, não. Então a caixa guarda a extensão dos últimos tiques em vez da
   * do último, e alternar deixa de significar mexer.
   */
  const smoothBoundsRef = useRef<ContentBounds | null>(null);
  const boundsHistoryRef = useRef<ContentBounds[]>([]);

  /**
   * O diagnóstico só é guardado quando alguém está olhando. Fora disso a
   * chamada sai por uma comparação booleana, e a sessão normal não paga por um
   * painel que ninguém abriu.
   */
  const publishDiagnostics = useCallback((scene: ScaledScene) => {
    if (!diagnosingRef.current) return;
    setDiagnostics({
      scene,
      streak: detectionCountRef.current,
      needed: DETECTION_TICKS,
      lockedScale: sceneArmedRef.current ? scaleRef.current : 0,
    });
  }, []);

  /** Every window of one frame, in the order the analysis expects them. */
  const sampleAll = useCallback(
    (video: HTMLVideoElement) =>
      ANALYSIS_SCALES.map((scale) => sampleFrame(video, zoomRef.current * scale)),
    [],
  );

  /**
   * A extensão que a cena mostrou nos últimos tiques, e não a do último.
   *
   * Uma leitura que perde metade da escrita não apaga a metade que a leitura
   * anterior viu; ela precisa de três tiques seguidos concordando para a caixa
   * encolher de verdade. Depois disso a caixa ainda caminha até o alvo em vez
   * de saltar, o que dá o passo final de calma quando o alvo muda mesmo — um
   * slide que troca.
   */
  const smoothBounds = useCallback((next: ContentBounds | null) => {
    if (!next) return smoothBoundsRef.current;
    const historico = [...boundsHistoryRef.current, next].slice(-ENVELOPE_TICKS);
    boundsHistoryRef.current = historico;

    const esquerda = Math.min(...historico.map((b) => b.x));
    const topo = Math.min(...historico.map((b) => b.y));
    const direita = Math.max(...historico.map((b) => b.x + b.width));
    const base = Math.max(...historico.map((b) => b.y + b.height));
    const alvo: ContentBounds = {
      x: esquerda,
      y: topo,
      width: direita - esquerda,
      height: base - topo,
    };

    const previous = smoothBoundsRef.current;
    if (!previous) {
      smoothBoundsRef.current = alvo;
      return alvo;
    }
    const passo = 0.4;
    const mistura = (a: number, b: number) => a + (b - a) * passo;
    const eased: ContentBounds = {
      x: mistura(previous.x, alvo.x),
      y: mistura(previous.y, alvo.y),
      width: mistura(previous.width, alvo.width),
      height: mistura(previous.height, alvo.height),
    };
    smoothBoundsRef.current = eased;
    return eased;
  }, []);

  /**
   * A dica só aparece depois de a cena repetir o mesmo recado, e some no
   * primeiro tique que a contradiz. Reconhecer a aula é a contradição mais
   * forte que existe: não há o que dizer sobre o enquadramento de um slide que
   * já foi lido.
   */
  const noteFraming = useCallback((scene: ScaledScene | null) => {
    if (!scene || scene.looksLikeClass || !scene.tooSmall) {
      hintCountRef.current = 0;
      setFramingHint(null);
      return;
    }
    hintCountRef.current++;
    if (hintCountRef.current >= HINT_TICKS) setFramingHint("distante");
  }, []);

  /** Esquecer a caixa por inteiro: a cena que a justificava não está mais lá. */
  const forgetBounds = useCallback(() => {
    smoothBoundsRef.current = null;
    boundsHistoryRef.current = [];
  }, []);

  const takeCapture = useCallback(
    async (reason: MomentReason, sample: Uint8Array | null) => {
      const video = videoRef.current;
      if (!video || capturingRef.current) return;
      capturingRef.current = true;
      try {
        const { blob } = await capturePhotoFromVideo(video, {
          zoom: zoomRef.current,
        });
        const reference =
          sample ?? sampleFrame(video, zoomRef.current * scaleRef.current);
        let marks = 0;
        if (reference) {
          const mask = markMask(reference);
          lastCapturedMarksRef.current = mask;
          marks = markArea(mask);
          referenceBoundsRef.current = boundsRef.current;
        }
        const moment: SlidCapture = {
          id: crypto.randomUUID(),
          blob,
          atMs: Date.now() - startedAtRef.current - pausedTotalRef.current,
          auto: reason !== "manual",
          reason,
          marks,
          refinements: 0,
          completedAtMs: Date.now() - startedAtRef.current - pausedTotalRef.current,
        };
        setCaptures((prev) => [...prev, moment]);
        setLastMoment(moment);
      } catch {
        // A failed frame must never end the session — the next tick tries again.
      } finally {
        capturingRef.current = false;
      }
    },
    [videoRef],
  );

  /**
   * The same topic, more complete. The moment already on the timeline keeps its
   * place and its starting time, and takes the fuller picture — which is what
   * the student actually wants from a slide that built up over a minute.
   */
  const refineCapture = useCallback(
    async (sample: Uint8Array | null) => {
      const video = videoRef.current;
      if (!video || capturingRef.current) return;
      capturingRef.current = true;
      try {
        const { blob } = await capturePhotoFromVideo(video, {
          zoom: zoomRef.current,
        });
        const reference =
          sample ?? sampleFrame(video, zoomRef.current * scaleRef.current);
        let marks = 0;
        if (reference) {
          const mask = markMask(reference);
          lastCapturedMarksRef.current = mask;
          marks = markArea(mask);
          referenceBoundsRef.current = boundsRef.current;
        }
        setCaptures((previous) => {
          if (previous.length === 0) return previous;
          const last = previous[previous.length - 1];
          const refined: SlidCapture = {
            ...last,
            blob,
            marks,
            refinements: last.refinements + 1,
            completedAtMs:
              Date.now() - startedAtRef.current - pausedTotalRef.current,
          };
          return [...previous.slice(0, -1), refined];
        });
      } catch {
        // A failed frame must never end the session — the next tick tries again.
      } finally {
        capturingRef.current = false;
      }
    },
    [videoRef],
  );

  // Contextual detection: looks for a board only when it could act on it.
  //
  // Deliberately a stricter question than the one the session asks. Offering a
  // class is unprompted — nobody pointed the camera anywhere on purpose — so it
  // waits for looksLikeClass, several lines of writing with clean surface
  // between them, and not merely for a surface with marks on it. A tiled floor
  // passes the session gate and must never open its mouth here.
  useEffect(() => {
    if (!detectionEnabled || suggestionDismissedRef.current) return;

    const interval = setInterval(() => {
      // Relido a cada tique, e não só quando o efeito monta. Dispensar mexe num
      // ref, refs não remontam efeitos, e o intervalo já em curso continuava
      // reacendendo a sugestão no tique seguinte — dispensar durava 1,2 s.
      if (suggestionDismissedRef.current) return;
      const video = videoRef.current;
      if (!video) return;
      const scene = readBestScene(sampleAll(video), detectScaleRef.current);
      if (!scene) return;
      publishDiagnostics(scene);
      noteFraming(scene);

      if (scene.looksLikeClass) {
        detectionCountRef.current++;
        // The window that found the class is the one the session will read
        // through, so it is chosen here and handed over by start().
        scaleRef.current = scene.scale;
        detectScaleRef.current = scene.scale;
        // The bounds go up from the first positive read: what the camera is
        // weighing is worth seeing, not only what it concluded.
        //
        // E uma leitura sem caixa não apaga a que estava lá. Uma janela pode
        // reconhecer a aula sem conseguir delimitá-la, e piscar o contorno a
        // cada tique desses é pior do que mantê-lo onde estava.
        if (scene.bounds)
          setContentBounds(smoothBounds(boundsAtScale(scene.bounds, scene.scale)));
        const confirmed = detectionCountRef.current >= DETECTION_TICKS;
        setBoardDetected(confirmed);
        setWeighing(!confirmed);
      } else {
        detectionCountRef.current = 0;
        detectScaleRef.current = undefined;
        forgetBounds();
        setBoardDetected(false);
        setWeighing(false);
        setContentBounds(null);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [
    detectionEnabled,
    videoRef,
    sampleAll,
    publishDiagnostics,
    smoothBounds,
    forgetBounds,
    noteFraming,
  ]);

  // Session loop: two gates, in order — is this study material, and did the
  // content change? A frame that fails the first is never even compared.
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      setElapsedMs(Date.now() - startedAtRef.current - pausedTotalRef.current);

      // While the scene is still being found the session may re-pick its
      // window; once armed it holds still, and reads that one window alone.
      const sample = sceneArmedRef.current
        ? sampleFrame(video, zoomRef.current * scaleRef.current)
        : null;
      const scene = sample
        ? { ...readScene(sample), scale: scaleRef.current }
        : readBestScene(sampleAll(video));
      if (!scene) return;
      if ("readings" in scene) {
        publishDiagnostics(scene as ScaledScene);
        noteFraming(scene as ScaledScene);
      } else if (scene.isStudy) {
        // A janela travada não devolve as outras leituras, e a sessão que já
        // está lendo a aula não tem dica de enquadramento a dar.
        noteFraming(null);
      }
      const frame = sample ?? sampleFrame(video, zoomRef.current * scene.scale);
      if (!frame) return;
      setStats((prev) => ({ ...prev, analysed: prev.analysed + 1 }));

      // Gate 1 — scene context. Hysteresis on both sides: a single good frame
      // does not arm the session, and a hand passing over the board does not
      // disarm it.
      if (scene.isStudy) {
        sceneMissRef.current = 0;
        sceneOkRef.current++;
        if (!sceneArmedRef.current) scaleRef.current = scene.scale;
        boundsRef.current = scene.bounds;
        setContentBounds(smoothBounds(boundsAtScale(scene.bounds, scaleRef.current)));
        if (sceneOkRef.current >= SCENE_ARM_TICKS && !sceneArmedRef.current) {
          sceneArmedRef.current = true;
          setSceneReady(true);
        }
      } else {
        sceneOkRef.current = 0;
        sceneMissRef.current++;
        if (sceneMissRef.current >= SCENE_LOST_TICKS && sceneArmedRef.current) {
          sceneArmedRef.current = false;
          // The window was chosen for content that is no longer there; the next
          // scene gets to pick its own.
          scaleRef.current = 1;
          forgetBounds();
          setSceneReady(false);
          setContentBounds(null);
        }
      }

      const previous = lastSampleRef.current;
      lastSampleRef.current = frame;

      if (!sceneArmedRef.current) {
        stableCountRef.current = 0;
        return;
      }
      if (!previous) return;

      // Wait for the scene to settle: a hand crossing the board is movement,
      // not new content.
      if (frameDifference(previous, frame) > MOTION_THRESHOLD) {
        stableCountRef.current = 0;
        return;
      }
      stableCountRef.current++;
      if (stableCountRef.current < STABLE_TICKS) return;

      // Gate 2 — content. The first steady frame of study material is the
      // starting state of the lesson and is always worth keeping.
      const marks = markMask(frame);
      const reference = lastCapturedMarksRef.current;
      if (!reference) {
        stableCountRef.current = 0;
        void takeCapture("novo-topico", frame);
        return;
      }

      // Where the change happened decides what it was. A slide advancing and a
      // camera being nudged look identical from the content alone — marks
      // leaving and arriving in equal measure. They differ everywhere else:
      // moving the camera also moves the bezel, the desk and the wall, and a
      // new slide leaves all of that exactly where it was.
      // The region tracks the content, so it moves when the content does. A
      // slide advancing shrinks or grows the box, and measuring "outside" from
      // the new box alone counted the old content as periphery — every slide
      // change looked like the camera had been moved, and was swallowed. The
      // union of both boxes is the part that genuinely belongs to the room.
      // Everything is measured over the same region: the box holding both the
      // old content and the new. A slide with fewer lines than the one before
      // shrinks the box, and measuring only the new box hid the lines that had
      // gone — a slide change registered a 7 % loss instead of 27 %.
      const content = unionBounds(referenceBoundsRef.current, boundsRef.current);
      const outside = contentDelta(reference, marks, content, "outside");
      if (outside.added + outside.removed > REFRAMED) {
        // A propped-up phone still twitches, and a slide that changed on the
        // same tick used to be swallowed with the twitch: re-anchoring on the
        // first frame threw away the reference that would have caught it.
        // A real reframe persists, a twitch does not — so the tick is skipped
        // and only a sustained move re-anchors.
        outsideMovedRef.current++;
        if (outsideMovedRef.current >= REFRAME_TICKS) {
          lastCapturedMarksRef.current = marks;
          referenceBoundsRef.current = boundsRef.current;
          outsideMovedRef.current = 0;
        }
        return;
      }
      outsideMovedRef.current = 0;

      const decision = decideMoment(
        contentDelta(reference, marks, content),
        markArea(reference, content),
      );
      if (!decision) {
        // Same content as the last moment: skip it and count the noise the
        // student was spared from reviewing later.
        setStats((prev) => ({
          ...prev,
          skippedDuplicates: prev.skippedDuplicates + 1,
        }));
        return;
      }

      stableCountRef.current = 0;
      if (decision.refine) void refineCapture(frame);
      else void takeCapture(decision.reason, frame);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [
    status,
    videoRef,
    takeCapture,
    sampleAll,
    publishDiagnostics,
    smoothBounds,
    forgetBounds,
    noteFraming,
  ]);

  const start = useCallback(() => {
    // Arriving from the suggestion means the scene was already confirmed three
    // ticks in a row. Making the session re-earn that from zero opens it with
    // "procurando o conteúdo" over the very content it just recognised — the
    // narrative breaks in the first second, exactly where it matters most.
    const alreadyConfirmed = detectionCountRef.current >= DETECTION_TICKS;
    startedAtRef.current = Date.now();
    pausedTotalRef.current = 0;
    lastSampleRef.current = null;
    lastCapturedMarksRef.current = null;
    referenceBoundsRef.current = null;
    outsideMovedRef.current = 0;
    stableCountRef.current = 0;
    sceneArmedRef.current = alreadyConfirmed;
    sceneOkRef.current = alreadyConfirmed ? SCENE_ARM_TICKS : 0;
    sceneMissRef.current = 0;
    // Arriving from the suggestion keeps the window that found the class.
    if (!alreadyConfirmed) scaleRef.current = 1;
    setSceneReady(alreadyConfirmed);
    setCaptures([]);
    setStats({ analysed: 0, skippedDuplicates: 0 });
    setLastMoment(null);
    setElapsedMs(0);
    setStatus("running");
    setBoardDetected(false);
  }, []);

  const pause = useCallback(() => {
    pausedAtRef.current = Date.now();
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    pausedTotalRef.current += Date.now() - pausedAtRef.current;
    setStatus("running");
  }, []);

  const finish = useCallback(() => setStatus("finished"), []);

  const reset = useCallback(() => {
    setStatus("idle");
    setCaptures([]);
    setStats({ analysed: 0, skippedDuplicates: 0 });
    setLastMoment(null);
    setElapsedMs(0);
    suggestionDismissedRef.current = false;
    detectionCountRef.current = 0;
    detectScaleRef.current = undefined;
    scaleRef.current = 1;
    hintCountRef.current = 0;
    setFramingHint(null);
    setWeighing(false);
    sceneArmedRef.current = false;
    sceneOkRef.current = 0;
    sceneMissRef.current = 0;
    setSceneReady(false);
  }, []);

  const captureManually = useCallback(async () => {
    await takeCapture("manual", null);
  }, [takeCapture]);

  const dismissSuggestion = useCallback(() => {
    suggestionDismissedRef.current = true;
    setBoardDetected(false);
  }, []);

  return {
    status,
    captures,
    stats,
    lastMoment,
    elapsedMs,
    boardDetected,
    contentBounds,
    weighing,
    sceneReady,
    framingHint,
    diagnostics,
    start,
    pause,
    resume,
    finish,
    reset,
    captureManually,
    dismissSuggestion,
  };
}
