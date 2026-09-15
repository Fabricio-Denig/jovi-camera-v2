import { useEffect, useMemo, useRef, useState } from "react";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { formatClock } from "../shared/lib/time";
import {
  segmentosDe,
  type LessonAudio,
  type LessonAudioSegment,
} from "../shared/lib/mediaStore";

/**
 * Onde, na lista de trechos, um instante da aula (relógio da sessão) cai.
 *
 * Três casos: dentro de um trecho (`exato`), antes do primeiro trecho, ou
 * numa lacuna entre dois — desligar o áudio no meio da aula é exatamente
 * isso, uma lacuna. Nos dois últimos a posição resolvida é a borda do trecho
 * mais próximo, nunca um ponto que não existe no arquivo nenhum.
 */
function resolverPosicao(
  segmentos: LessonAudioSegment[],
  alvoMs: number,
): { indice: number; localSeg: number; exato: boolean } | null {
  if (segmentos.length === 0) return null;
  for (let i = 0; i < segmentos.length; i++) {
    const s = segmentos[i];
    if (alvoMs >= s.startMs && alvoMs < s.startMs + s.durationMs) {
      return { indice: i, localSeg: (alvoMs - s.startMs) / 1000, exato: true };
    }
  }
  let melhor = 0;
  let menorDistancia = Infinity;
  segmentos.forEach((s, i) => {
    const distancia = Math.min(
      Math.abs(s.startMs - alvoMs),
      Math.abs(s.startMs + s.durationMs - alvoMs),
    );
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = i;
    }
  });
  const s = segmentos[melhor];
  const naBorda = alvoMs <= s.startMs ? 0 : s.durationMs / 1000;
  return { indice: melhor, localSeg: naBorda, exato: false };
}

/**
 * Aplica uma posição no `<audio>`, contornando um bug real do Chromium.
 *
 * Um `<audio>` tocando um Blob webm/opus gravado por `MediaRecorder` reporta
 * `duration: Infinity` até o navegador escanear o arquivo inteiro pelo menos
 * uma vez — o container não tem a duração no cabeçalho, só no fim. Enquanto
 * `duration` é `Infinity`, `el.currentTime = X` é aceito sem lançar erro mas
 * não tem efeito nenhum (medido: "Ouvir deste ponto" clicava, nenhum erro no
 * console, o áudio continuava do zero). Buscar um valor absurdamente grande
 * primeiro força esse scan; quando termina, o navegador dispara `timeupdate`
 * uma vez com o tempo já perto do fim real — só depois disso a busca para o
 * alvo verdadeiro funciona.
 */
function aplicarPosicao(el: HTMLAudioElement, segundos: number, aoAplicar?: () => void) {
  if (Number.isFinite(el.duration)) {
    el.currentTime = segundos;
    aoAplicar?.();
    return;
  }
  const aoResolverDuracao = () => {
    el.removeEventListener("timeupdate", aoResolverDuracao);
    el.currentTime = segundos;
    aoAplicar?.();
  };
  el.addEventListener("timeupdate", aoResolverDuracao);
  el.currentTime = 1e101;
}

/**
 * O áudio da aula, na aula guardada.
 *
 * Por dentro pode haver vários trechos — desligar e religar o áudio no meio
 * da aula fecha um `MediaRecorder` e abre outro, e colar dois containers
 * webm/ogg independentes num Blob só não é garantia de nada tocável depois
 * (ver `useListen.fecharTrechoAtual`). Mas para quem usa isto continua sendo
 * **um** áudio da aula: a barra representa a aula inteira, do primeiro som ao
 * último, e troca de arquivo por baixo sem que ninguém precise perceber —
 * "trecho 1", "trecho 2" nunca aparecem na tela.
 *
 * Ele não usa o `<audio controls>` do navegador porque aquele controle tem
 * aparência própria em cada sistema e ignora o resto da tela. O elemento
 * continua sendo um `<audio>`; só a casca é nossa.
 */
