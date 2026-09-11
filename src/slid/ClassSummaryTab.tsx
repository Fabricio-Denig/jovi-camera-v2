import { CopyButton } from "./CopyButton";
import { QuickActions } from "./QuickActions";
import { ListenFromHere } from "./ListenFromHere";
import { classAsText } from "./classText";
import {
  KIND_NAMES,
  overviewWithStatus,
  type ContentKind,
} from "./readContent";
import { STATUS_STYLES } from "./status";
import { formatClock } from "../shared/lib/time";
import type { ClassRecord } from "./classes";
import {
  acharDestaques,
  frasesRepresentativas,
  topicosDaFala,
} from "../listen/speechInsights";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

/**
 * A aba Resumo: a aula condensada no que dá para afirmar sobre ela.
 *
 * O wireframe chama esta aba de "Resumo IA" e desenha, embaixo das fórmulas,
 * três marcadores do tipo "Δ > 0 → duas raízes reais". Isso é conhecimento
 * sobre o assunto, não leitura da captura — nenhuma daquelas três linhas está
 * escrita no slide desenhado. É exatamente a coisa que este produto não faz.
 *
 * Então a forma do Figma fica e a fonte do conteúdo continua sendo a aula:
 * quantos momentos, quanto tempo, que estruturas a câmera reconheceu pela
 * forma, e quais linhas o professor escreveu como título. Quando a leitura não
 * deu nada, as seções somem em vez de encherem com texto plausível — um resumo
 * convincente de uma aula que não aconteceu é a pior coisa que esta tela
 * poderia produzir.
 *
 * **O que a fala acrescenta, e o limite dela.** Desde que a aula passou a ser
 * transcrita, o resumo tem duas fontes em vez de uma. Isso resolve o caso que
 * o teste no celular expôs — quadro ilegível, resumo genérico, e a aula
 * inteira falada ali do lado — e não afrouxa nada: as frases mostradas aqui
 * **foram ditas**, palavra por palavra, escolhidas entre as que existem por
 * frequência de termos, proximidade de um momento guardado e marcação de
 * ênfase. Nenhuma é gerada.
 *
 * O limite continua valendo nos dois sentidos. Se a fala disser só "isso aqui
 * é importante" sem dizer o quê, o resumo não descobre o assunto: a frase
 * aparece como foi dita, e nada é completado em volta dela.
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
  const falado = frasesRepresentativas(transcript, momentosMs);
  const destaques = acharDestaques(transcript, 4);
  /*
   * Termos da fala só quando o quadro não deu tópico nenhum.
   *
   * Com os dois, a lista misturaria o que o professor escreveu como título com
   * palavras que ele repetiu falando — e as primeiras são muito melhores,
   * porque alguém decidiu escrevê-las. Sem os primeiros, os segundos são a
   * única resposta honesta para "do que foi esta aula", e deixar a seção
   * sumir seria esconder o que o app sabe.
   */
  const topicos =
    record.topics.length > 0 ? record.topics : topicosDaFala(transcript);

  const nada =
    !record.overview &&
    topicos.length === 0 &&
    record.kinds.length === 0 &&
    falado.length === 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Que a aula foi gravada é um fato sobre ela, e entra no resumo como
          qualquer outro — não como propaganda de um recurso.

          As duas frases são separadas porque as duas coisas são separadas: o
          arquivo de áudio é gravado pelo app e fica neste aparelho; a
          transcrição é feita pelo reconhecimento do navegador, e o que ele faz
          com o som é decisão dele, não deste app. Dizer "transcrição local"
          seria uma garantia que não temos como dar. */}
      {temAudio && (
        <p className="-mb-2 text-[12.5px] text-ink-muted">
          Esta aula tem gravação de áudio.
          {falado.length > 0
            ? " O que foi dito também foi transcrito."
            : transcriptStatus === "indisponivel"
              ? " A transcrição da fala não funcionou neste navegador."
              : ""}
        </p>
      )}

      {record.overview && (
        <p className="text-[15px] leading-relaxed text-ink">
          {overviewWithStatus(
            record.overview,
            record.status,
            record.status ? STATUS_STYLES[record.status].label : null,
          )}
        </p>
      )}

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

      {topicos.length > 0 && (
        <section className="rounded-2xl bg-surface-2 px-4 py-4">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Nesta aula
          </h2>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {topicos.map((topic) => (
              <li
                key={topic}
                className="flex gap-2 text-[14.5px] leading-snug text-ink"
              >
                <span aria-hidden="true" className="text-accent">
                  •
                </span>
                <span className="min-w-0 flex-1">{topic}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        O que foi dito — e é literalmente o que foi dito.

        Esta seção é a diferença entre "o SliD escuta" e "o SliD entende o que
        escutou". Cada linha é uma frase reconhecida, escolhida por três
        sinais que já existem na aula: os termos que mais se repetem nela, a
        proximidade de um momento que a câmera achou digno de guardar, e a
        marcação de ênfase do próprio professor. Nenhuma foi escrita aqui.
      */}
      {falado.length > 0 && (
        <section>
          <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            O que foi dito
          </h2>
          <ul className="flex flex-col gap-2">
            {falado.map((frase) => (
              <li
                key={frase}
                className="flex gap-2 text-[14px] leading-snug text-ink"
              >
                <span aria-hidden="true" className="text-accent">
                  •
                </span>
                <span className="min-w-0 flex-1">{frase}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Os instantes em que alguém disse que aquilo importa — com a hora,
          porque a hora é o que leva de volta até lá. */}
      {destaques.length > 0 && (
        <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] px-4 py-4">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">
            O professor marcou
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {destaques.map((d) => (
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

      {nada && (
        <p className="pt-6 text-center text-sm text-ink-muted">
          Esta aula não tem resumo — a câmera guardou os momentos, mas não
          conseguiu ler o suficiente para montar um.
        </p>
      )}

      <CopyButton
        texto={classAsText(record, transcript)}
        rotulo="Copiar a aula inteira"
      />

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
