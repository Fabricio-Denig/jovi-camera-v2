import { useEffect, useRef, useState } from "react";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";
import type { LessonAudio } from "../shared/lib/mediaStore";

/**
 * O áudio da aula, na aula guardada.
 *
 * Um player só, para um arquivo só — e é essa escolha que faz o recurso
 * funcionar. A alternativa seria cortar a gravação num arquivo por momento, o
 * que exigiria remontar áudio no navegador, e daria um recurso que quebra
 * inteiro quando a gravação falha no meio. Com um arquivo e uma lista de
 * tempos, "ouvir deste ponto" é uma atribuição a `currentTime`.
 *
 * Ele não usa o `<audio controls>` do navegador porque aquele controle tem
 * aparência própria em cada sistema e ignora o resto da tela. O elemento
 * continua sendo um `<audio>`; só a casca é nossa.
 */
export function LessonAudioPlayer({
  audio,
  /** Onde o player deve pular, quando alguém pede de fora. */
  seekTo,
  onSeeked,
}: {
  audio: LessonAudio;
  seekTo: number | null;
  onSeeked: () => void;
}) {
  const url = useObjectUrl(audio.blob);
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  const [posicao, setPosicao] = useState(0);
  /**
   * A duração medida pelo relógio da sessão, e não a do arquivo.
   *
   * Um webm gravado em pedaços costuma vir sem duração no cabeçalho, e o
   * elemento devolve `Infinity` até o arquivo ser percorrido inteiro. O
   * relógio da sessão sabe o número desde sempre.
   */
  const [duracao, setDuracao] = useState(audio.durationMs / 1000);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    if (seekTo === null || !ref.current) return;
    const el = ref.current;
    const alvo = Math.max(0, Math.min(seekTo / 1000, duracao || Infinity));
    const pular = () => {
      try {
        el.currentTime = alvo;
        setPosicao(alvo);
        void el.play().then(() => setTocando(true)).catch(() => {});
      } catch {
        /* o arquivo ainda não sabe procurar; o próximo toque resolve */
      }
      onSeeked();
    };
    // Um webm sem cabeçalho de duração não aceita `currentTime` antes de ter
    // metadados. Esperar por eles é a diferença entre pular e não fazer nada.
    if (el.readyState >= 1) pular();
    else el.addEventListener("loadedmetadata", pular, { once: true });
  }, [seekTo, duracao, onSeeked]);

  if (!url) return null;

  return (
    <section className="rounded-2xl border border-line bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          Áudio da aula
        </h2>
        <span className="font-mono text-[11px] text-ink-muted/70">
          gravado no aparelho
        </span>
      </div>

      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onTimeUpdate={(e) => setPosicao(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuracao(d);
        }}
        onEnded={() => setTocando(false)}
        onError={() => setErro(true)}
        className="hidden"
      />

      {erro ? (
        <p className="mt-2 text-[13px] leading-snug text-warn">
          Este navegador não consegue tocar o formato em que a aula foi gravada.
          O arquivo continua guardado.
        </p>
      ) : (
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const el = ref.current;
              if (!el) return;
              if (tocando) {
                el.pause();
                setTocando(false);
              } else {
                void el
                  .play()
                  .then(() => setTocando(true))
                  .catch(() => setErro(true));
              }
            }}
            aria-label={tocando ? "Pausar o áudio da aula" : "Tocar o áudio da aula"}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] text-accent-ink transition-transform active:scale-90"
          >
            <span aria-hidden="true">{tocando ? "❚❚" : "▶"}</span>
          </button>

          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={Math.max(1, duracao)}
              step={0.5}
              value={Math.min(posicao, duracao)}
              onChange={(e) => {
                const el = ref.current;
                if (!el) return;
                const v = Number(e.target.value);
                try {
                  el.currentTime = v;
                  setPosicao(v);
                } catch {
                  /* ainda sem metadados */
                }
              }}
              aria-label="Posição no áudio da aula"
              className="h-9 w-full accent-[var(--color-accent)]"
            />
            <div className="-mt-1 flex justify-between font-mono text-[11px] tabular-nums text-ink-muted">
              <span>{formatClock(posicao * 1000)}</span>
              <span>{formatClock(duracao * 1000)}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