export function LessonAudioPlayer({
  audio,
  /** Onde o player deve pular, em ms desde o início da SESSÃO — o mesmo eixo
   * de `capture.atMs`. Quem pede não precisa saber em qual trecho isso cai. */
  seekTo,
  onSeeked,
}: {
  audio: LessonAudio;
  seekTo: number | null;
  onSeeked: () => void;
}) {
  const segmentos = useMemo(() => segmentosDe(audio), [audio]);
  const [segIndex, setSegIndex] = useState(0);
  const segmentoAtual = segmentos[segIndex] ?? null;
  const url = useObjectUrl(segmentoAtual?.blob ?? null);
  const ref = useRef<HTMLAudioElement>(null);
  const [tocando, setTocando] = useState(false);
  /** Posição na aula inteira, em ms — não a posição dentro do arquivo atual. */
  const [posicaoMs, setPosicaoMs] = useState(0);
  const [erro, setErro] = useState(false);
  /** A pessoa pediu um ponto sem áudio; o player caiu no trecho mais perto. */
  const [foraDoTrecho, setForaDoTrecho] = useState(false);
  /** Onde, dentro do arquivo que está carregando agora, aplicar assim que os metadados chegarem. */
  const pendenteRef = useRef<{ localSeg: number; tocar: boolean } | null>(null);

  const fimDaAulaMs = useMemo(
    () =>
      segmentos.reduce(
        (max, s) => Math.max(max, s.startMs + s.durationMs),
        0,
      ),
    [segmentos],
  );

  const irPara = (alvoMs: number, tocar: boolean) => {
    const resolvido = resolverPosicao(segmentos, alvoMs);
    if (!resolvido) return;
    setForaDoTrecho(!resolvido.exato);
    setPosicaoMs(
      (segmentos[resolvido.indice]?.startMs ?? 0) + resolvido.localSeg * 1000,
    );
    if (resolvido.indice === segIndex) {
      const el = ref.current;
      if (el) {
        try {
          aplicarPosicao(el, resolvido.localSeg, () => {
            if (tocar) void el.play().then(() => setTocando(true)).catch(() => {});
          });
        } catch {
          pendenteRef.current = { localSeg: resolvido.localSeg, tocar };
        }
      }
    } else {
      pendenteRef.current = { localSeg: resolvido.localSeg, tocar };
      setSegIndex(resolvido.indice);
    }
  };

  // Um pedido de fora (o "Ouvir deste ponto" de um momento) chega como
  // ms da sessão — a mesma conta que os momentos já usam.
  useEffect(() => {
    if (seekTo === null) return;
    irPara(seekTo, true);
    onSeeked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekTo]);

  // Ao trocar de trecho (arquivo novo), aplica a posição pendente assim que
  // os metadados chegarem — um webm gravado em pedaços costuma não aceitar
  // `currentTime` antes disso.
  useEffect(() => {
    const el = ref.current;
    const pendente = pendenteRef.current;
    if (!el || !pendente) return;
    const aplicar = () => {
      try {
        aplicarPosicao(el, pendente.localSeg, () => {
          if (pendente.tocar) void el.play().then(() => setTocando(true)).catch(() => {});
        });
      } catch {
        /* tenta nos metadados seguintes */
      }
      pendenteRef.current = null;
    };
    if (el.readyState >= 1) aplicar();
    else el.addEventListener("loadedmetadata", aplicar, { once: true });
  }, [segIndex, url]);

  if (segmentos.length === 0 || !url) return null;

  const duracaoTotal = Math.max(1, fimDaAulaMs / 1000);
  /*
   * O mapa de lacunas, só quando há mais de um trecho.
   *
   * Numa aula com um trecho só — o caso comum, sem nenhum desligar no meio —
   * este mapa seria uma barra cheia do começo ao fim, informação nenhuma a
   * mais. Ele só ganha desenho quando há de fato um "sem áudio aqui" para
   * avisar, e é isso que os `%` do gradiente marcam: onde a aula tem som e
   * onde não tem, antes de a pessoa arrastar e descobrir sozinha.
   */
  const mapaDeLacunas =
    segmentos.length > 1
      ? segmentos
          .map((s) => {
            const de = (s.startMs / 1000 / duracaoTotal) * 100;
            const ate = ((s.startMs + s.durationMs) / 1000 / duracaoTotal) * 100;
            return `transparent ${de.toFixed(2)}%, var(--color-accent) ${de.toFixed(2)}%, var(--color-accent) ${ate.toFixed(2)}%, transparent ${ate.toFixed(2)}%`;
          })
          .join(", ")
      : null;

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
        onTimeUpdate={(e) => {
          if (!segmentoAtual) return;
          setPosicaoMs(segmentoAtual.startMs + e.currentTarget.currentTime * 1000);
          // Tocando de verdade é a prova de que não há lacuna aqui — sem
          // isto, o aviso de uma busca anterior ("estava desligado") ficava
          // preso na tela mesmo depois de a audição já ter avançado para um
          // trecho com som de verdade.
          if (foraDoTrecho) setForaDoTrecho(false);
        }}
        onEnded={() => {
          // O fim de um trecho não é o fim da aula: se há um próximo, a
          // audição segue nele — é o que faz "um áudio só" parecer verdade.
          if (segIndex < segmentos.length - 1) {
            pendenteRef.current = { localSeg: 0, tocar: true };
            setSegIndex(segIndex + 1);
          } else {
            setTocando(false);
          }
        }}
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
            {/* O mapa de onde há som e onde há silêncio — antes de a pessoa
                arrastar e cair numa lacuna sem aviso nenhum. */}
            {mapaDeLacunas && (
              <div
                aria-hidden="true"
                className="mb-1 h-1 w-full overflow-hidden rounded-full bg-ink-muted/20"
                style={{ backgroundImage: `linear-gradient(to right, ${mapaDeLacunas})` }}
              />
            )}
            <input
              type="range"
              min={0}
              max={duracaoTotal}
              step={0.5}
              value={Math.min(posicaoMs / 1000, duracaoTotal)}
              onChange={(e) => irPara(Number(e.target.value) * 1000, tocando)}
              aria-label="Posição no áudio da aula"
              className="h-9 w-full accent-[var(--color-accent)]"
            />
            <div className="-mt-1 flex justify-between font-mono text-[11px] tabular-nums text-ink-muted">
              <span>{formatClock(posicaoMs)}</span>
              <span>{formatClock(duracaoTotal * 1000)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Discreto de propósito: não é um erro, é a aula tendo ficado sem
          áudio por um trecho — a pessoa desligou, e o player não finge que
          gravou o que não gravou. */}
      {foraDoTrecho && !erro && (
        <p className="mt-2 text-[11.5px] leading-snug text-ink-muted">
          O áudio estava desligado nesse momento da aula.
        </p>
      )}
    </section>
  );
}
