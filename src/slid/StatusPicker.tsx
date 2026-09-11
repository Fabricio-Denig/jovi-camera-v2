import { CLASS_STATUSES, STATUS_STYLES, type ClassStatus } from "./status";

/**
 * "Como ficou essa aula para você?"
 *
 * A pergunta vem depois de a aula existir, não antes: no fim da sessão o
 * estudante já sabe a resposta, e perguntar antes seria pedir uma previsão.
 *
 * Tocar de novo no status escolhido tira a marca — o mesmo gesto desfaz o
 * toque errado, que é como a matéria já funciona duas linhas acima.
 */
export function StatusPicker({
  value,
  onChange,
  label = "Como ficou essa aula para você?",
}: {
  value: ClassStatus | null;
  onChange: (status: ClassStatus | null) => void;
  label?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <div
        role="group"
        aria-label="Status da aula"
        className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CLASS_STATUSES.map((status) => {
          const style = STATUS_STYLES[status];
          const selected = value === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              title={style.meaning}
              onClick={() => onChange(selected ? null : status)}
              className={`flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-all duration-200 ease-out active:scale-95 ${
                selected
                  ? `${style.chip} ring-1 ring-current`
                  : "bg-surface-2 text-ink-muted"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${selected ? style.dot : "bg-ink-muted/40"}`}
              />
              {style.label}
            </button>
          );
        })}
      </div>
      {/* O significado só do escolhido: cinco legendas de uma vez seriam um
          formulário, e a pergunta é de um toque. */}
      {value && (
        <p className="mt-1.5 text-[12px] text-ink-muted">
          {STATUS_STYLES[value].meaning}
        </p>
      )}
    </div>
  );
}

/** A pastilha, onde só cabe dizer qual é. */
export function StatusChip({ status }: { status: ClassStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${style.chip}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}
