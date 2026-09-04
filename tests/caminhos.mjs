import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Onde ficam os vídeos das cenas. Elas não vão para o repositório — são
 * centenas de megabytes de quadros crus — então `render-*.mjs` as gera aqui.
 * `SLID_CENAS` sobrescreve, para rodar contra uma pasta já gerada.
 */
export const CENAS =
  process.env.SLID_CENAS ?? join(dirname(fileURLToPath(import.meta.url)), "cenas");

/** O endereço do app já publicado localmente (`npm run build && npm run preview`). */
export const APP = process.env.SLID_APP ?? "http://localhost:4173";

/** O Chromium que o Playwright instalou. */
export const CHROMIUM =
  process.env.SLID_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
