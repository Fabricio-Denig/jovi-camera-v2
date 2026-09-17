import { CLASS_STATUSES, STATUS_STYLES, type ClassStatus } from "../slid/status";

export type FiltroStatus = ClassStatus | "favoritas" | null;

/**
 * Os filtros das aulas, fora da tela até alguém pedir.
 *
 * **Por que deixou de ser uma fileira de chips.** A galeria tinha DOIS
 * trilhos horizontais empilhados: um de navegação (Fotos, SliD, Todas,
 * Favoritos, Vídeos) e outro com tudo o mais junto — "Todas as aulas",
 * cada status, favoritas e cada matéria, no mesmo nível. Eram três linhas de
 * controle antes da primeira aula aparecer, e a tela lia como um painel de
 * administração em vez da estante de alguém. Pior: o segundo trilho misturava
 * coisas diferentes — status é como a aula ficou, matéria é onde ela mora — e
 * só deixava escolher UMA por vez, então era impossível ver "o que preciso
 * revisar de Cálculo".
 *
 * Aqui os dois eixos são independentes e o custo visual é um botão. O padrão
 * é sem filtro nenhum, que é o que quase sempre se quer, e nesse estado a
 * galeria não gasta um pixel explicando isso.
 */
export function LessonFilterSheet({
  status,
  materia,
  disciplines,
  statusCounts,
  favorites,
  total,
  onStatus,
  onMateria,
  onLimpar,
  onFechar,
}: {
  status: FiltroStatus;
  materia: string | null;
  disciplines: [string, number][];
  statusCounts: Map<ClassStatus, number>;
  favorites: number;
  total: number;
  onStatus: (s: FiltroStatus) => void;
  onMateria: (m: string | null) => void;
  onLimpar: () => void;
  onFechar: () => void;
}) {
  const temFiltro = status !== null || materia !== null;

  return (
    /*
      `z-[70]`, o mesmo do gerenciador de matérias — e não `z-50`, que é o da
      barra de navegação do app. Com z-50 a folha subia por baixo dela: o
      "Ver aulas" ficava escondido atrás de "Modos / Câmera / Galeria", medido
      no navegador. Os dois painéis desta tela vivem na mesma camada porque
      são a mesma coisa para o usuário — algo que abre por cima de tudo.
    */
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      {/* O fundo fecha ao toque — o gesto que todo mundo tenta primeiro. */}
      <button
        type="button"
        aria-label="Fechar os filtros"
        onClick={onFechar}
        className="absolute inset-0 bg-black/45"
      />

      <div
        role="dialog"
        aria-label="Filtrar aulas"
        className="relative max-h-[80vh] overflow-y-auto rounded-t-3xl bg-canvas px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-3"
      >
        {/* A alça: diz "isto sobe e desce" sem uma palavra. */}
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-9 rounded-full bg-ink-muted/25"
        />

        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-ink">Filtrar aulas</h2>
          {temFiltro && (
            <button
              type="button"
              onClick={onLimpar}
              className="min-h-9 rounded-full px-2 text-[12.5px] font-medium text-accent transition-transform active:scale-95"
            >
              Limpar
            </button>
          )}
        </div>

        <Secao titulo="Status">
          <Opcao
            rotulo="Todos"
            n={total}
            escolhido={status === null}
            onEscolher={() => onStatus(null)}
          />
          {CLASS_STATUSES.filter((s) => (statusCounts.get(s) ?? 0) > 0).map((s) => (
            <Opcao
              key={s}
              rotulo={STATUS_STYLES[s].label}
              n={statusCounts.get(s)}
              escolhido={status === s}
              onEscolher={() => onStatus(status === s ? null : s)}
            />
          ))}
          {favorites > 0 && (
            <Opcao
              rotulo="Favoritas"
              n={favorites}
              escolhido={status === "favoritas"}
              onEscolher={() =>
                onStatus(status === "favoritas" ? null : "favoritas")
              }
            />
          )}
        </Secao>

        {/*
          Sem matéria nenhuma cadastrada, esta seção seria um cabeçalho com um
          botão "Todas" embaixo — ruído explicando uma escolha que não existe.
          Gerenciar matérias vive no cabeçalho da galeria, que é outra ação.
        */}
        {disciplines.length > 0 && (
          <Secao titulo="Matéria">
            <Opcao
              rotulo="Todas"
              escolhido={materia === null}
              onEscolher={() => onMateria(null)}
            />
            {disciplines.map(([nome, n]) => (
              <Opcao
                key={nome}
                rotulo={nome}
                n={n}
                escolhido={materia === nome}
                onEscolher={() => onMateria(materia === nome ? null : nome)}
              />
            ))}
          </Secao>
        )}

        <button
          type="button"
          onClick={onFechar}
          className="mt-5 min-h-12 w-full rounded-xl bg-accent text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98]"
        >
          Ver aulas
        </button>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {titulo}
      </h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">{children}</div>
    </section>
  );
}

function Opcao({
  rotulo,
  n,
  escolhido,
  onEscolher,
}: {
  rotulo: string;
  n?: number;
  escolhido: boolean;
  onEscolher: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={escolhido}
      onClick={onEscolher}
      className={`min-h-10 rounded-full px-3.5 text-[13px] font-medium transition-colors active:scale-95 ${
        escolhido ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink"
      }`}
    >
      {rotulo}
      {n !== undefined && (
        <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-60">
          {n}
        </span>
      )}
    </button>
  );
}
