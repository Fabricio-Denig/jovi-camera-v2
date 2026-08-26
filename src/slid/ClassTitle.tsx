import { useEffect, useRef } from "react";

interface ClassTitleProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
}

/**
 * The name of the class, editable in place.
 *
 * A single-line input scrolled a real class name out of view: "Cálculo
 * Diferencial e Integral II — Séries de Taylor" showed as "Cálculo Diferencial
 * e In" and stopped, with no ellipsis to say so. A student cannot check a name
 * they cannot read. This grows to fit instead, and refuses newlines, because a
 * title is one line of meaning however many lines it takes to show.
 */
export function ClassTitle({
  value,
  placeholder,
  onChange,
  onCommit,
}: ClassTitleProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label="Nome da aula"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className="-ml-1 mt-0.5 w-full resize-none overflow-hidden rounded-lg bg-transparent px-1 text-[22px] font-semibold leading-tight text-ink placeholder:text-ink-muted/60 focus:bg-surface-2 focus:outline-none"
    />
  );
}
