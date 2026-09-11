import { STATUS_STYLES } from "./status";
import { overviewWithStatus } from "./readContent";
import { formatClock, formatDate } from "../shared/lib/time";
import type { ClassRecord } from "./classes";

/** Chave frouxa para comparar duas leituras da mesma linha. */
const chave = (linha: string) => linha.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * As linhas de um momento sem a que já virou título.
 *
 * O título quase sempre É uma das linhas lidas — `pickHeading` escolhe uma
 * linha do quadro para nomear o momento. Mostrar as duas põe a mesma frase
 * como cabeçalho e como primeiro item logo abaixo dela, que é o tipo de
 * repetição que faz a tela parecer gerada por máquina.
 */
export function linesWithoutTitle(momento: {
  label: string;
  lines: string[];
  detail: string | null;
}): string[] {
  const titulo = chave(momento.label);
  const limpas = momento.lines.filter((linha) => chave(linha) !== titulo);
  if (limpas.length > 0) return limpas;
  // Sobrou nada: o momento leu só o próprio título. A legenda ainda pode
  // trazer algo, desde que não seja o título de novo.
  if (momento.detail && chave(momento.detail) !== titulo) return [momento.detail];
  return [];
}

/**
 * A aula como texto puro, para copiar e para o PDF.
 *
 * Só entra o que já está na tela: o que a câmera leu, os títulos que o
 * professor escreveu, e o que o estudante disse (nome, matéria, status).
 * Nenhuma linha aqui é gerada para preencher espaço — um momento sem leitura
 * aparece com o horário e o título e mais nada, que é a verdade sobre ele.
 */
export function classAsText(record: ClassRecord): string {
  const partes: string[] = [];

  partes.push(record.subject);
  const cabecalho = [
    record.discipline,
    record.status ? STATUS_STYLES[record.status].label : null,
    formatDate(record.savedAt),
    `${formatClock(record.durationMs)} de aula`,
    `${record.moments.length} ${record.moments.length === 1 ? "momento" : "momentos"}`,
  ].filter(Boolean);
  partes.push(cabecalho.join(" · "));

  if (record.overview) {
    partes.push(
      "",
      overviewWithStatus(
        record.overview,
        record.status,
        record.status ? STATUS_STYLES[record.status].label : null,
      ),
    );
  }

  if (record.topics.length > 0) {
    partes.push("", "NESTA AULA");
    for (const topico of record.topics) partes.push(`• ${topico}`);
  }

  const comLeitura = record.moments.filter((m) => m.lines.length > 0);
  if (comLeitura.length > 0 || record.moments.length > 0) {
    partes.push("", "MOMENTOS");
    for (const momento of record.moments) {
      partes.push("", `[${formatClock(momento.atMs)}] ${momento.label}`);
      if (momento.category) partes.push(`(${momento.category})`);
      for (const linha of linesWithoutTitle(momento)) partes.push(linha);
    }
  }

  return partes.join("\n").trim();
}

/** Só a aba Texto, que é o que o botão "Copiar texto" do wireframe copia. */
export function momentsAsText(record: ClassRecord): string {
  const partes: string[] = [];
  for (const momento of record.moments) {
    const linhas = linesWithoutTitle(momento);
    if (linhas.length === 0) continue;
    if (partes.length > 0) partes.push("");
    partes.push(`[${formatClock(momento.atMs)}] ${momento.label}`);
    for (const linha of linhas) partes.push(linha);
  }
  return partes.join("\n").trim();
}
