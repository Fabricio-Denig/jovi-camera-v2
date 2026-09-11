import { CopyButton } from "./CopyButton";
import { classAsText } from "./classText";
import { KIND_NAMES, overviewWithStatus, type ContentKind } from "./readContent";
import { STATUS_STYLES } from "./status";
import { formatClock } from "../shared/lib/time";
import type { ClassRecord } from "./classes";

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
 */
export function ClassSummaryTab({ record }: { record: ClassRecord }) {
  const nada =
    !record.overview && record.topics.length === 0 && record.kinds.length === 0;

  return (
    <div className="flex flex-col gap-5">
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

      {record.topics.length > 0 && (
        <section className="rounded-2xl bg-surface-2 px-4 py-4">
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Nesta aula
          </h2>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {record.topics.map((topic) => (
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

      <CopyButton texto={classAsText(record)} rotulo="Copiar a aula inteira" />
    </div>
  );
}

/** Tipos guardados voltam como texto; um desconhecido simplesmente não diz nada. */
function nameKind(kind: string, count: number): string {
  const names = KIND_NAMES[kind as ContentKind];
  return names ? names[count === 1 ? 0 : 1] : "";
}
