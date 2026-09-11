import { useCallback, useEffect, useState } from "react";
import { ClassReview } from "./ClassReview";
import { ClassHeaderCard } from "./ClassHeaderCard";
import { ClassTabs, type ClassTab } from "./ClassTabs";
import { ClassImagesTab } from "./ClassImagesTab";
import { ClassTextTab } from "./ClassTextTab";
import { ClassSummaryTab } from "./ClassSummaryTab";
import { linesWithoutTitle } from "./classText";
import { DisciplinePicker } from "./DisciplinePicker";
import { StatusPicker } from "./StatusPicker";
import { type ClassStatus } from "./status";
import { LessonAudioPlayer } from "../listen/LessonAudioPlayer";
import { getLessonAudio, type LessonAudio } from "../shared/lib/mediaStore";
import {
  getClassById,
  renameClass,
  setClassDiscipline,
  setClassFavorite,
  setClassStatus,
  trashClass,
  type ClassRecord,
} from "./classes";

interface ClassPageProps {
  classId: string;
  onClose: () => void;
  /**
   * Called after anything here writes. The gallery stays mounted behind this
   * page, so a matéria changed here has to reach the chips it filters by —
   * without it, the class moved and the filter above it did not.
   */
  onChanged?: () => void;
}

/**
 * Sua aula — the class as something you keep, not a session that ended.
 *
 * Esta é a tela do `Resumo v2` (`339:611`), e a estrutura dela vem de lá: um
 * cartão de cabeçalho que responde seis perguntas de uma vez, e três abas.
 *
 * As abas resolvem um problema real que a rolagem única tinha: numa aula de
 * doze momentos, o resumo ficava doze telas acima da última captura, e a
 * pergunta "o que eu preciso revisar" só era respondida por quem rolasse até
 * o fim. Cada aba responde uma pergunta diferente — onde está aquele slide,
 * o que foi lido, e como a aula foi no todo.
 *
 * Tudo aqui foi decidido enquanto a aula acontecia e guardado então; nada é
 * recalculado e nenhuma imagem é lida de novo.
 */
