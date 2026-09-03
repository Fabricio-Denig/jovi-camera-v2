/**
 * O status da aula — a pergunta que a banca pediu e a única que o aplicativo
 * faz ao estudante sobre o conteúdo em si.
 *
 * Cinco, não sete. A lista que veio no pedido tinha "Tranquilo", "Revisado" e
 * "Concluído", que são a mesma decisão dita de três jeitos, e sete pastilhas não
 * cabem numa linha de celular sem virar rolagem — rolagem numa pergunta que se
 * responde em um toque é atrito puro.
 *
 * E nenhum é obrigatório. Uma aula sem status é uma aula completa; o filtro
 * apenas tem uma forma a menos de encontrá-la. Inventar um "Novo" para toda aula
 * salva seria carimbar uma resposta que o estudante não deu.
 */
export const CLASS_STATUSES = [
  "revisar",
  "atencao",
  "importante",
  "tranquilo",
  "revisado",
] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];

export interface StatusStyle {
  /** Como aparece na pastilha e no filtro. */
  label: string;
  /** O que ele quer dizer, para a tela em que se escolhe. */
  meaning: string;
  /** Classes do cartão e da pastilha. */
  chip: string;
  /** Classe do ponto colorido, para quando só cabe a cor. */
  dot: string;
}

/*
 * A cor carrega o significado antes da palavra: vermelho pede volta, âmbar
 * pede cuidado, azul marca o que cai na prova, verde encerra. "Tranquilo" fica
 * neutro de propósito — é a ausência de alarme, e pintá-lo competiria com os
 * três que realmente pedem atenção.
 */
export const STATUS_STYLES: Record<ClassStatus, StatusStyle> = {
  revisar: {
    label: "Revisar",
    meaning: "Preciso estudar de novo",
    chip: "bg-danger/15 text-danger",
    dot: "bg-danger",
  },
  atencao: {
    label: "Atenção",
    meaning: "Fiquei com dúvida",
    chip: "bg-warn/15 text-warn",
    dot: "bg-warn",
  },
  importante: {
    label: "Importante",
    meaning: "Cai na prova ou no trabalho",
    chip: "bg-accent/15 text-accent",
    dot: "bg-accent",
  },
  tranquilo: {
    label: "Tranquilo",
    meaning: "Entendi bem",
    chip: "bg-surface-2 text-ink-muted",
    dot: "bg-ink-muted",
  },
  revisado: {
    label: "Revisado",
    meaning: "Já revisei depois",
    chip: "bg-emerald-500/15 text-emerald-400",
    dot: "bg-emerald-400",
  },
};

/** Aulas gravadas antes disto — ou com um status que deixou de existir — não têm. */
export function readStatus(value: string | undefined | null): ClassStatus | null {
  return value && (CLASS_STATUSES as readonly string[]).includes(value)
    ? (value as ClassStatus)
    : null;
}
