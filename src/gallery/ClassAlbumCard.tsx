import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { STATUS_STYLES } from "../slid/status";
import type { ClassRecord } from "../slid/classes";
import { formatDate } from "../shared/lib/time";

/**
 * Uma aula como o Figma a mostra: um card de imagem, não uma linha de lista.
 *
 * A diferença não é decorativa. Numa lista, a aula é uma entrada num índice —
 * o estudante lê nomes. Num card com a captura por baixo, ele reconhece a aula
 * pelo que viu no quadro, que é como a memória de uma aula funciona de verdade.
 *
 * As medidas vêm do nó `339:540`: card de 175×131 (proporção 1,336), título a
 * 59 % da altura e a linha de data a 78 %, com a imagem preenchendo o card
 * inteiro por baixo. O texto fica sobre um degradê porque uma captura de lousa
 * branca e uma de slide escuro passam por aqui com o mesmo layout.
 */
export function ClassAlbumCard({
  record,
  onOpen,
}: {
  record: ClassRecord;
  onOpen: () => void;
}) {
  const url = useObjectUrl(record.moments[0]?.media.blob);
  const status = record.status ? STATUS_STYLES[record.status] : null;

  return (
    /*
     * `article` por fora e botão esticado por cima, em vez de um `button` que
     * envolve tudo. Dois motivos, e os dois são reais: um `<h2>` dentro de um
     * `<button>` é HTML inválido — só conteúdo de frase entra ali —, e o título
     * da aula precisa continuar sendo um cabeçalho, que é como um leitor de
     * tela percorre uma lista de aulas. A primeira versão deste card usou
     * `span` e perdeu as duas coisas; o teste de fluxo pegou.
     */
    <article className="relative aspect-[175/131] w-full overflow-hidden rounded-2xl bg-surface-2 transition-transform duration-150 ease-out has-[button:active]:scale-[0.98] has-[button:active]:opacity-90">
      {url && (
        <img
          src={url}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/*
       * O degradê existe para o texto, e só na parte de baixo: cobrir o card
       * inteiro apagaria justamente a captura que faz o card ser reconhecível.
       *
       * Ele é forte porque o pior caso é uma lousa branca — quase todo o card
       * vira quase branco, e aí um título em branco fica no limite da leitura.
       * Medido nesse caso, e não no slide escuro, que é o caso fácil.
       */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/70 to-transparent"
      />

      {/* No lugar do ícone do Figma, o status — que é o que o estudante
          precisa ver antes de abrir: o que falta revisar. */}
      {status && (
        <span
          className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium backdrop-blur ${status.chip}`}
        >
          <span aria-hidden="true" className={`size-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      )}

      {record.favorite && (
        <span
          aria-label="Favorita"
          className="absolute right-2.5 top-2.5 text-[13px] text-white drop-shadow"
        >
          ★
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        {/*
         * O Figma escreve "Funções - Cálculo": assunto e matéria na mesma
         * linha. A matéria só aparece quando existe — nenhum card inventa uma.
         */}
        <h2 className="line-clamp-2 text-[13px] font-medium leading-tight text-white">
          {record.subject}
          {record.discipline && (
            <span className="font-normal text-white/70"> · {record.discipline}</span>
          )}
        </h2>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/75">
          {formatDate(record.savedAt)}
          <span aria-hidden="true" className="size-[3px] rounded-full bg-white/60" />
          {record.moments.length}{" "}
          {record.moments.length === 1 ? "momento" : "momentos"}
        </p>
      </div>

      {/* O card inteiro é o alvo de toque, e o rótulo diz o que ele abre. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Abrir a aula ${record.subject}`}
        className="absolute inset-0 rounded-2xl"
      />
    </article>
  );
}
