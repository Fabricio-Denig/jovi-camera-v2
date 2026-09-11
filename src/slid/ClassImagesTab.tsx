import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { ListenFromHere } from "./ListenFromHere";
import { formatClock } from "../shared/lib/time";
import type { ClassMoment } from "./classes";

/**
 * A aba Imagens: os momentos da aula, cada um com horário e título.
 *
 * Uma grade e não a linha do tempo do rodapé, porque a pergunta aqui é outra:
 * "onde está aquele slide?", respondida pelo olho, de relance. A linha do
 * tempo com legenda continua existindo na aba Texto, que responde "o que foi
 * dito nesse momento".
 *
 * Não há duplicata a filtrar: a curadoria da sessão já decidiu o que virou
 * momento, e refinar um slide que cresceu substitui o quadro em vez de
 * empilhar outro. Se aparecerem dois iguais aqui, o defeito é lá.
 */
export function ClassImagesTab({
  momentos,
  onAbrir,
  onOuvir,
}: {
  momentos: ClassMoment[];
  onAbrir: (index: number) => void;
  /** Presente só quando a aula tem gravação. */
  onOuvir?: (atMs: number) => void;
}) {
  if (momentos.length === 0) {
    return (
      <p className="pt-10 text-center text-sm text-ink-muted">
        Esta aula não guardou nenhum momento.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2.5">
      {momentos.map((momento, index) => (
        <li key={momento.media.id}>
          <CartaoDeMomento
            momento={momento}
            onAbrir={() => onAbrir(index)}
            onOuvir={onOuvir}
          />
        </li>
      ))}
    </ul>
  );
}

function CartaoDeMomento({
  momento,
  onAbrir,
  onOuvir,
}: {
  momento: ClassMoment;
  onAbrir: () => void;
  onOuvir?: (atMs: number) => void;
}) {
  const url = useObjectUrl(momento.media.blob);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Abrir momento de ${formatClock(momento.atMs)}: ${momento.label}`}
        className="w-full overflow-hidden rounded-xl border border-line bg-surface-2 text-left transition-transform duration-150 active:scale-[0.97]"
      >
        <span className="relative block aspect-[4/3] w-full bg-surface">
          {url && <img src={url} alt="" className="size-full object-cover" />}
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white backdrop-blur">
            {formatClock(momento.atMs)}
          </span>
        </span>
        <span className="block px-2 pb-2 pt-1.5">
          <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-ink">
            {momento.label}
          </span>
          {momento.category && (
            <span className="mt-1 inline-block rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
              {momento.category}
            </span>
          )}
        </span>
      </button>

      {/* Fora do botão do card, e não dentro: um <button> dentro de outro é
        HTML inválido, e o navegador desfaz o aninhamento de um jeito que
        deixa o de dentro inalcançável. */}
      {onOuvir && (
        <span className="absolute right-1.5 top-1.5">
          <ListenFromHere atMs={momento.atMs} onOuvir={onOuvir} compacto />
        </span>
      )}
    </div>
  );
}
