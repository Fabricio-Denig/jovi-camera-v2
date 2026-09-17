export type CameraFacing = "environment" | "user";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unsupported"
  /**
   * A câmera estava viva e o sistema a encerrou.
   *
   * Diferente de `error`: nada deu errado no pedido, e não há nada para a
   * pessoa autorizar. Uma ligação chegou, outro app tomou a câmera, ou o
   * navegador encerrou a track com a aba escondida. O conselho é outro — é
   * "retomar", não "verificar a permissão" — e por isso o estado é outro.
   */
  | "interrupted"
  | "error";

export type CaptureKind = "photo" | "video";

export interface CapturedMedia {
  id: string;
  kind: CaptureKind;
  blob: Blob;
  mimeType: string;
  createdAt: number;
  width: number;
  height: number;
  /** Marked by the student, and the only reason a capture ever gets promoted. */
  favorite?: boolean;
  /**
   * De onde a captura veio, quando não foi o obturador comum.
   *
   * `scanner` é documento capturado no modo Documento. Ele entra na galeria
   * como mídia manual — não é aula e não vira aula —, mas a origem fica
   * registrada para a galeria poder dizer o que é sem adivinhar.
   */
  source?: "scanner";
  /** A aparência escolhida na revisão do documento: Original, Documento, P&B. */
  look?: string;
  /**
   * O texto lido de um documento, quando alguém pediu para extrair.
   *
   * Guardado porque extrair e perder é meia funcionalidade: uma pessoa que
   * lê a folha na revisão e salva espera encontrar aquilo de novo. Reler
   * custaria os quatro megabytes de WASM outra vez.
   *
   * Peneirado pela mesma regra do resto do app — o que não leu como língua
   * nem como fórmula não chega aqui, e o texto bruto do reconhecimento não é
   * guardado em lugar nenhum.
   */
  text?: string[];
  /**
   * When it was thrown away. Set rather than deleted, so the trash can give it
   * back: a lecture is not something to lose to one stray tap.
   */
  deletedAt?: number;
  /** Present when the capture came from a SliD session, which groups it by class. */
  session?: {
    id: string;
    subject: string;
    /**
     * The matéria the student filed it under, when they said. Never guessed —
     * an invented subject is an invented class.
     */
    discipline?: string;
    /** Milliseconds into the session, preserving the order of the class. */
    atMs: number;
    /**
     * What the camera recognised, already in the student's language. Stored
     * because it is the result — reopening a class months later must not
     * depend on reading the board again.
     */
    label?: string;
    /**
     * O título deste momento foi escrito PELO ESTUDANTE.
     *
     * O SliD captura o momento; quem decide como ele se chama é quem assistiu
     * à aula. O título automático ("Conceito apresentado") é um ponto de
     * partida, não um veredito — e uma vez que alguém escreveu o próprio, o
     * app não pode passar por cima na próxima vez que reprocessar a aula.
     * Existe para essa proteção e para mais nada.
     */
    labelManual?: boolean;
    detail?: string | null;
    /**
     * As linhas que a câmera conseguiu ler neste momento, já peneiradas.
     *
     * Não é transcrição, e a diferença importa: o que entra aqui passou pelo
     * mesmo teste de leitura da legenda — língua ou fórmula, dentro da
     * confiança, sem repetir a linha anterior. O que o OCR devolveu e não
     * passou no teste **não é guardado**, então não existe um lugar neste app
     * onde o texto bruto de uma aula fique salvo.
     *
     * Guardado porque a aba Texto tem de abrir meses depois sem ler a imagem
     * de novo — e reler custaria quatro megabytes de WASM e um minuto.
     */
    lines?: string[];
    /** The kind of content, in one word. */
    category?: string | null;
    /** How long the topic kept growing before it settled. */
    spanMs?: number;
    /*
     * Class-level facts, repeated on every moment. Denormalised on purpose: a
     * class is then one query and no second object store, and the subject was
     * already stored this way.
     */
    durationMs?: number;
    skippedDuplicates?: number;
    savedAt?: number;
    /** What the class was about, as lines the lecturer actually wrote. */
    topics?: string[];
    /** The class in a sentence, assembled from what was captured. */
    overview?: string;
    /** Structures the camera recognised, as [kind, count] — the class reopens saying what the summary said. */
    kinds?: [string, number][];
    /** Marked by the student. Denormalised across the moments, like the name. */
    favorite?: boolean;
    /**
     * How the class turned out for the student — revisar, atenção, importante,
     * tranquilo, revisado. Absent until they say.
     */
    status?: string;
    /**
     * O resumo REESCRITO pelo estudante, quando ele reescreveu.
     *
     * O SliD monta um resumo a partir do que ouviu e leu, e ele é bom o
     * bastante para servir de rascunho — mas quem estudou a aula sabe coisas
     * que o áudio não carrega. Presente, este resumo substitui inteiramente o
     * automático na tela: a máquina propõe, a pessoa decide.
     *
     * Guardado junto da sessão, denormalizado em cada momento, como o nome e
     * a matéria — a aula é uma consulta só, sem um segundo object store (ver
     * o comentário dos campos de aula acima).
     *
     * Ausente é o estado normal: significa "ninguém mexeu, mostre o
     * automático". `null` nunca é gravado; para voltar ao automático o campo
     * é removido (ver `restaurarResumoAutomatico`).
     */
    summaryManual?: SummaryManual;
  };
}

/**
 * As quatro seções da aba Resumo, do jeito que o estudante as deixou.
 *
 * Mesma forma do resumo automático (`LessonSummary`), de propósito: a tela
 * renderiza os dois pelo mesmo caminho, e entrar em modo de edição é só
 * copiar o automático para cá e deixar editar. `professorDestacou` guarda o
 * horário junto do texto porque é ele que faz o "Ouvir deste ponto" funcionar
 * — perder o horário ao editar transformaria um destaque navegável em texto
 * morto.
 */
export interface SummaryManual {
  overview: string;
  pontosPrincipais: string[];
  professorDestacou: { atMs: number; text: string }[];
  paraRevisar: string[];
  /** Quando foi salvo — a tela diz "editado por você" a partir disto. */
  editedAt: number;
}
