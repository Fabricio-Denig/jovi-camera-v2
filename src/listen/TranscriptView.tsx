import { formatClock } from "../shared/lib/time";
import { CopyButton } from "../slid/CopyButton";
import {
  acharDestaques,
  blocosDeFala,
  transcricaoComoTexto,
} from "./speechInsights";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

/**
 * A aula falada, para reler.
 *
 * Isto não é legenda de vídeo nem despejo de reconhecimento. É a segunda
 * fonte de texto da aula, ao lado do que a câmera leu do quadro — e nas aulas
 * em que o quadro sai ilegível (letra à mão, slide longe, luz ruim) é a
 * **única** fonte que sobra. O teste no celular mostrou exatamente isso: OCR
 * insuficiente e quarenta minutos de fala que o app tinha gravado e não
 * usava.
 *
 * Cada parágrafo carrega a hora em que foi dito, e a hora é um botão: tocar
 * nela leva a gravação para aquele instante. É o que transforma uma parede de
 * texto em algo navegável — e o que liga esta aba ao tocador logo acima.
 */
export function TranscriptView({
  segments,
  onOuvir,
}: {
  segments: TranscriptSegment[];
  /** Presente só quando a aula tem gravação para onde pular. */
  onOuvir?: (atMs: number) => void;
}) {
  const blocos = blocosDeFala(segments);
  const destaques = acharDestaques(segments);

  if (blocos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {/*
        Os destaques primeiro, quando existem.

        Eles são o atalho: numa aula de quarenta minutos, os três instantes em
        que alguém disse "isso cai na prova" valem mais que a leitura inteira.
        Nenhum deles é escolhido por relevância inventada — cada um existe
        porque a expressão foi realmente dita, e a frase mostrada é a frase
        reconhecida.
      */}
      {/*
       * Barra de destaque à esquerda, e não um cartão preenchido: o mesmo
       * ajuste feito em "Professor destacou" na aba Resumo
       * (`ClassSummaryTab.tsx`), pela mesma razão — continua se destacando
       * pela cor e pela régua, sem fechar mais uma moldura em volta do texto.
       */}
      {destaques.length > 0 && (
        <section className="border-l-2 border-accent pl-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-accent">
            O professor marcou
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {destaques.map((d) => (
              <li key={`${d.atMs}-${d.marca}`} className="flex gap-2">
                <HoraBotao atMs={d.atMs} onOuvir={onOuvir} estrela />
                <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">
                  {d.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
       * Cada trecho falado era um cartão preenchido (`rounded-2xl border
       * bg-surface-2`) — numa aula de quarenta minutos, dezenas deles
       * empilhados liam como uma conversa de chat, um balão por fala, não
       * como uma transcrição para reler. Um divisor fino entre trechos (a
       * partir do segundo) e o horário como rótulo discreto — não mais um
       * botão do tamanho de uma pílula de estado — dá ritmo de texto corrido,
       * com a hora ainda tocável para quem quer ouvir daquele ponto.
       */}
      {blocos.map((bloco, index) => (
        <article
          key={bloco.atMs}
          className={index > 0 ? "border-t border-line pt-3" : undefined}
        >
          <HoraBotao
            atMs={bloco.atMs}
            onOuvir={onOuvir}
            estrela={bloco.marcado}
          />
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
            {bloco.text}
          </p>
        </article>
      ))}

      <div className="pt-1">
        <CopyButton
          texto={transcricaoComoTexto(segments)}
          rotulo="Copiar transcrição"
        />
      </div>
    </div>
  );
}

/**
 * A hora do trecho — botão quando há áudio, texto quando não há.
 *
 * Sem gravação ela continua aparecendo: o horário situa o trecho na aula
 * mesmo sem nada para tocar. O que não pode existir é o botão que parece
 * clicável e não leva a lugar nenhum.
 */
function HoraBotao({
  atMs,
  onOuvir,
  estrela = false,
}: {
  atMs: number;
  onOuvir?: (atMs: number) => void;
  estrela?: boolean;
}) {
  const conteudo = (
    <>
      {estrela && <span aria-hidden="true">★</span>}
      {formatClock(atMs)}
    </>
  );

  if (!onOuvir) {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[11.5px] tabular-nums text-accent">
        {conteudo}
      </span>
    );
  }

  // Fundo mais fraco que antes (`/12` → `/8`) e sem padding lateral extra: o
  // horário precisa continuar tocável, mas discreto o bastante para não
  // competir com o texto — que é o conteúdo desta aba, não ele.
  return (
    <button
      type="button"
      onClick={() => onOuvir(atMs)}
      aria-label={`Ouvir a aula a partir de ${formatClock(atMs)}`}
      className="-ml-1.5 inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full bg-accent/8 px-1.5 font-mono text-[11px] tabular-nums text-accent transition-transform active:scale-95"
    >
      {conteudo}
    </button>
  );
}
