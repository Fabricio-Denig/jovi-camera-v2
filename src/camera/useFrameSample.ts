import { useEffect, useRef, useState } from "react";

/** De quanto em quanto tempo a amostra é renovada. */
const REFRESH_MS = 2500;
/*
 * 240×320 e não 96×128, que era o tamanho de quando a amostra só alimentava
 * miniaturas de 56 px. A comparação "antes e depois" a mostra com 350 px de
 * largura, e nessa escala o quadro pequeno virava um borrão — o que anula o
 * ponto de comparar. Quatro vezes mais pixels num JPEG a cada dois segundos e
 * meio continua sendo perto de nada.
 */
const SAMPLE_W = 240;
const SAMPLE_H = 320;

/**
 * Um quadro parado do visor, para as miniaturas de filtro mostrarem a cena
 * real em vez de um retângulo cinza.
 *
 * Uma amostra só, e a mesma para a tira e para o painel. Sete <video> ao vivo
 * seriam sete decodificações simultâneas disputando a linha principal com a
 * análise da aula; um quadro renovado a cada dois segundos e meio dá a mesma
 * leitura — "é assim que a sua cena fica" — por perto de nada.
 *
 * `drawImage` a partir do <video> lê o quadro cru: a amostra nasce sem filtro,
 * e é por isso que dá para desenhá-la sete vezes com aparências diferentes.
 */
export function useFrameSample(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
): string | null {
  const [amostra, setAmostra] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!canvas.current) {
      canvas.current = document.createElement("canvas");
      canvas.current.width = SAMPLE_W;
      canvas.current.height = SAMPLE_H;
    }

    const tirar = () => {
      const video = videoRef.current;
      const cv = canvas.current;
      if (!video || !cv || !video.videoWidth) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      // Recorte central no formato da miniatura, para ela mostrar o mesmo
      // enquadramento que o visor e não uma versão espremida dele.
      const alvo = SAMPLE_W / SAMPLE_H;
      const atual = video.videoWidth / video.videoHeight;
      const sw = atual > alvo ? video.videoHeight * alvo : video.videoWidth;
      const sh = atual > alvo ? video.videoHeight : video.videoWidth / alvo;
      ctx.drawImage(
        video,
        (video.videoWidth - sw) / 2,
        (video.videoHeight - sh) / 2,
        sw,
        sh,
        0,
        0,
        SAMPLE_W,
        SAMPLE_H,
      );
      setAmostra(cv.toDataURL("image/jpeg", 0.72));
    };

    tirar();
    const timer = setInterval(tirar, REFRESH_MS);
    return () => clearInterval(timer);
  }, [videoRef, enabled]);

  return enabled ? amostra : null;
}
