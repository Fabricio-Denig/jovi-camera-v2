/**
 * As três aparências do documento escaneado.
 *
 * São filtros de CSS pelo mesmo motivo dos filtros da câmera: a mesma string
 * serve ao preview ao vivo e ao `ctx.filter` do canvas que grava o arquivo, e
 * o navegador compõe na GPU. Nada de laço de pixels.
 *
 * "Documento" é a razão de o modo existir — o que faz um papel fotografado
 * virar algo legível é levantar contraste e tirar a dominante de cor da luz
 * ambiente, que é o que deixa toda foto de folha com cara de amarelada.
 */
export interface DocumentLook {
  id: string;
  label: string;
  hint: string;
  css: string;
}

export const DOCUMENT_LOOKS: DocumentLook[] = [
  { id: "original", label: "Original", hint: "Como a câmera viu", css: "none" },
  {
    id: "documento",
    label: "Documento",
    hint: "Fundo limpo, texto firme",
    css: "saturate(0.35) contrast(1.55) brightness(1.16)",
  },
  {
    id: "pb",
    label: "P&B",
    hint: "Só preto no branco",
    css: "grayscale(1) contrast(1.8) brightness(1.14)",
  },
];

export function findLook(id: string): DocumentLook {
  return DOCUMENT_LOOKS.find((l) => l.id === id) ?? DOCUMENT_LOOKS[0];
}
