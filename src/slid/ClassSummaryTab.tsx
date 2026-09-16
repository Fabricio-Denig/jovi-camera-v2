import { CopyButton } from "./CopyButton";
import { QuickActions } from "./QuickActions";
import { ListenFromHere } from "./ListenFromHere";
import { resumoAsText, linesWithoutTitle } from "./classText";
import { KIND_NAMES, type ContentKind } from "./readContent";
import { formatClock } from "../shared/lib/time";
import type { ClassRecord } from "./classes";
import { gerarResumoGlobal } from "../listen/lessonSummary";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

/**
 * A aba Resumo: o payoff do SliD.
 *
 * Não é mais um relatório sobre o que o SISTEMA fez ("esta aula registrou 3
 * momentos em 8 minutos") — isso vira metadata pequena, quando sobra. O que
 * abre a tela agora é uma síntese GLOBAL de sobre o que a aula foi, montada
 * por `gerarResumoGlobal` (transcrição + quadro + momentos + destaques do
 * professor, todos juntos) — não uma lista de frases soltas que cresce com a
 * duração da aula. Um teste real expôs exatamente esse defeito: a aba
 * virando "quase a transcrição de volta" numa aula de menos de um minuto.
 * `gerarResumoGlobal` garante compressão de verdade, com um teto de
 * palavras que nunca deixa o resumo crescer proporcional à aula.
 *
 * A regra que continua valendo, herdada da versão anterior desta aba: nada é
 * inventado. Cada frase aqui foi dita ou lida; o que muda é que agora elas
 * são agrupadas por conceito e costuradas com conectores, não despejadas uma
 * a uma.
 */
