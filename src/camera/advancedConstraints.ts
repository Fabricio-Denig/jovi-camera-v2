import type { ConfiguracaoDeImagem } from "./mediaCapabilities";

/**
 * Um lugar só para pedir `applyConstraints({ advanced: [...] })`.
 *
 * O motivo de existir: `advanced` é uma propriedade de topo do dicionário de
 * constraints, e pedir `{ advanced: [{ zoom: 2 }] }` substitui **o array
 * inteiro** — não soma ao que já estava pedido. Três funcionalidades deste
 * app mexem no mesmo `advanced` do mesmo track (zoom, lanterna, foco), e cada
 * uma pedindo direto ao track é exatamente o desenho que apaga o pedido da
 * anterior: a lanterna acesa por `useTorch` podia desligar sozinha no
 * instante em que `useZoom` pedisse um nível novo, porque o segundo pedido
 * nunca mencionava `torch`.
 *
 * Este módulo guarda, por track, o último conjunto `advanced` que foi pedido
 * **e aceito**, e todo pedido novo funde com ele antes de chamar
 * `applyConstraints` — então pedir zoom não apaga a lanterna, e vice-versa.
 *
 * A chave é o próprio `MediaStreamTrack`. Um `WeakMap` é o que faz isso certo
 * sozinho: quando a câmera troca de lado, o track antigo é outro objeto, e o
 * estado dele não vaza para o novo — o novo começa do zero, que é o
 * comportamento correto (o hardware novo pode nem oferecer as mesmas
 * capacidades).
 *
 * O que este arquivo NÃO resolve: se o navegador em si zera um `advanced`
 * anterior internamente ao aceitar um novo pedido (o comportamento real varia
 * por navegador e não foi isso que a bancada mostrou — aqui um valor aplicado
 * sobrevive a uma chamada seguinte que não o repete). Fundir aqui custa quase
 * nada e remove o risco nos dois sentidos, então a defesa fica de qualquer
 * jeito.
 */
const estadoPorTrack = new WeakMap<MediaStreamTrack, ConfiguracaoDeImagem>();

/**
 * Pede um pedaço de configuração de imagem, fundido com o que já foi aplicado
 * com sucesso neste track antes.
 *
 * Devolve `true` só quando `applyConstraints` resolve sem lançar. Isso **não**
 * prova que o hardware obedeceu — só que o navegador aceitou tentar. A prova
 * de que algo mudou de verdade é reler `getSettings()` depois, e isso é
 * responsabilidade de quem chama (`useFocus`, `useZoom`, `useTorch`), porque
 * cada um sabe o que perguntar.
 */
export async function aplicarAvancadas(
  track: MediaStreamTrack,
  parciais: ConfiguracaoDeImagem,
): Promise<boolean> {
  const atual = estadoPorTrack.get(track) ?? {};
  const combinado = { ...atual, ...parciais };
  try {
    await track.applyConstraints({
      advanced: [combinado as unknown as MediaTrackConstraintSet],
    });
    estadoPorTrack.set(track, combinado);
    return true;
  } catch {
    // Recusado: o que já estava aplicado continua valendo, e não é
    // substituído por um pedido que falhou.
    return false;
  }
}

/** Só para teste e diagnóstico: o que este módulo acha que já pediu com sucesso. */
export function estadoConhecido(track: MediaStreamTrack): ConfiguracaoDeImagem | undefined {
  return estadoPorTrack.get(track);
}
