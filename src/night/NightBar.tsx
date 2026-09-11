import { NIVEIS_NOTURNOS, type NivelNoturno } from "./stackFrames";

/**
 * Os controles do modo Noite.
 *
 * A instrução "apoie o celular" não é conselho genérico: este modo empilha
 * quadros sem alinhá-los, então tremor vira borrão. Dizer isso na tela é a
 * diferença entre um modo que funciona e um modo que a pessoa acha quebrado.
 */
export function NightBar({
  nivel,
  onNivel,
  progresso,
  ocupado,
}: {
  nivel: NivelNoturno;
  onNivel: (n: NivelNoturno) => void;
  /** 0–1 enquanto empilha. */
  progresso: number;
  ocupado: boolean;
}) {
  const escolhido = NIVEIS_NOTURNOS.find((n) => n.id === nivel) ?? NIVEIS_NOTURNOS[1];

  if (ocupado) {
    return (
      <div className="pointer-events-none flex w-full max-w-sm flex-col items-center gap-2 px-5">
        <p className="text-[12.5px] font-medium text-white">
          Segure firme — juntando {escolhido.quadros} quadros
        </p>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-150"
            style={{ width: `${Math.round(progresso * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center gap-1.5 px-5">
      <div role="radiogroup" aria-label="Tempo de exposição" className="flex gap-1.5">
        {NIVEIS_NOTURNOS.map((n) => {
          const ativo = n.id === nivel;
          return (
            <button
              key={n.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => onNivel(n.id)}
              className={`min-h-10 rounded-full px-3.5 text-[12.5px] font-medium transition-transform active:scale-95 ${
                ativo ? "bg-white text-black" : "bg-black/45 text-white/80 backdrop-blur"
              }`}
            >
              {n.label}
              <span className={ativo ? "opacity-60" : "opacity-50"}> {n.segundos}s</span>
            </button>
          );
        })}
      </div>
      {/* O que o modo faz, em uma linha, sem prometer o que ele não faz. */}
      <p className="text-center text-[11px] leading-snug text-white/70">
        Junta {escolhido.quadros} quadros para tirar o granulado.{" "}
        <span className="text-white/90">Apoie o celular</span> — este modo não
        corrige tremor.
      </p>
    </div>
  );
}
