import { useCallback, useRef, useState } from "react";
import type { SlidCapture } from "./useSlidSession";

export interface OcrPage {
  captureId: string;
  atMs: number;
  text: string;
  confidence: number;
}

export type OcrStatus = "idle" | "running" | "done" | "error";

interface UseOcrResult {
  status: OcrStatus;
  pages: OcrPage[];
  progress: number;
  errorMessage: string | null;
  run: (captures: SlidCapture[]) => Promise<void>;
}

/**
 * Text extraction for a finished session.
 *
 * Runs on demand, never during the session: OCR and a live viewfinder compete for the
 * same CPU, and the capture pipeline always wins that argument.
 *
 * The engine, the WASM core and the language model are all served from this
 * origin. Tesseract's default CDN was measured as unreachable behind a
 * restricted network, and the summary is the climax of the demo — it cannot
 * depend on the venue's wifi.
 */
export function useOcr(): UseOcrResult {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [pages, setPages] = useState<OcrPage[]>([]);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async (captures: SlidCapture[]) => {
    if (runningRef.current || captures.length === 0) return;
    runningRef.current = true;
    setStatus("running");
    setProgress(0);
    setErrorMessage(null);

    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null =
      null;

    try {
      // Loaded lazily so the ~4 MB runtime never touches the camera's startup.
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("por", 1, {
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/",
        langPath: "/tesseract/",
        gzip: true,
      });

      const results: OcrPage[] = [];
      for (let i = 0; i < captures.length; i++) {
        const capture = captures[i];
        const { data } = await worker.recognize(capture.blob);
        results.push({
          captureId: capture.id,
          atMs: capture.atMs,
          text: data.text.trim(),
          confidence: data.confidence ?? 0,
        });
        setProgress((i + 1) / captures.length);
        setPages([...results]);
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage(
        "Não foi possível extrair o texto neste dispositivo. As capturas continuam disponíveis.",
      );
    } finally {
      await worker?.terminate().catch(() => {});
      runningRef.current = false;
    }
  }, []);

  return { status, pages, progress, errorMessage, run };
}
