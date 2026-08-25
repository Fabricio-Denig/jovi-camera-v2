import { useMemo, useState } from "react";
import {
  SECTION_LABELS,
  SECTION_ORDER,
  getMode,
  searchModes,
  type CameraMode,
} from "./modes";
import { BottomSheet } from "../shared/ui/BottomSheet";

interface ModesSheetProps {
  open: boolean;
  activeModeId: string;
  /** Mode the contextual engine is recommending right now, if any. */
  suggestedModeId: string | null;
  onSelect: (modeId: string) => void;
  onClose: () => void;
}

/**
 * The full catalog. Its job is discovery, not inventory: every entry says what
 * it does and when to reach for it, search matches how people actually name
 * things, and whatever the camera is recommending right now sits at the top.
 */
export function ModesSheet({
  open,
  activeModeId,
  suggestedModeId,
  onSelect,
  onClose,
}: ModesSheetProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchModes(query), [query]);
  const searching = query.trim().length > 0;

  return (
    <BottomSheet
      open={open}
      title="Modos"
      subtitle="Escolha como a câmera captura"
      onClose={onClose}
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Busque por nome ou situação — “aula”, “escuro”…"
        aria-label="Buscar modo"
        className="mb-4 w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted/70 focus:border-accent focus:outline-none"
      />

      {searching ? (
        results.length > 0 ? (
          <ModeList
            modes={results}
            activeModeId={activeModeId}
            onSelect={onSelect}
          />
        ) : (
          <div className="py-8 text-center">
            <p className="text-sm text-ink">Nenhum modo encontrado</p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Tente descrever a situação, como “pouca luz” ou “documento”.
            </p>
          </div>
        )
      ) : (
        <>
          {suggestedModeId && (
            <section className="mb-5">
              <SectionTitle>Sugerido agora</SectionTitle>
              <ModeRow
                mode={getMode(suggestedModeId)}
                active={suggestedModeId === activeModeId}
                suggested
                onSelect={() => onSelect(suggestedModeId)}
              />
            </section>
          )}

          {SECTION_ORDER.map((section) => {
            const modes = results.filter((mode) => mode.section === section);
            if (modes.length === 0) return null;
            return (
              <section key={section} className="mb-5">
                <SectionTitle>{SECTION_LABELS[section]}</SectionTitle>
                <ModeList
                  modes={modes}
                  activeModeId={activeModeId}
                  onSelect={onSelect}
                />
              </section>
            );
          })}
        </>
      )}
    </BottomSheet>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
      {children}
    </h3>
  );
}

function ModeList({
  modes,
  activeModeId,
  onSelect,
}: {
  modes: CameraMode[];
  activeModeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {modes.map((mode) => (
        <li key={mode.id}>
          <ModeRow
            mode={mode}
            active={mode.id === activeModeId}
            onSelect={() => onSelect(mode.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function ModeRow({
  mode,
  active,
  suggested = false,
  onSelect,
}: {
  mode: CameraMode;
  active: boolean;
  suggested?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left active:opacity-80 ${
        active || suggested
          ? "border-accent bg-accent-soft"
          : "border-line bg-surface-2"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-ink">{mode.label}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode.fidelity !== "real" && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-ink-muted">
              {mode.fidelity === "partial" ? "parcial" : "prévia"}
            </span>
          )}
          {active && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-ink">
              ativo
            </span>
          )}
        </div>
      </div>
      <p className="mt-1 text-[13px] text-ink-muted">{mode.summary}</p>
      <p className="mt-1.5 text-[12px] text-ink-muted/80">{mode.whenToUse}</p>
    </button>
  );
}
