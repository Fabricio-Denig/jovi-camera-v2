import { useState } from "react";
import { VERDICT_LABELS } from "./frameAnalysis";
import type { SlidDiagnostics } from "./useSlidSession";

/**
 * O painel de diagnóstico, atrás de `?debug=slid`.
 *
 * Ele existe por um motivo específico: quando o teste em sala falha, "não
 * detectou" não é um relatório — é uma impressão. Isto transforma a impressão
 * em números que dizem *qual* condição reprovou, em que janela, com quanto
 * contraste. É a diferença entre adivinhar por que o celular falha e saber.
 *
 * Não é bonito de propósito. É denso, é copiável e cabe num canto.
 */
export function SlidDebugPanel({
  diagnostics,
  zoomLevel,
  zoomNative,
  suggesting,
  running,
}: {
  diagnostics: SlidDiagnostics | null;
  zoomLevel: number;
  zoomNative: boolean;
  suggesting: boolean;
  running: boolean;
}) {
  const [aberto, setAberto] = useState(true);
  const [copiado, setCopiado] = useState(false);

  const cena = diagnostics?.scene ?? null;
  const relatorio = montarRelatorio(diagnostics, zoomLevel, zoomNative, suggesting, running);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorio);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissão de área de transferência o texto continua na tela para
      // ser lido ou fotografado, que é o que importa num teste de campo.
      setCopiado(false);
    }
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="pointer-events-auto absolute bottom-[268px] left-2 z-40 rounded-md bg-black/75 px-2 py-1 font-mono text-[10px] text-emerald-300"
      >
        debug
      </button>
    );
  }

  return (
    <div
      data-slid-debug=""
      /*
       * Atravessável, e é isso que importa mais que a posição.
       *
       * O painel cobria as abas de modo, e o roteiro de teste em campo manda
       * abrir o diagnóstico e *depois* tocar em SliD — um diagnóstico que
       * impede o gesto que ele existe para medir não é um diagnóstico. Subir
       * o painel só trocava a vítima: mais acima ele engolia o controle de
       * zoom, que é o outro gesto do roteiro. Numa tela de celular não existe
       * canto livre.
       *
       * Então ele deixa de disputar: os toques passam por ele e chegam no
       * controle que está embaixo. Só os botões dele mesmo capturam.
       */
      className="pointer-events-none absolute bottom-[268px] left-2 z-40 max-w-[70%] rounded-lg bg-black/80 p-2 font-mono text-[10px] leading-[1.45] text-white/90 backdrop-blur"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-semibold text-emerald-300">slid debug</span>
        <button
          type="button"
          onClick={copiar}
          className="pointer-events-auto rounded bg-white/15 px-1.5 py-0.5 text-[9.5px]"
        >
          {copiado ? "copiado" : "copiar"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          aria-label="Esconder diagnóstico"
          className="pointer-events-auto rounded bg-white/15 px-1.5 py-0.5 text-[9.5px]"
        >
          ✕
        </button>
      </div>

      {!cena ? (
        <p className="text-white/60">sem leitura ainda…</p>
      ) : (
        <>
          <Linha rotulo="estado">
            {running ? "sessão" : suggesting ? "SUGERINDO" : "procurando"} ·{" "}
            {diagnostics!.streak}/{diagnostics!.needed}
          </Linha>
          <Linha rotulo="veredito">
            <span className={cena.looksLikeClass ? "text-emerald-300" : "text-amber-300"}>
              {VERDICT_LABELS[cena.verdict]}
            </span>
          </Linha>
          <Linha rotulo="janela">
            {cena.scale}x lida
            {diagnostics!.lockedScale > 0 && ` · ${diagnostics!.lockedScale}x travada`}
          </Linha>
          <Linha rotulo="zoom">
            {zoomLevel}x {zoomNative ? "hardware" : "digital"}
          </Linha>
          <Linha rotulo="tinta">limiar {cena.inkThreshold.toFixed(0)}/255</Linha>
          <Linha rotulo="moldura">
            {cena.bounds
              ? `${(cena.bounds.x * 100).toFixed(0)},${(cena.bounds.y * 100).toFixed(0)} ` +
                `${(cena.bounds.width * 100).toFixed(0)}×${(cena.bounds.height * 100).toFixed(0)}%`
              : "nenhuma"}
          </Linha>
          {cena.tooSmall && (
            <p className="mt-1 rounded bg-amber-400/20 px-1 py-0.5 text-amber-200">
              conteúdo pequeno — 2x deve ajudar
            </p>
          )}

          <table className="mt-1.5 w-full border-collapse text-[9.5px] [&_td]:pr-1.5 [&_th]:pr-1.5">
            <thead className="text-white/50">
              <tr>
                <th className="text-left font-normal">jan</th>
                <th className="text-right font-normal">lin</th>
                <th className="text-right font-normal">fx</th>
                <th className="text-right font-normal">dens</th>
                <th className="text-right font-normal">finos</th>
                <th className="text-left font-normal">&nbsp;veredito</th>
              </tr>
            </thead>
            <tbody>
              {cena.readings.map((r) => (
                <tr key={r.scale} className={r.scale === cena.scale ? "text-white" : "text-white/55"}>
                  <td>{r.scale}x</td>
                  <td className="text-right">{r.writtenRows}</td>
                  <td className="text-right">{r.lines}</td>
                  <td className="text-right">{r.runDensity.toFixed(1)}</td>
                  <td className="text-right">{r.thinShare.toFixed(2)}</td>
                  <td className="pl-1">{VERDICT_LABELS[r.verdict]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="text-white/50">{rotulo} </span>
      {children}
    </p>
  );
}

/**
 * O texto que vai para a área de transferência.
 *
 * Curto de propósito: cabe numa mensagem, e traz o navegador e a tela junto
 * porque metade dos relatos de campo é "no meu celular não funciona".
 */
function montarRelatorio(
  d: SlidDiagnostics | null,
  zoomLevel: number,
  zoomNative: boolean,
  suggesting: boolean,
  running: boolean,
): string {
  if (!d?.scene) return "slid: sem leitura";
  const c = d.scene;
  const janelas = c.readings
    .map(
      (r) =>
        `  ${r.scale}x lin=${r.writtenRows} fx=${r.lines} dens=${r.runDensity.toFixed(1)} ` +
        `finos=${r.thinShare.toFixed(2)} -> ${VERDICT_LABELS[r.verdict]}`,
    )
    .join("\n");
  const caixa = c.bounds
    ? `${(c.bounds.x * 100).toFixed(0)},${(c.bounds.y * 100).toFixed(0)} ${(c.bounds.width * 100).toFixed(0)}x${(c.bounds.height * 100).toFixed(0)}%`
    : "nenhuma";
  return [
    `slid ${running ? "sessão" : suggesting ? "SUGERINDO" : "procurando"} ${d.streak}/${d.needed}`,
    `veredito: ${VERDICT_LABELS[c.verdict]} (janela ${c.scale}x${d.lockedScale ? `, travada ${d.lockedScale}x` : ""})`,
    `zoom: ${zoomLevel}x ${zoomNative ? "hardware" : "digital"}`,
    `tinta: limiar ${c.inkThreshold.toFixed(0)}/255`,
    `moldura: ${caixa}`,
    c.tooSmall ? "dica: conteúdo pequeno, 2x deve ajudar" : "",
    "janelas:",
    janelas,
    `tela: ${window.innerWidth}x${window.innerHeight}`,
    `nav: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join("\n");
}
