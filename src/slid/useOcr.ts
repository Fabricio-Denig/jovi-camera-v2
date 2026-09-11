import { useCallback, useRef, useState } from "react";
import { criarLeitor } from "../ocr/engine";
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
 * O motor vem de `ocr/engine`, compartilhado com o Scanner: dois lugares
 * configurando o mesmo Tesseract seria garantir que um dia carregariam
 * versões diferentes do mesmo WASM.
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

    let worker: Awaited<ReturnType<typeof criarLeitor>> | null = null;

    try {
      // Um trabalhador para o lote inteiro: criar um por imagem pagaria o
      // carregamento do WASM em cada momento da aula.
      worker = await criarLeitor();

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
