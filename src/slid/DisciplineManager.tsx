import { useState } from "react";
import { BottomSheet } from "../shared/ui/BottomSheet";
import {
  addDiscipline,
  getManageableDisciplines,
  removeDiscipline,
  renameDiscipline,
} from "./disciplines";

/**
 * Gerenciar matérias — the list itself, in one place a student can find.
 *
 * Filing a class happens where the class is; the list of names is a different
 * job, and before this it had nowhere to live: you could only create a matéria
 * at the exact moment you were saving a lecture, and nothing anywhere let you
 * fix a typo. So it sits behind one button beside the filters it feeds.
 *
 * Every row behaves the same, defaults included. A list where half the rows
 * have an edit button and half do not is a list that has to be explained.
 *
 * Deleting a matéria never deletes a class. The names are a filing system; the
 * lectures are the student's, and they come back filed under nothing.
 */
export function DisciplineManager({
  open,
  onClose,
  counts,
  onRenamed,
  onRemoved,
}: {
  open: boolean;
  onClose: () => void;
  /** How many saved classes carry each matéria, so the warning can be specific. */
  counts: Map<string, number>;
  onRenamed: (from: string, to: string) => void;
  onRemoved: (name: string) => void;
}) {
  const [names, setNames] = useState(getManageableDisciplines);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = () => setNames(getManageableDisciplines());

  const commitRename = (from: string) => {
    const stored = renameDiscipline(from, draft);
    if (!stored) {
      setProblem(
        draft.trim() ? "Já existe uma matéria com esse nome." : "Dê um nome à matéria.",
      );
      return;
    }
    refresh();
    onRenamed(from, stored);
    setEditing(null);
    setDraft("");
    setProblem(null);
  };

  const commitCreate = () => {
    const stored = addDiscipline(draft);
    if (!stored) {
      setProblem("Dê um nome à matéria.");
      return;
    }
    refresh();
    setCreating(false);
    setDraft("");
    setProblem(null);
  };

  return (
    <BottomSheet
      open={open}
      title="Matérias"
      subtitle="Onde suas aulas ficam guardadas"
      onClose={() => {
        setEditing(null);
        setCreating(false);
        setProblem(null);
        onClose();
      }}
    >
      <ul className="flex flex-col gap-1.5 pb-2">
        {names.map((name) => {
          const used = counts.get(name) ?? 0;
          if (editing === name) {
            return (
              <li key={name} className="rounded-2xl bg-surface-2 p-3">
                <NameField
                  value={draft}
                  onChange={setDraft}
                  onCommit={() => commitRename(name)}
                  onCancel={() => {
                    setEditing(null);
                    setProblem(null);
                  }}
                  action="Salvar"
                />
                {problem && (
                  <p className="mt-2 text-[12px] text-danger">{problem}</p>
                )}
              </li>
            );
          }
          return (
            <li
              key={name}
              className="flex items-center gap-2 rounded-2xl bg-surface-2 py-2 pl-3.5 pr-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] text-ink">{name}</p>
                <p className="text-[11.5px] text-ink-muted">
                  {used === 0
                    ? "Nenhuma aula"
                    : `${used} ${used === 1 ? "aula" : "aulas"}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditing(name);
                  setCreating(false);
                  setDraft(name);
                  setProblem(null);
                }}
                aria-label={`Renomear ${name}`}
                className="flex size-10 items-center justify-center rounded-xl text-ink-muted transition-transform active:scale-90 active:text-ink"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => setRemoving(name)}
                aria-label={`Apagar a matéria ${name}`}
                className="flex size-10 items-center justify-center rounded-xl text-ink-muted transition-transform active:scale-90 active:text-danger"
              >
                🗑
              </button>
            </li>
          );
        })}
      </ul>

      {creating ? (
        <div className="rounded-2xl bg-surface-2 p-3">
          <NameField
            value={draft}
            onChange={setDraft}
            onCommit={commitCreate}
            onCancel={() => {
              setCreating(false);
              setProblem(null);
            }}
            action="Criar"
          />
          {problem && <p className="mt-2 text-[12px] text-danger">{problem}</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setEditing(null);
            setDraft("");
            setProblem(null);
          }}
          className="min-h-11 w-full rounded-xl bg-accent text-[14px] font-medium text-accent-ink transition-transform active:scale-[0.98] active:opacity-80"
        >
          + Nova matéria
        </button>
      )}

      {removing && (
        <RemoveConfirm
          name={removing}
          used={counts.get(removing) ?? 0}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            removeDiscipline(removing);
            refresh();
            onRemoved(removing);
            setRemoving(null);
          }}
        />
      )}
    </BottomSheet>
  );
}

function NameField({
  value,
  onChange,
  onCommit,
  onCancel,
  action,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  action: string;
}) {
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={value}
        maxLength={28}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onCommit();
          if (event.key === "Escape") onCancel();
        }}
        placeholder="Nome da matéria"
        aria-label="Nome da matéria"
        className="min-h-11 min-w-0 flex-1 rounded-xl bg-canvas px-3.5 text-[14px] text-ink outline-none placeholder:text-ink-muted/60"
      />
      <button
        type="button"
        onClick={onCommit}
        className="min-h-11 shrink-0 rounded-xl bg-accent px-4 text-[13.5px] font-medium text-accent-ink transition-transform active:scale-95 active:opacity-80"
      >
        {action}
      </button>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar"
        className="min-h-11 shrink-0 rounded-xl bg-canvas px-3 text-[13.5px] text-ink-muted transition-transform active:scale-95"
      >
        ✕
      </button>
    </div>
  );
}

function RemoveConfirm({
  name,
  used,
  onCancel,
  onConfirm,
}: {
  name: string;
  used: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Apagar matéria"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm animate-[slid-rise_220ms_ease-out] rounded-2xl bg-canvas p-5">
        <h2 className="text-[16px] font-semibold text-ink">
          Apagar a matéria "{name}"?
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-ink-muted">
          {used === 0
            ? "Nenhuma aula está guardada nela."
            : `${used === 1 ? "A aula guardada nela fica" : `As ${used} aulas guardadas nela ficam`} sem matéria. Nenhuma aula é apagada.`}
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl bg-accent text-[13.5px] font-medium text-accent-ink transition-transform active:scale-[0.98] active:opacity-80"
          >
            Manter
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-surface-2 text-[13.5px] font-medium text-danger transition-transform active:scale-[0.98] active:opacity-70"
          >
            Apagar matéria
          </button>
        </div>
      </div>
    </div>
  );
}