export function ClassSummaryTab({
  record,
  temAudio = false,
  transcript = [],
  transcriptStatus,
  onOuvir,
  onExcluir,
}: {
  record: ClassRecord;
  /** A aula tem gravação — dito no resumo, porque é fato sobre a aula. */
  temAudio?: boolean;
  /** A fala reconhecida, quando houve. */
  transcript?: TranscriptSegment[];
  transcriptStatus?: "ok" | "indisponivel" | "desligada";
  onOuvir?: (atMs: number) => void;
  onExcluir: () => void;
}) {
  const momentosMs = record.moments.map((m) => m.atMs);
  // As duas formas do quadro: os tópicos já curados (`summariseTopics`, um
  // título por vez) e as linhas de cada momento (mais detalhe). As duas
  // entram como evidência — `gerarResumoGlobal` decide o que usar.
  const ocrLinhas = [
    ...record.topics,
    ...record.moments.flatMap((m) => linesWithoutTitle(m)),
  ];
  const resumo = gerarResumoGlobal({ transcript, ocrLinhas, momentosMs });

  const semNadaMesmo =
    !resumo.temConteudo && record.kinds.length === 0 && record.moments.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/*
        Independente de o resumo ter dado certo por outra fonte (o quadro):
        o áudio existir e a transcrição ter falhado é um fato sobre ESSA
        fonte, e precisa ser dito mesmo quando o quadro sustenta o resumo
        sozinho — as duas fontes falham de forma independente, e escondida
        atrás de um resumo bem-sucedido esta informação nunca chegaria a
        quem só tem aquele um navegador quebrado para descobrir.
      */}
      {temAudio && transcriptStatus === "indisponivel" && (
        <p className="-mb-2 text-[12.5px] text-ink-muted">
          A transcrição da fala não funcionou neste navegador. O áudio da
          aula continua salvo.
        </p>
      )}

      {resumo.temConteudo ? (
        <>
          {/* O PAYOFF: a síntese global, não um relatório sobre o sistema. */}
          <section>
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Resumo da aula
            </h2>
            <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink">
              {resumo.overview}
            </p>
          </section>

          {resumo.pontosPrincipais.length > 0 && (
            /*
             * Divisor no lugar de um cartão preenchido: logo abaixo do cabeçalho
             * (já um cartão) e do resumo, mais uma caixa cinza igual só somava
             * "empilhado" ao invés de "organizado". A régua de cima e o
             * espaçamento já separam a seção sem embrulhar o conteúdo de novo.
             */
            <section className="border-t border-line pt-4">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Pontos principais
              </h2>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {resumo.pontosPrincipais.map((ponto) => (
                  <li
                    key={ponto}
                    className="flex gap-2 text-[14px] leading-snug text-ink"
                  >
                    <span aria-hidden="true" className="text-accent">
                      •
                    </span>
                    <span className="min-w-0 flex-1">{ponto}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Os instantes em que alguém disse que aquilo importa — com a hora,
              porque a hora é o que leva de volta até lá. */}
          {resumo.professorDestacou.length > 0 && (
            /*
             * Era um cartão cheio (borda + fundo tingido) — a terceira caixa
             * em fila depois do cabeçalho e de "Pontos principais". Uma barra
             * de destaque à esquerda é o mesmo gesto de "isto é diferente" que
             * qualquer citação em destaque usa, sem fechar mais uma moldura em
             * volta do texto.
             */
            <section className="border-l-2 border-accent pl-3">
              <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">
                Professor destacou
              </h2>
              <ul className="mt-2.5 flex flex-col gap-2.5">
                {resumo.professorDestacou.map((d) => (
                  <li key={`${d.atMs}-${d.marca}`} className="flex flex-col gap-1">
                    <span className="text-[13.5px] leading-snug text-ink">
                      {d.text}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[11.5px] tabular-nums text-accent">
                        ★ {formatClock(d.atMs)}
                      </span>
                      {onOuvir && (
                        <ListenFromHere atMs={d.atMs} onOuvir={onOuvir} compacto />
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resumo.paraRevisar.length > 0 && (
            <section>
              <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                Para revisar
              </h2>
              <ul className="flex flex-col gap-1.5">
                {resumo.paraRevisar.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[14px] leading-snug text-ink"
                  >
                    <span aria-hidden="true" className="text-accent">
                      ◦
                    </span>
                    <span className="min-w-0 flex-1">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        /*
         * Reescrito numa rodada de confiança: a versão antiga ("A câmera
         * guardou os momentos desta aula, mas não conseguiu ler o suficiente
         * para montar um resumo") lia como um relatório de falha do sistema —
         * a câmera fazendo alguma coisa errado. A aula não é a câmera errando;
         * é só um resumo que não deu para montar, e o que existe (momentos,
         * áudio) continua ali, intacto. A segunda frase existe para dizer
         * exatamente isso — nada foi perdido — sempre que houver algo salvo.
         */
        <div className="pt-6 text-center">
          <p className="text-sm text-ink-muted">
            {semNadaMesmo
              ? "Ainda não há conteúdo suficiente para resumir esta aula."
              : "Ainda não foi possível montar um resumo desta aula."}
          </p>
          {!semNadaMesmo && (
            <p className="mt-1.5 text-[13px] leading-snug text-ink-muted/75">
              Os momentos e o áudio continuam salvos, para revisar quando
              quiser.
            </p>
          )}
        </div>
      )}

      {/* Metadata do que a câmera reconheceu — pequena de propósito, nunca
          ocupando o lugar do resumo. */}
      {record.kinds.length > 0 && (
        <section>
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Conteúdo reconhecido
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {record.kinds.map(([kind, count]) => (
              <span
                key={kind}
                className="rounded-full bg-accent/12 px-3 py-1.5 text-[12.5px] font-medium text-accent"
              >
                {count} {nameKind(kind, count)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* A linha do tempo continua aqui, e não na aba Imagens: ela responde
          "como a aula andou", que é pergunta de resumo. */}
      {record.moments.length > 0 && (
        <section>
          <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Como a aula andou
          </h2>
          <ol className="relative flex flex-col gap-2 pl-4">
            <span
              aria-hidden="true"
              className="absolute bottom-2 left-[3px] top-2 w-px bg-line"
            />
            {record.moments.map((momento) => (
              <li key={momento.media.id} className="relative flex gap-2">
                <span
                  aria-hidden="true"
                  className="absolute -left-4 top-1.5 size-[7px] rounded-full border border-accent bg-canvas"
                />
                <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-accent">
                  {formatClock(momento.atMs)}
                </span>
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
                  {momento.label}
                </span>
                {onOuvir && (
                  <ListenFromHere
                    atMs={momento.atMs}
                    onOuvir={onOuvir}
                    compacto
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {resumo.temConteudo && (
        <CopyButton texto={resumoAsText(record, resumo)} rotulo="Copiar resumo" />
      )}

      <QuickActions
        record={record}
        temAudio={temAudio}
        transcript={transcript}
        onExcluir={onExcluir}
      />
    </div>
  );
}

/** Tipos guardados voltam como texto; um desconhecido simplesmente não diz nada. */
function nameKind(kind: string, count: number): string {
  const names = KIND_NAMES[kind as ContentKind];
  return names ? names[count === 1 ? 0 : 1] : "";
}
