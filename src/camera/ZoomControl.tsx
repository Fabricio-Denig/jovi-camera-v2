import { ZOOM_LEVELS, type ZoomLevel } from "./useZoom";

/**
 * 1x · 2x · 3x — the control a student at the back of the room reaches for.
 *
 * Three fixed steps rather than a pinch: a phone propped against a bag is not
 * being pinched, and during a session the student's hands are somewhere else
 * entirely. One tap, a framing that holds, and nothing to hold onto.
 */
export function ZoomControl({
  level,
  onSelect,
  className = "",
}: {
  level: ZoomLevel;
  onSelect: (level: ZoomLevel) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Aproximar"
      className={`flex items-center gap-1 rounded-full bg-black/45 p-1 backdrop-blur-sm ${className}`}
    >
      {ZOOM_LEVELS.map((value) => {
        const active = value === level;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-pressed={active}
            aria-label={`Aproximar ${value} vezes`}
            className={`flex size-9 items-center justify-center rounded-full text-[12.5px] font-semibold transition-all duration-200 active:scale-90 ${
              active
                ? "bg-white text-black"
                : "text-white/75 active:text-white"
            }`}
          >
            {value}x
          </button>
        );
      })}
    </div>
  );
}
