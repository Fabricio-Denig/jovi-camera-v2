import { useObjectUrl } from "../shared/hooks/useObjectUrl";
import { ClassTitle } from "./ClassTitle";
import { STATUS_STYLES, type ClassStatus } from "./status";
import { formatClock, formatDate } from "../shared/lib/time";

/**
 * O cabeçalho da aula, como o cartão de `Resumo v2` (`339:611`, `340×134`).
 *
 * Ele responde seis perguntas de uma vez: qual aula, de qual matéria, como
 * ela ficou, quando foi, quanto durou e quantos momentos tem. Antes eram as
 * mesmas informações em texto corrido, e a diferença que o cartão faz é a
 * miniatura — a aula passa a ter rosto.
 *
 * A miniatura é **um momento real da aula**, nunca uma imagem inventada nem um
 * ícone de categoria. Quando a aula não guardou momento nenhum, o espaço mostra
 * que não há o que mostrar em vez de preencher com enfeite.
 */
export function ClassHeaderCard({
  capa,
  nome,
  onNome,
  onCommitNome,
  discipline,
  status,
  savedAt,
  durationMs,
  momentos,
  editando,
  onEditar,
  onAbrirMateria,
  onAbrirStatus,
  materiaAberta,
  statusAberto,
}: {
  /** O primeiro momento da aula. Null quando a aula não guardou nenhum. */
  capa: Blob | null;
  nome: string;
  onNome: (valor: string) => void;
  onCommitNome: () => void;
  discipline: string | null;
  status: ClassStatus | null;
  savedAt: number;
  durationMs: number;
  momentos: number;
  editando: boolean;
  onEditar: () => void;
  onAbrirMateria: () => void;
  onAbrirStatus: () => void;
  materiaAberta: boolean;
  statusAberto: boolean;
}) {
  const url = useObjectUrl(capa);

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-surface-2 p-3">
      {/* 103×103 no wireframe; aqui em `rem` para acompanhar a fonte do sistema. */}
      <div className="size-[88px] shrink-0 overflow-hidden rounded-xl bg-surface">
        {url ? (
          <img src={url} alt="" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-[10px] leading-tight text-ink-muted/70">
            sem
            <br />
            momentos
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            {editando ? (
              <ClassTitle
                value={nome}
                placeholder="Nomear esta aula"
                onChange={onNome}
                onCommit={onCommitNome}
                size="cartao"
              />
            ) : (
              <h1 className="truncate text-[17px] font-semibold leading-tight text-ink">
                {nome || "Aula sem título"}
              </h1>
            )}
          </div>
          {/* O lápis do `339:637`: o wireframe torna o gesto explícito, em vez
              de esperar que a pessoa descubra que o título é editável. */}
          <button
            type="button"
            onClick={onEditar}
            aria-label={editando ? "Concluir edição do nome" : "Editar o nome da aula"}
            aria-pressed={editando}
            className={`-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] transition-transform active:scale-90 ${
              editando ? "bg-accent-soft text-accent" : "text-ink-muted"
            }`}
          >
            {editando ? "✓" : "✎"}
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={onAbrirMateria}
            aria-expanded={materiaAberta}
            className={`min-h-7 rounded-full px-2.5 text-[12px] font-medium transition-all duration-200 active:scale-95 active:opacity-70 ${
              discipline ? "bg-accent-soft text-accent" : "bg-surface text-ink-muted"
            }`}
          >
            {discipline ?? "Escolher matéria"}
          </button>
          {/* O status não está no wireframe. Fica porque é decisão de produto:
              é a resposta à pergunta "o que eu preciso revisar", que é metade
              do motivo desta tela existir. */}
          <button
            type="button"
            onClick={onAbrirStatus}
            aria-expanded={statusAberto}
            className={`min-h-7 rounded-full px-2.5 text-[12px] font-medium transition-all duration-200 active:scale-95 active:opacity-70 ${
              status ? STATUS_STYLES[status].chip : "bg-surface text-ink-muted"
            }`}
          >
            {status ? STATUS_STYLES[status].label : "Marcar status"}
          </button>
        </div>

        {/* A linha de três do `339:638-640`, com as elipses de 3 px viradas em
            "·" — a mesma informação, sem um elemento só para separar. */}
        <p className="mt-auto flex flex-wrap items-center gap-x-1.5 pt-2 font-mono text-[11.5px] tabular-nums text-ink-muted">
          <span>{formatDate(savedAt)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatClock(durationMs)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {momentos} {momentos === 1 ? "momento" : "momentos"}
          </span>
        </p>
      </div>
    </div>
  );
}
