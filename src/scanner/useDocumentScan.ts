import { useEffect, useRef, useState } from "react";
import { sampleFrame, type ContentBounds } from "../slid/frameAnalysis";
import { findDocument } from "./documentEdges";

/** Com que frequência o Scanner procura a folha. */
const TICK_MS = 500;
/** Tiques concordando antes de a moldura mudar: uma caixa que pisca é ruído. */
const STEADY_TICKS = 2;
/** As dimensões da amostra de `sampleFrame`, que o detector precisa saber. */
const SAMPLE_W = 128;
const SAMPLE_H = 96;

export interface DocumentScan {
  /** Onde a folha está, em frações do quadro. `null` quando não há folha. */
  region: ContentBounds | null;
  /** 0..1, o quanto da caixa é claro. Vira o texto que o usuário lê. */
  confidence: number;
}

/**
 * O Scanner procurando a folha, e nada além disso.
 *
 * Roda mais rápido que o laço do SliD (meio segundo contra 1,2 s) porque as
 * duas perguntas têm ritmos diferentes: uma aula muda ao longo de minutos e
 * uma folha some no instante em que a mão se move. E roda **só** no modo
 * Documento — apontar a câmera para uma folha no modo Foto não deve acender
 * nada.
 */
export function useDocumentScan(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): DocumentScan {
  const [scan, setScan] = useState<DocumentScan>({ region: null, confidence: 0 });
  const seguidosRef = useRef(0);
  const ausentesRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setScan({ region: null, confidence: 0 });
      seguidosRef.current = 0;
      ausentesRef.current = 0;
      return;
    }

    const id = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const gray = sampleFrame(video);
      if (!gray) return;
      const achado = findDocument(gray, SAMPLE_W, SAMPLE_H);

      if (achado) {
        ausentesRef.current = 0;
        seguidosRef.current++;
        // Só depois de dois tiques concordando: a primeira leitura de uma mão
        // atravessando o quadro não deve mover a moldura.
        if (seguidosRef.current >= STEADY_TICKS)
          setScan({ region: achado.bounds, confidence: achado.confidence });
      } else {
        seguidosRef.current = 0;
        ausentesRef.current++;
        if (ausentesRef.current >= STEADY_TICKS)
          setScan({ region: null, confidence: 0 });
      }
    }, TICK_MS);

    return () => clearInterval(id);
  }, [enabled, videoRef]);

  return scan;
}
