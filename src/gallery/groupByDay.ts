import type { CapturedMedia } from "../types/camera";

/**
 * O rolo, partido em seções por data.
 *
 * O Figma (`339:540`) mostra a grade sob um rótulo `RECENTES` com um "Ver
 * tudo" ao lado. Copiar isso ao pé da letra daria um botão que não leva a
 * lugar nenhum — a vista Fotos já mostra todas as fotos, então "ver tudo" seria
 * um enfeite que não funciona.
 *
 * O que o rótulo pede de verdade é que o rolo tenha divisões, e a divisão que
 * um rolo de câmera tem é a data. Então `RECENTES` passa a significar algo:
 * os últimos sete dias. O resto vem em seções datadas, que é o que qualquer
 * galeria de celular faz e o que torna um rolo longo navegável.
 */
export interface DayGroup {
  id: string;
  label: string;
  items: CapturedMedia[];
}

/** Uma semana: a fronteira do que ainda é "recente" num rolo de câmera. */
const RECENT_DAYS = 7;

export function groupByDay(items: CapturedMedia[], now = Date.now()): DayGroup[] {
  const recentes: CapturedMedia[] = [];
  const anteriores = new Map<string, CapturedMedia[]>();
  const corte = now - RECENT_DAYS * 86400000;

  // Já vêm do mais novo para o mais velho; manter a ordem mantém as seções
  // em ordem sem precisar reordenar nada depois.
  for (const item of items) {
    if (item.createdAt >= corte) {
      recentes.push(item);
      continue;
    }
    const dia = new Date(item.createdAt);
    const chave = `${dia.getFullYear()}-${dia.getMonth()}`;
    const lista = anteriores.get(chave);
    if (lista) lista.push(item);
    else anteriores.set(chave, [item]);
  }

  const grupos: DayGroup[] = [];
  if (recentes.length > 0)
    grupos.push({ id: "recentes", label: "Recentes", items: recentes });
  for (const [chave, lista] of anteriores) {
    grupos.push({
      id: chave,
      label: new Date(lista[0].createdAt).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      items: lista,
    });
  }
  return grupos;
}
