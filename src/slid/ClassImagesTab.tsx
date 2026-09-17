import { useState } from "react";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { ListenFromHere } from "./ListenFromHere";
import { formatClock } from "../shared/lib/time";
import { EditPencil } from "../shared/ui/EditPencil";
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
  onRenomear,
}: {
  momentos: ClassMoment[];
  onAbrir: (index: number) => void;
  /** Presente só quando a aula tem gravação. */
  onOuvir?: (atMs: number) => void;
  /** Grava o título que o estudante escreveu para um momento. */
  onRenomear?: (mediaId: string, label: string) => void;
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
            onRenomear={onRenomear}
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
  onRenomear,
}: {
  momento: ClassMoment;
  onAbrir: () => void;
  onOuvir?: (atMs: number) => void;
  onRenomear?: (mediaId: string, label: string) => void;
}) {
  const url = useObjectUrl(momento.media.blob);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(momento.label);

  const confirmar = () => {
    onRenomear?.(momento.media.id, rascunho);
    setEditando(false);
  };

  /*
   * Em edição, o cartão inteiro deixa de ser um botão.
   *
   * A imagem continua ali, mas o toque agora pertence ao campo de texto: com
   * o botão de abrir ainda ativo por baixo, tocar para posicionar o cursor
   * abria a revisão da aula em tela cheia e jogava fora o que estava sendo
   * digitado — o pior tipo de defeito, o que só aparece no dedo de quem usa.
   */
  if (editando) {
    return (
      <div className="overflow-hidden rounded-xl border border-accent/40 bg-surface-2">
        <span className="relative block aspect-[4/3] w-full bg-surface">
          {url && <img src={url} alt="" className="size-full object-cover opacity-60" />}
          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white backdrop-blur">
            {formatClock(momento.atMs)}
          </span>
        </span>
        <div className="p-2">
          <input
            autoFocus
            value={rascunho}
            maxLength={80}
            aria-label={`Título do momento de ${formatClock(momento.atMs)}`}
            placeholder="Título do momento"
            /*
             * Seleciona tudo ao abrir. O campo abre com o título AUTOMÁTICO
             * ("Momento da aula", "Conceito apresentado"), que é justamente o
             * que a pessoa veio trocar — e com o cursor no fim, começar a
             * digitar ANEXA. Reproduzido aqui: escrever um título novo
             * produziu "Momento da aulaIntrodução aos fundamentos de
             * comunicação entre sistemas distribu", com o fim cortado pelo
             * limite de 80. No celular, desfazer isso significa apagar
             * caractere por caractere. Quem quiser só ajustar continua
             * podendo: um toque no texto desfaz a seleção.
             */
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") {
                setRascunho(momento.label);
                setEditando(false);
              }
            }}
            className="min-h-9 w-full rounded-lg bg-surface px-2 text-[12.5px] text-ink placeholder:text-ink-muted/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={confirmar}
              className="min-h-8 flex-1 rounded-lg bg-accent text-[12px] font-medium text-accent-ink transition-transform active:scale-95"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setRascunho(momento.label);
                setEditando(false);
              }}
              className="min-h-8 rounded-lg bg-surface px-2.5 text-[12px] font-medium text-ink-muted transition-transform active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {/*
          `pr-7` reserva a coluna do lápis, sobreposto no canto de baixo à
          direita — sem ela, a segunda linha do título passava por baixo do
          glifo.

          E NADA de `block` aqui: `line-clamp-2` só funciona com
          `display: -webkit-box`, e uma classe de display depois dela vence a
          dela. Com `block`, um título manual longo ("Comunicação entre
          sistemas distribuídos e integração via REST") se espalhou por quatro
          linhas e desalinhou a grade inteira — visto na tela, não no CSS.
        */}
        <span className="line-clamp-2 pr-7 text-[12.5px] font-medium leading-snug text-ink">
          {momento.label}
        </span>
        {momento.category && (
          /* A CLASSIFICAÇÃO continua aqui e é outra coisa que o título: ela
             diz o TIPO do que a câmera viu (fórmula, lista), e segue vindo do
             reconhecimento mesmo depois de a pessoa nomear o momento. */
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

    {/* Também fora do <button> do cartão, e pelo mesmo motivo que o "Ouvir":
        botão dentro de botão é HTML inválido e o navegador desfaz o
        aninhamento deixando o de dentro inalcançável. No canto de baixo, do
        lado do título — longe do "Ouvir", que fica no de cima. */}
    {onRenomear && (
      <span className="absolute bottom-0.5 right-0.5">
        <EditPencil
          onClick={() => {
            setRascunho(momento.label);
            setEditando(true);
          }}
          rotulo={`Editar o título do momento de ${formatClock(momento.atMs)}`}
          tamanho="compacto"
        />
      </span>
    )}
    </div>
  );
}
