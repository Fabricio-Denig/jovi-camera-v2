import { classAsText } from "./classText";
import type { ClassRecord } from "./classes";

/**
 * O que dá para fazer com uma aula, e o que este navegador realmente faz.
 *
 * A regra deste arquivo é a regra do produto inteiro nesta reta final: um
 * botão visível faz alguma coisa de verdade ou não está na tela. Então a
 * capacidade é detectada antes de o botão ser desenhado — não depois, com uma
 * mensagem de erro.
 */

/** `navigator.share` existe e este navegador aceita compartilhar texto. */
export function podeCompartilhar(): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    // `canShare` é o único jeito honesto de perguntar: `share` existe em
    // navegadores que recusam tudo que não seja URL.
    return navigator.canShare
      ? navigator.canShare({ text: "teste", title: "teste" })
      : true;
  } catch {
    return false;
  }
}

/** Imprimir existe em todo navegador de mesa e na maioria dos de celular. */
export function podeImprimir(): boolean {
  return typeof window !== "undefined" && typeof window.print === "function";
}

export type ResultadoDeCompartilhar = "compartilhou" | "cancelou" | "falhou";

/**
 * Compartilha a aula como texto.
 *
 * Texto e não arquivo: as imagens de uma aula somam dezenas de megabytes, e
 * `navigator.share` com muitos arquivos falha em silêncio em vários
 * aparelhos. O texto é o que a aula tem de mais útil para mandar para alguém,
 * e é o que cabe em qualquer canal.
 *
 * `AbortError` é a pessoa fechando a folha de compartilhamento. Não é erro, e
 * tratar como erro faria a tela reclamar de uma decisão perfeitamente normal.
 */
export async function compartilharAula(
  record: ClassRecord,
): Promise<ResultadoDeCompartilhar> {
  const texto = classAsText(record);
  try {
    await navigator.share({ title: record.subject, text: texto });
    return "compartilhou";
  } catch (erro) {
    const nome = erro instanceof Error ? erro.name : "";
    return nome === "AbortError" ? "cancelou" : "falhou";
  }
}
