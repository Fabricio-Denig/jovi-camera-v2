import { INTERVALOS, type Intervalo, type TimelapseStatus } from "./useTimelapse";
import { formatClock } from "../shared/lib/time";

/**
 * Os controles do modo Intervalo.
 *
 * A tela precisa responder três perguntas enquanto grava, porque um time-lapse
 * é a única captura em que a pessoa não faz ideia do que está saindo: quantos
 * quadros já existem, quanto tempo real isso cobriu, e quanto vai durar o
 * vídeo. As três juntas dizem a quarta, que é a que importa — quantas vezes
 * mais rápido o resultado vai ficar.
 */
export function TimelapseBar({
  status,
  intervalo,
  onIntervalo,
  quadros,
  decorridoMs,
  duracaoFinalMs,
  aceleracao,
  ultima,
}: {
  status: TimelapseStatus;
  intervalo: Intervalo;
  onIntervalo: (v: Intervalo) => void;
  quadros: number;
  decorridoMs: number;
  duracaoFinalMs: number;
  aceleracao: number;
  ultima: string | null;
}) {
  if (status === "indisponivel") {
    return (
      <p className="mx-6 rounded-xl bg-warn/15 px-3 py-2 text-center text-[11.5px] leading-snug text-warn">
        Este navegador não consegue montar vídeo a partir do canvas. O modo
        Intervalo não funciona aqui.
      </p>
    );
  }

  const gravando = status === "gravando";

  return (
    <div className="pointer-events-auto flex w-full flex-col items-center gap-2 px-5">
      {gravando || status === "montando" ? (
        <div className="flex w-full max-w-sm items-center gap-3 rounded-2xl bg-canvas/90 px-3 py-2.5 backdrop-blur">
          <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
            {ultima && <img src={ultima} alt="" className="size-full object-cover" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${gravando ? "animate-pulse bg-danger" : "bg-warn"}`}
              />
              {status === "montando" ? "Montando o vídeo…" : `${quadros} quadros`}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-ink-muted">
              {formatClock(decorridoMs)} de tempo real → {formatClock(duracaoFinalMs)}{" "}
              de vídeo
              {aceleracao > 1 && (
                <span className="text-accent"> · {aceleracao}× mais rápido</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-sm flex-col items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white/70">
            Um quadro a cada
          </span>
          <div
            role="radiogroup"
            aria-label="Intervalo entre capturas"
            className="flex gap-1.5"
          >
            {INTERVALOS.map((v) => {
              const escolhido = v === intervalo;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={escolhido}
                  onClick={() => onIntervalo(v)}
                  className={`min-h-10 min-w-11 rounded-full px-3 text-[12.5px] font-medium transition-transform active:scale-95 ${
                    escolhido
                      ? "bg-white text-black"
                      : "bg-black/45 text-white/80 backdrop-blur"
                  }`}
                >
                  {v < 1 ? `${v * 1000}ms` : `${v}s`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
