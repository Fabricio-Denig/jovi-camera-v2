import { useEffect, useState } from "react";
import { aplicarAvancadas } from "./advancedConstraints";
import { lerCapacidades, lerConfiguracao } from "./mediaCapabilities";

/**
 * O que este aparelho consegue dizer sobre foco — e o que ele consegue fazer.
 *
 * A distinção entre "declarado" e "confirmado" existe porque medi a diferença
 * nesta própria bancada: `getCapabilities().focusMode` lista `"continuous"`,
 * `applyConstraints({ focusMode: "continuous" })` resolve sem erro, e
 * `getSettings().focusMode` continua `"manual"` para sempre depois disso. A
 * API aceita o pedido e não faz nada — a mesma forma do achado do
 * `SpeechRecognition` (declarado ≠ produziu resultado). Por isso nada aqui
 * vira `true` só porque uma promise resolveu; sempre é relido de
 * `getSettings()`.
 */
export type EstadoDoFoco =
  /** Ainda não se sabe — nenhum track foi lido. */
  | "desconhecido"
  /** `focusMode` não está nas capacidades deste track, ou não há `getCapabilities`. */
  | "sem-suporte"
  /** O modo contínuo foi pedido e o navegador aceitou tentar. */
  | "pedido"
  /** Pedido e `getSettings()` confirma: o modo em uso é `continuous`. */
  | "confirmado";

export interface FocoDoAparelho {
  estado: EstadoDoFoco;
  /** Os `focusMode` que este track declara — para o diagnóstico, não para decisão de UI. */
  modosDeclarados: string[];
  /** `getSettings().focusMode` da última leitura — a prova, não a promessa. */
  modoAtual: string | null;
  /**
   * `pointsOfInterest` está nas capacidades deste track.
   *
   * Nesta bancada é sempre falso: o Chromium de mesa não lista essa chave
   * nem no dispositivo de câmera falsa, que por outro lado lista `focusMode`
   * cheio. Toque-para-focar só é oferecido quando isto é verdadeiro — nunca
   * por suposição.
   */
  tocarSuportado: boolean;
  /**
   * Pede foco num ponto normalizado (0–1, 0–1) do quadro da câmera.
   *
   * Só faz sentido chamar quando `tocarSuportado` é `true`. Devolve se o
   * pedido foi aceito — de novo, aceito não é confirmado; não há como ler de
   * volta *qual* ponto o hardware focou, só que o pedido não foi recusado.
   */
  focarEm: (ponto: { x: number; y: number }) => Promise<boolean>;
}

const SEM_SUPORTE: FocoDoAparelho = {
  estado: "sem-suporte",
  modosDeclarados: [],
  modoAtual: null,
  tocarSuportado: false,
  focarEm: async () => false,
};

/**
 * Autofoco contínuo por padrão na câmera traseira, quando o hardware declara
 * que tem — e só quando `getSettings()` prova que aceitou de verdade.
 *
 * Pedido uma vez por track (a troca de câmera, ou a recuperação depois de uma
 * interrupção, dá um track novo, e o pedido é refeito do zero para ele — o
 * hardware novo pode nem oferecer as mesmas capacidades). Nunca reaplicado
 * sozinho depois disso: sem toque-para-focar disponível não há gesto do
 * usuário que precise de um pedido novo, e insistir sem motivo é só tráfego
 * com o driver da câmera por nada.
 *
 * **O que este gancho nunca faz:** fingir. Se `focusMode` não estiver nas
 * capacidades, o estado fica `"sem-suporte"` e nada é pedido. Se for pedido e
 * `getSettings()` não confirmar, o estado fica `"pedido"` — não
 * `"confirmado"` — e é exatamente isso que aconteceu na bancada onde este
 * gancho foi escrito.
 */
export function useFocus(stream: MediaStream | null): FocoDoAparelho {
  const [foco, setFoco] = useState<FocoDoAparelho>(SEM_SUPORTE);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0] ?? null;

    if (!track) {
      setFoco(SEM_SUPORTE);
      return;
    }

    let cancelado = false;
    const caps = lerCapacidades(track);
    const modosDeclarados = caps?.focusMode ?? [];
    const tocarSuportado = "pointsOfInterest" in (caps ?? {});

    if (!modosDeclarados.includes("continuous")) {
      setFoco({
        estado: "sem-suporte",
        modosDeclarados,
        modoAtual: lerConfiguracao(track)?.focusMode ?? null,
        tocarSuportado,
        focarEm: (ponto) => pedirFoco(track, ponto),
      });
      return;
    }

    void aplicarAvancadas(track, { focusMode: "continuous" }).then((aceito) => {
      if (cancelado) return;
      // A prova é reler, não a promise. Ela pode resolver sem o modo mudar —
      // é exatamente o que este navegador faz.
      const modoAtual = lerConfiguracao(track)?.focusMode ?? null;
      setFoco({
        estado: aceito && modoAtual === "continuous" ? "confirmado" : "pedido",
        modosDeclarados,
        modoAtual,
        tocarSuportado,
        focarEm: (ponto) => pedirFoco(track, ponto),
      });
    });

    return () => {
      cancelado = true;
    };
  }, [stream]);

  return foco;
}

/** Pede foco num ponto — extraído para não duplicar entre os dois ramos do efeito. */
async function pedirFoco(
  track: MediaStreamTrack,
  ponto: { x: number; y: number },
): Promise<boolean> {
  const caps = lerCapacidades(track);
  if (!("pointsOfInterest" in (caps ?? {}))) return false;
  return aplicarAvancadas(track, { pointsOfInterest: [ponto] });
}
