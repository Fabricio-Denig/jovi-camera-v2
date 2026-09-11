import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { CopyButton } from "./CopyButton";
import { ListenFromHere } from "./ListenFromHere";
import { linesWithoutTitle, momentsAsText } from "./classText";
import { formatClock } from "../shared/lib/time";
import type { ClassMoment, ClassRecord } from "./classes";

/**
 * A aba Texto: o que a câmera leu, organizado por momento.
 *
 * Não é despejo de OCR, e a diferença está no que não aparece. O que o
 * reconhecimento devolveu e não passou no teste de leitura — nem língua, nem
 * fórmula, ou abaixo da confiança — nunca foi guardado. Então esta aba não
 * pode mostrar "ao do 20 grau LÁ": ou a linha foi lida como está, ou ela não
 * existe no banco.
 *
 * Cada bloco junta o que o `Resumo v2` junta no `339:648`: o título do trecho,
 * as linhas lidas, e a imagem daquele momento ao lado — texto e captura na
 * mesma caixa, que é o que deixa conferir uma leitura sem sair da tela.
 */
export function ClassTextTab({
  record,
  onOuvir,
}: {
  record: ClassRecord;
  /** Presente só quando a aula tem gravação. */
  onOuvir?: (atMs: number) => void;
}) {
  const comConteudo = record.moments.filter(
    (m) => linesWithoutTitle(m).length > 0,
  );

  if (comConteudo.length === 0) {
    return (
      <div className="pt-8 text-center">
        <p className="text-sm text-ink-muted">
          A câmera não conseguiu ler texto nesta aula.
        </p>
        {/* Dizer por que, porque o motivo é acionável: a próxima aula pode ser
            capturada de mais perto. */}
        <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-snug text-ink-muted/75">
          Acontece com letra à mão, com slide distante e com pouca luz. As
          imagens dos momentos continuam inteiras na aba Imagens.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {comConteudo.map((momento) => (
        <BlocoDeMomento
          key={momento.media.id}
          momento={momento}
          onOuvir={onOuvir}
        />
      ))}

      <div className="pt-1">
        <CopyButton texto={momentsAsText(record)} />
      </div>
    </div>
  );
}

function BlocoDeMomento({
  momento,
  onOuvir,
}: {
  momento: ClassMoment;
  onOuvir?: (atMs: number) => void;
}) {
  const url = useObjectUrl(momento.media.blob);
  const linhas = linesWithoutTitle(momento);

  return (
    <article className="rounded-2xl border border-line bg-surface-2 p-3.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11.5px] tabular-nums text-accent">
          {formatClock(momento.atMs)}
        </span>
        {momento.category && (
          <span className="rounded bg-accent/12 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
            {momento.category}
          </span>
        )}
        {/* Ao lado do horário, que é a informação com que ele conversa. */}
        {onOuvir && (
          <span className="ml-auto">
            <ListenFromHere atMs={momento.atMs} onOuvir={onOuvir} compacto />
          </span>
        )}
      </div>

      <div className="mt-1 flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">
            {momento.label}
          </h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {linhas.map((linha, i) => (
              <li
                key={`${i}-${linha}`}
                className="flex gap-1.5 text-[13.5px] leading-snug text-ink-muted"
              >
                <span aria-hidden="true" className="text-accent/70">
                  •
                </span>
                <span className="min-w-0 flex-1 break-words">{linha}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* A imagem dentro do bloco de texto, como o `342:818` desenha. */}
        <div className="size-[76px] shrink-0 overflow-hidden rounded-lg bg-surface">
          {url && <img src={url} alt="" className="size-full object-cover" />}
        </div>
      </div>
    </article>
  );
}
