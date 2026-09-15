/**
 * Copia o runtime WASM do ONNX Runtime (usado pela transcrição local) para
 * public/, na variante certa — e o motivo é medido, não estético.
 *
 * Sem isto, @huggingface/transformers escolhe sozinho em tempo de execução:
 * para qualquer navegador que não seja Safari, ele pede a variante
 * "asyncify" (pensada para WebGPU) de um CDN externo (jsdelivr) — 23,5 MB
 * crus contra 12,9 MB da variante simples que este app de fato usa (só WASM,
 * sem WebGPU). Ver o comentário em `listen/whisperEngine.ts`.
 *
 * Auto-hospedar resolve as duas coisas de uma vez, no mesmo padrão que o
 * Tesseract já usa (`copy-ocr-assets.mjs`): sem depender de um CDN que uma
 * rede de sala de aula pode bloquear, e com a metade do peso.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "ort");
mkdirSync(dest, { recursive: true });

const files = [
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.wasm"],
  ["onnxruntime-web/dist/ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.mjs"],
];

for (const [from, to] of files) {
  copyFileSync(join(root, "node_modules", from), join(dest, to));
}
console.log(`Runtime ONNX copiado para public/ort (${files.length} arquivos)`);
