interface ShutterButtonProps {
  mode: "photo" | "video";
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** Single shutter control. White ring = photo. Turns into a pulsing red square while recording video. */
export function ShutterButton({
  mode,
  isRecording,
  onPress,
  disabled = false,
}: ShutterButtonProps) {
  const isVideoArmed = mode === "video";

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={
        isVideoArmed
          ? isRecording
            ? "Parar gravação"
            : "Iniciar gravação"
          : "Tirar foto"
      }
      className="relative flex size-[72px] items-center justify-center rounded-full border-4 border-white/90 active:scale-95 disabled:opacity-30"
    >
      <span
        className={
          isRecording
            ? "size-7 rounded-md bg-danger transition-all animate-pulse"
            : isVideoArmed
              ? "size-[58px] rounded-full bg-danger transition-all"
              : "size-[58px] rounded-full bg-white transition-all"
        }
      />
    </button>
  );
}
