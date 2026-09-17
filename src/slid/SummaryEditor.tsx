import { useRef, useState } from "react";
import { formatClock } from "../shared/lib/time";
import type { SummaryManual } from "../types/camera";

/**
 * O resumo, reescrito à mão.
 *
 * **Por que existe.** O SliD monta um resumo do que ouviu e leu, e ele é bom
 * o bastante para servir de rascunho — mas quem assistiu à aula sabe coisas
 * que o áudio não carrega: o que o professor explicou no quadro sem falar, o
 * que já se sabia, o que ficou confuso. Um resumo que não pode ser corrigido
 * é uma opinião da máquina imposta a quem estudou. A máquina propõe; a pessoa
 * decide.
 *
 * **Um campo por seção, uma linha por item.** Não é um editor rico, e não
 * deve ser: no celular, uma caixa de texto em que cada linha é um item é mais
 * rápida do que qualquer interface de arrastar e soltar — acrescentar é dar
 * enter, remover é apagar a linha. As quatro seções da aba viram quatro
 * campos, nada mais.
 *
 * **"Professor destacou" é o caso especial**, e por um motivo concreto: cada
 * destaque carrega o horário que faz o "Ouvir deste ponto" funcionar. Um
 * campo de texto livre perderia esse horário e transformaria um destaque
 * navegável em texto morto — então aqui o horário fica visível e fixo, e só o
 * texto é editável. Esvaziar a linha remove o destaque.
 */
export function SummaryEditor({
  inicial,
  editadoAntes,
  onSalvar,
  onCancelar,
  onRestaurar,
}: {
  inicial: SummaryManual;
  /** Já existe uma versão manual salva — habilita voltar ao automático. */
  editadoAntes: boolean;
  onSalvar: (manual: SummaryManual) => void;
  onCancelar: () => void;
  onRestaurar: () => void;
}) {
  const [overview, setOverview] = useState(inicial.overview);
  const [pontos, setPontos] = useState(inicial.pontosPrincipais.join("\n"));
  const [revisar, setRevisar] = useState(inicial.paraRevisar.join("\n"));
  const [destaques, setDestaques] = useState(inicial.professorDestacou);
  const [salvando, setSalvando] = useState(false);

  const linhas = (texto: string) =>
    texto
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

  const salvar = () => {
    setSalvando(true);
    onSalvar({
      overview: overview.trim(),
      pontosPrincipais: linhas(pontos),
      paraRevisar: linhas(revisar),
      professorDestacou: destaques.filter((d) => d.text.trim()),
      editedAt: Date.now(),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Campo
        rotulo="Resumo da aula"
        valor={overview}
        onChange={setOverview}
        linhasMinimas={4}
        dica="Duas a cinco frases sobre o que a aula foi."
      />

      <Campo
        rotulo="Pontos principais"
        valor={pontos}
        onChange={setPontos}
        linhasMinimas={4}
        dica="Um por linha. Apague a linha para remover."
      />

      {destaques.length > 0 && (
        <section>
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">
            Professor destacou
          </h2>
          <p className="mt-1 text-[11.5px] leading-snug text-ink-muted/75">
            O horário fica — é ele que leva de volta ao áudio. Apague o texto
            para remover o destaque.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {destaques.map((d, i) => (
              <li key={`${d.atMs}-${i}`} className="flex items-center gap-2">
                <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-accent">
                  ★ {formatClock(d.atMs)}
                </span>
                <input
                  value={d.text}
                  aria-label={`Destaque de ${formatClock(d.atMs)}`}
                  onChange={(e) =>
                    setDestaques((atual) =>
                      atual.map((item, k) =>
                        k === i ? { ...item, text: e.target.value } : item,
                      ),
                    )
                  }
                  className="min-h-9 min-w-0 flex-1 rounded-lg bg-surface-2 px-2.5 text-[13.5px] text-ink focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/40"
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Campo
        rotulo="Para revisar"
        valor={revisar}
        onChange={setRevisar}
        linhasMinimas={3}
        dica="Um por linha. Pode ficar vazio."
      />

      {/*
        As ações no fim do formulário, não flutuando: a aba já tem o botão
        "Revisar a aula" fixo no rodapé da página, e uma segunda barra fixa por
        cima dela esconderia justamente o último campo que se está editando.
      */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="min-h-11 flex-1 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-transform duration-150 active:scale-[0.98] disabled:opacity-60"
        >
          {salvando ? "Salvando…" : "Salvar resumo"}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="min-h-11 rounded-xl bg-surface-2 px-4 text-sm font-medium text-ink-muted transition-transform duration-150 active:scale-[0.98]"
        >
          Cancelar
        </button>
      </div>

      {/*
        Só aparece depois de existir uma versão manual: antes disso não há o
        que restaurar, e o botão seria uma pergunta sem resposta.
      */}
      {editadoAntes && (
        <button
          type="button"
          onClick={onRestaurar}
          className="-mt-1 self-start text-[12.5px] text-ink-muted underline underline-offset-2 transition-opacity active:opacity-60"
        >
          Voltar ao resumo do SliD
        </button>
      )}
    </div>
  );
}

/** Um campo de texto que cresce com o conteúdo — nunca uma caixa de rolagem
    de três linhas no meio de um resumo que tem seis. */
function Campo({
  rotulo,
  valor,
  onChange,
  linhasMinimas,
  dica,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  linhasMinimas: number;
  dica: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const crescer = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <section>
      <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {rotulo}
      </h2>
      <p className="mt-1 text-[11.5px] leading-snug text-ink-muted/75">{dica}</p>
      <textarea
        ref={(el) => {
          ref.current = el;
          crescer(el);
        }}
        rows={linhasMinimas}
        value={valor}
        aria-label={rotulo}
        onChange={(e) => {
          onChange(e.target.value);
          crescer(e.currentTarget);
        }}
        className="mt-2 w-full resize-none overflow-hidden rounded-xl bg-surface-2 px-3 py-2.5 text-[14px] leading-relaxed text-ink focus:bg-surface focus:outline-none focus:ring-1 focus:ring-accent/40"
      />
    </section>
  );
}
