#!/usr/bin/env node
/**
 * Baixa os pesos do Whisper self-hospedado para `public/models/`, na
 * estrutura exata que `@huggingface/transformers` espera de
 * `env.localModelPath` (confirmado lendo o código-fonte da biblioteca, não
 * suposto): `<localModelPath>/<model_id>/<arquivo>`, com os dois arquivos
 * ONNX dentro de `onnx/`.
 *
 * **QUAIS modelos não se decide aqui.** `src/listen/whisperModels.json` é a
 * fonte única, lida também por `src/listen/whisperEngine.ts` — quem carrega e
 * quem baixa nunca mais podem discordar. Este arquivo já teve uma constante
 * `MODEL_ID` própria, e foi exatamente isso que quebrou a transcrição em
 * aparelho real: o motor passou a pedir `whisper-base`, este script continuou
 * baixando `whisper-tiny`, e como o motor roda com `allowRemoteModels=false`
 * (nada de CDN durante a aula, de propósito), TODOS os pesos responderam 404
 * no GitHub Pages. Resultado no celular: zero transcrição, duas vezes.
 *
 * **Os dois modelos, não só o primário.** O fallback existe para o celular da
 * banca: se o `base` não criar a sessão ONNX naquele aparelho (memória, uma
 * versão de WebAssembly diferente), o motor cai sozinho para o `tiny`, que já
 * rodou em aparelho real. Uma transcrição imperfeita vale mais que nenhuma, e
 * os ~42MB a mais só custam espaço no artefato do Pages — o navegador baixa
 * um modelo só, o que de fato carregar.
 *
 * Por que este passo existe. Publicar os bytes junto do site resolve dois
 * problemas de uma vez: o celular da banca nunca depende de alcançar o
 * Hugging Face Hub (só o próprio domínio do site, que já precisa alcançar
 * para tudo o mais), e o download não concorre com a inferência pelo tempo do
 * usuário — ele já aconteceu antes do deploy.
 *
 * Por que não faz parte de `predev`/`prebuild`. São ~119MB somados; ninguém
 * precisa disso para mexer no front. `public/models` é gerado e gitignored,
 * do mesmo jeito que `public/ort` — sem ele o build ainda funciona, só a
 * transcrição não teria onde buscar os pesos (e o motor diz isso em voz alta
 * agora, ver a checagem de pesos em `whisperEngine.ts`, em vez de falhar com
 * um erro de biblioteca sem pista nenhuma).
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const manifesto = JSON.parse(
  await readFile(path.join(RAIZ, "src", "listen", "whisperModels.json"), "utf8"),
);

/** Primário e fallback, sem repetir se algum dia forem o mesmo. */
const MODELOS = [...new Set([manifesto.primario, manifesto.fallback])];

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
const FILES = manifesto.arquivos;

/**
 * "main" por enquanto: o repositório não tem um commit conhecido fixado
 * ainda. O run de CI imprime a revisão resolvida no log — trocar aqui por
 * esse commit depois de observado é o próximo passo para um pin de verdade.
 */
const REVISION = "main";

async function jaExiste(dest) {
  try {
    const info = await stat(dest);
    return info.size > 0;
  } catch {
    return false;
  }
}

async function baixar(modelo, file) {
  const dest = path.join(RAIZ, "public", "models", modelo, file);
  await mkdir(path.dirname(dest), { recursive: true });

  // O cache do GitHub Actions (ver o workflow) restaura `public/models`
  // entre builds — não baixar de novo o que já está aqui.
  if (await jaExiste(dest)) {
    const info = await stat(dest);
    console.log(`[modelo] já em cache: ${modelo}/${file} (${info.size} bytes)`);
    return;
  }

  const url = `https://huggingface.co/${modelo}/resolve/${REVISION}/${file}`;
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
  console.log(`[modelo] ok: ${modelo}/${file} (${buf.byteLength} bytes)`);
}

for (const modelo of MODELOS) {
  for (const file of FILES) {
    await baixar(modelo, file);
  }
}

/*
 * A conferência final, e não é cerimônia: este script rodou "com sucesso" no
 * CI que publicou o defeito desta rodada — ele baixou tudo que sabia baixar,
 * e o que faltava era o modelo que nem estava na lista dele. Agora a lista
 * vem do mesmo JSON que o motor lê, e esta checagem exige que cada arquivo
 * exista de fato com bytes dentro antes de o build seguir. O cache do
 * GitHub Actions restaurando uma pasta pela metade cai aqui também.
 *
 * Falhar o build é de propósito. Um site publicado sem os pesos é pior que
 * um deploy que não acontece: o primeiro só aparece no celular, na frente da
 * banca; o segundo aparece no log, agora.
 */
const faltando = [];
for (const modelo of MODELOS) {
  for (const file of FILES) {
    const dest = path.join(RAIZ, "public", "models", modelo, file);
    if (!(await jaExiste(dest))) faltando.push(`${modelo}/${file}`);
  }
}
if (faltando.length > 0) {
  console.error(
    `[modelo] FALTANDO depois do download (o site não pode ser publicado assim):\n  ${faltando.join("\n  ")}`,
  );
  process.exit(1);
}

console.log(
  `[modelo] pronto e conferido: ${MODELOS.join(", ")} em ${path.join(RAIZ, "public", "models")}`,
);
