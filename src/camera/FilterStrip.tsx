import { useEffect, useRef, useState } from "react";
import { CAMERA_FILTERS } from "./filters";

/** De quanto em quanto tempo a amostra da tira é renovada. */
const REFRESH_MS = 2500;
const THUMB_W = 96;
const THUMB_H = 128;

/**
 * A tira de filtros, com cada miniatura mostrando a cena que está na frente.
 *
 * Uma amostra só, redesenhada seis vezes com filtros de CSS diferentes. Seis
 * <video> ao vivo seria seis decodificações simultâneas concorrendo com a
 * análise da aula; um quadro parado renovado a cada dois segundos e meio dá a
 * mesma leitura — "é assim que a sua cena fica" — por perto de nada.
 *
 * E ela só desenha enquanto está aberta e a câmera está em Foto: fora disso não
 * há tira, não há temporizador e não há amostra sendo tirada.
 */
export function FilterStrip({
  videoRef,
  active,
  onSelect,
  mirrored,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: string;
  onSelect: (id: string) => void;
  mirrored: boolean;
}) {
  const [amostra, setAmostra] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvas.current) {
      canvas.current = document.createElement("canvas");
      canvas.current.width = THUMB_W;
      canvas.current.height = THUMB_H;
    }

    const tirar = () => {
      const video = videoRef.current;
      const cv = canvas.current;
      if (!video || !cv || !video.videoWidth) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      // Recorte central no formato da miniatura, para ela mostrar o mesmo
      // enquadramento que o visor e não uma versão espremida dele.
      const alvo = THUMB_W / THUMB_H;
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
        THUMB_W,
        THUMB_H,
      );
      setAmostra(cv.toDataURL("image/jpeg", 0.6));
    };

    tirar();
    const timer = setInterval(tirar, REFRESH_MS);
    return () => clearInterval(timer);
  }, [videoRef]);

  return (
    <div className="pointer-events-auto w-full">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CAMERA_FILTERS.map((filtro) => {
          const selecionado = filtro.id === active;
          return (
            <button
              key={filtro.id}
              type="button"
              onClick={() => onSelect(filtro.id)}
              aria-pressed={selecionado}
              aria-label={`Filtro ${filtro.label}`}
              className="shrink-0 transition-transform duration-150 active:scale-95"
            >
              <span
                className={`block size-14 overflow-hidden rounded-xl border-2 bg-black/40 transition-colors ${
                  selecionado ? "border-white" : "border-white/25"
                }`}
              >
                {amostra && (
                  <img
                    src={amostra}
                    alt=""
                    className="size-full object-cover"
                    style={{
                      filter: filtro.css === "none" ? undefined : filtro.css,
                      transform: mirrored ? "scaleX(-1)" : undefined,
                    }}
                  />
                )}
              </span>
              <span
                className={`mt-1 block text-center text-[10px] font-medium ${
                  selecionado ? "text-white" : "text-white/65"
                }`}
              >
                {filtro.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
