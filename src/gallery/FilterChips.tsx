/**
 * The chips that decide what the gallery is showing.
 *
 * A row of pills rather than a segmented control or a dropdown: it scrolls
 * when there are more filters than fit, it takes one thumb, and it says what
 * the alternatives are without being opened. That last part matters most here,
 * because "SliD" being one of the filters is how a student finds out their
 * classes live in the same place as their photos.
 */
export interface Chip {
  id: string;
  label: string;
  /** Shown beside the label when there is something to count. */
  count?: number;
}

interface FilterChipsProps {
  chips: Chip[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
}

export function FilterChips({
  chips,
  active,
  onSelect,
  label,
}: FilterChipsProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      // The negative margin lets the row bleed to the screen edge while the
      // first chip still lines up with the heading above it.
      // 8 px entre chips e 24 px de margem: medido no `339:540`, onde os chips
      // começam em x=29 e ficam 8 px um do outro.
      className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {chips.map((chip) => {
        const selected = chip.id === active;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(chip.id)}
            className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium transition-all duration-200 ease-out active:scale-95 active:opacity-80 ${
              selected
                ? "bg-accent text-accent-ink shadow-[0_2px_10px_-2px] shadow-accent/50"
                : "bg-surface-2 text-ink-muted"
            }`}
          >
            {chip.label}
            {chip.count !== undefined && chip.count > 0 && (
              <span className={selected ? "opacity-70" : "opacity-60"}>
                {" "}
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
