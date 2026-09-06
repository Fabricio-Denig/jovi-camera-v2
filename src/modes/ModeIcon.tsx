/**
 * Um glifo por modo, 32×32 como no Figma (`337:443`).
 *
 * Traço e não preenchimento, para que um card ativo possa trocar só a cor sem
 * o ícone mudar de peso. Cada um desenha o que o modo faz, e não uma câmera
 * genérica — num painel de dezesseis cards, dezesseis câmeras iguais não
 * ajudam ninguém a encontrar nada.
 */
export function ModeIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {GLIFOS[id] ?? GLIFOS.photo}
    </svg>
  );
}

const GLIFOS: Record<string, React.ReactNode> = {
  photo: (
    <>
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-2h8.4l1.1 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="6" width="12.5" height="12" rx="2" />
      <path d="m15.5 10.5 5.5-3v9l-5.5-3z" />
    </>
  ),
  // A lousa: é o que o SliD olha.
  slid: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="1.6" />
      <path d="M12 17v3M7.5 8h9M7.5 12h5.5" />
    </>
  ),
  portrait: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M3 6.5V4h2.5M21 6.5V4h-2.5" />
    </>
  ),
  night: (
    <>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2" />
      <path d="M17 3.5v3M15.5 5h3" />
    </>
  ),
  food: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.6" />
    </>
  ),
  microfilm: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 12h18M3 8.5h4M3 15.5h4M17 8.5h4M17 15.5h4" />
    </>
  ),
  "slow-motion": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
      <path d="M12 3.5v1.5M12 19v1.5" />
    </>
  ),
  timelapse: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 1.8" />
    </>
  ),
  panorama: (
    <>
      <path d="M2.5 7.5c6-1.6 13-1.6 19 0v9c-6 1.6-13 1.6-19 0z" />
      <path d="m6.5 14 3.5-3.5 2.5 2.5 2-2 3 3" />
    </>
  ),
  pro: (
    <>
      <path d="M5 4v16M12 4v16M19 4v16" />
      <circle cx="5" cy="9" r="2" />
      <circle cx="12" cy="14.5" r="2" />
      <circle cx="19" cy="7.5" r="2" />
    </>
  ),
  "high-res": (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17" />
    </>
  ),
  supermoon: (
    <>
      <circle cx="10.5" cy="12.5" r="6.5" />
      <path d="M18.5 4.5v3M17 6h3M20 12.5v2M19 13.5h2" />
    </>
  ),
  "dual-view": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M12 5v14" />
      <circle cx="7.5" cy="12" r="1.8" />
      <circle cx="16.5" cy="12" r="1.8" />
    </>
  ),
  snapshot: <path d="m13 2.5-8 11h6l-1 8 8-11h-6z" />,
  scanner: (
    <>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="M7.5 12h9" />
    </>
  ),
};
