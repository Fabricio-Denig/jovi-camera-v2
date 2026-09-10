import type { ContentBounds } from "../slid/frameAnalysis";

/**
 * Onde está o documento no quadro.
 *
 * Isto **não** é o detector do SliD e não toca nele. São perguntas diferentes:
 * o SliD pergunta "isto é uma aula acontecendo?" sobre uma cena que muda ao
 * longo de uma hora; aqui a pergunta é "onde está a folha?" num instante. A
 * única coisa emprestada é `sampleFrame`, que só lê pixels.
 *
 * O método é deliberadamente simples, e a simplicidade é a decisão:
 *
 * Uma folha é uma **região clara sobre um fundo mais escuro**. Não é preciso
 * achar quatro cantos em perspectiva para recortar bem uma folha razoavelmente
 * enquadrada — e tentar isso sem uma biblioteca de visão computacional produz
 * cantos que dançam, que é pior do que uma caixa honesta.
 *
 * Duas coisas que a primeira versão errou, e que definem o método:
 *
 * **A folha é escrita.** Medir a maior corrida clara *contígua* por linha
 * perdia toda folha com texto: a tinta corta a corrida. O que vale é a
 * *extensão* do claro na linha — do primeiro ao último pixel claro — com uma
 * densidade mínima dentro dela. Uma folha escrita é clara com riscos escuros;
 * a densidade continua alta, a corrida contígua não.
 *
 * **A folha tem borda.** Sem exigir fundo mais escuro em volta, uma parede
 * rebocada e um carpete claro viravam documentos — eles são claros de ponta a
 * ponta do quadro. O que separa um documento de uma superfície clara é
 * justamente haver algo mais escuro em volta dele.
 */
export interface DocumentRegion {
  bounds: ContentBounds;
  /** 0..1 — quanto da caixa é de fato claro. Vira o texto que o usuário lê. */
  confidence: number;
}

/** Abaixo disto a caixa não é retângulo de papel, é um borrão claro qualquer. */
const MIN_FILL = 0.72;
/** Uma folha ocupa uma parte séria do quadro; menos que isso é um objeto. */
const MIN_AREA = 0.1;
/** E se ocupa quase tudo, não há borda para recortar — a foto já é o documento. */
const MAX_AREA = 0.97;
/** Uma linha só conta como "linha de papel" com claro nesta extensão. */
const MIN_ROW_RUN = 0.28;
/** E o claro precisa dominar a extensão: senão é vão entre coisas claras. */
const MIN_ROW_DENSITY = 0.55;
/**
 * Quanto o dentro precisa ser mais claro que o fora, em níveis de cinza.
 *
 * É esta prova que separa uma folha de uma parede: as duas são claras, mas só
 * a folha tem algo mais escuro em volta. Sem ela, parede rebocada e carpete
 * claro eram detectados como documento com 92 % e 96 % de confiança.
 */
const MIN_CONTRAST = 16;
/**
 * E o degrau de brilho na própria borda da caixa.
 *
 * O contraste médio sozinho não basta: uma parede com vinheta é mais clara no
 * meio que nos cantos, e isso passa como "dentro mais claro que fora" com 84 %
 * de confiança. O que a vinheta não tem é **borda**. Um documento muda de
 * brilho em dois ou três pixels; a vinheta muda ao longo do quadro inteiro.
 *
 * Medido em duas faixas finas, uma de cada lado do limite, nos quatro lados —
 * e o que vale é **o lado mais nítido**, não a mediana. Uma folha bem
 * enquadrada frequentemente sangra para fora do quadro pelos lados, e ali não
 * existe borda para medir. Medido nas cenas de referência, o maior degrau:
 *
 *   folha A4 escrita   24.6      papel amassado    3.9
 *   folha A4 densa     13.5      parede rebocada   2.1
 *   caderno escrito     7.8      carpete           1.0
 *
 * Seis separa com folga de duas vezes. O papel amassado fica de fora junto, e
 * isso é aceito: sombra de vinco quebra qualquer borda, ele está fora do caso
 * declarado — folha razoavelmente enquadrada — e recusar é a falha barata,
 * porque sobra o ajuste manual.
 */
const MIN_EDGE_STEP = 6;
/** Espessura das faixas comparadas, em pixels da amostra. */
const EDGE_BAND = 2;

