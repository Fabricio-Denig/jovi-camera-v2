import { formatClock } from "../shared/lib/time";
import type { ListenStatus } from "./useListen";

/**
 * O Listen, visível.
 *
 * O nome do produto é **See, Listen and Identify**, e por muito tempo o Listen
 * era a única das três letras sem nada na tela. Uma funcionalidade que grava
 * sem aparecer é duas coisas ruins ao mesmo tempo: não demonstra a promessa, e
 * é um microfone aberto que a pessoa não vê.
 *
 * Então este selo existe sempre que a sessão existe, inclusive — e
 * principalmente — quando **não** há gravação: "Áudio desativado" é uma
 * informação, não uma falha escondida.
 *
 * A barra de nível não é enfeite: ela é a prova mais barata de que o microfone
 * está vivo. Um ponto vermelho parado não distingue gravação de congelamento;
 * uma barra que mexe quando o professor fala, sim.
 */
export function ListenBadge({
  status,
  elapsedMs,
  level,
  onDesligar,
  onTentarDeNovo,
  compacto = false,
}: {
  status: ListenStatus;
  elapsedMs: number;
  /** 0–1, do próprio microfone. */
  level: number;
  onDesligar?: () => void;
  onTentarDeNovo?: () => void;
  /** Sem o botão, para caber ao lado de outras coisas. */
  compacto?: boolean;
}) {
  const ouvindo = status === "ouvindo";
  const pausado = status === "pausado";

  const texto =
    status === "pedindo"
      ? "Pedindo o microfone"
      : ouvindo
        ? "Ouvindo"
        : pausado
          ? "Áudio pausado"
          : status === "negado"
            ? "Áudio desativado"
            : status === "indisponivel"
              ? "Sem áudio neste aparelho"
              : status === "falhou"
                ? "A gravação parou"
                : "Áudio desligado";

  return (
    <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-canvas/90 px-3 py-1.5 backdrop-blur">
      {ouvindo ? (
        <MedidorDeVoz level={level} />
      ) : (
        <span
          aria-hidden="true"
          className={`size-2 rounded-full ${
            pausado ? "bg-warn" : status === "pedindo" ? "animate-pulse bg-accent" : "bg-ink-muted/50"
          }`}
        />
      )}

      <span className="text-[12px] font-semibold text-ink">{texto}</span>

      {(ouvindo || pausado) && (
        <span className="font-mono text-[11.5px] tabular-nums text-ink-muted">
          {formatClock(elapsedMs)}
        </span>
      )}

      {/* Desligar o áudio é um gesto que precisa estar sempre a uma distância
          curta. Quem mudou de ideia no meio da aula não deve ter de encerrar a
          aula para parar de gravar. */}
      {!compacto && (ouvindo || pausado) && onDesligar && (
        <button
          type="button"
          onClick={onDesligar}
          aria-label="Desligar o áudio desta aula"
          // 36 px de alvo, com o ✕ desenhado no tamanho de antes: um botão de
          // 28 px é pequeno demais para um dedo, e este é o controle de
          // desligar a gravação — o que mais precisa ser fácil de acertar.
          className="-mr-2 -my-1 ml-0 flex size-9 items-center justify-center rounded-full text-[12px] text-ink-muted transition-transform active:scale-90 active:opacity-70"
        >
          ✕
        </button>
      )}

      {/* Negado é reversível: a pessoa pode liberar nas permissões do site e
          voltar. Indisponível não é, e por isso não ganha botão. */}
      {!compacto && status === "negado" && onTentarDeNovo && (
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="-mr-1.5 ml-0.5 min-h-7 rounded-full px-2 text-[11.5px] font-medium text-accent transition-transform active:scale-95"
        >
          Ativar
        </button>
      )}
    </div>
  );
}

/** Cinco barrinhas que sobem com a voz. */
function MedidorDeVoz({ level }: { level: number }) {
  return (
    <span aria-hidden="true" className="flex h-3 items-center gap-[2px]">
      {[0.15, 0.45, 0.8, 0.45, 0.15].map((peso, i) => {
        const altura = 3 + Math.min(1, level / peso) * 9;
        return (
          <span
            key={i}
            className="w-[2.5px] rounded-full bg-accent transition-[height] duration-75"
            style={{ height: `${Math.max(3, altura)}px` }}
          />
        );
      })}
    </span>
  );
}

/**
 * As três letras do produto, como estado.
 *
 * See e Identify já funcionavam e não tinham onde se ver; o Listen passou a
 * existir. Esta linha põe as três juntas porque juntas elas são a promessa —
 * e porque um estudante que olha a tela durante uma aula deve conseguir dizer,
 * de relance, o que o app está fazendo por ele agora.
 */
export function SeeListenIdentify({
  vendo,
  ouvindo,
  identificou,
}: {
  vendo: boolean;
  ouvindo: boolean;
  identificou: number;
}) {
  return (
    <div className="pointer-events-none flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur">
      <Letra nome="See" aceso={vendo} />
      <span aria-hidden="true" className="text-white/25">
        ·
      </span>
      <Letra nome="Listen" aceso={ouvindo} pulsa />
      <span aria-hidden="true" className="text-white/25">
        ·
      </span>
      <Letra nome="Identify" aceso={identificou > 0} sufixo={identificou > 0 ? String(identificou) : undefined} />
    </div>
  );
}

function Letra({
  nome,
  aceso,
  pulsa = false,
  sufixo,
}: {
  nome: string;
  aceso: boolean;
  pulsa?: boolean;
  sufixo?: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          aceso ? `bg-accent${pulsa ? " animate-pulse" : ""}` : "bg-white/25"
        }`}
      />
      <span
        className={`text-[9.5px] font-semibold uppercase tracking-[0.08em] ${
          aceso ? "text-white/90" : "text-white/40"
        }`}
      >
        {nome}
        {sufixo && <span className="ml-0.5 font-mono normal-case">{sufixo}</span>}
      </span>
    </span>
  );
}
