/**
 * O lápis — o mesmo gesto, em todo lugar que o app deixa reescrever algo.
 *
 * Nasceu no cabeçalho da aula (`ClassHeaderCard`), onde o wireframe pedia um
 * lápis explícito em vez de esperar que a pessoa descobrisse sozinha que o
 * título era editável. Agora o SliD deixa editar mais de uma coisa — o resumo
 * inteiro e o título de cada momento — e três lápis desenhados três vezes
 * viram três tamanhos e três cores em duas semanas. Este arquivo é a
 * definição única: mesmo glifo, mesmo alvo de toque, mesmo realce quando
 * ativo.
 *
 * Pequeno de propósito. O conteúdo é o que importa na tela; o lápis precisa
 * ser encontrável ao procurar, não competir com o que está escrito. Por isso
 * um glifo discreto e não um botão "EDITAR" — que, repetido por momento,
 * transformaria a aba Imagens num painel de administração.
 */
export function EditPencil({
  onClick,
  ativo = false,
  rotulo,
  rotuloAtivo,
  tamanho = "normal",
}: {
  onClick: () => void;
  /** Em edição — o lápis vira ✓ e ganha o realce de "isto está ligado". */
  ativo?: boolean;
  /** `aria-label` no estado normal. Sempre diz O QUE edita, nunca só "editar". */
  rotulo: string;
  /** `aria-label` enquanto edita. Cai para `rotulo` quando não informado. */
  rotuloAtivo?: string;
  /**
   * `compacto` para dentro de um cartão de momento, onde o alvo divide a
   * linha com o título e um botão de ouvir. Continua com 32px de alvo — o
   * mínimo confortável no polegar —, só sem a folga extra em volta.
   */
  tamanho?: "normal" | "compacto";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ativo ? (rotuloAtivo ?? rotulo) : rotulo}
      aria-pressed={ativo}
      className={`flex shrink-0 items-center justify-center rounded-full transition-transform active:scale-90 ${
        tamanho === "compacto" ? "size-8 text-[12px]" : "size-9 text-[13px]"
      } ${ativo ? "bg-accent-soft text-accent" : "text-ink-muted"}`}
    >
      {ativo ? "✓" : "✎"}
    </button>
  );
}
