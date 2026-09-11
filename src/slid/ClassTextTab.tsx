import { useState } from "react";
import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { CopyButton } from "./CopyButton";
import { ListenFromHere } from "./ListenFromHere";
import { linesWithoutTitle, momentsAsText } from "./classText";
import { formatClock } from "../shared/lib/time";
import type { ClassMoment, ClassRecord } from "./classes";
import { TranscriptView } from "../listen/TranscriptView";
import { MicIcon } from "../listen/MicIcon";
import { legendaDaFala } from "../listen/speechInsights";
import type { TranscriptSegment } from "../shared/lib/mediaStore";

type Fonte = "quadro" | "fala";

/**
 * A aba Texto: as duas fontes de texto que a aula tem.
 *
 * **Texto do quadro** é o que a câmera leu; **Transcrição da aula** é o que
 * foi dito. Duas fontes e não duas abas: a fidelidade ao `Resumo v2` são três
 * abas, e uma quarta quebraria a tela desenhada. Um seletor aqui dentro
 * respeita o desenho e resolve o problema que ele não previa — o de a aula
 * ter texto vindo de dois lugares diferentes.
 *
 * A ordem tem motivo. O quadro vem primeiro quando existe, porque é o que o
 * estudante apontou a câmera para guardar. Quando ele não existe — e o teste
 * no celular mostrou que acontece —, a transcrição assume o lugar em vez de
 * a aba dizer que não há texto nenhum enquanto quarenta minutos de fala estão
 * salvos ali do lado.
 *
 * O que a câmera leu, organizado por momento.
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
  transcript = [],
  transcriptStatus,
}: {
  record: ClassRecord;
  /** Presente só quando a aula tem gravação. */
  onOuvir?: (atMs: number) => void;
  /** A fala reconhecida desta aula, quando houve. */
  transcript?: TranscriptSegment[];
  /** Como a transcrição terminou, para a tela poder dizer a verdade. */
  transcriptStatus?: "ok" | "indisponivel" | "desligada";
}) {
  const comConteudo = record.moments.filter(
    (m) => linesWithoutTitle(m).length > 0,
  );
  const temQuadro = comConteudo.length > 0;
  const temFala = transcript.some((s) => s.final && s.text.trim());

  // Abre na fonte que tem conteúdo. Abrir no quadro vazio de uma aula cuja
  // fala foi transcrita inteira é a tela mentindo sobre o que ela tem.
  const [fonte, setFonte] = useState<Fonte>(temQuadro ? "quadro" : "fala");
  const atual: Fonte = fonte === "quadro" && !temQuadro ? "fala" : fonte;

  if (!temQuadro && !temFala) {
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
        {/* E, quando dá, dizer o que aconteceu com a outra fonte: uma aula
            sem texto por dois motivos diferentes pede duas respostas
            diferentes. */}
        {transcriptStatus === "indisponivel" && (
          <p className="mx-auto mt-2 max-w-[34ch] text-[13px] leading-snug text-ink-muted/75">
            A transcrição da fala não funcionou neste navegador. O áudio da aula
            continua salvo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* O seletor só aparece quando há escolha a fazer. Com uma fonte só,
          dois chips em que um está sempre vazio é ruído. */}
      {temQuadro && temFala && (
        <div
          role="tablist"
          aria-label="Fonte do texto"
          className="flex gap-1.5"
        >
          <Chip
            id="quadro"
            rotulo="Texto do quadro"
            n={comConteudo.length}
            escolhido={atual === "quadro"}
            onEscolher={() => setFonte("quadro")}
          />
          <Chip
            id="fala"
            rotulo="Transcrição da aula"
            escolhido={atual === "fala"}
            onEscolher={() => setFonte("fala")}
          />
        </div>
      )}

      {/* Sem quadro, a transcrição assume — e diz por que está sozinha. */}
      {!temQuadro && temFala && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] leading-snug text-ink-muted">
          A câmera não conseguiu ler o quadro nesta aula. Abaixo está o que foi
          falado.
        </p>
      )}

      {atual === "quadro" ? (
        <>
          {comConteudo.map((momento) => (
            <BlocoDeMomento
              key={momento.media.id}
              momento={momento}
              legenda={legendaDaFala(transcript, momento.atMs)}
              onOuvir={onOuvir}
            />
          ))}

          <div className="pt-1">
            <CopyButton texto={momentsAsText(record)} />
          </div>
        </>
      ) : (
        <TranscriptView segments={transcript} onOuvir={onOuvir} />
      )}
    </div>
  );
}

function Chip({
  id,
  rotulo,
  n,
  escolhido,
  onEscolher,
}: {
  id: string;
  rotulo: string;
  n?: number;
  escolhido: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`fonte-${id}`}
      aria-selected={escolhido}
      onClick={onEscolher}
      className={`min-h-9 rounded-full px-3 text-[12.5px] font-medium transition-colors ${
        escolhido ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-muted"
      }`}
    >
      {rotulo}
      {n !== undefined && (
        <span className="ml-1 font-mono text-[11px] tabular-nums opacity-70">
          {n}
        </span>
      )}
    </button>
  );
}

function BlocoDeMomento({
  momento,
  legenda,
  onOuvir,
}: {
  momento: ClassMoment;
  /** O que estava sendo dito por volta deste momento, se algo sustentar. */
  legenda?: string | null;
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

      {/*
        O que estava sendo dito quando a câmera guardou este quadro.

        É a costura entre as duas metades do SliD — o que se viu e o que se
        ouviu, na mesma caixa. A janela é assimétrica porque a explicação
        começa antes de o slide ficar pronto e continua depois dele.

        Ausente com facilidade, e isso é o recurso funcionando: quando nada na
        janela sustenta uma legenda, não há legenda. Uma frase de muleta
        ("então tá, vamos lá") embaixo de uma fórmula não acrescenta nada e
        gasta a confiança nas que acrescentam.
      */}
      {legenda && (
        <p className="mt-2.5 flex gap-1.5 border-t border-line pt-2.5 text-[12.5px] italic leading-snug text-ink-muted">
          <span className="mt-px text-accent">
            <MicIcon size={13} />
          </span>
          <span className="min-w-0 flex-1">{legenda}</span>
        </p>
      )}
    </article>
  );
}
