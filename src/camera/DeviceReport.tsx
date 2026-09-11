import { useEffect, useState } from "react";
import { CopyButton } from "../slid/CopyButton";
import {
  montarRelatorio,
  relatorioComoTexto,
  type EstadoVivo,
  type SecaoDoRelatorio,
} from "../shared/lib/deviceReport";

/**
 * O relatório de aparelho, em tela cheia, atrás de `?debug=device`.
 *
 * Um celular em teste de campo não tem console alcançável, e "não funcionou no
 * meu celular" sem dados é uma investigação que começa do zero toda vez. Esta
 * tela existe para virar um texto colável: o que o navegador diz que tem, o
 * que o app conseguiu usar de fato, e o que está guardado.
 *
 * Fora do produto normal — nenhum caminho da interface leva aqui.
 */
export function DeviceReport({
  vivo,
  onFechar,
}: {
  vivo: EstadoVivo;
  onFechar: () => void;
}) {
  const [secoes, setSecoes] = useState<SecaoDoRelatorio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /* Recolher força um recálculo; o estado do aparelho muda entre um teste e
     outro, e um relatório congelado descreveria o momento errado. */
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    let ativo = true;
    montarRelatorio(vivo)
      .then((s) => {
        if (ativo) setSecoes(s);
      })
      // Um relatório que falha e fica em "Lendo…" para sempre é o mesmo
      // defeito que ele existe para diagnosticar.
      .catch((e) => {
        if (ativo)
          setErro(e instanceof Error ? e.message : "erro desconhecido");
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada]);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-canvas">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-ink">
            Diagnóstico do aparelho
          </h1>
          <p className="text-[11.5px] text-ink-muted">
            Só com <code>?debug=device</code>. Não faz parte do produto.
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar o diagnóstico"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink active:opacity-70"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {erro && (
          <p className="rounded-xl border border-danger/40 bg-surface-2 px-3 py-2 text-[13px] text-danger">
            O relatório falhou: {erro}
          </p>
        )}

        {!secoes && !erro && (
          <p className="pt-8 text-center text-sm text-ink-muted">
            Lendo o aparelho…
          </p>
        )}

        {secoes?.map((secao) => (
          <section key={secao.titulo} className="mb-4">
            <h2 className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {secao.titulo}
            </h2>
            <dl className="overflow-hidden rounded-xl border border-line">
              {secao.linhas.map((linha, i) => (
                <div
                  key={linha.rotulo}
                  className={`flex gap-3 px-3 py-2 ${
                    i % 2 === 1 ? "bg-surface-2" : ""
                  }`}
                >
                  <dt className="w-[44%] shrink-0 text-[12px] text-ink-muted">
                    {linha.rotulo}
                  </dt>
                  <dd
                    className={`min-w-0 flex-1 break-words font-mono text-[11.5px] ${
                      linha.tom === "bom"
                        ? "text-accent"
                        : linha.tom === "ruim"
                          ? "text-danger"
                          : "text-ink"
                    }`}
                  >
                    {linha.valor}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <footer className="border-t border-line px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <CopyButton
              texto={secoes ? relatorioComoTexto(secoes) : ""}
              rotulo="Copiar diagnóstico"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setSecoes(null);
              setErro(null);
              setRodada((r) => r + 1);
            }}
            className="min-h-11 shrink-0 rounded-xl bg-surface-2 px-4 text-[14px] font-medium text-ink active:opacity-70"
          >
            Reler
          </button>
        </div>
      </footer>
    </div>
  );
}
