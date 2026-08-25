import { useState } from "react";
import type { CameraDiagnostics } from "./useCamera";
import type { CameraFacing, CameraStatus } from "../types/camera";

interface DebugPanelProps {
  status: CameraStatus;
  facing: CameraFacing;
  diagnostics: CameraDiagnostics;
  lastError: string | null;
}

/**
 * On-screen diagnostics. A phone has no reachable console during a field test,
 * so the pipeline has to report its own state: track status, real video
 * dimensions, and which media events actually fired.
 *
 * Temporary — remove once the camera is confirmed working on real hardware.
 */
export function DebugPanel({
  status,
  facing,
  diagnostics,
  lastError,
}: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  const live =
    diagnostics.trackState === "live" && diagnostics.videoSize !== "—";

  return (
    // pointer-events-none on the wrapper: this panel spans the full width and
    // sits above the camera chrome, so without it the flip control underneath
    // becomes untappable. Only the panel's own controls take pointer events.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-3 pt-[max(64px,calc(env(safe-area-inset-top)+52px))]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 font-mono text-[11px] text-white"
      >
        <span
          className={
            live
              ? "size-2 rounded-full bg-emerald-400"
              : "size-2 rounded-full bg-red-400"
          }
        />
        debug {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="pointer-events-auto mt-2 max-h-[60vh] overflow-y-auto rounded-xl bg-black/85 p-3 font-mono text-[10.5px] leading-relaxed text-white">
          <Row label="status" value={status} />
          <Row label="facing pedido" value={facing} />
          <Row label="facing aplicado" value={diagnostics.appliedFacing} />
          <Row label="tracks" value={String(diagnostics.trackCount)} />
          <Row label="track.readyState" value={diagnostics.trackState} />
          <Row label="track.label" value={diagnostics.trackLabel} />
          <Row label="video size" value={diagnostics.videoSize} />
          <Row label="video.readyState" value={String(diagnostics.readyState)} />
          <Row label="paused" value={String(diagnostics.paused)} />
          <Row label="áudio no stream" value={String(diagnostics.hasAudio)} />
          <Row label="secure context" value={String(window.isSecureContext)} />
          <Row label="protocolo" value={window.location.protocol} />
          {lastError && <Row label="último erro" value={lastError} />}

          <div className="mt-2 border-t border-white/20 pt-2 text-white/70">
            {diagnostics.log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/50">{label}</span>
      <span className="truncate text-right">{value}</span>
    </div>
  );
}
