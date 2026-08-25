import type { CameraStatus } from "../types/camera";

interface PermissionGateProps {
  status: CameraStatus;
  errorMessage: string | null;
  onRequest: () => void;
}

/**
 * Full-screen state shown before the camera is live: first request, denied,
 * or unsupported/error. Keeps the "golden path" alive even when the browser
 * says no — the user always gets an explanation and a retry action instead
 * of a blank screen.
 */
export function PermissionGate({
  status,
  errorMessage,
  onRequest,
}: PermissionGateProps) {
  const isDenied = status === "denied";
  const isError = status === "unsupported" || status === "error";

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-canvas px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <CameraIcon />
      </div>

      <div className="space-y-2">
        <h1 className="text-lg font-semibold text-ink">
          {isDenied
            ? "Permissão de câmera negada"
            : isError
              ? "Não foi possível acessar a câmera"
              : "Jovi Camera precisa da sua câmera"}
        </h1>
        <p className="max-w-xs text-sm text-ink-muted">
          {isDenied
            ? "Ative a permissão de câmera nas configurações do navegador e tente novamente."
            : isError
              ? errorMessage
              : "Usada só para o preview ao vivo e para as fotos e vídeos que você capturar. Tudo fica salvo no seu dispositivo."}
        </p>
      </div>

      <button
        type="button"
        onClick={onRequest}
        className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-ink active:opacity-80"
      >
        {status === "requesting"
          ? "Solicitando…"
          : isDenied || isError
            ? "Tentar novamente"
            : "Permitir câmera"}
      </button>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      width="28"
      height="28"
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