export function findDocument(
  gray: Uint8Array,
  width: number,
  height: number,
): DocumentRegion | null {
  if (gray.length !== width * height) return null;

  const limiar = limiarDeFundo(gray);
  // Sem separação de verdade entre claro e escuro, não há folha contra fundo.
  if (limiar <= 0) return null;

  // A corrida clara mais longa de cada linha, e onde ela começa e termina.
  const inicios: number[] = [];
  const fins: number[] = [];
  const linhaEhPapel: boolean[] = new Array(height).fill(false);
  const minRun = Math.round(width * MIN_ROW_RUN);

  for (let y = 0; y < height; y++) {
    let primeiro = -1;
    let ultimo = -1;
    let claros = 0;
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] >= limiar) {
        if (primeiro < 0) primeiro = x;
        ultimo = x;
        claros++;
      }
    }
    if (primeiro < 0) continue;
    const extensao = ultimo - primeiro + 1;
    if (extensao >= minRun && claros / extensao >= MIN_ROW_DENSITY) {
      linhaEhPapel[y] = true;
      inicios.push(primeiro);
      fins.push(ultimo + 1);
    }
  }

  // O bloco contíguo mais alto de linhas de papel: uma folha é uma coisa só,
  // não linhas claras espalhadas pelo quadro.
  let melhorTopo = -1;
  let melhorAltura = 0;
  let topo = -1;
  for (let y = 0; y <= height; y++) {
    if (y < height && linhaEhPapel[y]) {
      if (topo < 0) topo = y;
    } else if (topo >= 0) {
      if (y - topo > melhorAltura) {
        melhorAltura = y - topo;
        melhorTopo = topo;
      }
      topo = -1;
    }
  }
  if (melhorTopo < 0 || melhorAltura < height * 0.2) return null;

  // Mediana das bordas nas linhas do bloco — resiste a um objeto claro solto.
  const esquerdas: number[] = [];
  const direitas: number[] = [];
  let i = 0;
  for (let y = 0; y < height; y++) {
    if (!linhaEhPapel[y]) continue;
    if (y >= melhorTopo && y < melhorTopo + melhorAltura) {
      esquerdas.push(inicios[i]);
      direitas.push(fins[i]);
    }
    i++;
  }
  const x0 = mediana(esquerdas);
  const x1 = mediana(direitas);
  if (x1 - x0 < width * MIN_ROW_RUN) return null;

  const bounds: ContentBounds = {
    x: x0 / width,
    y: melhorTopo / height,
    width: (x1 - x0) / width,
    height: melhorAltura / height,
  };
  const area = bounds.width * bounds.height;
  if (area < MIN_AREA || area > MAX_AREA) return null;

  // Quanto da caixa é realmente claro, e quanto ela é mais clara que o resto.
  let claros = 0;
  let dentroTotal = 0;
  let somaDentro = 0;
  let somaFora = 0;
  let foraTotal = 0;
  for (let y = 0; y < height; y++) {
    const naFaixa = y >= melhorTopo && y < melhorTopo + melhorAltura;
    for (let x = 0; x < width; x++) {
      const v = gray[y * width + x];
      if (naFaixa && x >= x0 && x < x1) {
        dentroTotal++;
        somaDentro += v;
        if (v >= limiar) claros++;
      } else {
        foraTotal++;
        somaFora += v;
      }
    }
  }
  const fill = dentroTotal > 0 ? claros / dentroTotal : 0;
  if (fill < MIN_FILL) return null;

  // A prova da borda: sem fundo mais escuro em volta, é superfície, não folha.
  if (foraTotal === 0) return null;
  const contraste = somaDentro / dentroTotal - somaFora / foraTotal;
  if (contraste < MIN_CONTRAST) return null;

  // E a prova do degrau: a borda precisa ser borda, não um esmaecer lento.
  const base = melhorTopo;
  const fim = melhorTopo + melhorAltura;
  const degraus = [
    faixa(gray, width, height, x0, x1, base, base + EDGE_BAND) -
      faixa(gray, width, height, x0, x1, base - EDGE_BAND, base),
    faixa(gray, width, height, x0, x1, fim - EDGE_BAND, fim) -
      faixa(gray, width, height, x0, x1, fim, fim + EDGE_BAND),
    faixa(gray, width, height, x0, x0 + EDGE_BAND, base, fim) -
      faixa(gray, width, height, x0 - EDGE_BAND, x0, base, fim),
    faixa(gray, width, height, x1 - EDGE_BAND, x1, base, fim) -
      faixa(gray, width, height, x1, x1 + EDGE_BAND, base, fim),
  ].filter((d) => Number.isFinite(d));
  // O lado mais nítido, e não a mediana: basta uma borda visível para provar
  // que há um objeto ali, e uma folha costuma sangrar para fora pelos lados.
  if (degraus.length === 0 || Math.max(...degraus) < MIN_EDGE_STEP) return null;

  return { bounds, confidence: fill };
}

/**
 * O limiar que separa o papel do que está em volta.
 *
 * Otsu foi a primeira escolha e falha exatamente no caso que importa: quando a
 * folha ocupa a maior parte do quadro, a variância entre classes é maximizada
 * *dentro do papel*, separando a parte iluminada da parte na sombra. Medido no
 * navegador sobre uma folha A4 escrita, Otsu devolveu 200 num quadro cujo
 * fundo está em 110 e cujo papel está em 205 — ele partiu o papel ao meio.
 *
 * O meio do caminho entre os percentis 5 e 95 não tem esse problema: ele
 * pergunta "onde fica o meio entre o mais escuro e o mais claro desta cena",
 * que é a pergunta certa para um objeto claro sobre um fundo mais escuro, e
 * não muda de resposta conforme a folha ocupa mais ou menos quadro.
 */
function limiarDeFundo(gray: Uint8Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  const percentil = (p: number) => {
    const alvo = total * p;
    let acumulado = 0;
    for (let i = 0; i < 256; i++) {
      acumulado += hist[i];
      if (acumulado >= alvo) return i;
    }
    return 255;
  };
  const escuro = percentil(0.05);
  const claro = percentil(0.95);
  // Sem separação real entre escuro e claro não há folha contra fundo.
  if (claro - escuro < 30) return 0;
  return (escuro + claro) / 2;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = ordenado.length >> 1;
  return ordenado.length % 2
    ? ordenado[meio]
    : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

/** Brilho médio de um retângulo, ou NaN quando ele cai fora do quadro. */
function faixa(
  gray: Uint8Array,
  width: number,
  height: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): number {
  let soma = 0;
  let n = 0;
  for (let y = Math.max(0, Math.round(y0)); y < Math.min(height, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x < Math.min(width, Math.round(x1)); x++) {
      soma += gray[y * width + x];
      n++;
    }
  return n > 0 ? soma / n : NaN;
}
