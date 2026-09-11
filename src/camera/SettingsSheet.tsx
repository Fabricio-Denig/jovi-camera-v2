import { BottomSheet } from "../shared/ui/BottomSheet";

export interface CameraSettings {
  /** Linhas de terços sobre o visor. */
  grid: boolean;
  /** Guardar a selfie como ela aparece na tela, e não como a lente a vê. */
  mirrorSelfie: boolean;
}

export const DEFAULT_SETTINGS: CameraSettings = {
  grid: false,
  mirrorSelfie: true,
};

/**
 * Ajustes rápidos.
 *
 * Só entra aqui o que existe de verdade e o que muda alguma coisa. A tentação
 * numa tela dessas é encher de interruptores para ela parecer completa, e o
 * resultado é uma banca tocando em algo que não faz nada. Dois interruptores
 * que funcionam valem mais que oito que decoram.
 */
export function SettingsSheet({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: CameraSettings;
  onChange: (settings: CameraSettings) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      open={open}
      title="Ajustes da câmera"
      subtitle="Valem para as fotos que você tira"
      onClose={onClose}
    >
      <div className="flex flex-col gap-2 pb-1">
        <Toggle
          label="Grade de composição"
          hint="Linhas de terços sobre o visor"
          on={settings.grid}
          onToggle={() => onChange({ ...settings, grid: !settings.grid })}
        />
        <Toggle
          label="Espelhar selfies"
          hint="Guarda a foto como você a vê na tela"
          on={settings.mirrorSelfie}
          onToggle={() =>
            onChange({ ...settings, mirrorSelfie: !settings.mirrorSelfie })
          }
        />

        {/*
          Onde a pessoa procura quando quer saber, e não quando está no meio de
          uma aula.

          O mesmo texto está no "Saiba mais" do SliD, que é onde ele aparece na
          hora do recurso. Aqui ele fica acessível sempre — é o lugar em que se
          procura por "o que esse app faz com meus dados" quando a pergunta vem
          depois, e não durante.

          As duas frases são separadas porque as duas coisas são separadas: o
          arquivo de áudio dá para afirmar que fica no aparelho; o que o
          reconhecimento do navegador faz com o som, não. Por isso a palavra
          "local" não cobre as duas.
        */}
        <section className="mt-1 rounded-2xl bg-surface-2 px-4 py-3.5">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Áudio e transcrição das aulas
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-snug text-ink">
            O áudio da aula é gravado pelo app e fica guardado neste aparelho.
          </p>
          <p className="mt-1 text-[12px] leading-snug text-ink-muted">
            Quando o navegador oferece transcrição da fala, quem reconhece é
            ele — e, dependendo do navegador, isso pode usar o serviço de
            reconhecimento de voz dele. O app não controla essa parte.
          </p>
        </section>
      </div>
    </BottomSheet>
  );
}

function Toggle({
  label,
  hint,
  on,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 text-left transition-transform active:scale-[0.99] active:opacity-80"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] text-ink">{label}</span>
        <span className="block text-[11.5px] text-ink-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ${
          on ? "bg-accent" : "bg-canvas"
        }`}
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-white transition-all duration-200 ${
            on ? "left-5" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}
