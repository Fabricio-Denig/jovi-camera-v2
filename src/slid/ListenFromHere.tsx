import { formatClock } from "../shared/lib/time";

/**
 * "Ouvir deste ponto" — o que liga o Listen ao momento.
 *
 * É a peça que transforma uma gravação de quarenta minutos em algo usável.
 * Sem ela o áudio é um arquivo que ninguém abre; com ela, cada slide guardado
 * vira uma porta para o que o professor estava dizendo naquele instante.
 *
 * Aparece só quando existe gravação. Um botão que não faz nada porque a aula
 * não tem áudio seria pior que a ausência dele.
 */
export function ListenFromHere({
  atMs,
  onOuvir,
  compacto = false,
}: {
  atMs: number;
  onOuvir: (atMs: number) => void;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Dentro de um card que já abre o momento: sem isto, tocar em "ouvir"
        // abriria a revisão em tela cheia junto.
        e.stopPropagation();
        onOuvir(atMs);
      }}
      aria-label={`Ouvir a aula a partir de ${formatClock(atMs)}`}
      className={`inline-flex items-center gap-1 rounded-full bg-accent/15 font-medium text-accent transition-transform active:scale-95 ${
        compacto ? "min-h-7 px-2 text-[10.5px]" : "min-h-8 px-2.5 text-[11.5px]"
      }`}
    >
      <span aria-hidden="true">▶</span>
      {compacto ? "Ouvir" : "Ouvir deste ponto"}
    </button>
  );
}
