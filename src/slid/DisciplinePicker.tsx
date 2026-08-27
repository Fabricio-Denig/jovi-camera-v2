import { useState } from "react";
import { addDiscipline, getDisciplines } from "./disciplines";

/**
 * Choosing the matéria — the one question this app asks the student, and it
 * asks it once, at the end, when they already know what the class was.
 *
 * A row of chips instead of a select: the answer is almost always one of five
 * things, and picking it should cost the same as not picking it. Nothing here
 * is required. A class with no matéria is a complete class; the filters simply
 * have one fewer way to find it.
 */
export function DisciplinePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (discipline: string | null) => void;
}) {
  const [names, setNames] = useState(getDisciplines);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");

  const create = () => {
    const stored = addDiscipline(draft);
    if (stored) {
      setNames(getDisciplines());
      onChange(stored);
    }
    setDraft("");
    setNaming(false);
  };

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        Matéria
      </p>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {names.map((name) => {
          const selected = value === name;
          const isOther = name === "Outra";
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (isOther) {
                  setNaming(true);
                  return;
                }
                // Tapping the chosen matéria again takes it off, so a wrong tap
                // is undone the same way it was made.
                onChange(selected ? null : name);
              }}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium active:opacity-70 ${
                selected
                  ? "bg-accent text-accent-ink"
                  : "bg-surface-2 text-ink-muted"
              }`}
            >
              {isOther ? "+ Outra" : name}
            </button>
          );
        })}
      </div>

      {naming && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={draft}
            maxLength={28}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
              if (event.key === "Escape") setNaming(false);
            }}
            placeholder="Nome da matéria"
            aria-label="Nome da matéria"
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-surface-2 px-3.5 text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
          />
          <button
            type="button"
            onClick={create}
            className="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-[13.5px] font-medium text-accent-ink active:opacity-80"
          >
            Criar
          </button>
        </div>
      )}
    </div>
  );
}
