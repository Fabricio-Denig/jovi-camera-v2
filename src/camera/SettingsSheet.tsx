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
