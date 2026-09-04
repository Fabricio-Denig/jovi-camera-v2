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

/**
 * O ruído de sensor dos quadros, com semente.
 *
 * Ele era `Math.random()`, e isso tornava as cenas irreprodutíveis: cada
 * geração dava um ruído diferente, e o ruído muda a máscara de marcas o
 * bastante para virar o veredito de uma cena de fronteira. Medido, a mesma
 * mesa de madeira saía "nenhuma escrita" numa geração e "só uma linha" na
 * seguinte. Um teste que muda de resposta sem o código mudar não serve para
 * decidir nada.
 */
export function ruido(semente = 20260904) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
