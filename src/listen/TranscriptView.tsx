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
      {destaques.length > 0 && (
        <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-3.5">
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

      {blocos.map((bloco) => (
        <article
          key={bloco.atMs}
          className="rounded-2xl border border-line bg-surface-2 p-3.5"
        >
          <HoraBotao
            atMs={bloco.atMs}
            onOuvir={onOuvir}
            estrela={bloco.marcado}
          />
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
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

  return (
    <button
      type="button"
      onClick={() => onOuvir(atMs)}
      aria-label={`Ouvir a aula a partir de ${formatClock(atMs)}`}
      className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full bg-accent/12 px-2 font-mono text-[11.5px] tabular-nums text-accent transition-transform active:scale-95"
    >
      {conteudo}
    </button>
  );
}
