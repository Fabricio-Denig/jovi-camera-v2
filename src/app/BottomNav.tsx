import type { ReactNode } from "react";
import type { ShellTab } from "../state/cameraState";

interface BottomNavProps {
  tab: ShellTab;
  sheetOpen: boolean;
  onSelect: (tab: ShellTab) => void;
}

const ITEMS: { id: ShellTab; label: string; icon: ReactNode }[] = [
  { id: "modes", label: "Modos", icon: <ModesIcon /> },
  { id: "camera", label: "Câmera", icon: <CameraIcon /> },
  { id: "gallery", label: "Galeria", icon: <GalleryIcon /> },
];

/** Persistent three-tab navigation from the Figma v2 frames. */
export function BottomNav({ tab, sheetOpen, onSelect }: BottomNavProps) {
  return (
    <nav className="z-50 flex shrink-0 items-stretch border-t border-line bg-canvas pb-[env(safe-area-inset-bottom)]">
      {ITEMS.map((item) => {
        // "Modos" is a panel rather than a destination, so it reads as active
        // whenever that panel is open.
        const active =
          item.id === "modes" ? sheetOpen : tab === item.id && !sheetOpen;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 ${
              active ? "text-accent" : "text-ink-muted"
            }`}
          >
            {item.icon}
            <span className="text-[11px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ModesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.8" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  );
}
