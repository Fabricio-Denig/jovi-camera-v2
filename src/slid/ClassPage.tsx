import { useCallback, useEffect, useState } from "react";
import { ClassReview } from "./ClassReview";
import { ClassHeaderCard } from "./ClassHeaderCard";
import { ClassTabs, type ClassTab } from "./ClassTabs";
import { ClassImagesTab } from "./ClassImagesTab";
import { ClassTextTab } from "./ClassTextTab";
import { ClassSummaryTab } from "./ClassSummaryTab";
import { linesWithoutTitle } from "./classText";
import { LessonPrintSheet } from "./LessonPrintSheet";
import { DisciplinePicker } from "./DisciplinePicker";
import { StatusPicker } from "./StatusPicker";
import { type ClassStatus } from "./status";
import { LessonAudioPlayer } from "../listen/LessonAudioPlayer";
import {
  jobParecaTravado,
  transcreverAula,
} from "../listen/transcribeSession";
import { ListenDebugReport } from "../listen/ListenDebugReport";
import { sugerirTitulo } from "../listen/lessonSummary";
import { getLessonAudio, type LessonAudio } from "../shared/lib/mediaStore";

/** `?debug=listen` abre o diagnóstico do Listen — o que cada etapa da
    transcrição (áudio, motor, download, inferência) registrou de verdade.
    Fora do produto normal, mesmo desenho de `?debug=device`. */
