interface ShutterButtonProps {
  mode: "photo" | "video";
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Ocupado com uma captura que leva tempo — o Noturno empilhando quadros. */
  busy?: boolean;
}

/** Single shutter control. White ring = photo. Turns into a pulsing red square while recording video. */
export function ShutterButton({
  mode,
  isRecording,
  onPress,
  disabled = false,
  busy = false,
}: ShutterButtonProps) {
  const isVideoArmed = mode === "video";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled || busy}
      aria-label={
        isVideoArmed
          ? isRecording
            ? "Parar gravação"
            : "Iniciar gravação"
          : "Tirar foto"
      }
      className="relative flex size-[72px] items-center justify-center rounded-full border-4 border-white/90 shadow-[0_2px_14px_rgba(0,0,0,0.4)] active:scale-95 disabled:opacity-30"
    >
      {/* Sombra fina por dentro do anel: sem ela o obturador lia como um
          desenho vetorial colado no vídeo — uma câmera de verdade tem
          profundidade entre o anel e o disco. */}
      <span
        className={
          isRecording
            ? "size-7 rounded-md bg-danger shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)] transition-all animate-pulse"
            : isVideoArmed
              ? "size-[58px] rounded-full bg-danger shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)] transition-all"
              : "size-[58px] rounded-full bg-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] transition-all"
        }
      />
    </button>
  );
}
