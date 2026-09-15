#!/usr/bin/env node
/**
 * Baixa os pesos do Whisper self-hospedado para `public/models/`, na
 * estrutura exata que `@huggingface/transformers` espera de
 * `env.localModelPath` (confirmado lendo o código-fonte da biblioteca, não
 * suposto): `<localModelPath>/<model_id>/<arquivo>`, com os dois arquivos
 * ONNX dentro de `onnx/`.
 *
 * Por que este passo existe, e por que só roda em CI. O ambiente de
 * desenvolvimento onde este projeto é trabalhado bloqueia huggingface.co por
 * política de rede (ver o comentário em `whisperEngine.ts`) — só o runner do
 * GitHub Actions tem acesso real. Rodar isto ali, uma vez, e publicar os
 * bytes junto do site resolve dois problemas ao mesmo tempo: o celular da
 * banca nunca depende de alcançar o Hugging Face Hub (só o próprio domínio
 * do site, que já precisa alcançar para tudo o mais), e o download não
 * concorre com a inferência pelo tempo do usuário — ele já aconteceu antes
 * do deploy.
 *
 * Por que não faz parte de `predev`/`prebuild`. Rodar isto localmente, neste
 * mesmo ambiente restrito, quebraria `npm run build`/`npm run dev` para
 * qualquer pessoa sem acesso a huggingface.co. `public/models` é gerado e
 * gitignored, do mesmo jeito que `public/ort` — sem ele, o build ainda
 * funciona; só a transcrição em si não teria onde buscar os pesos
 * localmente (o motor cairia para a URL remota, ver `whisperEngine.ts`).
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Ajustar aqui, em um lugar só, se `whisper-base` provar necessário depois
    de um teste real — mesma constante que `whisperEngine.ts` usa. */
const MODEL_ID = "Xenova/whisper-tiny";

/**
 * "main" por enquanto: o repositório não tem um commit conhecido fixado
 * ainda porque baixar a árvore de arquivos para descobrir o SHA exato
 * também exige a mesma rede bloqueada nesta bancada. O primeiro run real
 * (em CI) imprime a revisão resolvida no log — trocar aqui por esse commit
 * depois de observado é o próximo passo para um pin de verdade.
 */
const REVISION = "main";

/**
 * Exatamente os arquivos que `pipeline("automatic-speech-recognition",
 * MODEL_ID, { dtype: "q8", device: "wasm" })` busca — confirmado lendo
 * `node_modules/@huggingface/transformers/dist/transformers.web.js`, não
 * suposto pelo padrão comum de outros repositórios HF:
 *
 * - `DEFAULT_DEVICE_DTYPE_MAPPING`/`DATA_TYPES.q8` → sufixo `_quantized`.
 * - `MODEL_TYPES.Seq2Seq.sessions()` → `encoder_model` +
 *   `decoder_model_merged`, os dois dentro de `onnx/`.
 * - `get_tokenizer_files()` → só `tokenizer.json` + `tokenizer_config.json`
 *   (a biblioteca só carrega mais arquivos quando NÃO existe
 *   `tokenizer_config.json` — não é o caso dos modelos Xenova).
 * - `WhisperProcessor` não sobrescreve `uses_processor_config` (herda
 *   `false` da classe base) → sem `processor_config.json`.
 * - `MODEL_TYPES.Seq2Seq.optional_configs` → `generation_config.json`.
 * - `FEATURE_EXTRACTOR_NAME` → `preprocessor_config.json`, sempre.
 */
const FILES = [
  "config.json",
  "generation_config.json",
  "preprocessor_config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
  // Teste temporário: o onnxruntime-web (wasm) desta versão falha ao
  // carregar QUALQUER variante "_quantized" (QDQ/MatMulNBits — ver o
  // comentário em whisperEngine.ts). fp32 (sem sufixo, sem quantização)
  // testa se o problema é mesmo a quantização ou outra coisa.
  "onnx/encoder_model.onnx",
  "onnx/decoder_model_merged.onnx",
];

const OUT_DIR = path.join(process.cwd(), "public", "models", MODEL_ID);

async function jaExiste(dest) {
  try {
    const info = await stat(dest);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function baixar(file) {
  const dest = path.join(OUT_DIR, file);
  await mkdir(path.dirname(dest), { recursive: true });

  // O cache do GitHub Actions (ver o workflow) restaura `public/models`
  // entre builds — não baixar de novo o que já está aqui.
  if (await jaExiste(dest)) {
    const info = await stat(dest);
    console.log(`[modelo] já em cache: ${file} (${info.size} bytes)`);
    return;
  }

  const url = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}/${file}`;
  console.log(`[modelo] baixando ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Falha ao baixar ${file}: HTTP ${res.status} ${res.statusText} (${url})`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new Error(`Arquivo vazio: ${file} (${url})`);
  }
  await writeFile(dest, buf);
  console.log(`[modelo] ok: ${file} (${buf.byteLength} bytes)`);
}

for (const file of FILES) {
  await baixar(file);
}

console.log(`[modelo] pronto em ${OUT_DIR}`);