export function ClassPage({ classId, onClose, onChanged }: ClassPageProps) {
  const [record, setRecord] = useState<ClassRecord | null | undefined>(undefined);
  /** Index of the moment being reviewed, or null when the timeline is showing. */
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [filing, setFiling] = useState(false);
  const [marking, setMarking] = useState(false);
  /*
   * Abre em Imagens: é a aba que sempre tem conteúdo, porque uma aula sem
   * momento nenhum não vira aula. Texto e Resumo dependem de a leitura ter
   * dado certo, e abrir numa aba vazia faz a tela parecer quebrada.
   */
  const [tab, setTab] = useState<ClassTab>("imagens");
  /** A gravação desta aula, quando ela tem uma. */
  const [audio, setAudio] = useState<LessonAudio | null>(null);
  /** Para onde o player deve pular, quando um momento pede. */
  const [seekTo, setSeekTo] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void getClassById(classId).then((found) => {
      if (!active) return;
      setRecord(found);
      setName(found?.subject ?? "");
    });
    // O áudio vem de um armazém próprio e falha sozinho: uma aula sem
    // gravação abre igual, e uma leitura que der errado não pode impedir a
    // aula de abrir.
    void getLessonAudio(classId)
      .then((achado) => {
        if (active && achado) setAudio(achado);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [classId]);

  // The name is committed when the student leaves the field, not on every
  // keystroke: renaming rewrites every moment of the class.
  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (!record || !trimmed || trimmed === record.subject) return;
    setRecord({ ...record, subject: trimmed });
    void renameClass(record.id, trimmed).then(() => onChanged?.());
  }, [name, record, onChanged]);

  if (record === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-canvas">
        <p className="text-sm text-ink-muted">Abrindo a aula…</p>
      </div>
    );
  }

  if (record === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas px-8 text-center">
        <p className="text-sm text-ink-muted">Esta aula não está mais salva.</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl bg-surface-2 px-5 text-sm text-ink active:opacity-70"
        >
          Voltar
        </button>
      </div>
    );
  }

  const comLeitura = record.moments.filter(
    (m) => linesWithoutTitle(m).length > 0,
  ).length;

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="border-b border-line px-4 pb-0 pt-[max(14px,env(safe-area-inset-top))]">
        {/* "Voltar" à esquerda, como o `339:671` — e não um ✕ à direita. Este é
            o gesto de uma tela que está dentro de outra, e a aula está. */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-full px-2 pr-3 text-[14px] text-ink-muted transition-transform active:scale-95 active:opacity-70"
          >
            <span aria-hidden="true" className="text-[17px] leading-none">
              ‹
            </span>
            Voltar
          </button>
          {/* A estrela não está no wireframe. Fica por decisão de produto: é
              como uma aula volta a ser encontrada na galeria. */}
          <button
            type="button"
            onClick={() => {
              const next = !record.favorite;
              setRecord({ ...record, favorite: next });
              void setClassFavorite(record.id, next).then(() => onChanged?.());
            }}
            aria-label={
              record.favorite ? "Remover dos favoritos" : "Marcar como favorita"
            }
            aria-pressed={record.favorite}
            className={`-mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-[17px] transition-all duration-200 active:scale-90 active:opacity-70 ${
              record.favorite ? "bg-accent-soft text-accent" : "text-ink-muted"
            }`}
          >
            <span
              key={String(record.favorite)}
              className="animate-[slid-rise_260ms_ease-out]"
            >
              {record.favorite ? "★" : "☆"}
            </span>
          </button>
        </div>

        <div className="pb-3.5 pt-1">
          <ClassHeaderCard
            capa={record.moments[0]?.media.blob ?? null}
            nome={name}
            onNome={setName}
            onCommitNome={commitName}
            discipline={record.discipline}
            status={record.status}
            savedAt={record.savedAt}
            durationMs={record.durationMs}
            momentos={record.moments.length}
            editando={editingName}
            onEditar={() => {
              if (editingName) commitName();
              setEditingName((aberto) => !aberto);
            }}
            onAbrirMateria={() => {
              setFiling((open) => !open);
              setMarking(false);
            }}
            onAbrirStatus={() => {
              setMarking((open) => !open);
              setFiling(false);
            }}
            materiaAberta={filing}
            statusAberto={marking}
          />

          {marking && (
            <div className="mt-3 animate-[slid-enter_220ms_ease-out]">
              <StatusPicker
                value={record.status}
                label="Como ficou essa aula para você?"
                onChange={(status: ClassStatus | null) => {
                  setRecord({ ...record, status });
                  void setClassStatus(record.id, status).then(() => onChanged?.());
                }}
              />
            </div>
          )}

          {filing && (
            <div className="mt-3 animate-[slid-enter_220ms_ease-out]">
              <DisciplinePicker
                value={record.discipline}
                onChange={(discipline) => {
                  setRecord({ ...record, discipline });
                  void setClassDiscipline(record.id, discipline).then(() =>
                    onChanged?.(),
                  );
                }}
              />
            </div>
          )}
        </div>

        <ClassTabs
          active={tab}
          onSelect={setTab}
          counts={{
            imagens: record.moments.length,
            texto: comLeitura,
            resumo:
              (record.overview ? 1 : 0) +
              record.topics.length +
              record.kinds.length,
          }}
        />
      </header>

      <div
        role="tabpanel"
        id={`painel-${tab}`}
        aria-labelledby={`aba-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
      >
        {/* O player fica fora das abas, e de propósito: o áudio é da aula
            inteira, não de uma das três vistas dela. Assim "ouvir deste ponto"
            na aba Imagens não faz o player sumir ao trocar para Texto. */}
        {audio && (
          <div className="mb-4">
            <LessonAudioPlayer
              audio={audio}
              seekTo={seekTo}
              onSeeked={() => setSeekTo(null)}
            />
          </div>
        )}

        {tab === "imagens" && (
          <ClassImagesTab
            momentos={record.moments}
            onAbrir={setReviewing}
            onOuvir={
              audio
                ? (atMs) => setSeekTo(Math.max(0, atMs - audio.startedAtMs))
                : undefined
            }
          />
        )}
        {tab === "texto" && (
          <ClassTextTab
            record={record}
            onOuvir={
              audio
                ? (atMs) => setSeekTo(Math.max(0, atMs - audio.startedAtMs))
                : undefined
            }
          />
        )}
        {tab === "resumo" && (
          <ClassSummaryTab
            record={record}
            temAudio={Boolean(audio)}
            onOuvir={
              audio
                ? (atMs) => setSeekTo(Math.max(0, atMs - audio.startedAtMs))
                : undefined
            }
          />
        )}
      </div>

      {record.moments.length > 0 && (
        <footer className="flex gap-2.5 border-t border-line px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => setReviewing(0)}
            className="min-h-11 flex-1 rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
          >
            Revisar a aula
          </button>
          {/* No confirmation, on purpose: this is the reversible one. The class
              goes to the trash whole and comes back whole, and saying so here
              is worth more than a dialog that would make it feel final. */}
          <button
            type="button"
            onClick={async () => {
              await trashClass(record.id);
              onChanged?.();
              onClose();
            }}
            aria-label="Mover a aula para a lixeira"
            className="flex min-h-11 items-center justify-center rounded-xl bg-surface-2 px-4 text-sm font-medium text-ink transition-transform duration-150 active:scale-95 active:opacity-70"
          >
            <span aria-hidden="true">🗑</span>
          </button>
        </footer>
      )}

      {reviewing !== null && (
        <ClassReview
          record={record}
          startAt={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}