const listenDebug = new URLSearchParams(window.location.search).get("debug") === "listen";
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
  const [record, setRecord] = useState<ClassRecord | null | undefined>(
    undefined,
  );
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
  const [relatorioListenAberto, setRelatorioListenAberto] = useState(listenDebug);

  useEffect(() => {
    let active = true;
    void getClassById(classId)
      .then((found) => {
        if (!active) return;
        setRecord(found);
        setName(found?.subject ?? "");
      })
      // Banco recusado vira "esta aula não está mais salva", que é o estado
      // que já existe e diz a verdade. Sem isto, a tela ficava em "Abrindo a
      // aula…" para sempre.
      .catch(() => {
        if (active) setRecord(null);
      });
    // O áudio vem de um armazém próprio e falha sozinho: uma aula sem
    // gravação abre igual, e uma leitura que der errado não pode impedir a
    // aula de abrir.
    void getLessonAudio(classId)
      .then((achado) => {
        if (!active || !achado) return;
        setAudio(achado);
        /*
         * Uma aula salva por uma versão anterior do app — com áudio, mas sem
         * `transcriptJobStatus` nenhum — nunca passou pelo motor local.
         * Processa uma vez, sozinha: o valor de uma transcrição melhor deve
         * chegar às aulas já guardadas, não só às novas.
         */
        if (achado.transcriptJobStatus === undefined) {
          void transcreverAula(classId);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [classId]);

  /*
   * Enquanto o motor local está processando (nesta aba ou numa aba que já
   * fechou), a tela só descobre que terminou relendo o armazém — não há
   * evento, é um `Promise` solto rodando em segundo plano. O intervalo para
   * sozinho assim que o status sai de "processando", e nunca chega a existir
   * quando não há job nenhum rodando.
   */
  useEffect(() => {
    if (audio?.transcriptJobStatus !== "processando") return;
    const id = window.setInterval(() => {
      void getLessonAudio(classId).then((achado) => {
        if (!achado) return;
        /*
         * Só os campos da transcrição, nunca o objeto inteiro — o IndexedDB
         * devolve um `Blob` novo a cada leitura, mesmo com os bytes
         * idênticos. Substituir `audio` inteiro trocava a identidade desse
         * Blob a cada 2s, e `LessonAudioPlayer` (via `useObjectUrl`) tratava
         * isso como um áudio novo: revogava a URL antiga, criava outra, e o
         * `<audio>` reiniciava — posição e duração resetadas para zero,
         * medido com o player parando de responder a "ouvir deste ponto"
         * bem no meio do reprocessamento. Os campos de áudio (`segments`,
         * `blob`, `mimeType`, `durationMs`, `startedAtMs`) não mudam durante
         * a transcrição — só a leitura os duplica — então preservar a
         * identidade do estado anterior para eles é seguro, e é o que evita
         * o problema pela raiz.
         */
        setAudio((atual) =>
          atual
            ? {
                ...atual,
                transcript: achado.transcript,
                transcriptStatus: achado.transcriptStatus,
                transcriptJobStatus: achado.transcriptJobStatus,
                transcriptJobStartedAt: achado.transcriptJobStartedAt,
              }
            : achado,
        );
      });
    }, 2000);
    return () => window.clearInterval(id);
  }, [classId, audio?.transcriptJobStatus]);

  /*
   * Assim que a transcrição real termina, uma chance de trocar "Aula sem
   * título" por um título de verdade — só quando a pessoa nunca escreveu um.
   * Só dispara na transição para "pronto" (não a cada poll): sem isso,
   * tentaria de novo a cada 2s enquanto o status ficasse parado em "pronto",
   * e a exigência de confiança alta em `sugerirTitulo` já existe — não
   * precisa ser reforçada tentando repetidamente.
   */
  useEffect(() => {
    if (!record || record.subject !== "Aula sem título") return;
    if (audio?.transcriptJobStatus !== "pronto") return;
    const ocrTopicos = record.topics;
    const sugerido = sugerirTitulo(ocrTopicos, audio.transcript ?? []);
    if (!sugerido) return;
    setRecord((atual) => (atual ? { ...atual, subject: sugerido } : atual));
    setName(sugerido);
    void renameClass(classId, sugerido).then(() => onChanged?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, audio?.transcriptJobStatus]);

  // The name is committed when the student leaves the field, not on every
  // keystroke: renaming rewrites every moment of the class.
  const commitName = useCallback(() => {
    const trimmed = name.trim();
    if (!record || !trimmed || trimmed === record.subject) return;
    setRecord({ ...record, subject: trimmed });
    void renameClass(record.id, trimmed).then(() => onChanged?.());
  }, [name, record, onChanged]);

  if (record === undefined) {
    /*
     * Nunca uma tela preta com "Abrindo a aula…" no meio — um teste físico
     * real mostrou até 12s nesse estado numa abertura fria, e uma tela em
     * branco por 12s parece quebrada mesmo quando o app está funcionando.
     * O "Voltar" continua respondendo (a pessoa não fica presa), e o
     * esqueleto ocupa o lugar onde o cabeçalho de verdade vai entrar assim
     * que `getClassById` responder — sem saltar de tamanho quando o
     * conteúdo real chega.
     */
    return (
      <div className="flex h-full flex-col bg-canvas">
        <header className="border-b border-line px-4 pb-0 pt-[max(14px,env(safe-area-inset-top))]">
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
          </div>
          <div className="animate-pulse pb-4 pt-1" aria-hidden="true">
            <div className="h-24 rounded-2xl bg-surface-2" />
            <div className="mt-3 h-4 w-2/3 rounded bg-surface-2" />
            <div className="mt-2 h-3 w-1/3 rounded bg-surface-2" />
          </div>
        </header>
        <p className="sr-only" role="status">
          Abrindo a aula…
        </p>
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
  /*
   * A fala reconhecida desta aula, se houve.
   *
   * Ela viaja junto do áudio e não da aula: são as duas coisas que nascem do
   * mesmo microfone e que o estudante descarta juntas. Uma aula sem gravação
   * simplesmente não tem esta fonte, e a aba Texto continua sendo a aba Texto.
   */
  const transcript = audio?.transcript ?? [];
  const falado = transcript.filter((s) => s.final && s.text.trim()).length;

  /* Sem confirmação, de propósito: esta é a ação reversível. A aula vai
     inteira para a lixeira e volta inteira, e dizer isso vale mais que um
     diálogo que a faria parecer definitiva.

     Seta e não `function`: uma declaração de função é içada para fora do
     estreitamento de tipo acima, e o `record` volta a poder ser nulo dentro
     dela. */
  const excluir = async () => {
    await trashClass(record.id);
    onChanged?.();
    onClose();
  };

  return (
    <div className="flex h-full flex-col bg-canvas">
      {listenDebug && relatorioListenAberto && (
        <ListenDebugReport onFechar={() => setRelatorioListenAberto(false)} />
      )}
      {listenDebug && !relatorioListenAberto && (
        <button
          type="button"
          onClick={() => setRelatorioListenAberto(true)}
          className="fixed right-3 top-[max(60px,calc(env(safe-area-inset-top)+48px))] z-40 min-h-9 rounded-full bg-black/70 px-3 font-mono text-[11px] text-white"
        >
          diagnóstico
        </button>
      )}
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
                  void setClassStatus(record.id, status).then(() =>
                    onChanged?.(),
                  );
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
            // A aba Texto tem duas fontes, e o contador conta as duas: com o
            // quadro ilegível e a fala transcrita, marcá-la como vazia
            // esconderia a única leitura que a aula tem.
            texto: comLeitura + falado,
            // A fala conta: uma aula cujo quadro não deu resumo mas cuja
            // transcrição deu não pode ter a aba marcada como vazia.
            resumo:
              (record.overview ? 1 : 0) +
              record.topics.length +
              record.kinds.length +
              falado,
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

        {audio && (
          <TranscricaoEmAndamento
            audio={audio}
            onTentarDeNovo={() => {
              /*
               * Otimista, e necessário: `transcreverAula` só escreve
               * "processando" no IndexedDB — sem atualizar `audio` aqui, o
               * efeito que faz o polling nunca liga (ele só liga quando
               * `audio.transcriptJobStatus` JÁ é "processando"), e a tela
               * ficava presa mostrando "falhou" até a pessoa sair e voltar.
               */
              setAudio({
                ...audio,
                transcriptJobStatus: "processando",
                transcriptJobStartedAt: Date.now(),
              });
              void transcreverAula(classId);
            }}
          />
        )}

        {tab === "imagens" && (
          <ClassImagesTab
            momentos={record.moments}
            onAbrir={setReviewing}
            // O player recebe o ms da sessão direto — o mesmo eixo de
            // `capture.atMs` — e resolve sozinho em qual trecho isso cai.
            onOuvir={audio ? (atMs) => setSeekTo(atMs) : undefined}
          />
        )}
        {tab === "texto" && (
          <ClassTextTab
            record={record}
            transcript={transcript}
            transcriptStatus={audio?.transcriptStatus}
            // O player recebe o ms da sessão direto — o mesmo eixo de
            // `capture.atMs` — e resolve sozinho em qual trecho isso cai.
            onOuvir={audio ? (atMs) => setSeekTo(atMs) : undefined}
          />
        )}
        {tab === "resumo" && (
          <ClassSummaryTab
            record={record}
            temAudio={Boolean(audio)}
            transcript={transcript}
            transcriptStatus={audio?.transcriptStatus}
            onExcluir={excluir}
            // O player recebe o ms da sessão direto — o mesmo eixo de
            // `capture.atMs` — e resolve sozinho em qual trecho isso cai.
            onOuvir={audio ? (atMs) => setSeekTo(atMs) : undefined}
          />
        )}
      </div>

      {record.moments.length > 0 && (
        <footer className="border-t border-line px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
          {/* Só a ação principal. A lixeira que ficava ao lado virou o cartão
              "Excluir" das ações rápidas, e dois caminhos para a mesma coisa
              na mesma tela é ruído — ainda mais quando um deles é um ícone
              sem rótulo. */}
          <button
            type="button"
            onClick={() => setReviewing(0)}
            className="min-h-11 w-full rounded-xl bg-accent py-3 text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] active:opacity-80"
          >
            Revisar a aula
          </button>
        </footer>
      )}

      {/* A folha de impressão vive fora da tela e só existe quando alguém
          manda imprimir. Ela precisa estar no documento — não dá para montá-la
          durante o `print()`. */}
      <LessonPrintSheet
        record={record}
        temAudio={Boolean(audio)}
        transcript={transcript}
      />

      {reviewing !== null && (
        <ClassReview
          record={record}
          startAt={reviewing}
          transcript={transcript}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

/**
 * O estado do reprocessamento — discreto, e quieto na maior parte do tempo.
 *
 * Ele não aparece quando termina bem: uma aula pronta simplesmente mostra a
 * transcrição nas abas Texto e Resumo, sem crachá-lo em lugar nenhum. Só fala
 * quando há algo a dizer — ainda organizando, ou não deu certo — porque um
 * selo "transcrito com sucesso" permanente seria propaganda de recurso, não
 * informação.
 */
function TranscricaoEmAndamento({
  audio,
  onTentarDeNovo,
}: {
  audio: LessonAudio;
  onTentarDeNovo: () => void;
}) {
  if (audio.transcriptJobStatus === "processando" && !jobParecaTravado(audio)) {
    return (
      <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-muted">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 animate-pulse rounded-full bg-accent"
        />
        Organizando o que foi dito…
      </p>
    );
  }

  const travado = jobParecaTravado(audio);
  if (audio.transcriptJobStatus === "falhou" || travado) {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
        <p className="text-[12.5px] leading-snug text-ink-muted">
          Não foi possível organizar o que foi dito agora.
        </p>
        <button
          type="button"
          onClick={onTentarDeNovo}
          className="min-h-9 shrink-0 rounded-full bg-accent-soft px-3 text-[12.5px] font-medium text-accent transition-transform active:scale-95"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  return null;
}
