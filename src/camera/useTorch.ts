import { useCallback, useEffect, useState } from "react";
import { aplicarAvancadas } from "./advancedConstraints";
import { lerCapacidades } from "./mediaCapabilities";

export interface CameraTorch {
  /** O aparelho tem lanterna nesta câmera e o navegador deixa mexer nela. */
  available: boolean;
  on: boolean;
  toggle: () => void;
}

/**
 * A lanterna, quando o aparelho tem uma e o navegador a expõe.
 *
 * Isto é `torch`, não flash de disparo: a web não tem flash sincronizado com o
 * obturador. Acender antes e apagar depois seria improvisar um flash que
 * piscaria na cara de quem está sendo fotografado sem sincronia nenhuma, então
 * o botão faz o que diz — acende e apaga.
 *
 * O Chrome no Android costuma expor; o Safari não expõe. Quando não existe, o
 * botão não aparece: um controle morto na barra é pior do que a ausência dele,
 * porque a banca vai tocar e concluir que o app está quebrado.
 */
export function useTorch(stream: MediaStream | null): CameraTorch {
  const [available, setAvailable] = useState(false);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      setAvailable(false);
      setOn(false);
      return;
    }
    const caps = lerCapacidades(track);
    setAvailable(Boolean(caps?.torch));
    // Uma câmera nova começa apagada, e a frontal normalmente nem tem lanterna.
    setOn(false);
  }, [stream]);

  const toggle = useCallback(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    const next = !on;
    setOn(next);
    // Por `aplicarAvancadas`, para o mesmo `advanced` não apagar o zoom ou o
    // foco que já tinham sido pedidos com sucesso neste track.
    void aplicarAvancadas(track, { torch: next }).then((aceito) => {
      if (!aceito) {
        // Pedimos e o aparelho recusou: o botão volta ao que a lanterna está.
        setOn(!next);
        setAvailable(false);
      }
    });
  }, [stream, on]);

  return { available, on, toggle };
}
