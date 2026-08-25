/**
 * Copies the Tesseract runtime into public/ so OCR works entirely offline.
 *
 * The default CDN was measured as unreachable from restricted networks, and a
 * demo that depends on venue wifi to reach its own climax is a demo that fails
 * on stage. These files are generated at build time rather than committed —
 * they are a few megabytes of vendor binary, not project source.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "tesseract");
mkdirSync(dest, { recursive: true });

const files = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  // Several core builds: the browser picks the fastest one it supports.
  ["tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm", "tesseract-core-relaxedsimd-lstm.wasm"],
  ["tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-relaxedsimd-lstm.wasm.js"],
  // Compact Portuguese model: 1.4 MB against 6.7 MB for the standard one.
  ["@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz", "por.traineddata.gz"],
];

for (const [from, to] of files) {
  copyFileSync(join(root, "node_modules", from), join(dest, to));
}
console.log(`OCR assets copiados para public/tesseract (${files.length} arquivos)`);
